import { randomUUID } from "node:crypto";
import { defaultContentRoot, loadContent } from "@corniversity/content/load";
import { seedContent } from "@corniversity/content/seed";
import type { RouteProposal } from "@corniversity/core";
import { createDb } from "@corniversity/db/client";
import { user } from "@corniversity/db/schema/auth";
import {
  changeProposal,
  course,
  courseVersion,
  enrolment,
  learnerConceptOverride,
  programme,
  programmeParticipation,
  source,
} from "@corniversity/db/schema/index";
import { enrol } from "@corniversity/db/services/enrolment";
import { suggestedRequests } from "@corniversity/db/services/library";
import { assessPrerequisites, candidatePlans, setConceptSelfReport } from "@corniversity/db/services/programme";
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
import { seedContentIfRequested } from "./seed-on-start";

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
  await handle.db.delete(learnerConceptOverride).where(eq(learnerConceptOverride.userId, OWNER));
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

describe("seeding when the worker starts", () => {
  it("seeds only when the deployment asks for it, and a repeat start creates nothing", async () => {
    expect(await seedContentIfRequested(handle.db, undefined)).toBeNull();
    expect(await seedContentIfRequested(handle.db, "0")).toBeNull();
    const report = await seedContentIfRequested(handle.db, "1");
    expect(report?.courseVersionsCreated).toBe(0);
    expect(report?.courseVersionsUnchanged).toBe(bundle.courses.length);
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

  it("never lets an older route displace a newer focus", async () => {
    const [before] = await handle.db.select().from(programmeParticipation).where(eq(programmeParticipation.ownerId, OWNER));
    const older = await proposeProgrammeRoute(handle.db, OWNER, "MIND-BRAIN-AI");
    const newer = await proposeProgrammeRoute(handle.db, OWNER, "MIND-BRAIN-AI");
    const status = async (id: string) =>
      (await handle.db.select({ status: changeProposal.status }).from(changeProposal).where(eq(changeProposal.id, id)))[0]?.status;
    // A new route supersedes the earlier draft, which can no longer be confirmed.
    expect(await status(older.id)).toBe("superseded");
    expect(await decideProposal(handle.db, OWNER, older.id, "confirmed")).toBe("not_open");
    // The focus changes another way after the newer route was proposed: confirming it changes nothing.
    await handle.db
      .update(programmeParticipation)
      .set({ focusBlockIds: ["MBI-02"] })
      .where(eq(programmeParticipation.ownerId, OWNER));
    expect(await decideProposal(handle.db, OWNER, newer.id, "confirmed")).toBe("superseded");
    expect(await status(newer.id)).toBe("superseded");
    const [after] = await handle.db.select().from(programmeParticipation).where(eq(programmeParticipation.ownerId, OWNER));
    expect(after?.focusBlockIds).toEqual(["MBI-02"]);
    await handle.db
      .update(programmeParticipation)
      .set({ focusBlockIds: before?.focusBlockIds ?? [] })
      .where(eq(programmeParticipation.ownerId, OWNER));
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

  it("recognises a mathematics background rule by rule: programming and statistics are still asked for", async () => {
    // A learner who reports every mathematics concept the catalogue's rules mention, and nothing else.
    const maths = ["linear-algebra-vector-spaces", "multivariable-calculus", "ode-basics", "probability-measure-theoretic"];
    await setConceptSelfReport(handle.db, OWNER, maths, true, "test: a mathematics background, self-reported");
    const neu = await assessPrerequisites(handle.db, OWNER, "NEU-220");
    expect(neu.find((r) => r.ruleId === "NEU-220-mathematics")).toMatchObject({ satisfied: true, basis: "self_report" });
    expect(neu.find((r) => r.ruleId === "NEU-220-python-and-statistics")).toMatchObject({ satisfied: false, basis: "none" });
    expect(neu.find((r) => r.ruleId === "NEU-220-python-and-statistics")?.alternativeCourseIds).toContain("CSA-100");
    const cog = await assessPrerequisites(handle.db, OWNER, "COG-201");
    expect(cog.find((r) => r.ruleId === "COG-201-probability")?.satisfied).toBe(true);
    expect(cog.find((r) => r.ruleId === "COG-201-programming")?.satisfied).toBe(false);
    // Probability theory does not stand in for fitting models: COG-260 still asks for that.
    const fitting = (await assessPrerequisites(handle.db, OWNER, "COG-260")).find((r) => r.ruleId === "COG-260-likelihood");
    expect(fitting).toMatchObject({ satisfied: false, basis: "none" });
    expect(fitting?.alternativeCourseIds).toContain("NEU-220");
    // The director's route shows the same split, and recommends nothing past an unmet rule silently.
    const proposal = await proposeProgrammeRoute(handle.db, OWNER, "MIND-BRAIN-AI");
    const route = (proposal.diff as { route: RouteProposal }).route;
    // The learner takes NEU-220 (from the first test), so the route starts from it.
    expect(route.steps.find((st) => st.courseId === "NEU-220")?.action).toBe("continue");
    expect(route.recognised).toContainEqual(expect.objectContaining({ courseId: "NEU-220", basis: "self_report" }));
    expect(route.toPrepare.some((r) => r.courseId === "NEU-220" && /Python/.test(r.description))).toBe(true);
    expect(route.rationale.at(-1)).toMatch(/enrols you in nothing/);
  });

  it("proposes every first-term plan's courses only in modes they offer, with the programme chosen in orientation", async () => {
    // Choosing the programme adds its departments, which brings NEU-220 (offered enrolled or
    // audit, never as a reading seminar) into the plans; its lighter slot must fall back to audit.
    const answers: Parameters<typeof candidatePlans>[2] = {
      departmentIds: ["mathematics", "cognitive-science", "neuroscience", "computer-science-ai"],
      interestCourseIds: ["MAT-230"],
      programmeIds: ["mind-and-computation"],
    };
    const plans = await candidatePlans(handle.db, OWNER, answers);
    const versions = await handle.db
      .select({ courseId: courseVersion.courseId, modes: courseVersion.modesOffered })
      .from(courseVersion)
      .where(eq(courseVersion.isCurrent, true));
    const offered = new Map(versions.map((v) => [v.courseId, v.modes as string[]]));
    const courses = plans.flatMap((p) => p.courses.map((c) => ({ plan: p.id, ...c })));
    expect(courses.some((c) => c.courseId === "NEU-220")).toBe(true);
    for (const c of courses) {
      expect(offered.get(c.courseId), `${c.plan}: ${c.courseId} as ${c.mode}`).toContain(c.mode);
      if (c.mode === "enrolled") expect(c.preparedUnits, `${c.plan}: ${c.courseId}`).toBeGreaterThan(0);
    }
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
