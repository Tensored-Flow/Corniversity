import { randomUUID } from "node:crypto";
import { defaultContentRoot, loadContent } from "@corniversity/content/load";
import { seedContent } from "@corniversity/content/seed";
import { createDb } from "@corniversity/db/client";
import { user } from "@corniversity/db/schema/auth";
import { changeProposal, course, courseVersion, enrolment, programme, programmeParticipation, source } from "@corniversity/db/schema/index";
import { enrol } from "@corniversity/db/services/enrolment";
import { suggestedRequests } from "@corniversity/db/services/library";
import {
  followProgramme,
  learnerProgrammeMap,
  programmeDetail,
  proposeProgrammeRoute,
  setParticipationStatus,
} from "@corniversity/db/services/programmes";
import { decideProposal } from "@corniversity/db/services/timetable";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Seeding the real catalogue twice changes nothing the second time, and learner records made in
 * between survive it. Then the Mind, Brain and AI programme is exercised against that catalogue:
 * found by its reference id, its blocks' readiness derived from real units, and a director
 * proposal confirmed without enrolling the learner in anything.
 */
const OWNER = `seed-owner-${randomUUID()}`;
let handle: ReturnType<typeof createDb>;
const bundle = loadContent(defaultContentRoot());

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 3 });
  await seedContent(handle.db, bundle);
  await handle.db
    .insert(user)
    .values({ id: OWNER, name: "Seed Test", email: `${OWNER}@example.test` })
    .onConflictDoNothing();
}, 180_000);

afterAll(async () => {
  await handle.db.delete(changeProposal).where(eq(changeProposal.ownerId, OWNER));
  await handle.db.delete(programmeParticipation).where(eq(programmeParticipation.ownerId, OWNER));
  await handle.db.delete(enrolment).where(eq(enrolment.ownerId, OWNER));
  await handle.db.delete(user).where(eq(user.id, OWNER));
  await handle.close();
});

const counts = async () => ({
  courses: (await handle.db.select({ n: count() }).from(course))[0]!.n,
  versions: (await handle.db.select({ n: count() }).from(courseVersion))[0]!.n,
  programmes: (await handle.db.select({ n: count() }).from(programme))[0]!.n,
  sources: (await handle.db.select({ n: count() }).from(source))[0]!.n,
});

describe("seeding is idempotent", () => {
  it("a second seed creates no course, version, programme or source, and keeps learner records", async () => {
    await enrol(handle.db, { ownerId: OWNER, courseId: "NEU-220", mode: "enrolled" });
    await followProgramme(handle.db, OWNER, "mind-and-computation", "learner");
    const before = await counts();
    expect(before.courses).toBe(bundle.courses.length);
    expect(before.programmes).toBe(bundle.programmes.length);
    const report = await seedContent(handle.db, bundle);
    expect(report.courseVersionsCreated).toBe(0);
    expect(await counts()).toEqual(before);
    expect(await handle.db.select().from(enrolment).where(eq(enrolment.ownerId, OWNER))).toHaveLength(1);
    expect(await handle.db.select().from(programmeParticipation).where(eq(programmeParticipation.ownerId, OWNER))).toHaveLength(1);
  }, 180_000);
});

describe("Mind, Brain and AI against the seeded catalogue", () => {
  it("is found by its reference id with twelve blocks, eight electives and readiness derived from real units", async () => {
    const detail = await programmeDetail(handle.db, "MIND-BRAIN-AI");
    expect(detail?.programme.id).toBe("mind-and-computation");
    expect(detail?.blocks).toHaveLength(12);
    expect(detail?.programme.electives).toHaveLength(8);
    const byId = new Map(detail!.blocks.map((b) => [b.block.id, b.report.readiness]));
    // MBI-07 maps prepared and unprepared CSA-210 units; MBI-02 maps only proposed courses.
    expect(byId.get("MBI-07")).toBe("partly_prepared");
    expect(byId.get("MBI-02")).toBe("proposed");
    // A unit that serves two blocks is one work item.
    const shared = detail!.workItems.find((w) => w.unitId === "CSA-210-u01");
    expect(shared?.blockIds.length).toBeGreaterThan(1);
    // The prepared COG-250 unit makes planning partly prepared, not prepared: its outlined units
    // are mapped too, so the block cannot claim coverage it does not have.
    const planning = detail!.blocks.find((b) => b.block.id === "MBI-09")!.report;
    expect(planning.readiness).toBe("partly_prepared");
    expect(planning.preparedUnitIds).toEqual(["COG-250-u01"]);
    expect(planning.unpreparedUnitIds).toHaveLength(7);
    // The prepared COG-260 unit is one piece of work for the three blocks it serves.
    const loop = detail!.workItems.filter((w) => w.unitId === "COG-260-u01");
    expect(loop).toHaveLength(1);
    expect(loop[0]!.blockIds).toEqual(["MBI-04", "MBI-06", "MBI-11"]);
  });

  it("a confirmed director proposal sets a focus and enrols the learner in nothing new", async () => {
    const proposal = await proposeProgrammeRoute(handle.db, OWNER, "MIND-BRAIN-AI");
    expect(proposal.kind).toBe("programme");
    const diff = proposal.diff as { focusBlockIds: string[]; suggestedCourseIds: string[] };
    expect(diff.focusBlockIds.length).toBeGreaterThan(0);
    // NEU-220 is already taken, so it is not suggested again.
    expect(diff.suggestedCourseIds).not.toContain("NEU-220");
    const enrolmentsBefore = (await handle.db.select().from(enrolment).where(eq(enrolment.ownerId, OWNER))).length;
    await decideProposal(handle.db, OWNER, proposal.id, "confirmed");
    const [part] = await handle.db.select().from(programmeParticipation).where(eq(programmeParticipation.ownerId, OWNER));
    expect(part?.focusBlockIds).toEqual(diff.focusBlockIds);
    expect((await handle.db.select().from(enrolment).where(eq(enrolment.ownerId, OWNER))).length).toBe(enrolmentsBefore);
    const map = await learnerProgrammeMap(handle.db, OWNER);
    expect(map[0]?.blocks.find((b) => b.blockId === "MBI-08")?.takingCourseIds).toEqual(["NEU-220"]);
    expect(map[0]?.methods).toHaveLength(8);
    expect(map[0]?.methods.every((m) => m.state === "unassessed")).toBe(true);
    // Recovery methods are taught by a prepared unit now; measurement is still planned only.
    const method = (id: string) => map[0]!.methods.find((m) => m.methodId === id)!;
    expect(method("parameter-recovery").plannedOnly).toBe(false);
    expect(method("model-recovery").preparedUnits.map((u) => u.unitId)).toContain("COG-260-u01");
    expect(method("measurement-reliability-validity").plannedOnly).toBe(true);
  });

  it("missing sources reach the library's request list as labelled leads, only while the programme is followed", async () => {
    const leads = (await suggestedRequests(handle.db, OWNER)).filter((s) => s.lead);
    expect(leads.map((l) => l.courseId).sort()).toEqual(["COG-250", "COG-250", "COG-260"]);
    for (const l of leads) {
      expect(l.essential).toBe(false);
      expect(l.links).toEqual([]);
      expect(l.edition).toBe("To be identified");
      expect(l.caveats).toMatch(/nothing here is a citation/);
    }
    await setParticipationStatus(handle.db, OWNER, "mind-and-computation", "left");
    expect((await suggestedRequests(handle.db, OWNER)).filter((s) => s.lead)).toEqual([]);
  });
});
