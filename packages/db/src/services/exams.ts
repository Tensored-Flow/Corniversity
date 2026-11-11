import { learnerVisibleReference } from "@corniversity/core/domain/reference";
import {
  EXAM_LIMITS,
  examResult,
  pickExamQuestions,
  type QuestionOutcome,
  questionScore,
  validateExamSettings,
  withinExamTime,
} from "@corniversity/core/exams/exam";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Database, DbOrTx } from "../client";
import {
  assessmentRun,
  attempt,
  auditEvent,
  courseVersion,
  exam,
  instructorArtifact,
  submissionVersion,
  teachingUnit,
  unitExercise,
} from "../schema/index";
import { getEnrolmentForCourse } from "./enrolment";
import { submitAttempt } from "./learning";

/** Postgres reports a unique violation as 23505; the driver may wrap it in `cause`. */
function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

const ALREADY_RUNNING = "An exam on this course is already running. Finish it first.";

/*
 * Course exams: a timed, closed-book paper of problems the learner has not attempted, answered as
 * self-test attempts linked to the exam (practice sessions never see them), submitted together and
 * marked by the assessor through the ordinary assessment queue. Work is accepted until the
 * deadline (plus a short grace); after it, whatever was saved is submitted.
 */

export class ExamError extends Error {}

export type GraderConfig = { provider: string; model: string; promptVersion: string; roleVersion: string };

/** The course's current version, which holds its units (a content update moves them there). */
async function currentVersionId(db: DbOrTx, courseId: string): Promise<string | null> {
  const [v] = await db
    .select({ id: courseVersion.id })
    .from(courseVersion)
    .where(and(eq(courseVersion.courseId, courseId), eq(courseVersion.isCurrent, true)))
    .limit(1);
  return v?.id ?? null;
}

/** The prepared problems of the course (its current version) that the learner has never attempted. */
async function unattemptedProblems(db: DbOrTx, ownerId: string, courseVersionId: string) {
  const rows = await db
    .select({ id: unitExercise.id, sequence: unitExercise.sequence, unitSequence: teachingUnit.sequence })
    .from(unitExercise)
    .innerJoin(teachingUnit, eq(unitExercise.unitId, teachingUnit.id))
    .where(and(eq(teachingUnit.courseVersionId, courseVersionId), eq(teachingUnit.status, "ready")));
  if (rows.length === 0) return [];
  const tried = await db
    .selectDistinct({ exerciseId: attempt.exerciseId })
    .from(attempt)
    .where(
      and(
        eq(attempt.ownerId, ownerId),
        inArray(
          attempt.exerciseId,
          rows.map((r) => r.id),
        ),
      ),
    );
  const seen = new Set(tried.map((t) => t.exerciseId));
  return rows.filter((r) => !seen.has(r.id));
}

/** What an exam on this course could hold now, and any exam already running. */
export async function examOverview(db: DbOrTx, ownerId: string, courseId: string) {
  const enrolled = await getEnrolmentForCourse(db, ownerId, courseId);
  const exams = await db
    .select()
    .from(exam)
    .where(and(eq(exam.ownerId, ownerId), eq(exam.courseId, courseId)))
    .orderBy(desc(exam.startedAt));
  const versionId = enrolled ? await currentVersionId(db, courseId) : null;
  const available = versionId ? (await unattemptedProblems(db, ownerId, versionId)).length : 0;
  return {
    taking: Boolean(enrolled),
    available,
    maxQuestions: Math.min(available, EXAM_LIMITS.maxQuestions),
    running: exams.find((e) => e.status === "in_progress") ?? null,
    past: exams.filter((e) => e.status === "submitted"),
  };
}

/**
 * Starts an exam: a random sample of unattempted prepared problems (fewer if fewer remain), a
 * deadline `minutes` from now, and an empty self-test answer for each question. One exam per
 * course runs at a time.
 */
export async function startExam(
  db: DbOrTx,
  ownerId: string,
  courseId: string,
  settings: { questions: number; minutes: number },
  random: () => number = Math.random,
  now: Date = new Date(),
) {
  const { questions, minutes } = validateExamSettings(settings);
  const enrolled = await getEnrolmentForCourse(db, ownerId, courseId);
  if (!enrolled) throw new ExamError("Take the course before sitting its exam.");
  const versionId = await currentVersionId(db, courseId);
  if (!versionId) throw new ExamError("This course has no current version.");
  // The partial unique index exam_one_running_idx settles two starts racing each other.
  const started = (db as Database).transaction(async (tx) => {
    const [running] = await tx
      .select({ id: exam.id })
      .from(exam)
      .where(and(eq(exam.ownerId, ownerId), eq(exam.courseId, courseId), eq(exam.status, "in_progress")));
    if (running) throw new ExamError(ALREADY_RUNNING);
    const picked = pickExamQuestions(await unattemptedProblems(tx, ownerId, versionId), questions, random);
    if (picked.length === 0) throw new ExamError("You have attempted every prepared problem in this course, so none is left for an exam.");
    const [row] = await tx
      .insert(exam)
      .values({
        ownerId,
        courseId,
        courseVersionId: versionId,
        exerciseIds: picked.map((p) => p.id),
        durationMinutes: minutes,
        startedAt: now,
        deadlineAt: new Date(now.getTime() + minutes * 60_000),
      })
      .returning();
    await tx.insert(attempt).values(picked.map((p) => ({ ownerId, exerciseId: p.id, mode: "self_test" as const, examId: row!.id })));
    await tx.insert(auditEvent).values({
      ownerId,
      actor: "learner",
      action: "exam:start",
      entity: "exam",
      entityId: row!.id,
      details: { courseId, questions: picked.length, minutes },
    });
    return row!;
  });
  return started.catch((error: unknown) => {
    if (isUniqueViolation(error)) throw new ExamError(ALREADY_RUNNING);
    throw error;
  });
}

async function ownedExam(db: DbOrTx, ownerId: string, examId: string) {
  const [row] = await db
    .select()
    .from(exam)
    .where(and(eq(exam.id, examId), eq(exam.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new ExamError("Exam not found.");
  return row;
}

/**
 * Saves one answer while the exam is running and within time. The exam row is locked, so a save
 * either lands before submission (and is submitted) or sees the exam submitted and is refused.
 */
export async function saveExamAnswer(
  db: DbOrTx,
  ownerId: string,
  examId: string,
  exerciseId: string,
  text: string,
  now: Date = new Date(),
): Promise<void> {
  await (db as Database).transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(exam)
      .where(and(eq(exam.id, examId), eq(exam.ownerId, ownerId)))
      .for("update");
    if (!row) throw new ExamError("Exam not found.");
    if (row.status !== "in_progress") throw new ExamError("This exam has been submitted; answers can no longer change.");
    if (!withinExamTime(row.deadlineAt, now)) throw new ExamError("Time is up. What you saved before the deadline is what counts.");
    const updated = await tx
      .update(attempt)
      .set({ draftMarkdown: text.slice(0, 100_000), draftSavedAt: now })
      .where(and(eq(attempt.examId, examId), eq(attempt.exerciseId, exerciseId), eq(attempt.ownerId, ownerId)))
      .returning({ id: attempt.id });
    if (updated.length === 0) throw new ExamError("That question is not part of this exam.");
  });
}

/**
 * Submits the exam once: every answered question becomes a submission queued for the assessor;
 * unanswered ones stay unanswered. `by` records whether the learner submitted or the deadline did.
 * A second call (a double click, or the deadline catching a submission in flight) does nothing.
 */
export async function submitExam(
  db: DbOrTx,
  ownerId: string,
  examId: string,
  graderConfig: GraderConfig,
  by: "learner" | "deadline" = "learner",
  now: Date = new Date(),
): Promise<{ submitted: number; alreadySubmitted: boolean }> {
  return (db as Database).transaction(async (tx) => {
    const [claimed] = await tx
      .update(exam)
      .set({ status: "submitted", submittedAt: now, submittedBy: by })
      .where(and(eq(exam.id, examId), eq(exam.ownerId, ownerId), eq(exam.status, "in_progress")))
      .returning();
    if (!claimed) {
      await ownedExam(tx, ownerId, examId);
      return { submitted: 0, alreadySubmitted: true };
    }
    const answers = await tx
      .select()
      .from(attempt)
      .where(and(eq(attempt.examId, examId), eq(attempt.ownerId, ownerId)));
    let submitted = 0;
    for (const a of answers) {
      const text = a.draftMarkdown?.trim();
      if (!text) continue;
      await submitAttempt(tx, {
        ownerId,
        attemptId: a.id,
        contentMarkdown: text,
        assistanceDisclosed: { hintsUsed: 0, peersConsulted: false, externalSources: [], note: "exam: closed book, timed" },
        graderConfig,
      });
      submitted++;
    }
    await tx.insert(auditEvent).values({
      ownerId,
      actor: by === "learner" ? "learner" : "system",
      action: "exam:submit",
      entity: "exam",
      entityId: examId,
      details: { submitted, questions: answers.length, by },
    });
    return { submitted, alreadySubmitted: false };
  });
}

/** Submits a running exam whose time and grace have run out; returns whether it did. */
export async function closeIfExpired(db: DbOrTx, ownerId: string, examId: string, graderConfig: GraderConfig, now: Date = new Date()) {
  const row = await ownedExam(db, ownerId, examId);
  if (row.status !== "in_progress" || withinExamTime(row.deadlineAt, now)) return false;
  await submitExam(db, ownerId, examId, graderConfig, "deadline", now);
  return true;
}

/**
 * The paper's clock reached zero: submit as the deadline did, but only once the server agrees the
 * deadline has passed (a device clock that runs fast must not end the exam early). Returns whether
 * it submitted.
 */
export async function submitAtDeadline(db: DbOrTx, ownerId: string, examId: string, graderConfig: GraderConfig, now: Date = new Date()) {
  const row = await ownedExam(db, ownerId, examId);
  if (row.status !== "in_progress" || now.getTime() < row.deadlineAt.getTime()) return false;
  await submitExam(db, ownerId, examId, graderConfig, "deadline", now);
  return true;
}

/**
 * The exam as the learner sees it: its questions and answers; once submitted, each question's
 * marking (a score when the assessor has marked it), the overall result, and the worked solution
 * wherever its author allows one to be shown.
 */
export async function examView(db: DbOrTx, ownerId: string, examId: string) {
  const row = await ownedExam(db, ownerId, examId);
  const exercises = await db
    .select({ exercise: unitExercise, unitTitle: teachingUnit.title, unitSequence: teachingUnit.sequence })
    .from(unitExercise)
    .innerJoin(teachingUnit, eq(unitExercise.unitId, teachingUnit.id))
    .where(inArray(unitExercise.id, row.exerciseIds));
  const answers = await db
    .select()
    .from(attempt)
    .where(and(eq(attempt.examId, examId), eq(attempt.ownerId, ownerId)));
  const submitted = row.status === "submitted";
  const versions = submitted
    ? await db
        .select({ version: submissionVersion, run: assessmentRun })
        .from(submissionVersion)
        .leftJoin(assessmentRun, eq(assessmentRun.submissionVersionId, submissionVersion.id))
        .where(
          inArray(
            submissionVersion.attemptId,
            answers.map((a) => a.id),
          ),
        )
        .orderBy(desc(assessmentRun.createdAt))
    : [];
  const solutions = submitted
    ? await db
        .select({
          exerciseId: instructorArtifact.exerciseId,
          markdown: instructorArtifact.markdown,
          releasePolicy: instructorArtifact.releasePolicy,
        })
        .from(instructorArtifact)
        .where(
          and(
            inArray(instructorArtifact.exerciseId, row.exerciseIds),
            eq(instructorArtifact.kind, "reference_solution"),
            inArray(instructorArtifact.releasePolicy, ["on_request_practice", "after_accepted"]),
            isNotNull(instructorArtifact.exerciseId),
          ),
        )
    : [];

  const questions = row.exerciseIds.flatMap((id, index) => {
    const found = exercises.find((e) => e.exercise.id === id);
    if (!found) return [];
    const answer = answers.find((a) => a.exerciseId === id) ?? null;
    const latest = answer ? versions.find((v) => v.version.attemptId === answer.id) : undefined;
    const run = latest?.run ?? null;
    let outcome: QuestionOutcome;
    if (!latest) outcome = { kind: "unanswered" };
    else if (run?.status === "feedback_ready" && run.verdict !== "needs_review" && run.feedback) {
      const criteria = (run.exerciseSnapshot?.rubric ?? found.exercise.rubric).criteria;
      const score = questionScore(criteria, run.feedback.checks);
      outcome = score === null ? { kind: "unscored" } : { kind: "marked", score };
    } else outcome = { kind: "awaiting" };
    // An "after accepted" solution waits until this answer is accepted, as it would in practice.
    const solution = solutions.find(
      (s) => s.exerciseId === id && (s.releasePolicy === "on_request_practice" || run?.verdict === "accepted"),
    );
    return [
      {
        number: index + 1,
        exerciseId: id,
        title: found.exercise.title,
        unit: { sequence: found.unitSequence, title: found.unitTitle },
        promptMarkdown: found.exercise.promptMarkdown,
        answer: answer?.draftMarkdown ?? "",
        submitted: latest ? latest.version.contentMarkdown : null,
        run: run ? { status: run.status, verdict: run.verdict, feedback: run.feedback } : null,
        outcome,
        solution: submitted ? (solution ? learnerVisibleReference(solution.markdown) : null) : null,
      },
    ];
  });
  return { exam: row, questions, result: submitted ? examResult(questions.map((q) => q.outcome)) : null };
}

/** The learner's running exams, soonest deadline first. */
export async function runningExams(db: DbOrTx, ownerId: string) {
  return db
    .select()
    .from(exam)
    .where(and(eq(exam.ownerId, ownerId), eq(exam.status, "in_progress")))
    .orderBy(exam.deadlineAt);
}
