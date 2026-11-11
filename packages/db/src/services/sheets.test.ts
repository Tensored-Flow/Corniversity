import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "../../test/fixtures";
import { createDb } from "../client";
import { stopBoss } from "../queue";
import { assessmentRun, attempt, courseVersion, enrolment, submissionVersion, teachingUnit } from "../schema/index";
import { enrol, setEnrolmentStatus } from "./enrolment";
import { getOrCreateAttempt, saveDraft, submitAttempt } from "./learning";
import { activityFor, courseProgress, problemSheet } from "./sheets";

/**
 * Problem sheets and progress from practice attempts (exam answers flagged apart), the activity a
 * problem opens in, and taking a course again after leaving it.
 */
let handle: ReturnType<typeof createDb>;
let fx: Fixture;
const grader = { provider: "fixture", model: "fixture", promptVersion: "test", roleVersion: "test" };

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  fx = await createFixture(handle.db, "sheet");
});

afterAll(async () => {
  const attempts = await handle.db.select({ id: attempt.id }).from(attempt).where(eq(attempt.ownerId, fx.ownerId));
  if (attempts.length) {
    const ids = attempts.map((a) => a.id);
    const versions = await handle.db
      .select({ id: submissionVersion.id })
      .from(submissionVersion)
      .where(inArray(submissionVersion.attemptId, ids));
    if (versions.length)
      await handle.db.delete(assessmentRun).where(
        inArray(
          assessmentRun.submissionVersionId,
          versions.map((v) => v.id),
        ),
      );
    await handle.db.delete(submissionVersion).where(inArray(submissionVersion.attemptId, ids));
    await handle.db.delete(attempt).where(eq(attempt.ownerId, fx.ownerId));
  }
  await fx.cleanup();
  await stopBoss();
  await handle.close();
});

describe("problem sheets", () => {
  it("show each problem as not started, in progress, then submitted, and count it done once submitted", async () => {
    expect((await problemSheet(handle.db, fx.ownerId, fx.unitId)).map((p) => p.status)).toEqual(["not_started"]);
    const a = await getOrCreateAttempt(handle.db, { ownerId: fx.ownerId, exerciseId: fx.exerciseId });
    await saveDraft(handle.db, fx.ownerId, a.id, "Begin with the triangle inequality.");
    expect((await problemSheet(handle.db, fx.ownerId, fx.unitId))[0]!.status).toBe("in_progress");
    expect(await courseProgress(handle.db, fx.ownerId, fx.courseId)).toEqual([{ unitId: fx.unitId, problems: 1, done: 0 }]);
    await submitAttempt(handle.db, { ownerId: fx.ownerId, attemptId: a.id, contentMarkdown: "A full argument.", graderConfig: grader });
    expect((await problemSheet(handle.db, fx.ownerId, fx.unitId))[0]).toMatchObject({ status: "submitted", inExam: false });
    expect(await courseProgress(handle.db, fx.ownerId, fx.courseId)).toEqual([{ unitId: fx.unitId, problems: 1, done: 1 }]);
  });

  it("open a problem in the activity that holds it, and a tutorial otherwise", () => {
    const activities = [
      { id: "read", sessionKind: "lecture", exerciseIds: [] },
      { id: "lab", sessionKind: "lab", exerciseIds: ["p3"] },
      { id: "tut", sessionKind: "tutorial", exerciseIds: ["p1", "p2"] },
    ];
    expect(activityFor(activities, "p2")).toBe("tut");
    expect(activityFor(activities, "p3")).toBe("lab");
    expect(activityFor(activities)).toBe("tut");
    expect(activityFor([{ id: "read", sessionKind: "lecture", exerciseIds: [] }])).toBe("read");
    expect(activityFor([])).toBeNull();
  });
});

describe("a course updated since you enrolled", () => {
  it("counts progress on its current units, wherever the enrolment points", async () => {
    const [v1] = await handle.db.select().from(courseVersion).where(eq(courseVersion.id, fx.courseVersionId));
    const { id: _id, ...rest } = v1!;
    const [v2] = await handle.db
      .insert(courseVersion)
      .values({ ...rest, version: v1!.version + 1, contentHash: `${v1!.contentHash}-2`, isCurrent: true })
      .returning();
    await handle.db.update(courseVersion).set({ isCurrent: false }).where(eq(courseVersion.id, fx.courseVersionId));
    await handle.db.update(teachingUnit).set({ courseVersionId: v2!.id }).where(eq(teachingUnit.id, fx.unitId));
    try {
      expect(await courseProgress(handle.db, fx.ownerId, fx.courseId)).toEqual([{ unitId: fx.unitId, problems: 1, done: 1 }]);
    } finally {
      await handle.db.update(teachingUnit).set({ courseVersionId: fx.courseVersionId }).where(eq(teachingUnit.id, fx.unitId));
      await handle.db.update(courseVersion).set({ isCurrent: true }).where(eq(courseVersion.id, fx.courseVersionId));
      await handle.db.delete(courseVersion).where(eq(courseVersion.id, v2!.id));
    }
  });
});

describe("taking a course again", () => {
  it("brings back the same enrolment after leaving it", async () => {
    await handle.db
      .update(enrolment)
      .set({ idempotencyKey: `enrol:${fx.ownerId}:${fx.courseId}` })
      .where(eq(enrolment.id, fx.enrolmentId));
    await setEnrolmentStatus(handle.db, fx.ownerId, fx.enrolmentId, "withdrawn");
    const again = await enrol(handle.db, { ownerId: fx.ownerId, courseId: fx.courseId, mode: "enrolled" });
    expect(again.enrolment).toMatchObject({ id: fx.enrolmentId, status: "active", mode: "enrolled" });
  });
});
