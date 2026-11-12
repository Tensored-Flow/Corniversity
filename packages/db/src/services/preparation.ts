import {
  buildConvenorSystemPrompt,
  CONVENOR_PROMPT_VERSION,
  outputSchemaText,
  ProviderError,
  parseUsdMicros,
  ROLE_CONTRACTS,
  usdToMicros,
} from "@corniversity/ai";
import {
  checkUnitDraft,
  PREPARATION_STAGES,
  preparationSummary,
  renderDraftLesson,
  type StageKey,
  stageWithinBudget,
  UnitDraftSchema,
} from "@corniversity/core/preparation/pipeline";
import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "../client";
import type { Env } from "../env";
import { isUuid } from "../ids";
import { QUEUES } from "../jobs";
import { enqueue } from "../queue";
import {
  auditEvent,
  concept,
  conceptBridge,
  course,
  courseVersion,
  instructorArtifact,
  locator,
  type PreparationIntake,
  preparationRequest,
  preparationStage,
  prerequisiteRule,
  providerRun,
  resourceRequest,
  source,
  sourceVersion,
  teachingUnit,
  unitDraft,
  unitExercise,
  unitPublication,
} from "../schema/index";
import { planRun } from "./ai-runs";
import { permittedPassagesForCourse, sourcePassagesStillPermitted } from "./library";
import { finishProviderRun, getBudgetLimits } from "./provider-config";

/**
 * The course-preparation service. A learner's intake becomes a request with a finite budget; on
 * confirmation the worker runs the stages in order, each a checkpoint with an artifact: source
 * inspection, a small shelf, concept and prerequisite mapping, syllabus and workload, exact
 * resource requirements (deterministic, from verified records), then model authoring of a bounded
 * buffer of outlined units, automatic checks, and the owner's publication. Nothing here enrols
 * anyone, browsing never starts it, and a published lesson is never replaced silently.
 */

export class PreparationError extends Error {}

/** The largest budget one request may carry; the owner's own limits still apply to every run. */
export const PREPARATION_BUDGET_CEILING_USD = 20;
export const MAX_BUFFER_UNITS = 4;

export const PreparationIntakeSchema = z.object({
  goal: z.string().trim().min(10).max(600),
  depth: z.enum(["survey", "standard", "rigorous"]),
  weeklyHours: z.number().min(1).max(40),
  preferredSources: z.string().trim().max(600).default(""),
  balance: z.enum(["more_lecture", "balanced", "more_reading"]),
  assessment: z.enum(["none", "feedback", "self_test"]),
  materials: z.string().trim().max(600).default(""),
  bufferUnits: z.number().int().min(1).max(MAX_BUFFER_UNITS),
});

export type PreparePayload = { idempotencyKey: string; ownerId: string; requestId: string };

async function currentVersion(db: DbOrTx, courseId: string) {
  const [v] = await db
    .select()
    .from(courseVersion)
    .where(and(eq(courseVersion.courseId, courseId), eq(courseVersion.isCurrent, true)))
    .limit(1);
  return v ?? null;
}

async function courseUnits(db: DbOrTx, courseVersionId: string) {
  return db.select().from(teachingUnit).where(eq(teachingUnit.courseVersionId, courseVersionId)).orderBy(asc(teachingUnit.sequence));
}

/** Creates a draft request (nothing runs until it is confirmed) with its stage plan. */
export async function createPreparationRequest(
  db: DbOrTx,
  env: Env,
  ownerId: string,
  input: { courseId: string; intake: unknown; budgetUsd: number; autoPrepare: boolean },
) {
  const intake = PreparationIntakeSchema.parse(input.intake) as PreparationIntake;
  const [c] = await db.select().from(course).where(eq(course.id, input.courseId)).limit(1);
  if (!c) throw new PreparationError("Course not found.");
  const limits = await getBudgetLimits(db, ownerId, env);
  const ceiling = Math.min(PREPARATION_BUDGET_CEILING_USD, limits.monthlyUsd);
  if (!Number.isFinite(input.budgetUsd) || input.budgetUsd <= 0 || input.budgetUsd > ceiling) {
    throw new PreparationError(
      `Choose a budget above $0 and at most $${ceiling.toFixed(2)} (your monthly limit, and at most $${PREPARATION_BUDGET_CEILING_USD}).`,
    );
  }
  const version = await currentVersion(db, c.id);
  if (!version) throw new PreparationError("This course has no current version.");
  const outlined = (await courseUnits(db, version.id)).filter((u) => u.status !== "ready").slice(0, intake.bufferUnits);
  const [request] = await db
    .insert(preparationRequest)
    .values({ ownerId, courseId: c.id, intake, budgetUsd: input.budgetUsd.toFixed(6), autoPrepare: input.autoPrepare })
    .returning();
  let sequence = 0;
  const rows: (typeof preparationStage.$inferInsert)[] = [];
  for (const stage of PREPARATION_STAGES) {
    const perUnit = stage.key === "unit_authoring" || stage.key === "checks" || stage.key === "publication";
    if (!perUnit) rows.push({ requestId: request!.id, stageKey: stage.key, unitKey: "", sequence: sequence++, role: stage.role });
    else
      for (const u of outlined)
        rows.push({ requestId: request!.id, stageKey: stage.key, unitKey: u.id, sequence: sequence++, role: stage.role });
  }
  if (rows.length) await db.insert(preparationStage).values(rows);
  await db.insert(auditEvent).values({
    ownerId,
    actor: "learner",
    action: "preparation:create",
    entity: "preparation_request",
    entityId: request!.id,
    details: { courseId: c.id, budgetUsd: input.budgetUsd, bufferUnits: intake.bufferUnits, units: outlined.map((u) => u.id) },
  });
  return request!;
}

export async function getPreparation(db: DbOrTx, ownerId: string, id: string) {
  if (!isUuid(id)) return null;
  const [request] = await db
    .select()
    .from(preparationRequest)
    .where(and(eq(preparationRequest.id, id), eq(preparationRequest.ownerId, ownerId)))
    .limit(1);
  return request ?? null;
}

export async function listPreparations(db: DbOrTx, ownerId: string, courseId?: string) {
  return db
    .select()
    .from(preparationRequest)
    .where(
      courseId
        ? and(eq(preparationRequest.ownerId, ownerId), eq(preparationRequest.courseId, courseId))
        : eq(preparationRequest.ownerId, ownerId),
    )
    .orderBy(desc(preparationRequest.createdAt));
}

/** What the request has spent or holds, in micro-dollars: its provider runs, held ones at their worst case. */
export async function preparationSpendMicros(db: DbOrTx, ownerId: string, requestId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(case when ${providerRun.status} in ('running', 'unsettled') then greatest(coalesce(${providerRun.worstCaseUsd}, 0), ${providerRun.costUsd}) else ${providerRun.costUsd} end), 0)::text`,
    })
    .from(providerRun)
    .where(and(eq(providerRun.ownerId, ownerId), eq(providerRun.purpose, `prepare:${requestId}`)));
  return parseUsdMicros(row?.total ?? "0");
}

/** Everything the preparation page shows: the request, its stages, drafts, spend and the honest summary. */
export async function preparationView(db: DbOrTx, ownerId: string, id: string) {
  const request = await getPreparation(db, ownerId, id);
  if (!request) return null;
  const stages = await db.select().from(preparationStage).where(eq(preparationStage.requestId, id)).orderBy(asc(preparationStage.sequence));
  const drafts = await db.select().from(unitDraft).where(eq(unitDraft.requestId, id)).orderBy(desc(unitDraft.createdAt));
  const version = await currentVersion(db, request.courseId);
  const units = version ? await courseUnits(db, version.id) : [];
  const locatorIds = new Set((await db.select({ id: locator.id }).from(locator)).map((l) => l.id));
  const readiness = units.map((u) => ({
    unitId: u.id,
    status: u.status,
    sourced: u.preparation.length > 0 && u.preparation.every((p) => locatorIds.has(p.locatorId)),
  }));
  const next = units.find((u) => u.status !== "ready");
  const summary = preparationSummary(readiness, units.some((u) => u.status === "ready") && (!next || units.indexOf(next) > 0));
  return { request, stages, drafts, units, summary, spentMicros: await preparationSpendMicros(db, ownerId, id) };
}

async function start(db: DbOrTx, ownerId: string, id: string, action: string): Promise<void> {
  const request = await getPreparation(db, ownerId, id);
  if (!request) throw new PreparationError("Preparation not found.");
  const runs = request.runs + 1;
  await db
    .update(preparationRequest)
    .set({
      status: "running",
      statusNote: null,
      runs,
      confirmedAt: request.confirmedAt ?? new Date(),
      cancelledAt: null,
      updatedAt: new Date(),
    })
    .where(eq(preparationRequest.id, id));
  await db
    .update(preparationStage)
    .set({ status: "pending", error: null, leaseUntil: null })
    .where(and(eq(preparationStage.requestId, id), inArray(preparationStage.status, ["cancelled", "blocked", "failed"])));
  await enqueue(db, {
    queue: QUEUES.prepareUnit,
    kind: "prepare-course",
    payload: { idempotencyKey: `prepare:${id}:run${runs}`, ownerId, requestId: id } satisfies PreparePayload,
  });
  await db.insert(auditEvent).values({
    ownerId,
    actor: "learner",
    action: `preparation:${action}`,
    entity: "preparation_request",
    entityId: id,
    details: { run: runs },
  });
}

/** Confirms a draft request within its stated budget and queues the pipeline. */
export async function confirmPreparation(db: DbOrTx, ownerId: string, id: string): Promise<void> {
  const request = await getPreparation(db, ownerId, id);
  if (!request) throw new PreparationError("Preparation not found.");
  if (request.status !== "draft") throw new PreparationError("This preparation has already been confirmed.");
  await start(db, ownerId, id, "confirm");
}

/** Resumes a cancelled, blocked or failed request: finished stages are kept and skipped. */
export async function resumePreparation(db: DbOrTx, ownerId: string, id: string): Promise<void> {
  const request = await getPreparation(db, ownerId, id);
  if (!request) throw new PreparationError("Preparation not found.");
  if (!["cancelled", "blocked", "failed"].includes(request.status))
    throw new PreparationError("Only a stopped preparation can be resumed.");
  await start(db, ownerId, id, "resume");
}

/**
 * Cancels: no further stage starts. A stage already running finishes its current step (a model
 * call already accepted by the provider cannot be recalled) and is recorded as it ends.
 */
export async function cancelPreparation(db: DbOrTx, ownerId: string, id: string): Promise<void> {
  const request = await getPreparation(db, ownerId, id);
  if (!request) throw new PreparationError("Preparation not found.");
  if (!["running", "blocked", "awaiting_review", "draft"].includes(request.status)) return;
  await db
    .update(preparationRequest)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      statusNote: "Cancelled by you. Finished stages are kept; resume to continue.",
      updatedAt: new Date(),
    })
    .where(eq(preparationRequest.id, id));
  await db
    .update(preparationStage)
    .set({ status: "cancelled" })
    .where(
      and(eq(preparationStage.requestId, id), eq(preparationStage.status, "pending"), sql`${preparationStage.stageKey} <> 'publication'`),
    );
  await db
    .insert(auditEvent)
    .values({ ownerId, actor: "learner", action: "preparation:cancel", entity: "preparation_request", entityId: id, details: {} });
}

const LEASE_MS = 15 * 60 * 1000;

/** Claims a stage for this worker: pending, or running with an expired lease (a crashed worker). */
async function claim(db: DbOrTx, stageId: string, now: Date) {
  const [row] = await db
    .update(preparationStage)
    .set({
      status: "running",
      leaseUntil: new Date(now.getTime() + LEASE_MS),
      attempts: sql`${preparationStage.attempts} + 1`,
      startedAt: now,
    })
    .where(
      and(
        eq(preparationStage.id, stageId),
        or(eq(preparationStage.status, "pending"), and(eq(preparationStage.status, "running"), lt(preparationStage.leaseUntil, now))),
      ),
    )
    .returning();
  return row ?? null;
}

async function finish(
  db: DbOrTx,
  stageId: string,
  status: "done" | "blocked" | "failed" | "skipped",
  artifact: Record<string, unknown> | null,
  error?: string,
) {
  await db
    .update(preparationStage)
    .set({ status, artifact, error: error ?? null, leaseUntil: null, finishedAt: new Date() })
    .where(eq(preparationStage.id, stageId));
}

/**
 * Runs a request's pending stages in order. Called by the worker; safe to call twice (a stage is
 * claimed under a lease, finished stages are skipped) and stops between stages once cancelled.
 */
export async function runPreparation(
  db: DbOrTx,
  env: Env,
  payload: PreparePayload,
  now = () => new Date(),
): Promise<{ status: string; ran: string[] }> {
  const ran: string[] = [];
  const request = await getPreparation(db, payload.ownerId, payload.requestId);
  if (!request) return { status: "missing", ran };
  const version = await currentVersion(db, request.courseId);
  if (!version) return { status: "failed", ran };
  const stages = await db
    .select()
    .from(preparationStage)
    .where(eq(preparationStage.requestId, request.id))
    .orderBy(asc(preparationStage.sequence));
  const artifacts = new Map<string, Record<string, unknown>>();
  for (const s of stages) if (s.status === "done" && s.artifact) artifacts.set(`${s.stageKey}:${s.unitKey}`, s.artifact);
  let blockedNote: string | null = null;

  for (const stage of stages) {
    const fresh = await getPreparation(db, payload.ownerId, request.id);
    if (!fresh || fresh.status === "cancelled") return { status: "cancelled", ran };
    if (stage.stageKey === "publication") continue;
    if (stage.status !== "pending" && stage.status !== "running") continue;
    const claimed = await claim(db, stage.id, now());
    if (!claimed) continue;
    try {
      const result = await executeStage(db, env, request, version, claimed.stageKey as StageKey, claimed.unitKey, artifacts);
      artifacts.set(`${claimed.stageKey}:${claimed.unitKey}`, result.artifact ?? {});
      await finish(db, claimed.id, result.status, result.artifact, result.error);
      ran.push(`${claimed.stageKey}${claimed.unitKey ? `:${claimed.unitKey}` : ""}`);
      if (result.status === "blocked") blockedNote ??= result.error ?? "A stage is blocked.";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await finish(db, claimed.id, "failed", null, message);
      await db
        .update(preparationRequest)
        .set({ status: "failed", statusNote: message, updatedAt: new Date() })
        .where(eq(preparationRequest.id, request.id));
      return { status: "failed", ran };
    }
  }
  const drafts = await db.select({ status: unitDraft.status }).from(unitDraft).where(eq(unitDraft.requestId, request.id));
  const status = blockedNote ? "blocked" : drafts.some((d) => d.status === "checked") ? "awaiting_review" : "completed";
  await db
    .update(preparationRequest)
    .set({
      status,
      statusNote:
        blockedNote ??
        (status === "awaiting_review"
          ? "Drafts are ready for you to read. Nothing is published until you publish it."
          : "All stages finished."),
      updatedAt: new Date(),
    })
    .where(eq(preparationRequest.id, request.id));
  return { status, ran };
}

type StageResult = { status: "done" | "blocked" | "skipped"; artifact: Record<string, unknown> | null; error?: string };

async function executeStage(
  db: DbOrTx,
  env: Env,
  request: typeof preparationRequest.$inferSelect,
  version: typeof courseVersion.$inferSelect,
  key: StageKey,
  unitId: string,
  artifacts: Map<string, Record<string, unknown>>,
): Promise<StageResult> {
  switch (key) {
    case "source_inspection": {
      const ids = [...new Set([...version.primarySourceIds, ...version.supplementalSourceIds])];
      const rows = ids.length
        ? await db
            .select({ source, version: sourceVersion })
            .from(source)
            .innerJoin(sourceVersion, eq(sourceVersion.id, source.currentVersionId))
            .where(inArray(source.id, ids))
        : [];
      const counts = ids.length
        ? await db
            .select({ versionId: locator.sourceVersionId, n: sql<number>`count(*)::int` })
            .from(locator)
            .where(
              inArray(
                locator.sourceVersionId,
                rows.map((r) => r.version.id),
              ),
            )
            .groupBy(locator.sourceVersionId)
        : [];
      const countOf = new Map(counts.map((c) => [c.versionId, Number(c.n)]));
      return {
        status: "done",
        artifact: {
          sources: rows.map((r) => ({
            id: r.source.id,
            title: r.source.title,
            edition: r.version.label,
            licence: r.version.licence,
            access: r.version.accessStatus,
            importAllowed: r.version.importAllowed,
            verifiedAt: r.version.verifiedAt,
            verifiedLocators: countOf.get(r.version.id) ?? 0,
            primary: version.primarySourceIds.includes(r.source.id),
          })),
          missing: ids.filter((id) => !rows.some((r) => r.source.id === id)),
        },
      };
    }
    case "primary_shelf": {
      const sources = (
        (artifacts.get("source_inspection:")?.sources as { id: string; primary: boolean; verifiedLocators: number }[]) ?? []
      ).filter((s) => s.verifiedLocators > 0);
      const spine = sources.find((s) => s.primary) ?? sources[0] ?? null;
      return {
        status: spine ? "done" : "blocked",
        artifact: {
          spine: spine?.id ?? null,
          supplements: sources
            .filter((s) => s.id !== spine?.id)
            .slice(0, 3)
            .map((s) => s.id),
        },
        error: spine
          ? undefined
          : "No verified source with located passages is registered for this course; a source must be verified first.",
      };
    }
    case "concept_mapping": {
      const teaches = version.teachesConceptIds.length
        ? await db.select({ id: concept.id, title: concept.title }).from(concept).where(inArray(concept.id, version.teachesConceptIds))
        : [];
      const rules = version.prerequisiteRuleIds.length
        ? await db.select().from(prerequisiteRule).where(inArray(prerequisiteRule.id, version.prerequisiteRuleIds))
        : [];
      const prereqConcepts = [...new Set(rules.flatMap((r) => r.alternatives.flatMap((a) => a.conceptIds)))];
      const bridges = prereqConcepts.length
        ? await db.select({ id: conceptBridge.conceptId }).from(conceptBridge).where(inArray(conceptBridge.conceptId, prereqConcepts))
        : [];
      return {
        status: "done",
        artifact: {
          teaches: teaches.map((t) => t.title),
          rules: rules.map((r) => ({ id: r.id, strength: r.strength, description: r.description })),
          bridgesPrepared: bridges.map((b) => b.id),
          bridgesMissing: prereqConcepts.filter((c) => !bridges.some((b) => b.id === c)),
        },
      };
    }
    case "syllabus_workload": {
      const units = await courseUnits(db, version.id);
      return {
        status: "done",
        artifact: {
          units: units.map((u) => ({ id: u.id, sequence: u.sequence, title: u.title, status: u.status, minutes: u.estimatedMinutes })),
          workload: version.workload,
          weeklyHours: request.intake.weeklyHours,
        },
      };
    }
    case "resource_requirements": {
      const sources =
        (artifacts.get("source_inspection:")?.sources as { id: string; title: string; importAllowed: boolean; access: string }[]) ?? [];
      const needed = sources.filter((s) => !s.importAllowed);
      const created: string[] = [];
      for (const s of needed) {
        const [existing] = await db
          .select({ id: resourceRequest.id })
          .from(resourceRequest)
          .where(
            and(
              eq(resourceRequest.ownerId, request.ownerId),
              eq(resourceRequest.courseId, request.courseId),
              eq(resourceRequest.title, s.title),
            ),
          )
          .limit(1);
        if (existing) continue;
        await db.insert(resourceRequest).values({
          ownerId: request.ownerId,
          courseId: request.courseId,
          title: s.title,
          why: `Course preparation for ${request.courseId}: this source is ${s.access.replace(/_/g, " ")} and cannot be imported automatically. Source-dependent drafting requires actual permitted passages; obtain a legitimate copy and grant permissions per action, use an appropriate open alternative, or prepare the unit directly.`,
          essential: false,
          destinationFolder: `library/${request.courseId}`,
          minPermission: "local_read",
        });
        created.push(s.id);
      }
      return { status: "done", artifact: { referenceOnly: needed.map((s) => s.id), requestsCreated: created } };
    }
    case "unit_authoring":
      return authorUnit(db, env, request, version, unitId);
    case "checks": {
      const [latest] = await db
        .select()
        .from(unitDraft)
        .where(and(eq(unitDraft.requestId, request.id), eq(unitDraft.unitId, unitId)))
        .orderBy(desc(unitDraft.version))
        .limit(1);
      if (!latest) return { status: "skipped", artifact: null, error: "No draft to check." };
      return {
        status: "done",
        artifact: {
          draftId: latest.id,
          passed: latest.checks.filter((c) => c.result === "pass").length,
          failed: latest.checks.filter((c) => c.result === "fail").map((c) => c.name),
        },
      };
    }
    case "publication":
      return { status: "skipped", artifact: null };
  }
}

async function authorUnit(
  db: DbOrTx,
  env: Env,
  request: typeof preparationRequest.$inferSelect,
  version: typeof courseVersion.$inferSelect,
  unitId: string,
): Promise<StageResult> {
  const [unit] = await db.select().from(teachingUnit).where(eq(teachingUnit.id, unitId)).limit(1);
  if (!unit) return { status: "skipped", artifact: null, error: "The unit no longer exists." };
  if (unit.status === "ready") return { status: "skipped", artifact: { reason: "already prepared" } };
  const locators = unit.preparation.length
    ? await db
        .select({ id: locator.id, label: locator.label, sourceVersionId: locator.sourceVersionId })
        .from(locator)
        .where(
          inArray(
            locator.id,
            unit.preparation.map((p) => p.locatorId),
          ),
        )
    : [];
  const passages = (
    await permittedPassagesForCourse(
      db,
      request.ownerId,
      request.courseId,
      `${unit.title} ${unit.summary} ${unit.objectives.map((o) => o.description).join(" ")}`,
      8,
      [...new Set(locators.map((l) => l.sourceVersionId))],
    )
  ).map((p) => ({
    id: p.id,
    assetId: p.asset_id,
    sourceVersionId: p.asset.sourceVersionId,
    label: `${p.asset.confirmedTitle ?? p.asset.filename}${p.asset.confirmedEdition ? ` (${p.asset.confirmedEdition})` : ""}, ${p.printed_label ? `p. ${p.printed_label}, ` : ""}PDF page ${p.physical_index + 1}`,
    text: p.text.slice(0, 2400),
    excerpted: p.text.length > 2400,
  }));
  // Source availability is checked before reserving a provider run. A bibliography alone must
  // never trigger an invented textbook adaptation or a billable attempt.
  if (!passages.length)
    return {
      status: "blocked",
      artifact: { unitId, reason: "source_text_required" },
      error:
        "No permitted source passages are available for this unit. Import the assigned source, link its edition and allow AI processing, or prepare the unit directly in the content files. A source title or section label is not enough to generate teaching.",
    };
  const previous = (await courseUnits(db, version.id))
    .filter((u) => u.status === "ready" && u.sequence < unit.sequence)
    .map((u) => u.title);
  const [c] = await db.select().from(course).where(eq(course.id, request.courseId)).limit(1);
  const system = buildConvenorSystemPrompt({
    institutionName: env.INSTITUTION_NAME,
    courseTitle: c?.title ?? request.courseId,
    courseDescription: version.description,
    unitTitle: unit.title,
    unitSummary: unit.summary,
    objectives: unit.objectives.map((o) => o.description),
    locators,
    passages,
    intake: request.intake,
    previousUnits: previous,
  });
  const instruction = "Draft this unit following the rules, as the structured unit draft.";
  const [tries] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(providerRun)
    .where(sql`${providerRun.idempotencyKey} like ${`prepare:${request.id}:${unitId}:try%`}`);
  const plan = await planRun(
    db,
    request.ownerId,
    env,
    "convenor",
    { text: `${system}\n${instruction}\n${outputSchemaText(UnitDraftSchema)}`, messages: 1 },
    {
      purpose: `prepare:${request.id}`,
      promptVersion: `${CONVENOR_PROMPT_VERSION};role:${ROLE_CONTRACTS.convenor.version}`,
      idempotencyKey: `prepare:${request.id}:${unitId}:try${Number(tries?.n ?? 0)}`,
    },
  );
  if (plan.kind === "scripted") {
    return {
      status: "blocked",
      artifact: { unitId },
      error:
        "No model is configured (scripted demo), so no unit is drafted: drafts are written only by a live model you have approved. The stages above are complete; units can also be prepared by hand in the content files.",
    };
  }
  if (plan.kind === "refused") return { status: "blocked", artifact: { unitId }, error: plan.reason };
  const budget = stageWithinBudget(
    usdToMicros(Number(request.budgetUsd)),
    (await preparationSpendMicros(db, request.ownerId, request.id)) - usdToMicros(plan.worstCaseUsd),
    usdToMicros(plan.worstCaseUsd),
  );
  if (!budget.ok) {
    // Released before anything was sent: the run never started, so it costs nothing.
    await finishProviderRun(db, plan.runId, { status: "budget_blocked", model: plan.model, error: budget.reason, attempts: [] });
    return { status: "blocked", artifact: { unitId }, error: budget.reason };
  }
  try {
    // A queued job or budget admission cannot preserve consent after it is withdrawn.
    const sourcesPermitted = await sourcePassagesStillPermitted(
      db,
      request.ownerId,
      request.courseId,
      passages.map((p) => ({ passageId: p.id, assetId: p.assetId, sourceVersionId: p.sourceVersionId })),
      [...new Set(locators.map((l) => l.sourceVersionId))],
    ).catch(() => false);
    if (!sourcesPermitted) {
      await finishProviderRun(db, plan.runId, {
        status: "blocked",
        model: plan.model,
        error: "Source availability or permission changed, or could not be checked before generation.",
        attempts: [],
      });
      return {
        status: "blocked",
        artifact: { unitId },
        error: "Source availability or permission changed, or could not be checked before generation. No text was sent.",
      };
    }
    const result = await plan.provider.generateStructured({
      role: "convenor",
      purpose: `prepare:${request.id}`,
      system,
      messages: [{ role: "user", content: instruction }],
      schema: UnitDraftSchema,
      schemaName: "UnitDraft",
      maxTokens: plan.maxTokens,
      effort: plan.effort,
    });
    await finishProviderRun(db, plan.runId, { status: "ok", model: result.model, attempts: result.attempts });
    const checks = checkUnitDraft(result.object, {
      verifiedLocatorIds: new Set(locators.map((l) => l.id)),
      suppliedPassageIds: new Set(passages.map((p) => p.id)),
      expectedObjectives: unit.objectives.map((o) => o.description),
    });
    const sourceCheck = checks.find((c) => c.name === "supplied-source-passages");
    if (sourceCheck) sourceCheck.detail += ` Supplied: ${passages.map((p) => `${p.label} [${p.id}]`).join("; ")}.`;
    const [last] = await db
      .select({ v: unitDraft.version })
      .from(unitDraft)
      .where(eq(unitDraft.unitId, unitId))
      .orderBy(desc(unitDraft.version))
      .limit(1);
    const [draft] = await db
      .insert(unitDraft)
      .values({
        requestId: request.id,
        ownerId: request.ownerId,
        unitId,
        version: (last?.v ?? 0) + 1,
        draft: result.object,
        checks,
        status: checks.every((x) => x.result === "pass") ? "checked" : "failed_checks",
        providerRunId: plan.runId,
      })
      .returning();
    return { status: "done", artifact: { draftId: draft!.id, version: draft!.version, model: result.model } };
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    await finishProviderRun(db, plan.runId, {
      status: error.billing === "uncertain" ? "unsettled" : error.kind === "refused" ? "refused" : "error",
      model: plan.model,
      error: error.message,
      attempts: error.attempts,
    });
    return { status: "blocked", artifact: { unitId }, error: error.message };
  }
}

/**
 * The owner publishes a checked draft: the unit becomes ready with the draft's lesson and
 * exercises (reference solutions instructor-only), the previous state is kept with the
 * publication, and the seeder leaves the unit alone from then on. A unit already prepared by hand
 * is never replaced by a draft. Publishing enrols nobody.
 */
export async function publishDraft(db: DbOrTx, ownerId: string, draftId: string): Promise<void> {
  if (!isUuid(draftId)) throw new PreparationError("Draft not found.");
  // One transaction, starting with a conditional claim of the draft: a failure part-way leaves
  // nothing behind, a second request for the same draft finds it no longer checked, and the unit
  // row is locked so publications of two drafts for one unit happen one after the other.
  await db.transaction(async (tx) => {
    const [draft] = await tx
      .update(unitDraft)
      .set({ status: "published", decidedAt: new Date() })
      .where(and(eq(unitDraft.id, draftId), eq(unitDraft.ownerId, ownerId), eq(unitDraft.status, "checked")))
      .returning();
    if (!draft) {
      const [existing] = await tx
        .select({ id: unitDraft.id })
        .from(unitDraft)
        .where(and(eq(unitDraft.id, draftId), eq(unitDraft.ownerId, ownerId)))
        .limit(1);
      throw new PreparationError(existing ? "Only a draft that passed every automatic check can be published." : "Draft not found.");
    }
    const [unit] = await tx.select().from(teachingUnit).where(eq(teachingUnit.id, draft.unitId)).for("update").limit(1);
    if (!unit) throw new PreparationError("The unit no longer exists.");
    const [active] = await tx
      .select()
      .from(unitPublication)
      .where(and(eq(unitPublication.unitId, unit.id), eq(unitPublication.active, true)))
      .limit(1);
    if (unit.status === "ready" && !active)
      throw new PreparationError("This unit is already prepared; a draft only fills an outlined unit.");
    const provenance = draft.checks.find((c) => c.name === "supplied-source-passages")?.evidence;
    const parsedDraft = UnitDraftSchema.safeParse(draft.draft);
    if (!provenance || !parsedDraft.success)
      throw new PreparationError(
        "This draft predates the current evidence and teaching checks. Prepare and review a new draft before publishing.",
      );
    const currentChecks = checkUnitDraft(parsedDraft.data, {
      verifiedLocatorIds: new Set(provenance.locatorIds),
      suppliedPassageIds: new Set(provenance.passageIds),
      expectedObjectives: provenance.expectedObjectives,
    });
    if (currentChecks.some((c) => c.result === "fail"))
      throw new PreparationError(
        "The draft does not pass the current evidence and teaching checks. Review its failed checks before publishing.",
      );
    const existingExercises = await tx.select({ id: unitExercise.id }).from(unitExercise).where(eq(unitExercise.unitId, unit.id));
    const d = parsedDraft.data;
    const exerciseIds = d.exercises.map((_, i) => `${unit.id}-p${draft.version}-ex${i + 1}`);
    for (const [i, e] of d.exercises.entries()) {
      await tx.insert(unitExercise).values({
        id: exerciseIds[i]!,
        unitId: unit.id,
        sequence: 100 * draft.version + i + 1,
        title: e.title,
        kind: e.kind,
        promptMarkdown: e.promptMarkdown,
        conceptIds: unit.teachesConceptIds,
        hintLadder: e.hintLadder,
        rubric: {
          version: 1,
          criteria: e.criteria.map((c, j) => ({
            id: `c${j + 1}`,
            criterion: c.criterion,
            weight: c.weight,
            levels: [
              { label: "not yet", description: "The criterion is not met." },
              { label: "met", description: "The criterion is met." },
            ],
          })),
          acceptAlternateApproaches: true,
          referenceIsExhaustive: false,
        },
        rubricVersion: 1,
        origin: "original",
        attribution: `Drafted by the AI convenor and published by the owner (draft v${draft.version}).`,
        estimatedMinutes: 30,
        progression: {
          stage: e.stage,
          difficulty: { level: "standard", basis: "Assigned by the drafting model; not a measured difficulty." },
          knownAmbiguities: [],
        },
      });
      await tx.insert(instructorArtifact).values({
        unitId: unit.id,
        exerciseId: exerciseIds[i]!,
        kind: "reference_solution",
        markdown: e.referenceSolution,
        releasePolicy: "on_request_practice",
      });
    }
    const activities = [
      {
        id: `p${draft.version}-read`,
        type: "reading" as const,
        title: `Lesson: ${unit.title}`,
        instructions:
          "Read the lesson with its sources. It was drafted by the AI convenor and published by you; mark anything that looks wrong as a question.",
        estimatedMinutes: 45,
        sourceLocatorIds: d.sourceLocatorIds,
        exerciseIds: [],
        sessionKind: "lecture" as const,
      },
      {
        id: `p${draft.version}-tutorial`,
        type: "problem" as const,
        title: `Problems: ${unit.title}`,
        instructions: "Work the exercises in order; the progression moves from familiar to unfamiliar.",
        estimatedMinutes: 60,
        sourceLocatorIds: d.sourceLocatorIds,
        exerciseIds,
        sessionKind: "tutorial" as const,
      },
    ];
    await tx
      .update(teachingUnit)
      .set({
        status: "ready",
        lessonMarkdown: renderDraftLesson(d),
        objectives: d.objectives.map((o, i) => ({ id: `p-o${i + 1}`, description: o })),
        activities,
        misconceptions: d.misconceptions.map((m) => ({ ...m, correctionLocatorIds: [] })),
        checks: [
          ...currentChecks.map((c) => ({ name: c.name, result: c.result, evidence: c.detail })),
          {
            name: "owner-review",
            result: "pass" as const,
            evidence: `Published by the owner's decision on ${new Date().toISOString().slice(0, 10)} from draft v${draft.version}; not independent academic verification.`,
          },
        ],
      })
      .where(eq(teachingUnit.id, unit.id));
    if (active) await tx.update(unitPublication).set({ active: false }).where(eq(unitPublication.id, active.id));
    await tx.insert(unitPublication).values({
      unitId: unit.id,
      draftId: draft.id,
      ownerId,
      version: draft.version,
      previous: { status: unit.status, lessonMarkdown: unit.lessonMarkdown, exerciseIds: existingExercises.map((x) => x.id) },
    });
    await tx
      .update(preparationStage)
      .set({ status: "done", artifact: { draftId: draft.id, published: true }, finishedAt: new Date() })
      .where(
        and(
          eq(preparationStage.requestId, draft.requestId),
          eq(preparationStage.stageKey, "publication"),
          eq(preparationStage.unitKey, unit.id),
        ),
      );
    await tx.insert(auditEvent).values({
      ownerId,
      actor: "learner",
      action: "preparation:publish",
      entity: "teaching_unit",
      entityId: unit.id,
      details: { draftId: draft.id, version: draft.version },
    });
  });
}

export async function rejectDraft(db: DbOrTx, ownerId: string, draftId: string, note: string): Promise<void> {
  if (!isUuid(draftId)) throw new PreparationError("Draft not found.");
  const [draft] = await db
    .update(unitDraft)
    .set({ status: "rejected", decisionNote: note.trim().slice(0, 1000) || null, decidedAt: new Date() })
    .where(and(eq(unitDraft.id, draftId), eq(unitDraft.ownerId, ownerId), inArray(unitDraft.status, ["checked", "failed_checks"])))
    .returning();
  if (!draft) throw new PreparationError("Draft not found or already decided.");
  await db
    .insert(auditEvent)
    .values({ ownerId, actor: "learner", action: "preparation:reject", entity: "unit_draft", entityId: draftId, details: { note } });
}

/** Units the seeder must leave alone because a published draft supplies them. */
export async function publishedUnitIds(db: DbOrTx): Promise<Set<string>> {
  const rows = await db.select({ unitId: unitPublication.unitId }).from(unitPublication).where(eq(unitPublication.active, true));
  return new Set(rows.map((r) => r.unitId));
}
