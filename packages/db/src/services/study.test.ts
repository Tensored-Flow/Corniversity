import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { user } from "../schema/auth";
import { academicDeadline, learnerProfile, term } from "../schema/index";
import { ensureProfile } from "./onboarding";
import { ensureTerm } from "./programme";
import {
  academicStatus,
  createDeadline,
  getStudyPreferences,
  listDeadlines,
  markDeadlinesMet,
  StudyError,
  updateStudyPreferences,
  withdrawDeadline,
} from "./study";

/**
 * Study defaults for a new learner, preservation of earlier explicit choices, and the rule that
 * academic deadlines exist only when the learner chose them.
 */
const NEW = `study-new-${randomUUID()}`;
const EXISTING = `study-existing-${randomUUID()}`;
let handle: ReturnType<typeof createDb>;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  for (const id of [NEW, EXISTING]) {
    await handle.db
      .insert(user)
      .values({ id, name: "Study Test", email: `${id}@example.test` })
      .onConflictDoNothing();
    await ensureProfile(handle.db, id);
  }
  // An owner who chose term mode during orientation before these defaults existed.
  await handle.db.update(learnerProfile).set({ studyRhythm: "term" }).where(eq(learnerProfile.userId, EXISTING));
});

afterAll(async () => {
  for (const id of [NEW, EXISTING]) {
    await handle.db.delete(academicDeadline).where(eq(academicDeadline.ownerId, id));
    await handle.db.delete(term).where(eq(term.ownerId, id));
    await handle.db.delete(user).where(eq(user.id, id));
  }
  await handle.close();
});

describe("study preferences", () => {
  it("a new learner gets the defaults and none of them is recorded as a choice", async () => {
    const { preferences, explicit } = await getStudyPreferences(handle.db, NEW);
    expect(preferences).toMatchObject({
      rhythm: "rolling",
      weeklyAppointments: true,
      hardDeadlines: false,
      examinations: false,
      mainCourseLimit: 1,
      exploratoryLimit: 1,
    });
    expect(explicit).toEqual([]);
  });

  it("an earlier explicit choice is preserved", async () => {
    const { preferences, explicit } = await getStudyPreferences(handle.db, EXISTING);
    expect(preferences.rhythm).toBe("term");
    expect(explicit).toEqual(["rhythm"]);
  });

  it("choosing term mode changes only the rhythm", async () => {
    const next = await updateStudyPreferences(handle.db, NEW, { rhythm: "term" });
    expect(next).toMatchObject({ rhythm: "term", examinations: false, hardDeadlines: false });
    const [row] = await handle.db.select().from(learnerProfile).where(eq(learnerProfile.userId, NEW));
    expect(row?.studyRhythm).toBe("term");
    await updateStudyPreferences(handle.db, NEW, { rhythm: "rolling" });
  });

  it("refuses a heavier load until the workload preview has been seen", async () => {
    await expect(updateStudyPreferences(handle.db, NEW, { mainCourseLimit: 3 })).rejects.toThrow(StudyError);
    const next = await updateStudyPreferences(handle.db, NEW, { mainCourseLimit: 2, heavierLoadPreviewedAt: new Date().toISOString() });
    expect(next.mainCourseLimit).toBe(2);
  });
});

describe("a rolling plan has no completion date", () => {
  it("a learner who never chose a rhythm gets a rolling horizon without reading or synthesis weeks", async () => {
    const row = await ensureTerm(handle.db, NEW, {}, "Europe/London");
    expect(row.mode).toBe("rolling");
    expect(row.readingWeek).toBe(false);
    expect(row.synthesisWeek).toBe(false);
    expect(row.title).toMatch(/^Rolling study from/);
  });
});

describe("academic deadlines", () => {
  it("cannot be created while deadlines are off; a milestone always can and is not binding", async () => {
    await expect(
      createDeadline(handle.db, EXISTING, { kind: "assessment", title: "Problem set", dueAt: new Date(Date.now() + 86_400_000) }),
    ).rejects.toThrow(/deadlines are off/i);
    await expect(
      createDeadline(handle.db, EXISTING, { kind: "examination", title: "Paper", dueAt: new Date(Date.now() + 86_400_000) }),
    ).rejects.toThrow(/examinations are off/i);
    const milestone = await createDeadline(handle.db, EXISTING, {
      kind: "milestone",
      title: "Finish unit 2",
      dueAt: new Date(Date.now() - 86_400_000),
    });
    expect(milestone.binding).toBe(false);
    // A passed milestone is not an academic consequence.
    expect(await academicStatus(handle.db, EXISTING)).toEqual([]);
  });

  it("once switched on, a binding deadline that passes unmet is the only consequence recorded", async () => {
    await updateStudyPreferences(handle.db, EXISTING, { hardDeadlines: true });
    const passed = await createDeadline(handle.db, EXISTING, {
      kind: "assessment",
      title: "Proof portfolio",
      dueAt: new Date(Date.now() - 3_600_000),
    });
    expect(passed.binding).toBe(true);
    const status = await academicStatus(handle.db, EXISTING);
    expect(status).toEqual([{ deadlineId: passed.id, kind: "assessment", outcome: "passed" }]);
    await withdrawDeadline(handle.db, EXISTING, passed.id);
    expect(await academicStatus(handle.db, EXISTING)).toEqual([]);
    expect((await listDeadlines(handle.db, EXISTING)).find((d) => d.id === passed.id)?.status).toBe("withdrawn");
  });

  it("a submission meets the open deadlines attached to its exercise", async () => {
    // markDeadlinesMet is keyed by exercise; with no deadline on the exercise nothing changes.
    await markDeadlinesMet(handle.db, EXISTING, "NO-SUCH-EXERCISE");
    expect((await listDeadlines(handle.db, EXISTING)).every((d) => d.status !== "met")).toBe(true);
  });
});
