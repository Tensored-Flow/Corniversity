import {
  ASSESSOR_PROMPT_VERSION,
  AssessorFeedbackSchema,
  type AttemptUsage,
  buildAssessorSystemPrompt,
  numberLines,
  PRICING_VERSION,
  ProviderError,
  ROLE_CONTRACTS,
} from "@corniversity/ai";
import { runDeterministicChecks } from "@corniversity/core/checks/deterministic";
import { reconcileVerdict } from "@corniversity/core/checks/verdict";
import { annotateTurn } from "@corniversity/core/grounding/citations";
import { AssessSubmissionPayload } from "@corniversity/db/jobs";
import { assessmentRun, attempt, instructorArtifact, submissionVersion, teachingUnit, unitExercise } from "@corniversity/db/schema/index";
import { planRun } from "@corniversity/db/services/ai-runs";
import { recordEvidence } from "@corniversity/db/services/evidence";
import { type RunStatus, recordProviderRun } from "@corniversity/db/services/provider-config";
import { buildUnitEvidence } from "@corniversity/db/services/tutoring";
import { and, eq } from "drizzle-orm";
import type { HandlerContext } from "./index";

/**
 * Assessment job. Idempotent on the assessment run: a completed run is never re-graded.
 * Order of operations matters for honesty: deterministic checks first (recorded regardless of
 * what the model says), then the structured assessor call, then reconciliation rules that can
 * only lower confidence, never raise it.
 */
export async function assessHandler(ctx: HandlerContext, raw: unknown): Promise<Record<string, unknown>> {
  const payload = AssessSubmissionPayload.parse(raw);
  const db = ctx.db;

  const [run] = await db.select().from(assessmentRun).where(eq(assessmentRun.id, payload.assessmentRunId)).limit(1);
  if (!run) throw new Error(`assessment run ${payload.assessmentRunId} not found`);
  if (run.status === "feedback_ready" || run.status === "needs_review") {
    return { skipped: true, reason: "already completed" };
  }
  await db.update(assessmentRun).set({ status: "reviewing" }).where(eq(assessmentRun.id, run.id));

  const [sv] = await db.select().from(submissionVersion).where(eq(submissionVersion.id, run.submissionVersionId)).limit(1);
  if (!sv) throw new Error("submission version missing");
  const [a] = await db.select().from(attempt).where(eq(attempt.id, sv.attemptId)).limit(1);
  if (!a) throw new Error("attempt missing");
  const [exercise] = await db.select().from(unitExercise).where(eq(unitExercise.id, a.exerciseId)).limit(1);
  if (!exercise) throw new Error("exercise missing");
  const [unit] = await db.select().from(teachingUnit).where(eq(teachingUnit.id, exercise.unitId)).limit(1);
  const [reference] = await db
    .select()
    .from(instructorArtifact)
    .where(and(eq(instructorArtifact.exerciseId, exercise.id), eq(instructorArtifact.kind, "reference_solution")))
    .limit(1);

  const deterministic = runDeterministicChecks(sv.contentMarkdown, exercise.deterministicChecks).map((r) => ({
    checkId: r.checkId,
    passed: r.passed,
    detail: r.detail,
  }));
  await db.update(assessmentRun).set({ deterministicResults: deterministic }).where(eq(assessmentRun.id, run.id));

  const evidence = await buildUnitEvidence(db, exercise.unitId);
  const system = buildAssessorSystemPrompt({
    institutionName: ctx.env.INSTITUTION_NAME,
    courseTitle: unit?.title ?? "course",
    exerciseTitle: exercise.title,
    exercisePrompt: exercise.promptMarkdown,
    exerciseKind: exercise.kind,
    rubricVersion: exercise.rubricVersion,
    rubricCriteria: exercise.rubric.criteria,
    acceptAlternateApproaches: exercise.rubric.acceptAlternateApproaches,
    referenceIsExhaustive: exercise.rubric.referenceIsExhaustive,
    referenceReasoning: reference?.markdown ?? null,
    deterministicResults: deterministic,
    evidencePrompt: evidence.prompt,
    submissionNumbered: numberLines(sv.contentMarkdown),
    assistanceDisclosed: JSON.stringify(sv.assistanceDisclosed),
  });

  const scenario = fixtureScenario(exercise.id, deterministic);
  const instruction = "Assess the numbered submission according to the standard and return the structured judgement.";
  // The same gate as the web routes: a submission never spends past the owner's limits, and a
  // blocked provider fails the assessment with its reason instead of answering with fixtures.
  const plan = await planRun(db, payload.ownerId, ctx.env, "assessor", `${system}\n${instruction}`);
  const live = plan.kind === "live";
  const startedAt = new Date();
  let feedbackObject: ReturnType<typeof AssessorFeedbackSchema.parse> | null = null;
  let runStatus: RunStatus = "ok";
  let errorText: string | undefined;
  let attempts: AttemptUsage[] = [];
  let model = plan.model;

  if (plan.kind === "refused") {
    runStatus = plan.status;
    errorText = plan.reason;
  } else {
    try {
      const result = await plan.provider.generateStructured({
        role: "assessor",
        purpose: "assess-submission",
        system,
        messages: [{ role: "user", content: instruction }],
        schema: AssessorFeedbackSchema,
        schemaName: "AssessorFeedback",
        maxTokens: plan.maxTokens,
        effort: plan.effort,
        scenario,
      });
      feedbackObject = result.object;
      attempts = result.attempts;
      model = result.model;
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      runStatus = error.kind === "refused" ? "refused" : "error";
      errorText = error.message;
      attempts = error.attempts;
    }
  }

  const providerRunId = await recordProviderRun(db, {
    ownerId: payload.ownerId,
    role: "assessor",
    provider: plan.kind === "scripted" ? "fixture" : "anthropic",
    model,
    purpose: "assess-submission",
    pricingVersion: PRICING_VERSION,
    promptVersion: `${ASSESSOR_PROMPT_VERSION};role:${ROLE_CONTRACTS.assessor.version}`,
    status: runStatus,
    error: errorText ?? null,
    attempts,
    worstCaseUsd: plan.kind === "scripted" ? null : plan.worstCaseUsd,
    startedAt,
  });
  // The run records what actually assessed it, whatever was configured when it was submitted.
  const graderConfig = { ...run.graderConfig, provider: plan.kind === "scripted" ? "fixture" : "anthropic", model };

  if (!feedbackObject) {
    await db
      .update(assessmentRun)
      .set({ status: "failed", error: errorText ?? "provider failure", providerRunId, graderConfig, completedAt: new Date() })
      .where(eq(assessmentRun.id, run.id));
    await db.update(attempt).set({ state: "submitted" }).where(eq(attempt.id, a.id));
    return { status: "failed", error: errorText };
  }

  // Reconciliation (pure and tested in core): rules only lower confidence or route to review;
  // they never upgrade a verdict, and a fixture run never yields one.
  const { verdict, confidence, notes } = reconcileVerdict({
    verdict: feedbackObject.verdict,
    confidence: feedbackObject.confidence,
    live,
    deterministic,
  });
  const annotatedSummary = annotateTurn(
    feedbackObject.citationTags.length ? `${feedbackObject.summary} [${feedbackObject.citationTags.join(", ")}]` : feedbackObject.summary,
    evidence.refs,
  );
  const feedback = {
    summary: notes.length ? `${feedbackObject.summary}\n\n${notes.join(" ")}` : feedbackObject.summary,
    firstGap: feedbackObject.firstGap ?? undefined,
    checks: feedbackObject.checks,
    strengths: feedbackObject.strengths,
    nextStep: feedbackObject.nextStep,
    alternateApproachRecognised: feedbackObject.alternateApproachRecognised,
    labels: annotatedSummary.labels,
    citations: annotatedSummary.citations.map((c) => ({ tag: c.tag, locatorId: c.locatorId, label: c.label })),
  };
  const status = verdict === "needs_review" ? "needs_review" : "feedback_ready";
  await db
    .update(assessmentRun)
    .set({ status, feedback, verdict, confidence, providerRunId, graderConfig, completedAt: new Date() })
    .where(eq(assessmentRun.id, run.id));

  const attemptState = verdict === "accepted" ? "accepted" : verdict === "revision_requested" ? "revision_requested" : "needs_review";
  await db.update(attempt).set({ state: attemptState }).where(eq(attempt.id, a.id));

  const assisted = Boolean(a.solutionRevealedAt) || a.hintsUsed > 1;
  await recordEvidence(db, {
    ownerId: payload.ownerId,
    conceptIds: exercise.conceptIds,
    activityRef: `exercise:${exercise.id}`,
    submissionVersionId: sv.id,
    evidenceType: "assessment",
    source: live ? `assessor (${model})` : "assessor (fixture provider)",
    assistance: assisted ? `hints ${a.hintsUsed}${a.solutionRevealedAt ? ", solution revealed" : ""}` : `hints ${a.hintsUsed}`,
    interpretation: `Verdict ${verdict} (confidence ${confidence.toFixed(2)}) on submission v${sv.version}.${live ? "" : " Fixture provider: not a live assessment."}`,
    verdict,
    assisted,
    reviewStatus: "provisional",
  });

  return { status, verdict, confidence, live, deterministic: deterministic.length };
}

/** Picks the fixture scenario from the exercise and the automatic checks; live providers ignore it. */
export function fixtureScenario(exerciseId: string, checks: { checkId: string; passed: boolean; detail: string }[]): string {
  if (checks.some((c) => !c.passed && /not true in general/i.test(c.detail))) return `${exerciseId}_overgeneralisation`;
  if (checks.some((c) => !c.passed && /examples alone do not prove/i.test(c.detail))) return `${exerciseId}_examples-only`;
  if (checks.length > 0 && checks.every((c) => c.passed)) return `${exerciseId}_accepted`;
  return "default";
}
