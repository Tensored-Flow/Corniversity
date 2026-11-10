import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "../src/client";
import { user } from "../src/schema/auth";
import { concept, course, courseVersion, department, enrolment, teachingUnit, unitExercise } from "../src/schema/index";

/**
 * A minimal academic chain for integration tests that need real rows (an owner enrolled in a
 * course with one prepared unit, one reading activity and one tutorial exercise) without seeding
 * the whole catalogue. Every id carries a random suffix so test files never collide.
 */
export interface Fixture {
  ownerId: string;
  departmentId: string;
  courseId: string;
  courseVersionId: string;
  unitId: string;
  exerciseId: string;
  conceptId: string;
  prerequisiteConceptId: string;
  enrolmentId: string;
  readingActivityId: string;
  tutorialActivityId: string;
  cleanup: () => Promise<void>;
}

export async function createFixture(db: Database, label = "fixture"): Promise<Fixture> {
  const s = randomUUID().slice(0, 8);
  const ownerId = `${label}-owner-${s}`;
  const departmentId = `dept-${s}`;
  const courseId = `TST-${s.slice(0, 3).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
  const conceptId = `concept-${s}`;
  const prerequisiteConceptId = `prereq-${s}`;
  const unitId = `${courseId}-u01`;
  const exerciseId = `${unitId}-ex1`;
  await db.insert(user).values({ id: ownerId, name: "Fixture Owner", email: `${ownerId}@example.test` });
  await db.insert(department).values({ id: departmentId, title: "Fixture", shortTitle: "Fix", identity: "test", emblem: "test" });
  await db.insert(concept).values([
    { id: conceptId, title: "Fixture concept", departmentId, description: "A concept for tests." },
    { id: prerequisiteConceptId, title: "Fixture prerequisite", departmentId, description: "A prerequisite for tests." },
  ]);
  await db
    .insert(course)
    .values({ id: courseId, title: "Fixture course", primaryDepartmentId: departmentId, level: "foundation", position: "test" });
  const [version] = await db
    .insert(courseVersion)
    .values({
      courseId,
      version: 1,
      contentHash: s,
      readiness: "teaching_ready",
      purpose: "test",
      description: "test",
      workload: { minimum: 1, typical: 2, maximum: 3 },
      provenance: { authoringMethod: "test fixture", reviewerNotes: [] },
    })
    .returning({ id: courseVersion.id });
  await db.insert(teachingUnit).values({
    id: unitId,
    courseVersionId: version!.id,
    sequence: 1,
    title: "Fixture unit",
    summary: "test",
    objectives: [{ id: "o1", description: "Test objective." }],
    prerequisiteConceptIds: [prerequisiteConceptId],
    teachesConceptIds: [conceptId],
    activities: [
      {
        id: "a1",
        type: "reading",
        title: "Read",
        instructions: "Read it.",
        estimatedMinutes: 30,
        sourceLocatorIds: [],
        exerciseIds: [],
        sessionKind: "lecture",
      },
      {
        id: "a2",
        type: "proof_workshop",
        title: "Prove",
        instructions: "Prove it.",
        estimatedMinutes: 45,
        sourceLocatorIds: [],
        exerciseIds: [exerciseId],
        sessionKind: "tutorial",
      },
    ],
    exitCheck: { description: "test" },
    estimatedMinutes: 75,
    status: "ready",
    lessonMarkdown: "# Fixture lesson\n\nA complete normed space is a Banach space.",
  });
  await db.insert(unitExercise).values({
    id: exerciseId,
    unitId,
    sequence: 1,
    title: "Fixture exercise",
    kind: "proof",
    promptMarkdown: "Prove the fixture statement.",
    conceptIds: [conceptId],
    hintLadder: ["First hint.", "Second hint."],
    rubric: {
      version: 1,
      criteria: [
        {
          id: "c1",
          criterion: "Correct.",
          weight: 1,
          levels: [
            { label: "no", description: "-" },
            { label: "yes", description: "-" },
          ],
        },
      ],
      acceptAlternateApproaches: true,
      referenceIsExhaustive: false,
    },
    rubricVersion: 1,
    origin: "original",
    estimatedMinutes: 30,
  });
  const [enrolled] = await db
    .insert(enrolment)
    .values({ ownerId, courseVersionId: version!.id, mode: "enrolled", idempotencyKey: `enrol-${s}` })
    .returning({ id: enrolment.id });
  return {
    ownerId,
    departmentId,
    courseId,
    courseVersionId: version!.id,
    unitId,
    exerciseId,
    conceptId,
    prerequisiteConceptId,
    enrolmentId: enrolled!.id,
    readingActivityId: "a1",
    tutorialActivityId: "a2",
    cleanup: async () => {
      await db.delete(user).where(eq(user.id, ownerId));
      await db.delete(course).where(eq(course.id, courseId));
      await db.delete(concept).where(eq(concept.departmentId, departmentId));
      await db.delete(department).where(eq(department.id, departmentId));
    },
  };
}
