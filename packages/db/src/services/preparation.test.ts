import { checkUnitDraft, renderDraftLesson, type UnitDraft } from "@corniversity/core/preparation/pipeline";
import { preparationDraft } from "@corniversity/core/preparation/pipeline.fixture";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "../../test/fixtures";
import { createDb } from "../client";
import { getEnv } from "../env";
import { stopBoss } from "../queue";
import {
  courseVersion,
  enrolment,
  instructorArtifact,
  jobRecord,
  locator,
  preparationRequest,
  preparationStage,
  resourceRequest,
  source,
  sourceVersion,
  teachingUnit,
  unitDraft,
  unitExercise,
  unitPublication,
} from "../schema/index";
import {
  cancelPreparation,
  confirmPreparation,
  createPreparationRequest,
  listPreparations,
  PreparationError,
  preparationView,
  publishDraft,
  rejectDraft,
  resumePreparation,
  runPreparation,
} from "./preparation";

/**
 * Course preparation against PostgreSQL, with the scripted demo: the deterministic stages run and
 * leave artifacts, authoring is blocked honestly (nothing invented), cancel and resume never
 * duplicate work, a crashed worker's stage is retaken after its lease, and only the owner's act
 * publishes a draft, never over a unit prepared by hand.
 */
let handle: ReturnType<typeof createDb>;
let fx: Fixture;
const outlinedUnit = () => `${fx.courseId}-u02`;
const intake = {
  goal: "Study the course seriously with weekly problems.",
  depth: "rigorous",
  weeklyHours: 6,
  preferredSources: "",
  balance: "balanced",
  assessment: "feedback",
  materials: "",
  bufferUnits: 1,
};

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 3 });
  fx = await createFixture(handle.db, "prep");
  const sid = `src-${fx.courseId.toLowerCase()}`;
  await handle.db.insert(source).values({
    id: sid,
    title: "A reference-only textbook",
    kind: "book",
    canonicalUrl: "https://example.org/book",
    currentVersionId: `${sid}-v1`,
  });
  await handle.db.insert(sourceVersion).values({
    id: `${sid}-v1`,
    sourceId: sid,
    label: "2nd edition",
    url: "https://example.org/book",
    verifiedAt: "2026-11-01",
    verifiedBy: "test",
    licence: "All rights reserved",
    accessStatus: "reference_only",
    importAllowed: false,
  });
  await handle.db.insert(locator).values({
    id: `${sid}-ch1`,
    sourceVersionId: `${sid}-v1`,
    kind: "book_reference",
    payload: { kind: "book_reference", sourceVersionId: `${sid}-v1`, edition: "2nd edition", sectionLabel: "Chapter 1" },
    label: "Chapter 1",
    verifiedAt: "2026-11-01",
  });
  await handle.db
    .update(courseVersion)
    .set({ primarySourceIds: [sid] })
    .where(eq(courseVersion.id, fx.courseVersionId));
  await handle.db.insert(teachingUnit).values({
    id: outlinedUnit(),
    courseVersionId: fx.courseVersionId,
    sequence: 2,
    title: "An outlined unit",
    summary: "Still to prepare.",
    objectives: [{ id: "o1", description: "Outline objective." }],
    preparation: [{ description: "Read chapter 1.", locatorId: `${sid}-ch1` }],
    activities: [
      {
        id: "a1",
        type: "reading",
        title: "Read",
        instructions: "Read.",
        estimatedMinutes: 30,
        sourceLocatorIds: [],
        exerciseIds: [],
        sessionKind: "lecture",
      },
    ],
    exitCheck: { description: "test" },
    estimatedMinutes: 60,
    status: "draft",
    lessonMarkdown: "Outline only.",
  });
});

afterAll(async () => {
  await handle.db.delete(unitPublication).where(eq(unitPublication.ownerId, fx.ownerId));
  await handle.db.delete(instructorArtifact).where(eq(instructorArtifact.unitId, outlinedUnit()));
  await handle.db.delete(unitExercise).where(eq(unitExercise.unitId, outlinedUnit()));
  await handle.db.delete(unitDraft).where(eq(unitDraft.ownerId, fx.ownerId));
  await handle.db.delete(teachingUnit).where(eq(teachingUnit.id, outlinedUnit()));
  await fx.cleanup();
  await handle.db.delete(source).where(eq(source.id, `src-${fx.courseId.toLowerCase()}`));
  await stopBoss();
  await handle.close();
});

describe("preparing a course with the scripted demo", () => {
  it("plans stages within a finite budget, runs the deterministic ones and blocks authoring honestly", async () => {
    await expect(
      createPreparationRequest(handle.db, getEnv(), fx.ownerId, { courseId: fx.courseId, intake, budgetUsd: 500, autoPrepare: false }),
    ).rejects.toThrow(PreparationError);
    const request = await createPreparationRequest(handle.db, getEnv(), fx.ownerId, {
      courseId: fx.courseId,
      intake,
      budgetUsd: 2,
      autoPrepare: false,
    });
    const planned = await handle.db.select().from(preparationStage).where(eq(preparationStage.requestId, request.id));
    expect(planned.map((s) => `${s.stageKey}:${s.unitKey}`).sort()).toEqual(
      [
        "source_inspection:",
        "primary_shelf:",
        "concept_mapping:",
        "syllabus_workload:",
        "resource_requirements:",
        `unit_authoring:${outlinedUnit()}`,
        `checks:${outlinedUnit()}`,
        `publication:${outlinedUnit()}`,
      ].sort(),
    );
    // Nothing runs until confirmed, and confirming enrols nobody.
    const enrolmentsBefore = (await handle.db.select().from(enrolment).where(eq(enrolment.ownerId, fx.ownerId))).length;
    await confirmPreparation(handle.db, fx.ownerId, request.id);
    const [job] = await handle.db
      .select()
      .from(jobRecord)
      .where(and(eq(jobRecord.ownerId, fx.ownerId), eq(jobRecord.kind, "prepare-course")));
    expect(job).toBeDefined();
    const result = await runPreparation(handle.db, getEnv(), { idempotencyKey: "t", ownerId: fx.ownerId, requestId: request.id });
    expect(result.status).toBe("blocked");
    expect(result.ran).toContain("source_inspection");
    const view = await preparationView(handle.db, fx.ownerId, request.id);
    const authoring = view!.stages.find((s) => s.stageKey === "unit_authoring");
    expect(authoring).toMatchObject({ status: "blocked" });
    expect(authoring?.error).toMatch(/No permitted source passages/);
    expect(view!.drafts).toHaveLength(0);
    expect(view!.request.statusNote).toMatch(/No permitted source passages/);
    expect(view!.summary).toBe("2 units mapped; 1 prepared; your next sessions are ready.");
    const sourceArtifact = view!.stages.find((s) => s.stageKey === "source_inspection")?.artifact as {
      sources: { importAllowed: boolean }[];
    };
    expect(sourceArtifact.sources[0]).toMatchObject({ importAllowed: false });
    const requests = await handle.db.select().from(resourceRequest).where(eq(resourceRequest.ownerId, fx.ownerId));
    expect(requests).toHaveLength(1);
    expect((await handle.db.select().from(enrolment).where(eq(enrolment.ownerId, fx.ownerId))).length).toBe(enrolmentsBefore);
  });

  it("cancels and resumes without repeating finished stages or duplicating requests", async () => {
    const [request] = await listPreparations(handle.db, fx.ownerId);
    await cancelPreparation(handle.db, fx.ownerId, request!.id);
    expect((await runPreparation(handle.db, getEnv(), { idempotencyKey: "t2", ownerId: fx.ownerId, requestId: request!.id })).status).toBe(
      "cancelled",
    );
    await resumePreparation(handle.db, fx.ownerId, request!.id);
    const again = await runPreparation(handle.db, getEnv(), { idempotencyKey: "t3", ownerId: fx.ownerId, requestId: request!.id });
    expect(again.ran).not.toContain("source_inspection");
    expect(again.ran).toContain(`unit_authoring:${outlinedUnit()}`);
    expect(await handle.db.select().from(resourceRequest).where(eq(resourceRequest.ownerId, fx.ownerId))).toHaveLength(1);
  });

  it("retakes a stage whose worker crashed after its lease expires, and leaves a live lease alone", async () => {
    const [request] = await listPreparations(handle.db, fx.ownerId);
    const [stage] = await handle.db
      .select()
      .from(preparationStage)
      .where(and(eq(preparationStage.requestId, request!.id), eq(preparationStage.stageKey, "unit_authoring")));
    await handle.db
      .update(preparationStage)
      .set({ status: "running", leaseUntil: new Date(Date.now() + 60_000) })
      .where(eq(preparationStage.id, stage!.id));
    await handle.db.update(preparationRequest).set({ status: "running" }).where(eq(preparationRequest.id, request!.id));
    expect(
      (await runPreparation(handle.db, getEnv(), { idempotencyKey: "t4", ownerId: fx.ownerId, requestId: request!.id })).ran,
    ).not.toContain(`unit_authoring:${outlinedUnit()}`);
    await handle.db
      .update(preparationStage)
      .set({ leaseUntil: new Date(Date.now() - 1000) })
      .where(eq(preparationStage.id, stage!.id));
    expect(
      (await runPreparation(handle.db, getEnv(), { idempotencyKey: "t5", ownerId: fx.ownerId, requestId: request!.id })).ran,
    ).toContain(`unit_authoring:${outlinedUnit()}`);
  });
});

describe("publication", () => {
  const madeDraft = () => preparationDraft("supplied-passage", `src-${fx.courseId.toLowerCase()}-ch1`);
  const checksFor = (draft: UnitDraft) =>
    checkUnitDraft(draft, {
      verifiedLocatorIds: new Set(draft.sourceLocatorIds),
      suppliedPassageIds: new Set(["supplied-passage"]),
      expectedObjectives: draft.objectives,
    });
  const insert = async (version: number, draft = madeDraft(), unitId = outlinedUnit()) => {
    const [request] = await listPreparations(handle.db, fx.ownerId);
    return (
      await handle.db
        .insert(unitDraft)
        .values({ requestId: request!.id, ownerId: fx.ownerId, unitId, version, draft, checks: checksFor(draft), status: "checked" })
        .returning()
    )[0]!;
  };

  it("does not let a previously checked legacy draft bypass the stronger publication gate", async () => {
    const draft = await insert(1);
    await handle.db
      .update(unitDraft)
      .set({ checks: [{ name: "lesson-length", result: "pass", detail: "old check" }] })
      .where(eq(unitDraft.id, draft.id));
    await expect(publishDraft(handle.db, fx.ownerId, draft.id)).rejects.toThrow(/predates the current evidence/);
    expect((await handle.db.select().from(unitDraft).where(eq(unitDraft.id, draft.id)))[0]?.status).toBe("checked");
    expect(await handle.db.select().from(unitPublication).where(eq(unitPublication.unitId, outlinedUnit()))).toHaveLength(0);
  });

  it("publishes only for the owner after current checks, stores worked examples, and keeps reference solutions instructor-only", async () => {
    const data = madeDraft();
    const draft = await insert(2, data);
    await expect(publishDraft(handle.db, "someone-else", draft.id)).rejects.toThrow(/not found/);
    await publishDraft(handle.db, fx.ownerId, draft.id);
    const [unit] = await handle.db.select().from(teachingUnit).where(eq(teachingUnit.id, outlinedUnit()));
    expect(unit).toMatchObject({ status: "ready", lessonMarkdown: renderDraftLesson(data) });
    expect(unit!.checks.at(-1)).toMatchObject({ name: "owner-review", result: "pass" });
    const exercises = await handle.db.select().from(unitExercise).where(eq(unitExercise.unitId, outlinedUnit()));
    expect(exercises.map((e) => e.id)).toEqual([1, 2, 3].map((i) => `${outlinedUnit()}-p2-ex${i}`));
    const [reference] = await handle.db
      .select()
      .from(instructorArtifact)
      .where(eq(instructorArtifact.exerciseId, `${outlinedUnit()}-p2-ex1`));
    expect(reference).toMatchObject({
      kind: "reference_solution",
      releasePolicy: "on_request_practice",
      markdown: data.exercises[0]!.referenceSolution,
    });
    expect(unit!.lessonMarkdown).not.toContain(data.exercises[0]!.referenceSolution);
    const [publication] = await handle.db.select().from(unitPublication).where(eq(unitPublication.unitId, outlinedUnit()));
    expect(publication).toMatchObject({ active: true, previous: { status: "draft", lessonMarkdown: "Outline only." } });
    await expect(rejectDraft(handle.db, fx.ownerId, draft.id, "too late")).rejects.toThrow(/already decided/);
    const hand = await insert(1, data, fx.unitId);
    await expect(publishDraft(handle.db, fx.ownerId, hand.id)).rejects.toThrow(/already prepared/);
    expect((await handle.db.select().from(unitDraft).where(eq(unitDraft.id, hand.id)))[0]?.status).toBe("checked");
    await handle.db.delete(unitDraft).where(eq(unitDraft.id, hand.id));
  });

  it("rechecks a modified draft rather than trusting its stored pass flags", async () => {
    const draft = await insert(3);
    const modified = madeDraft();
    modified.lessonMarkdown = "This repeated sentence demonstrates why a word count is insufficient. ".repeat(100);
    await handle.db.update(unitDraft).set({ draft: modified }).where(eq(unitDraft.id, draft.id));
    await expect(publishDraft(handle.db, fx.ownerId, draft.id)).rejects.toThrow(/current evidence and teaching checks/);
    expect((await handle.db.select().from(unitDraft).where(eq(unitDraft.id, draft.id)))[0]?.status).toBe("checked");
  });

  it("publishes once under double submit and serialises two drafts for one unit without losing records", async () => {
    const draft = await insert(4);
    const results = await Promise.allSettled([
      publishDraft(handle.db, fx.ownerId, draft.id),
      publishDraft(handle.db, fx.ownerId, draft.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const generated = (await handle.db.select().from(unitExercise).where(eq(unitExercise.unitId, outlinedUnit()))).filter((e) =>
      e.id.includes("-p4-"),
    );
    expect(generated).toHaveLength(3);
    const [five, six] = [await insert(5), await insert(6)];
    await Promise.all([publishDraft(handle.db, fx.ownerId, five.id), publishDraft(handle.db, fx.ownerId, six.id)]);
    const publications = await handle.db.select().from(unitPublication).where(eq(unitPublication.unitId, outlinedUnit()));
    expect(publications.filter((p) => p.active)).toHaveLength(1);
    expect(publications).toHaveLength(4);
    const previous = (await handle.db.select().from(teachingUnit).where(eq(teachingUnit.id, outlinedUnit())))[0]!;
    const broken = await insert(7);
    await handle.db
      .update(unitDraft)
      .set({ draft: { ...madeDraft(), exercises: [{ ...madeDraft().exercises[0]!, referenceSolution: null }] } as unknown as UnitDraft })
      .where(eq(unitDraft.id, broken.id));
    await expect(publishDraft(handle.db, fx.ownerId, broken.id)).rejects.toThrow();
    expect((await handle.db.select().from(teachingUnit).where(eq(teachingUnit.id, outlinedUnit())))[0]!.lessonMarkdown).toBe(
      previous.lessonMarkdown,
    );
    expect(
      (await handle.db.select().from(unitExercise).where(eq(unitExercise.unitId, outlinedUnit()))).filter((e) => e.id.includes("-p7-")),
    ).toHaveLength(0);
    expect((await handle.db.select().from(unitDraft).where(eq(unitDraft.id, broken.id)))[0]?.status).toBe("checked");
  });
});
