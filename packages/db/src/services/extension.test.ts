import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "../../test/fixtures";
import { createDb } from "../client";
import {
  course,
  courseDepartment,
  courseVersion,
  curriculumProposal,
  curriculumProposalVersion,
  enrolment,
  resourceRequest,
  teachingUnit,
} from "../schema/index";
import { createProposal, decideOverlap, findOverlap, ProposalError, publishProposal, rejectProposal, reviseProposal } from "./extension";

/**
 * The subject/reading-programme workflow against PostgreSQL: a proposal searches what exists
 * first, cannot be published while an overlapping course is undecided, keeps every revision,
 * reuses only prepared units, and publishing lists a "proposed" catalogue item whose source
 * leads become requests: no enrolment, no verified source, no prepared teaching.
 */
let handle: ReturnType<typeof createDb>;
let fx: Fixture;
const word = () => Array.from({ length: 8 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");
const [w1, w2, w3, w4] = [word(), word(), word(), word()];
const published: string[] = [];

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  fx = await createFixture(handle.db, "proposal");
  // A distinctive title, so the overlap search finds this fixture course and nothing else.
  await handle.db
    .update(course)
    .set({ title: `Fixture ${w1}` })
    .where(eq(course.id, fx.courseId));
  await handle.db.update(teachingUnit).set({ status: "ready" }).where(eq(teachingUnit.id, fx.unitId));
});

afterAll(async () => {
  if (published.length) {
    await handle.db.delete(resourceRequest).where(inArray(resourceRequest.courseId, published));
    await handle.db.delete(curriculumProposal).where(eq(curriculumProposal.ownerId, fx.ownerId));
    await handle.db.delete(courseVersion).where(inArray(courseVersion.courseId, published));
    await handle.db.delete(courseDepartment).where(inArray(courseDepartment.courseId, published));
    await handle.db.delete(course).where(inArray(course.id, published));
  }
  await handle.db.delete(curriculumProposal).where(eq(curriculumProposal.ownerId, fx.ownerId));
  await fx.cleanup();
  await handle.close();
});

const input = () => ({
  kind: "reading_course" as const,
  departmentId: fx.departmentId,
  title: `Reading ${w1} closely`,
  purpose: `To read the ${w2} literature slowly, with problems.`,
  scope: `${w1} ${w3} ${w4}, leaving out applications.`,
  depth: "rigorous" as const,
  sourceCandidates: [
    { title: `${w2} lecture notes`, note: "chapters 1-3" },
    { title: `${w3} monograph`, note: "" },
  ],
});

describe("proposing a subject or reading programme", () => {
  it("finds the overlapping course first and refuses to publish until it is decided", async () => {
    const p = await createProposal(handle.db, fx.ownerId, input());
    expect(p).toMatchObject({ status: "draft", version: 1 });
    const overlap = await findOverlap(handle.db, `${p.title} ${p.scope}`);
    expect(overlap.courses.map((c) => c.id)).toEqual([fx.courseId]);
    await expect(publishProposal(handle.db, fx.ownerId, p.id)).rejects.toThrow(`Decide on each overlapping course first: ${fx.courseId}.`);
    await expect(decideOverlap(handle.db, fx.ownerId, p.id, { courseId: fx.courseId, decision: "distinct", note: "" })).rejects.toThrow(
      ProposalError,
    );
  });

  it("keeps every revision, reuses only prepared units, and publishes a proposed catalogue item with requests and no enrolment", async () => {
    const p = await createProposal(handle.db, fx.ownerId, input());
    await decideOverlap(handle.db, fx.ownerId, p.id, { courseId: fx.courseId, decision: "reuse", note: "use its unit" });
    await expect(reviseProposal(handle.db, fx.ownerId, p.id, { reusedUnitIds: ["NO-SUCH-u01"] })).rejects.toThrow(/prepared units/);
    const revised = await reviseProposal(handle.db, fx.ownerId, p.id, { reusedUnitIds: [fx.unitId], conceptIds: [fx.conceptId] });
    expect(revised.version).toBe(3);

    const { courseId } = await publishProposal(handle.db, fx.ownerId, p.id);
    published.push(courseId);
    expect(courseId).toMatch(/^[A-Z]{2,4}-9\d\d$/);
    const [version] = await handle.db.select().from(courseVersion).where(eq(courseVersion.courseId, courseId));
    expect(version?.readiness).toBe("proposed");
    expect(version?.blockers.map((b) => b.type)).toContain("source");
    expect(version?.catalogueNotes.preparationPath).toContain(fx.unitId);
    expect(version?.teachesConceptIds).toEqual([fx.conceptId]);
    expect(await handle.db.select().from(courseDepartment).where(eq(courseDepartment.courseId, courseId))).toHaveLength(1);
    const requests = await handle.db.select().from(resourceRequest).where(eq(resourceRequest.courseId, courseId));
    expect(requests.map((r) => r.status)).toEqual(["open", "open"]);
    expect(await handle.db.select().from(enrolment).where(eq(enrolment.courseVersionId, version!.id))).toHaveLength(0);

    const versions = await handle.db.select().from(curriculumProposalVersion).where(eq(curriculumProposalVersion.proposalId, p.id));
    expect(versions.map((v) => v.version).sort()).toEqual([1, 2, 3]);
    await expect(reviseProposal(handle.db, fx.ownerId, p.id, { depth: "survey" })).rejects.toThrow(/Only a draft/);
    await expect(publishProposal(handle.db, fx.ownerId, p.id)).rejects.toThrow(/Only a draft/);
  });

  it("publishes once under a double submit: one course, one set of requests", async () => {
    const p = await createProposal(handle.db, fx.ownerId, input());
    // Earlier tests published proposals that now overlap too; decide on every overlapping course.
    for (const c of (await findOverlap(handle.db, `${p.title} ${p.scope}`)).courses) {
      await decideOverlap(handle.db, fx.ownerId, p.id, { courseId: c.id, decision: "distinct", note: "a narrower reading" });
    }
    const results = await Promise.allSettled([publishProposal(handle.db, fx.ownerId, p.id), publishProposal(handle.db, fx.ownerId, p.id)]);
    const done = results.filter((r): r is PromiseFulfilledResult<{ courseId: string }> => r.status === "fulfilled");
    const refused = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(refused.map((r) => String(r.reason))).toEqual([expect.stringMatching(/changed while it was being published|Only a draft/)]);
    expect(done).toHaveLength(1);
    const courseId = done[0]!.value.courseId;
    published.push(courseId);
    expect(await handle.db.select().from(resourceRequest).where(eq(resourceRequest.courseId, courseId))).toHaveLength(2);
    const [row] = await handle.db.select().from(curriculumProposal).where(eq(curriculumProposal.id, p.id));
    expect(row).toMatchObject({ status: "published", publishedCourseId: courseId });
  });

  it("never publishes a rejected proposal, and refuses a department that does not exist", async () => {
    const p = await createProposal(handle.db, fx.ownerId, input());
    await rejectProposal(handle.db, fx.ownerId, p.id, "overlaps too much");
    await expect(publishProposal(handle.db, fx.ownerId, p.id)).rejects.toThrow(/Only a draft/);
    await expect(createProposal(handle.db, fx.ownerId, { ...input(), departmentId: "no-such-department" })).rejects.toThrow(
      /existing departments/,
    );
  });
});
