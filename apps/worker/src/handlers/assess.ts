import {
  ASSESSOR_PROMPT_VERSION,
  AssessorFeedbackSchema,
  buildAssessorSystemPrompt,
  estimateCostUsd,
  numberLines,
  PRICING_VERSION,
  ProviderError,
  ROLE_CONTRACTS,
} from "@corniversity/ai";
import { runDeterministicChecks } from "@corniversity/core/checks/deterministic";
import { annotateTurn } from "@corniversity/core/grounding/citations";
import { AssessSubmissionPayload } from "@corniversity/db/jobs";
import {
  assessmentRun,
  attempt,
  instructorArtifact,
  providerRun,
  submissionVersion,
  teachingUnit,
  unitExercise,
} from "@corniversity/db/schema/index";
import { recordEvidence } from "@corniversity/db/services/evidence";
import { buildUnitEvidence } from "@corniversity/db/services/tutoring";
import { and, eq } from "drizzle-orm";
import { providerFor } from "../provider";
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
  const { provider, live } = await providerFor(ctx, payload.ownerId);
  const contract = ROLE_CONTRACTS.assessor;
  const startedAt = new Date();
  let feedbackObject: ReturnType<typeof AssessorFeedbackSchema.parse> | null = null;
  let runStatus: "ok" | "error" | "refused" | "budget_blocked" = "ok";
  let errorText: string | undefined;
  let usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  let model = live ? run.graderConfig.model : "fixture";

  try {
    const result = await provider.generateStructured({
      role: "assessor",
      purpose: "assess-submission",
      system,
      messages: [
        { role: "user", content: "Assess the numbered submission according to the standard and return the structured judgement." },
      ],
      schema: AssessorFeedbackSchema,
      schemaName: "AssessorFeedback",
      maxTokens: contract.limits.maxOutputTokens,
      scenario,
    });
    feedbackObject = result.object;
    usage = result.usage;
    model = result.model;
  } catch (error) {
    if (error instanceof ProviderError) {
      runStatus = error.kind === "refused" ? "refused" : error.kind === "budget_exceeded" ? "budget_blocked" : "error";
      errorText = error.message;
    } else {
      throw error;
    }
  }

  const [pr] = await db
    .insert(providerRun)
    .values({
      ownerId: payload.ownerId,
      role: "assessor",
      provider: provider.name,
      model,
      purpose: "assess-submission",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      costUsd: String(estimateCostUsd(model, usage)),
      pricingVersion: PRICING_VERSION,
      promptVersion: `${ASSESSOR_PROMPT_VERSION};role:${contract.version}`,
      status: runStatus,
      error: errorText ?? null,
      startedAt,
      finishedAt: new Date(),
    })
    .returning({ id: providerRun.id });

  if (!feedbackObject) {
    await db
      .update(assessmentRun)
      .set({ status: "failed", error: errorText ?? "provider failure", providerRunId: pr?.id ?? null, completedAt: new Date() })
      .where(eq(assessmentRun.id, run.id));
    await db.update(attempt).set({ state: "submitted" }).where(eq(attempt.id, a.id));
    return { status: "failed", error: errorText };
  }

  // Reconciliation: rules only lower confidence or route to review; they never upgrade a verdict.
  let verdict = feedbackObject.verdict;
  let confidence = feedbackObject.confidence;
  const notes: string[] = [];
  const forbiddenFailed = deterministic.some((d) => !d.passed && /forbidden|not true in general/i.test(d.detail));
  if (verdict === "accepted" && forbiddenFailed) {
    verdict = "needs_review";
    confidence = Math.min(confidence, 0.4);
    notes.push("An automatic check flagged a claim that is not true in general; the acceptance is held for review.");
  }
  if (confidence < 0.6 && verdict !== "needs_review") {
    verdict = "needs_review";
    notes.push("The assessor's confidence is below the threshold, so this judgement is provisional.");
  }
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
    .set({ status, feedback, verdict, confidence, providerRunId: pr?.id ?? null, completedAt: new Date() })
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
