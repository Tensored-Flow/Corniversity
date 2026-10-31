import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { user } from "../schema/auth";
import { enrolment, programme, programmeParticipation } from "../schema/index";
import { followProgramme, getProgramme, listParticipation, ProgrammeError, setParticipationStatus } from "./programmes";

/**
 * Following programmes: by internal or reference id, idempotent, several at once, and never an
 * enrolment. (Route proposals against the real catalogue are tested with the seeded content in
 * the worker's seed test.)
 */
const OWNER = `programme-owner-${randomUUID()}`;
const A = `test-programme-a-${randomUUID().slice(0, 8)}`;
const B = `test-programme-b-${randomUUID().slice(0, 8)}`;
let handle: ReturnType<typeof createDb>;

const blocks = [
  {
    id: "TST-01",
    sequence: 1,
    title: "First block",
    centralQuestion: "q",
    entryLevel: "e",
    requiredCoverage: ["c"],
    prerequisiteReasoning: "r",
    bridges: [],
    canStudyAlongside: [],
    courseMappings: [{ courseId: "COG-100", unitIds: [], contribution: "x" }],
    sourceShelf: [],
    activities: [{ title: "a", description: "d", methodIds: [] }],
    evidenceOfUnderstanding: "e",
    gaps: [],
  },
];

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  await handle.db
    .insert(user)
    .values({ id: OWNER, name: "Programme Test", email: `${OWNER}@example.test` })
    .onConflictDoNothing();
  const ref = `TST-${randomUUID().slice(0, 6).toUpperCase()}`;
  await handle.db.insert(programme).values([
    { id: A, referenceId: ref, title: "Test programme A", description: "d", departmentIds: ["cognitive-science"], stages: [], blocks },
    { id: B, title: "Test programme B", description: "d", departmentIds: ["mathematics"], stages: [] },
  ]);
});

afterAll(async () => {
  await handle.db.delete(programmeParticipation).where(eq(programmeParticipation.ownerId, OWNER));
  await handle.db.delete(programme).where(eq(programme.id, A));
  await handle.db.delete(programme).where(eq(programme.id, B));
  await handle.db.delete(user).where(eq(user.id, OWNER));
  await handle.close();
});

describe("programme participation", () => {
  it("finds a programme by internal id or by its stable reference id", async () => {
    const byId = await getProgramme(handle.db, A);
    expect(byId?.id).toBe(A);
    expect((await getProgramme(handle.db, byId!.referenceId!))?.id).toBe(A);
    expect(await getProgramme(handle.db, "../etc")).toBeNull();
  });

  it("following is idempotent, keeps only real block ids as focus, and creates no enrolment", async () => {
    await followProgramme(handle.db, OWNER, A, "learner", ["TST-01", "NOPE-99"]);
    const again = await followProgramme(handle.db, OWNER, A, "learner");
    expect(again.focusBlockIds).toEqual(["TST-01"]);
    expect((await listParticipation(handle.db, OWNER)).filter((p) => p.programmeId === A)).toHaveLength(1);
    expect(await handle.db.select().from(enrolment).where(eq(enrolment.ownerId, OWNER))).toEqual([]);
  });

  it("a learner can follow several programmes, and leave one without touching the other", async () => {
    await followProgramme(handle.db, OWNER, B, "onboarding");
    await setParticipationStatus(handle.db, OWNER, A, "left");
    const rows = await listParticipation(handle.db, OWNER);
    expect(rows.find((p) => p.programmeId === A)?.status).toBe("left");
    expect(rows.find((p) => p.programmeId === B)?.status).toBe("following");
  });

  it("refuses an unknown programme", async () => {
    await expect(followProgramme(handle.db, OWNER, "no-such-programme", "learner")).rejects.toThrow(ProgrammeError);
  });
});
