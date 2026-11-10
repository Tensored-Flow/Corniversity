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
    expect(authoring?.error).toMatch(/No model is configured/);
    expect(view!.drafts).toHaveLength(0);
    expect(view!.request.statusNote).toMatch(/No model is configured/);
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
  it("publishes only a checked draft, by the owner, into an outlined unit, and never over a unit prepared by hand", async () => {
    const [request] = await listPreparations(handle.db, fx.ownerId);
    const draft = {
      lessonMarkdown: "A lesson.",
      objectives: ["Understand the outlined topic."],
      sourceLocatorIds: [`src-${fx.courseId.toLowerCase()}-ch1`],
      exercises: [
        {
          title: "First exercise",
          kind: "proof" as const,
          promptMarkdown: "Prove the statement.",
          hintLadder: ["Start from the definition."],
          criteria: [{ criterion: "Correct.", weight: 1 }],
          referenceSolution: "The reference argument, instructor-only.",
          stage: "independent" as const,
        },
      ],
      misconceptions: [],
    };
    const [failed] = await handle.db
      .insert(unitDraft)
      .values({
        requestId: request!.id,
        ownerId: fx.ownerId,
        unitId: outlinedUnit(),
        version: 1,
        draft,
        checks: [{ name: "lesson-length", result: "fail", detail: "short" }],
        status: "failed_checks",
      })
      .returning();
    await expect(publishDraft(handle.db, fx.ownerId, failed!.id)).rejects.toThrow(/passed every automatic check/);
    const [checked] = await handle.db
      .insert(unitDraft)
      .values({
        requestId: request!.id,
        ownerId: fx.ownerId,
        unitId: outlinedUnit(),
        version: 2,
        draft,
        checks: [{ name: "lesson-length", result: "pass", detail: "ok" }],
        status: "checked",
      })
      .returning();
    await expect(publishDraft(handle.db, "someone-else", checked!.id)).rejects.toThrow(/not found/);
    await publishDraft(handle.db, fx.ownerId, checked!.id);
    const [unit] = await handle.db.select().from(teachingUnit).where(eq(teachingUnit.id, outlinedUnit()));
    expect(unit).toMatchObject({ status: "ready", lessonMarkdown: "A lesson." });
    expect(unit!.checks.at(-1)).toMatchObject({ name: "owner-review", result: "pass" });
    const exercises = await handle.db.select().from(unitExercise).where(eq(unitExercise.unitId, outlinedUnit()));
    expect(exercises.map((e) => e.id)).toEqual([`${outlinedUnit()}-p2-ex1`]);
    const [reference] = await handle.db
      .select()
      .from(instructorArtifact)
      .where(eq(instructorArtifact.exerciseId, `${outlinedUnit()}-p2-ex1`));
    expect(reference).toMatchObject({ kind: "reference_solution", releasePolicy: "on_request_practice" });
    const [publication] = await handle.db.select().from(unitPublication).where(eq(unitPublication.unitId, outlinedUnit()));
    expect(publication).toMatchObject({ active: true, previous: { status: "draft", lessonMarkdown: "Outline only." } });
    await expect(rejectDraft(handle.db, fx.ownerId, checked!.id, "too late")).rejects.toThrow(/already decided/);

    // A unit prepared by hand (ready, never published from a draft) is not replaced.
    const [hand] = await handle.db
      .insert(unitDraft)
      .values({ requestId: request!.id, ownerId: fx.ownerId, unitId: fx.unitId, version: 1, draft, checks: [], status: "checked" })
      .returning();
    await expect(publishDraft(handle.db, fx.ownerId, hand!.id)).rejects.toThrow(/already prepared/);
    // The refusal rolled back the claim: the draft is still only checked.
    expect((await handle.db.select().from(unitDraft).where(eq(unitDraft.id, hand!.id)))[0]?.status).toBe("checked");
    await handle.db.delete(unitDraft).where(eq(unitDraft.id, hand!.id));
  });

  it("publishes a draft once under a double submit, serialises two drafts for one unit, and leaves nothing behind when it fails part-way", async () => {
    const [request] = await listPreparations(handle.db, fx.ownerId);
    const exercise = {
      title: "Later exercise",
      kind: "proof" as const,
      promptMarkdown: "Prove it.",
      hintLadder: ["Start."],
      criteria: [{ criterion: "Correct.", weight: 1 }],
      referenceSolution: "Instructor-only.",
      stage: "independent" as const,
    };
    const draftOf = (lessonMarkdown: string, exercises: unknown[]) => ({
      lessonMarkdown,
      objectives: ["Objective."],
      sourceLocatorIds: [],
      exercises: exercises as (typeof exercise)[],
      misconceptions: [],
    });
    const insert = async (version: number, d: ReturnType<typeof draftOf>) =>
      (
        await handle.db
          .insert(unitDraft)
          .values({ requestId: request!.id, ownerId: fx.ownerId, unitId: outlinedUnit(), version, draft: d, checks: [], status: "checked" })
          .returning()
      )[0]!;
    const activeCount = async () =>
      (await handle.db.select().from(unitPublication).where(eq(unitPublication.unitId, outlinedUnit()))).filter((p) => p.active).length;

    // The same draft, submitted twice at once: exactly one publication.
    const twice = await insert(3, draftOf("Lesson three.", [exercise]));
    const results = await Promise.allSettled([
      publishDraft(handle.db, fx.ownerId, twice.id),
      publishDraft(handle.db, fx.ownerId, twice.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const p3 = (await handle.db.select().from(unitExercise).where(eq(unitExercise.unitId, outlinedUnit()))).filter((e) =>
      e.id.includes("-p3-"),
    );
    expect(p3).toHaveLength(1);
    expect(await activeCount()).toBe(1);

    // Two drafts for the same unit at once: both publish, one after the other; one stays active.
    const [four, five] = [await insert(4, draftOf("Lesson four.", [exercise])), await insert(5, draftOf("Lesson five.", [exercise]))];
    await Promise.all([publishDraft(handle.db, fx.ownerId, four.id), publishDraft(handle.db, fx.ownerId, five.id)]);
    expect(await activeCount()).toBe(1);

    // A failure part-way (a second exercise with no reference solution) rolls everything back.
    const [unitBefore] = await handle.db.select().from(teachingUnit).where(eq(teachingUnit.id, outlinedUnit()));
    const broken = await insert(6, draftOf("Lesson six.", [exercise, { ...exercise, referenceSolution: null }]));
    await expect(publishDraft(handle.db, fx.ownerId, broken.id)).rejects.toThrow();
    const [unitAfter] = await handle.db.select().from(teachingUnit).where(eq(teachingUnit.id, outlinedUnit()));
    expect(unitAfter?.lessonMarkdown).toBe(unitBefore?.lessonMarkdown);
    const p6 = (await handle.db.select().from(unitExercise).where(eq(unitExercise.unitId, outlinedUnit()))).filter((e) =>
      e.id.includes("-p6-"),
    );
    expect(p6).toHaveLength(0);
    expect((await handle.db.select().from(unitDraft).where(eq(unitDraft.id, broken.id)))[0]?.status).toBe("checked");
    expect(await activeCount()).toBe(1);
  });
});
