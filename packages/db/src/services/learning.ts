import { learnerVisibleReference } from "@corniversity/core/domain/reference";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { AssessSubmissionPayload, QUEUES } from "../jobs";
import { enqueue } from "../queue";
import {
  assessmentRun,
  attempt,
  auditEvent,
  enrolment,
  evidenceEvent,
  feedbackReview,
  instructorArtifact,
  learningSession,
  scheduledSession,
  teachingUnit,
  unitExercise,
} from "../schema/index";
import { markDeadlinesMet } from "./study";

export type LearningSessionRow = typeof learningSession.$inferSelect;
export type AttemptRow = typeof attempt.$inferSelect;
export type AssessmentRunRow = typeof assessmentRun.$inferSelect;

export class LearningError extends Error {
  constructor(
    readonly code:
      | "not_enrolled"
      | "unit_not_ready"
      | "activity_not_found"
      | "attempt_not_found"
      | "not_practice_mode"
      | "no_reference"
      | "attempt_closed",
    message: string,
  ) {
    super(message);
    this.name = "LearningError";
  }
}

/**
 * Starts or resumes a learning session for one activity of one unit. Sessions are owner-scoped
 * and resume at their saved state; a unit that is not prepared cannot be started (audit mode
 * may read the lesson but cannot open a tutorial).
 */
/**
 * Ties a learning session to the timetable slot that asked for it, so that completing the work
 * completes the slot instead of leaving two places to keep in step.
 */
async function linkScheduledSession(db: DbOrTx, ownerId: string, learningSessionId: string, scheduledSessionId?: string): Promise<void> {
  if (!scheduledSessionId || !isUuid(scheduledSessionId)) return;
  const [slot] = await db
    .update(scheduledSession)
    .set({ learningSessionId, status: "attempted" })
    .where(
      and(
        eq(scheduledSession.id, scheduledSessionId),
        eq(scheduledSession.ownerId, ownerId),
        inArray(scheduledSession.status, ["planned", "attempted"]),
      ),
    )
    .returning({ id: scheduledSession.id });
  if (slot) await db.update(learningSession).set({ scheduledSessionId }).where(eq(learningSession.id, learningSessionId));
}

export async function startOrResumeSession(
  db: DbOrTx,
  input: { ownerId: string; unitId: string; activityId: string; scheduledSessionId?: string },
): Promise<{ session: LearningSessionRow; created: boolean }> {
  const [unit] = await db.select().from(teachingUnit).where(eq(teachingUnit.id, input.unitId)).limit(1);
  if (!unit) throw new LearningError("activity_not_found", "Unit not found.");
  if (unit.status !== "ready") throw new LearningError("unit_not_ready", "This unit is not prepared yet.");
  const activity = unit.activities.find((a) => a.id === input.activityId);
  if (!activity) throw new LearningError("activity_not_found", "Activity not found in this unit.");
  // Enrolments record the course version they were made under; the learner always studies the
  // current version of the same course, and earlier work is kept. Resolve by course, not version.
  const { courseVersion } = await import("../schema/index");
  const [currentVersion] = await db
    .select({ courseId: courseVersion.courseId })
    .from(courseVersion)
    .where(eq(courseVersion.id, unit.courseVersionId))
    .limit(1);
  if (!currentVersion) throw new LearningError("activity_not_found", "Course version not found.");
  const [enrolled] = await db
    .select({ enrolment })
    .from(enrolment)
    .innerJoin(courseVersion, eq(enrolment.courseVersionId, courseVersion.id))
    .where(and(eq(enrolment.ownerId, input.ownerId), eq(courseVersion.courseId, currentVersion.courseId), eq(enrolment.status, "active")))
    .limit(1)
    .then((rows) => rows.map((r) => r.enrolment));
  if (!enrolled) throw new LearningError("not_enrolled", "You are not taking this course.");

  const existing = await db
    .select()
    .from(learningSession)
    .where(
      and(
        eq(learningSession.ownerId, input.ownerId),
        eq(learningSession.unitId, input.unitId),
        eq(learningSession.activityId, input.activityId),
        eq(learningSession.status, "open"),
      ),
    )
    .limit(1);
  if (existing[0]) {
    await db.update(learningSession).set({ lastActiveAt: new Date() }).where(eq(learningSession.id, existing[0].id));
    await linkScheduledSession(db, input.ownerId, existing[0].id, input.scheduledSessionId);
    return { session: existing[0], created: false };
  }
  const [created] = await db
    .insert(learningSession)
    .values({
      ownerId: input.ownerId,
      enrolmentId: enrolled.id,
      unitId: input.unitId,
      activityId: input.activityId,
      sessionKind: activity.sessionKind,
      state: { currentExerciseId: activity.exerciseIds[0] },
    })
    .returning();
  if (!created) throw new Error("session insert returned nothing");
  await linkScheduledSession(db, input.ownerId, created.id, input.scheduledSessionId);
  return { session: created, created: true };
}

export async function getSession(db: DbOrTx, ownerId: string, sessionId: string): Promise<LearningSessionRow | null> {
  if (!isUuid(sessionId)) return null;
  const rows = await db
    .select()
    .from(learningSession)
    .where(and(eq(learningSession.id, sessionId), eq(learningSession.ownerId, ownerId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateSessionState(db: DbOrTx, ownerId: string, sessionId: string, patch: Record<string, unknown>): Promise<void> {
  const session = await getSession(db, ownerId, sessionId);
  if (!session) return;
  await db
    .update(learningSession)
    .set({ state: { ...session.state, ...patch }, lastActiveAt: new Date() })
    .where(eq(learningSession.id, sessionId));
}

export async function completeSession(db: DbOrTx, ownerId: string, sessionId: string, summary?: string): Promise<void> {
  const session = await getSession(db, ownerId, sessionId);
  if (!session) return;
  await db
    .update(learningSession)
    .set({ status: "completed", endedAt: new Date(), state: { ...session.state, summary } })
    .where(eq(learningSession.id, sessionId));
  if (session.scheduledSessionId) {
    await db
      .update(scheduledSession)
      .set({ status: "completed" })
      .where(and(eq(scheduledSession.id, session.scheduledSessionId), eq(scheduledSession.ownerId, ownerId)));
  }
}

export async function listOpenSessions(db: DbOrTx, ownerId: string) {
  return db
    .select()
    .from(learningSession)
    .where(and(eq(learningSession.ownerId, ownerId), eq(learningSession.status, "open")))
    .orderBy(desc(learningSession.lastActiveAt));
}

/** Creates a practice or self-test attempt. One open (non-accepted) attempt per exercise is reused. */
export async function getOrCreateAttempt(
  db: DbOrTx,
  input: { ownerId: string; exerciseId: string; sessionId?: string; mode?: "practice" | "self_test" },
): Promise<AttemptRow> {
  const open = await db
    .select()
    .from(attempt)
    .where(and(eq(attempt.ownerId, input.ownerId), eq(attempt.exerciseId, input.exerciseId)))
    .orderBy(desc(attempt.createdAt))
    .limit(1);
  if (open[0] && open[0].state !== "accepted") return open[0];
  const [created] = await db
    .insert(attempt)
    .values({
      ownerId: input.ownerId,
      exerciseId: input.exerciseId,
      learningSessionId: input.sessionId ?? null,
      mode: input.mode ?? "practice",
    })
    .returning();
  if (!created) throw new Error("attempt insert returned nothing");
  return created;
}

export async function getAttempt(db: DbOrTx, ownerId: string, attemptId: string): Promise<AttemptRow | null> {
  if (!isUuid(attemptId)) return null;
  const rows = await db
    .select()
    .from(attempt)
    .where(and(eq(attempt.id, attemptId), eq(attempt.ownerId, ownerId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Saves unsubmitted work so a closed tab never loses an argument. */
export async function saveDraft(db: DbOrTx, ownerId: string, attemptId: string, draftMarkdown: string): Promise<void> {
  await db
    .update(attempt)
    .set({ draftMarkdown })
    .where(and(eq(attempt.id, attemptId), eq(attempt.ownerId, ownerId)));
}

/** The hint ladder is learner-facing content; revealing a step is recorded, never penalised. */
export async function requestHint(
  db: DbOrTx,
  ownerId: string,
  attemptId: string,
): Promise<{ hint: string | null; index: number; total: number }> {
  const a = await getAttempt(db, ownerId, attemptId);
  if (!a) throw new LearningError("attempt_not_found", "Attempt not found.");
  const [exercise] = await db.select().from(unitExercise).where(eq(unitExercise.id, a.exerciseId)).limit(1);
  if (!exercise) throw new LearningError("attempt_not_found", "Exercise not found.");
  const total = exercise.hintLadder.length;
  if (a.hintsUsed >= total) return { hint: null, index: a.hintsUsed, total };
  const hint = exercise.hintLadder[a.hintsUsed] ?? null;
  await db
    .update(attempt)
    .set({ hintsUsed: a.hintsUsed + 1 })
    .where(eq(attempt.id, attemptId));
  return { hint, index: a.hintsUsed + 1, total };
}

/**
 * Submits an immutable version and queues an assessment. The assessment run's idempotency key is
 * the submission version id, so a retried request or a duplicate job cannot grade it twice.
 */
export async function submitAttempt(
  db: DbOrTx,
  input: {
    ownerId: string;
    attemptId: string;
    contentMarkdown: string;
    assistanceDisclosed?: { hintsUsed: number; peersConsulted: boolean; externalSources: string[]; note?: string };
    graderConfig: { provider: string; model: string; promptVersion: string; roleVersion: string };
  },
): Promise<{ submissionVersionId: string; assessmentRunId: string; version: number }> {
  const a = await getAttempt(db, input.ownerId, input.attemptId);
  if (!a) throw new LearningError("attempt_not_found", "Attempt not found.");
  if (a.state === "accepted") throw new LearningError("attempt_closed", "This attempt has already been accepted; start a new one.");
  const [exercise] = await db.select().from(unitExercise).where(eq(unitExercise.id, a.exerciseId)).limit(1);
  if (!exercise) throw new LearningError("attempt_not_found", "Exercise not found.");

  const { submissionVersion } = await import("../schema/index");
  const previous = await db
    .select({ version: submissionVersion.version })
    .from(submissionVersion)
    .where(eq(submissionVersion.attemptId, a.id))
    .orderBy(desc(submissionVersion.version))
    .limit(1);
  const version = (previous[0]?.version ?? 0) + 1;
  const [sv] = await db
    .insert(submissionVersion)
    .values({
      attemptId: a.id,
      version,
      contentMarkdown: input.contentMarkdown,
      contentKind: "text",
      assistanceDisclosed: input.assistanceDisclosed ?? { hintsUsed: a.hintsUsed, peersConsulted: false, externalSources: [] },
    })
    .returning();
  if (!sv) throw new Error("submission insert returned nothing");

  const [run] = await db
    .insert(assessmentRun)
    .values({
      submissionVersionId: sv.id,
      rubricVersion: exercise.rubricVersion,
      graderConfig: input.graderConfig,
      status: "queued",
      idempotencyKey: `assess:${sv.id}`,
    })
    .returning();
  if (!run) throw new Error("assessment run insert returned nothing");

  await db
    .update(attempt)
    .set({ state: version === 1 ? "submitted" : "revised" })
    .where(eq(attempt.id, a.id));
  await db.update(attempt).set({ state: "reviewing" }).where(eq(attempt.id, a.id));

  const payload = AssessSubmissionPayload.parse({
    idempotencyKey: `assess:${sv.id}`,
    ownerId: input.ownerId,
    submissionVersionId: sv.id,
    assessmentRunId: run.id,
  });
  await enqueue(db, { queue: QUEUES.assessSubmission, kind: "assess-submission", payload });
  await markDeadlinesMet(db, input.ownerId, a.exerciseId);
  await db.insert(auditEvent).values({
    ownerId: input.ownerId,
    actor: "learner",
    action: "submit",
    entity: "submission_version",
    entityId: sv.id,
    details: { attemptId: a.id, version, exerciseId: a.exerciseId },
  });
  return { submissionVersionId: sv.id, assessmentRunId: run.id, version };
}

export interface AttemptHistory {
  attempt: AttemptRow;
  versions: {
    id: string;
    version: number;
    contentMarkdown: string;
    submittedAt: Date;
    run: AssessmentRunRow | null;
    reviews: (typeof feedbackReview.$inferSelect)[];
  }[];
}

export async function getAttemptHistory(db: DbOrTx, ownerId: string, exerciseId: string): Promise<AttemptHistory[]> {
  const attempts = await db
    .select()
    .from(attempt)
    .where(and(eq(attempt.ownerId, ownerId), eq(attempt.exerciseId, exerciseId)))
    .orderBy(asc(attempt.createdAt));
  if (attempts.length === 0) return [];
  const { submissionVersion } = await import("../schema/index");
  const versions = await db
    .select()
    .from(submissionVersion)
    .where(
      inArray(
        submissionVersion.attemptId,
        attempts.map((a) => a.id),
      ),
    )
    .orderBy(asc(submissionVersion.version));
  const runs = versions.length
    ? await db
        .select()
        .from(assessmentRun)
        .where(
          inArray(
            assessmentRun.submissionVersionId,
            versions.map((v) => v.id),
          ),
        )
    : [];
  const reviews = runs.length
    ? await db
        .select()
        .from(feedbackReview)
        .where(
          inArray(
            feedbackReview.assessmentRunId,
            runs.map((r) => r.id),
          ),
        )
    : [];
  return attempts.map((a) => ({
    attempt: a,
    versions: versions
      .filter((v) => v.attemptId === a.id)
      .map((v) => {
        // A regrade adds a later run for the same version; the card shows the latest judgement
        // and every review filed against any run of that version.
        const versionRuns = runs
          .filter((r) => r.submissionVersionId === v.id)
          .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
        const run = versionRuns[0] ?? null;
        const runIds = new Set(versionRuns.map((r) => r.id));
        return {
          id: v.id,
          version: v.version,
          contentMarkdown: v.contentMarkdown,
          submittedAt: v.submittedAt,
          run,
          reviews: reviews.filter((r) => runIds.has(r.assessmentRunId)),
        };
      }),
  }));
}

/**
 * Practice-mode reveal of the instructor reference reasoning. Recorded as evidence of
 * assistance; refused in self-test mode and when no reference exists.
 */
export async function revealReference(db: DbOrTx, ownerId: string, attemptId: string): Promise<{ markdown: string }> {
  const a = await getAttempt(db, ownerId, attemptId);
  if (!a) throw new LearningError("attempt_not_found", "Attempt not found.");
  if (a.mode !== "practice") throw new LearningError("not_practice_mode", "Solutions are withheld in self-test mode until you submit.");
  const [artifact] = await db
    .select()
    .from(instructorArtifact)
    .where(
      and(
        eq(instructorArtifact.exerciseId, a.exerciseId),
        eq(instructorArtifact.kind, "reference_solution"),
        eq(instructorArtifact.releasePolicy, "on_request_practice"),
      ),
    )
    .limit(1);
  if (!artifact) throw new LearningError("no_reference", "No reference reasoning is available for this exercise.");
  const [exercise] = await db.select().from(unitExercise).where(eq(unitExercise.id, a.exerciseId)).limit(1);
  if (!a.solutionRevealedAt) {
    await db.update(attempt).set({ solutionRevealedAt: new Date() }).where(eq(attempt.id, a.id));
    for (const conceptId of exercise?.conceptIds ?? []) {
      await db.insert(evidenceEvent).values({
        ownerId,
        conceptId,
        activityRef: `exercise:${a.exerciseId}`,
        evidenceType: "solution_revealed",
        source: "practice-mode reveal",
        assistance: "full solution shown on request",
        interpretation: "The learner chose to see the reference reasoning; later attempts on this exercise count as assisted practice.",
      });
    }
  }
  return { markdown: learnerVisibleReference(artifact.markdown) };
}

export async function fileReview(
  db: DbOrTx,
  input: { ownerId: string; assessmentRunId: string; kind: "appeal" | "regrade" | "learner_challenge"; note: string },
): Promise<typeof feedbackReview.$inferSelect> {
  const { submissionVersion } = await import("../schema/index");
  const [owned] = await db
    .select({ run: assessmentRun, attemptId: attempt.id, exerciseId: attempt.exerciseId })
    .from(assessmentRun)
    .innerJoin(submissionVersion, eq(assessmentRun.submissionVersionId, submissionVersion.id))
    .innerJoin(attempt, eq(submissionVersion.attemptId, attempt.id))
    .where(and(eq(assessmentRun.id, input.assessmentRunId), eq(attempt.ownerId, input.ownerId)))
    .limit(1);
  if (!owned) throw new LearningError("attempt_not_found", "Assessment not found.");
  let newRunId: string | undefined;
  if (input.kind === "regrade") {
    // A regrade is a real re-assessment of the same submission version: a fresh run under its
    // own key, queued like the first one. With the fixture provider it is withheld again, honestly.
    const [prior] = await db
      .select({ n: count() })
      .from(assessmentRun)
      .where(eq(assessmentRun.submissionVersionId, owned.run.submissionVersionId));
    const idempotencyKey = `assess:${owned.run.submissionVersionId}#r${prior?.n ?? 1}`;
    const [rerun] = await db
      .insert(assessmentRun)
      .values({
        submissionVersionId: owned.run.submissionVersionId,
        rubricVersion: owned.run.rubricVersion,
        graderConfig: owned.run.graderConfig,
        status: "queued",
        idempotencyKey,
      })
      .returning({ id: assessmentRun.id });
    if (!rerun) throw new Error("assessment run insert returned nothing");
    newRunId = rerun.id;
    await db.update(attempt).set({ state: "reviewing" }).where(eq(attempt.id, owned.attemptId));
    const payload = AssessSubmissionPayload.parse({
      idempotencyKey,
      ownerId: input.ownerId,
      submissionVersionId: owned.run.submissionVersionId,
      assessmentRunId: rerun.id,
    });
    await enqueue(db, { queue: QUEUES.assessSubmission, kind: "assess-submission", payload });
  }
  const [review] = await db
    .insert(feedbackReview)
    .values({
      assessmentRunId: input.assessmentRunId,
      kind: input.kind,
      learnerNote: input.note,
      ...(newRunId
        ? {
            status: "resolved" as const,
            resolution: { outcome: "re-assessed", note: "A new assessment run was queued.", newRunId },
            resolvedAt: new Date(),
          }
        : {}),
    })
    .returning();
  if (!review) throw new Error("review insert returned nothing");
  await db.insert(auditEvent).values({
    ownerId: input.ownerId,
    actor: "learner",
    action: `review:${input.kind}`,
    entity: "assessment_run",
    entityId: input.assessmentRunId,
    details: {},
  });
  return review;
}
