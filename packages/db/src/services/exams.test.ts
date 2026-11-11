import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "../../test/fixtures";
import { createDb } from "../client";
import { stopBoss } from "../queue";
import { assessmentRun, attempt, exam, instructorArtifact, submissionVersion, unitExercise } from "../schema/index";
import { closeIfExpired, ExamError, examOverview, examView, saveExamAnswer, startExam, submitAtDeadline, submitExam } from "./exams";
import { getOrCreateAttempt, LearningError, runningExamFor, startAttempt } from "./learning";

/**
 * Exams against PostgreSQL: questions are unattempted prepared problems; one exam per course runs
 * at a time; answers count until the deadline and its grace; submission happens once and queues
 * each answer for the assessor; the score follows the assessor's checks of weighted criteria;
 * worked solutions appear only after submission and only where their author allows; while the
 * exam runs its problems cannot be practised; practice sessions never see exam answers.
 */
let handle: ReturnType<typeof createDb>;
let fx: Fixture;
const grader = { provider: "fixture", model: "fixture", promptVersion: "test", roleVersion: "test" };
const rubric = {
  version: 1,
  criteria: [
    {
      id: "c1",
      criterion: "Sets up the estimate.",
      weight: 0.6,
      levels: [
        { label: "no", description: "-" },
        { label: "yes", description: "-" },
      ],
    },
    {
      id: "c2",
      criterion: "Concludes correctly.",
      weight: 0.4,
      levels: [
        { label: "no", description: "-" },
        { label: "yes", description: "-" },
      ],
    },
  ],
  acceptAlternateApproaches: true,
  referenceIsExhaustive: false,
};

async function addProblems(ids: string[]) {
  await handle.db.insert(unitExercise).values(
    ids.map((id, i) => ({
      id,
      unitId: fx.unitId,
      sequence: 10 + i,
      title: `Problem ${id}`,
      kind: "proof",
      promptMarkdown: `Prove statement ${id}.`,
      conceptIds: [fx.conceptId],
      hintLadder: ["A hint."],
      rubric,
      rubricVersion: 1,
      origin: "original",
      estimatedMinutes: 20,
    })),
  );
}

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 3 });
  fx = await createFixture(handle.db, "exam");
  await addProblems([`${fx.unitId}-x1`, `${fx.unitId}-x2`]);
});

afterAll(async () => {
  const exams = await handle.db.select({ id: exam.id }).from(exam).where(eq(exam.ownerId, fx.ownerId));
  const attempts = await handle.db.select({ id: attempt.id }).from(attempt).where(eq(attempt.ownerId, fx.ownerId));
  if (attempts.length) {
    const versions = await handle.db
      .select({ id: submissionVersion.id })
      .from(submissionVersion)
      .where(
        inArray(
          submissionVersion.attemptId,
          attempts.map((a) => a.id),
        ),
      );
    if (versions.length)
      await handle.db.delete(assessmentRun).where(
        inArray(
          assessmentRun.submissionVersionId,
          versions.map((v) => v.id),
        ),
      );
    await handle.db.delete(submissionVersion).where(
      inArray(
        submissionVersion.attemptId,
        attempts.map((a) => a.id),
      ),
    );
    await handle.db.delete(attempt).where(eq(attempt.ownerId, fx.ownerId));
  }
  if (exams.length)
    await handle.db.delete(exam).where(
      inArray(
        exam.id,
        exams.map((e) => e.id),
      ),
    );
  await handle.db.delete(instructorArtifact).where(eq(instructorArtifact.unitId, fx.unitId));
  await handle.db.delete(unitExercise).where(eq(unitExercise.unitId, fx.unitId));
  await fx.cleanup();
  await stopBoss();
  await handle.close();
});

describe("exams", () => {
  let examId: string;
  const t0 = new Date("2026-11-11T09:00:00Z");

  it("draw only problems never attempted, fewer when fewer remain, in course order", async () => {
    await getOrCreateAttempt(handle.db, { ownerId: fx.ownerId, exerciseId: fx.exerciseId });
    expect((await examOverview(handle.db, fx.ownerId, fx.courseId)).available).toBe(2);
    const started = await startExam(handle.db, fx.ownerId, fx.courseId, { questions: 5, minutes: 30 }, Math.random, t0);
    examId = started.id;
    expect(started.exerciseIds).toEqual([`${fx.unitId}-x1`, `${fx.unitId}-x2`]);
    expect(started.deadlineAt.toISOString()).toBe("2026-11-11T09:30:00.000Z");
    const answers = await handle.db.select().from(attempt).where(eq(attempt.examId, examId));
    expect(answers.map((a) => a.mode)).toEqual(["self_test", "self_test"]);
  });

  it("allow one running exam per course and refuse a learner not taking it", async () => {
    await expect(startExam(handle.db, fx.ownerId, fx.courseId, { questions: 1, minutes: 30 })).rejects.toThrow(ExamError);
    await expect(startExam(handle.db, "nobody", fx.courseId, { questions: 1, minutes: 30 })).rejects.toThrow(/Take the course/);
  });

  it("stay closed book: while the exam runs its problems cannot be opened for practice, help or solutions", async () => {
    expect(await runningExamFor(handle.db, fx.ownerId, `${fx.unitId}-x1`, new Date("2026-11-11T09:20:00Z"))).toEqual({ id: examId });
    expect(await runningExamFor(handle.db, fx.ownerId, fx.exerciseId, new Date("2026-11-11T09:20:00Z"))).toBeNull();
    // Past its deadline and grace the exam no longer holds its problems, closed or not.
    expect(await runningExamFor(handle.db, fx.ownerId, `${fx.unitId}-x1`, new Date("2026-11-11T09:31:00Z"))).toBeNull();
    // Attempt creation checks the real clock, so for these checks the deadline is moved ahead of it.
    const [original] = await handle.db.select({ deadlineAt: exam.deadlineAt }).from(exam).where(eq(exam.id, examId));
    const deadlineAt = original!.deadlineAt;
    await handle.db
      .update(exam)
      .set({ deadlineAt: new Date(Date.now() + 3_600_000) })
      .where(eq(exam.id, examId));
    try {
      await expect(getOrCreateAttempt(handle.db, { ownerId: fx.ownerId, exerciseId: `${fx.unitId}-x1` })).rejects.toThrow(LearningError);
      await expect(startAttempt(handle.db, { ownerId: fx.ownerId, exerciseId: `${fx.unitId}-x2`, mode: "practice" })).rejects.toThrow(
        /running exam/,
      );
    } finally {
      await handle.db.update(exam).set({ deadlineAt }).where(eq(exam.id, examId));
    }
  });

  it("accept answers until the deadline's grace, and not after", async () => {
    await saveExamAnswer(handle.db, fx.ownerId, examId, `${fx.unitId}-x1`, "Take the sup over [0,1]...", new Date("2026-11-11T09:20:00Z"));
    await expect(
      saveExamAnswer(handle.db, fx.ownerId, examId, `${fx.unitId}-x2`, "late", new Date("2026-11-11T09:31:00Z")),
    ).rejects.toThrow(/Time is up/);
    await expect(
      saveExamAnswer(handle.db, fx.ownerId, examId, fx.exerciseId, "not in the exam", new Date("2026-11-11T09:20:00Z")),
    ).rejects.toThrow(/not part of this exam/);
  });

  it("submit once, queue each answered question for marking, and leave the unanswered one unanswered", async () => {
    const first = await submitExam(handle.db, fx.ownerId, examId, grader, "learner", new Date("2026-11-11T09:25:00Z"));
    expect(first).toEqual({ submitted: 1, alreadySubmitted: false });
    expect(await submitExam(handle.db, fx.ownerId, examId, grader)).toEqual({ submitted: 0, alreadySubmitted: true });
    const view = await examView(handle.db, fx.ownerId, examId);
    expect(view.questions.map((q) => q.outcome.kind)).toEqual(["awaiting", "unanswered"]);
    expect(view.result).toMatchObject({ questions: 2, awaiting: 1, unanswered: 1, score: null });
    await expect(
      saveExamAnswer(handle.db, fx.ownerId, examId, `${fx.unitId}-x2`, "after", new Date("2026-11-11T09:26:00Z")),
    ).rejects.toThrow(/submitted/);
    // After submission the problem can be practised, as a separate attempt that never sees the exam answer.
    const practice = await getOrCreateAttempt(handle.db, { ownerId: fx.ownerId, exerciseId: `${fx.unitId}-x1` });
    expect(practice).toMatchObject({ examId: null, mode: "practice", draftMarkdown: null });
    await handle.db.delete(attempt).where(eq(attempt.id, practice.id));
  });

  it("score a marked answer from the weighted checks, count unanswered as zero, and show worked solutions only where allowed", async () => {
    const [answer] = await handle.db
      .select()
      .from(attempt)
      .where(and(eq(attempt.examId, examId), eq(attempt.exerciseId, `${fx.unitId}-x1`)));
    const [version] = await handle.db.select().from(submissionVersion).where(eq(submissionVersion.attemptId, answer!.id));
    await handle.db
      .update(assessmentRun)
      .set({
        status: "feedback_ready",
        verdict: "revision_requested",
        feedback: {
          summary: "Sound start; the conclusion is incomplete.",
          checks: [
            { criterionId: "c1", status: "met", comment: "" },
            { criterionId: "c2", status: "partially_met", comment: "" },
          ],
          strengths: [],
          nextStep: "",
          alternateApproachRecognised: false,
          labels: [],
          citations: [],
        },
      })
      .where(eq(assessmentRun.submissionVersionId, version!.id));
    await handle.db.insert(instructorArtifact).values([
      {
        unitId: fx.unitId,
        exerciseId: `${fx.unitId}-x1`,
        kind: "reference_solution",
        markdown: "Bound each term, then take the supremum.",
        releasePolicy: "on_request_practice",
      },
      // Released only after an accepted answer; this question was not answered.
      {
        unitId: fx.unitId,
        exerciseId: `${fx.unitId}-x2`,
        kind: "reference_solution",
        markdown: "Withheld.",
        releasePolicy: "after_accepted",
      },
    ]);
    const view = await examView(handle.db, fx.ownerId, examId);
    expect(view.questions[0]!.outcome).toEqual({ kind: "marked", score: 0.8 });
    expect(view.result).toMatchObject({ marked: 1, unanswered: 1, score: 0.4 });
    expect(view.questions[0]!.solution).toContain("Bound each term");
    expect(view.questions[1]!.solution).toBeNull();
  });

  it("submit what was saved when the deadline passes", async () => {
    await addProblems([`${fx.unitId}-x3`]);
    const second = await startExam(handle.db, fx.ownerId, fx.courseId, { questions: 1, minutes: 10 }, Math.random, t0);
    await saveExamAnswer(handle.db, fx.ownerId, second.id, `${fx.unitId}-x3`, "Partial answer.", new Date("2026-11-11T09:05:00Z"));
    expect(await closeIfExpired(handle.db, fx.ownerId, second.id, grader, new Date("2026-11-11T09:09:00Z"))).toBe(false);
    expect(await closeIfExpired(handle.db, fx.ownerId, second.id, grader, new Date("2026-11-11T09:11:00Z"))).toBe(true);
    const [row] = await handle.db.select().from(exam).where(eq(exam.id, second.id));
    expect(row).toMatchObject({ status: "submitted", submittedBy: "deadline" });
    expect((await examView(handle.db, fx.ownerId, second.id)).questions[0]!.submitted).toBe("Partial answer.");
    expect((await examOverview(handle.db, fx.ownerId, fx.courseId)).available).toBe(0);
  });

  it("let only one of two racing starts through, and settle a save racing the submission either way", async () => {
    await addProblems([`${fx.unitId}-x4`, `${fx.unitId}-x5`]);
    const starts = await Promise.allSettled([
      startExam(handle.db, fx.ownerId, fx.courseId, { questions: 2, minutes: 30 }),
      startExam(handle.db, fx.ownerId, fx.courseId, { questions: 2, minutes: 30 }),
    ]);
    const won = starts.filter((s) => s.status === "fulfilled");
    const lost = starts.filter((s): s is PromiseRejectedResult => s.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0]!.reason).toBeInstanceOf(ExamError);
    const third = (won[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof startExam>>>).value;

    const [save] = await Promise.allSettled([
      saveExamAnswer(handle.db, fx.ownerId, third.id, `${fx.unitId}-x4`, "Written as time ran out."),
      submitExam(handle.db, fx.ownerId, third.id, grader),
    ]);
    const answer = (await examView(handle.db, fx.ownerId, third.id)).questions.find((q) => q.exerciseId === `${fx.unitId}-x4`)!;
    if (save.status === "fulfilled") expect(answer.submitted).toBe("Written as time ran out.");
    else expect(String(save.reason)).toMatch(/submitted/);
  });

  it("submit at the paper's zero only once the server's clock agrees", async () => {
    await addProblems([`${fx.unitId}-x6`]);
    const fourth = await startExam(handle.db, fx.ownerId, fx.courseId, { questions: 1, minutes: 5 }, Math.random, t0);
    expect(await submitAtDeadline(handle.db, fx.ownerId, fourth.id, grader, new Date("2026-11-11T09:04:59Z"))).toBe(false);
    expect(await submitAtDeadline(handle.db, fx.ownerId, fourth.id, grader, new Date("2026-11-11T09:05:00Z"))).toBe(true);
    const [row] = await handle.db.select().from(exam).where(eq(exam.id, fourth.id));
    expect(row).toMatchObject({ status: "submitted", submittedBy: "deadline" });
  });
});
