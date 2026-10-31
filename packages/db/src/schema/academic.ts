import type {
  Activity,
  AssessmentSpec,
  Blocker,
  DeterministicCheck,
  Misconception,
  Outcome,
  Preparation,
  PrerequisiteRule as PrerequisiteRuleSpec,
  Provenance,
  Rubric,
  UnitCheck,
  Workload,
} from "@corniversity/core";
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { courseReadinessEnum, createdAt, tz, unitStatusEnum, updatedAt } from "./_shared";

export const department = pgTable("department", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  shortTitle: text("short_title").notNull(),
  identity: text("identity").notNull(),
  emblem: text("emblem").notNull(),
  paths: jsonb("paths").$type<{ title: string; courseIds: string[] }[]>().notNull().default([]),
  facultyPersonaIds: jsonb("faculty_persona_ids").$type<string[]>().notNull().default([]),
  conventions: jsonb("conventions").$type<string[]>().notNull().default([]),
  sort: integer("sort").notNull().default(0),
});

export const programme = pgTable("programme", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  departmentIds: jsonb("department_ids").$type<string[]>().notNull().default([]),
  stages: jsonb("stages")
    .$type<
      {
        title: string;
        courses: { courseId: string; role: "core" | "seminar" | "bridge" | "elective"; note?: string }[];
      }[]
    >()
    .notNull()
    .default([]),
});

export const concept = pgTable(
  "concept",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    departmentId: text("department_id")
      .notNull()
      .references(() => department.id),
    description: text("description").notNull(),
  },
  (t) => [index("concept_department_idx").on(t.departmentId)],
);

export const course = pgTable("course", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  primaryDepartmentId: text("primary_department_id")
    .notNull()
    .references(() => department.id),
  level: text("level").notNull(),
  position: text("position").notNull(),
  launch: boolean("launch").notNull().default(false),
  createdAt: createdAt(),
});

export const courseDepartment = pgTable(
  "course_department",
  {
    courseId: text("course_id")
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    departmentId: text("department_id")
      .notNull()
      .references(() => department.id),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.departmentId] })],
);

export const courseVersion = pgTable(
  "course_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: text("course_id")
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    contentHash: text("content_hash").notNull(),
    readiness: courseReadinessEnum("readiness").notNull(),
    purpose: text("purpose").notNull(),
    description: text("description").notNull(),
    workload: jsonb("workload").$type<Workload>().notNull(),
    outcomes: jsonb("outcomes").$type<Outcome[]>().notNull().default([]),
    assessmentSpecs: jsonb("assessment_specs").$type<AssessmentSpec[]>().notNull().default([]),
    blockers: jsonb("blockers").$type<Blocker[]>().notNull().default([]),
    provenance: jsonb("provenance").$type<Provenance>().notNull(),
    primarySourceIds: jsonb("primary_source_ids").$type<string[]>().notNull().default([]),
    supplementalSourceIds: jsonb("supplemental_source_ids").$type<string[]>().notNull().default([]),
    modesOffered: jsonb("modes_offered").$type<string[]>().notNull().default([]),
    recommendedConceptIds: jsonb("recommended_concept_ids").$type<string[]>().notNull().default([]),
    teachesConceptIds: jsonb("teaches_concept_ids").$type<string[]>().notNull().default([]),
    prerequisiteRuleIds: jsonb("prerequisite_rule_ids").$type<string[]>().notNull().default([]),
    convenorPersonaId: text("convenor_persona_id"),
    tutorPersonaId: text("tutor_persona_id"),
    externalSyllabusNote: text("external_syllabus_note"),
    isCurrent: boolean("is_current").notNull().default(true),
    publishedAt: tz("published_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("course_version_unique").on(t.courseId, t.version), index("course_version_current_idx").on(t.courseId, t.isCurrent)],
);

export const prerequisiteRule = pgTable(
  "prerequisite_rule",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    strength: text("strength").$type<"hard" | "soft" | "corequisite">().notNull(),
    description: text("description").notNull(),
    alternatives: jsonb("alternatives").$type<PrerequisiteRuleSpec["alternatives"]>().notNull(),
  },
  (t) => [index("prereq_course_idx").on(t.courseId)],
);

export const teachingUnit = pgTable(
  "teaching_unit",
  {
    id: text("id").primaryKey(),
    courseVersionId: uuid("course_version_id")
      .notNull()
      .references(() => courseVersion.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    objectives: jsonb("objectives").$type<{ id: string; description: string }[]>().notNull(),
    prerequisiteConceptIds: jsonb("prerequisite_concept_ids").$type<string[]>().notNull().default([]),
    teachesConceptIds: jsonb("teaches_concept_ids").$type<string[]>().notNull().default([]),
    preparation: jsonb("preparation").$type<Preparation[]>().notNull().default([]),
    activities: jsonb("activities").$type<Activity[]>().notNull(),
    exitCheck: jsonb("exit_check").$type<{ description: string; exerciseId?: string }>().notNull(),
    misconceptions: jsonb("misconceptions").$type<Misconception[]>().notNull().default([]),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    status: unitStatusEnum("status").notNull(),
    checks: jsonb("checks").$type<UnitCheck[]>().notNull().default([]),
    lessonMarkdown: text("lesson_markdown").notNull(),
  },
  (t) => [uniqueIndex("teaching_unit_sequence_unique").on(t.courseVersionId, t.sequence)],
);

export const unitExercise = pgTable(
  "unit_exercise",
  {
    id: text("id").primaryKey(),
    unitId: text("unit_id")
      .notNull()
      .references(() => teachingUnit.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    promptMarkdown: text("prompt_markdown").notNull(),
    conceptIds: jsonb("concept_ids").$type<string[]>().notNull().default([]),
    hintLadder: jsonb("hint_ladder").$type<string[]>().notNull().default([]),
    deterministicChecks: jsonb("deterministic_checks").$type<DeterministicCheck[]>().notNull().default([]),
    rubric: jsonb("rubric").$type<Rubric>().notNull(),
    rubricVersion: integer("rubric_version").notNull(),
    origin: text("origin").notNull(),
    attribution: text("attribution"),
    externalLocatorId: text("external_locator_id"),
    estimatedMinutes: integer("estimated_minutes").notNull(),
  },
  (t) => [index("unit_exercise_unit_idx").on(t.unitId)],
);

/**
 * Instructor-only reasoning. Never selected by learner-facing queries; the only readers are the
 * assessor service and the explicit practice-mode reveal (which records an evidence event).
 */
export const instructorArtifact = pgTable(
  "instructor_artifact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: text("unit_id")
      .notNull()
      .references(() => teachingUnit.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").references(() => unitExercise.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"reference_solution" | "grading_notes" | "misconception_notes" | "lesson_notes">().notNull(),
    markdown: text("markdown").notNull(),
    releasePolicy: text("release_policy").$type<"never" | "after_accepted" | "on_request_practice">().notNull().default("never"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("instructor_artifact_unit_idx").on(t.unitId)],
);

export const InstructorArtifactKind = z.enum(["reference_solution", "grading_notes", "misconception_notes", "lesson_notes"]);
