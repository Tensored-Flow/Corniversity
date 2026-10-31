import { boolean, date, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, learningModeEnum, tz, updatedAt } from "./_shared";
import { courseVersion, programme, teachingUnit, unitExercise } from "./academic";
import { user } from "./auth";

export const term = pgTable(
  "term",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    teachingWeeks: integer("teaching_weeks").notNull().default(10),
    readingWeek: boolean("reading_week").notNull().default(true),
    synthesisWeek: boolean("synthesis_week").notNull().default(true),
    mode: text("mode").$type<"term" | "rolling" | "reading_course">().notNull().default("term"),
    timezone: text("timezone").notNull().default("Europe/London"),
    status: text("status").$type<"planned" | "active" | "completed">().notNull().default("planned"),
    createdAt: createdAt(),
  },
  (t) => [index("term_owner_idx").on(t.ownerId)],
);

export const enrolment = pgTable(
  "enrolment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    termId: uuid("term_id").references(() => term.id),
    courseVersionId: uuid("course_version_id")
      .notNull()
      .references(() => courseVersion.id),
    mode: learningModeEnum("mode").notNull(),
    status: text("status").$type<"active" | "paused" | "withdrawn" | "completed">().notNull().default("active"),
    priority: integer("priority").notNull().default(1),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    enrolledAt: createdAt(),
    updatedAt: updatedAt(),
    completedAt: tz("completed_at"),
  },
  (t) => [
    uniqueIndex("enrolment_owner_course_version_unique").on(t.ownerId, t.courseVersionId),
    index("enrolment_owner_status_idx").on(t.ownerId, t.status),
  ],
);

export const availabilityWindow = pgTable(
  "availability_window",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(), // 1 = Monday … 7 = Sunday (ISO)
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (t) => [index("availability_owner_idx").on(t.ownerId)],
);

export const commitment = pgTable(
  "commitment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    weekday: integer("weekday"), // recurring weekly when set
    date: date("date", { mode: "string" }), // one-off when set
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    protected: boolean("protected").notNull().default(true),
    source: text("source").$type<"onboarding_suggestion" | "manual">().notNull().default("manual"),
  },
  (t) => [index("commitment_owner_idx").on(t.ownerId)],
);

export const dayOff = pgTable(
  "day_off",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    note: text("note"),
  },
  (t) => [uniqueIndex("day_off_owner_date_unique").on(t.ownerId, t.date)],
);

export const planVersion = pgTable(
  "plan_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    termId: uuid("term_id")
      .notNull()
      .references(() => term.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").$type<"proposed" | "confirmed" | "superseded">().notNull(),
    inputsSnapshot: jsonb("inputs_snapshot").notNull(),
    summary: jsonb("summary")
      .$type<{
        plannedMinutes: number;
        availableMinutes: number;
        feasible: boolean;
        shortfallMinutes: number;
        unplaced: { activityId: string; title: string; reason: string }[];
        weekly: { weekStart: string; plannedMinutes: number; capMinutes: number }[];
        explanations: string[];
      }>()
      .notNull(),
    createdAt: createdAt(),
    confirmedAt: tz("confirmed_at"),
  },
  (t) => [uniqueIndex("plan_version_unique").on(t.termId, t.version)],
);

export const scheduledSession = pgTable(
  "scheduled_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planVersionId: uuid("plan_version_id")
      .notNull()
      .references(() => planVersion.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    enrolmentId: uuid("enrolment_id")
      .notNull()
      .references(() => enrolment.id, { onDelete: "cascade" }),
    unitId: text("unit_id").references(() => teachingUnit.id),
    activityId: text("activity_id").notNull(),
    sessionKind: text("session_kind").notNull(),
    title: text("title").notNull(),
    startsAt: tz("starts_at").notNull(),
    endsAt: tz("ends_at").notNull(),
    status: text("status").$type<"planned" | "completed" | "attempted" | "cancelled" | "moved">().notNull().default("planned"),
    locked: boolean("locked").notNull().default(false),
    uid: text("uid").notNull(), // stable across plan versions for the same activity
    movedFromSessionId: uuid("moved_from_session_id"),
    learningSessionId: uuid("learning_session_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("scheduled_session_owner_time_idx").on(t.ownerId, t.startsAt), index("scheduled_session_plan_idx").on(t.planVersionId)],
);

export const changeProposal = pgTable(
  "change_proposal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"programme" | "timetable" | "enrolment" | "recovery">().notNull(),
    proposedBy: text("proposed_by").$type<"director" | "learner" | "system">().notNull(),
    title: text("title").notNull(),
    rationale: text("rationale").notNull(),
    diff: jsonb("diff").notNull(),
    status: text("status").$type<"draft" | "confirmed" | "rejected">().notNull().default("draft"),
    createdAt: createdAt(),
    decidedAt: tz("decided_at"),
  },
  (t) => [index("change_proposal_owner_idx").on(t.ownerId, t.status)],
);

export const calendarToken = pgTable(
  "calendar_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    detailLevel: text("detail_level").$type<"minimal" | "full">().notNull().default("minimal"),
    createdAt: createdAt(),
    lastUsedAt: tz("last_used_at"),
    revokedAt: tz("revoked_at"),
  },
  (t) => [index("calendar_token_owner_idx").on(t.ownerId)],
);

/**
 * A learner's relationship to a programme. Following a programme shows its blocks on the
 * academic map; it never enrols the learner in any of its courses. A learner may follow several.
 */
export const programmeParticipation = pgTable(
  "programme_participation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    programmeId: text("programme_id")
      .notNull()
      .references(() => programme.id),
    status: text("status").$type<"following" | "paused" | "left">().notNull().default("following"),
    source: text("source").$type<"onboarding" | "learner" | "director_proposal">().notNull(),
    /** Blocks the learner is concentrating on now, in order; empty means no focus chosen. */
    focusBlockIds: jsonb("focus_block_ids").$type<string[]>().notNull().default([]),
    startedAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("programme_participation_owner_programme").on(t.ownerId, t.programmeId)],
);

/**
 * Academic deadlines, kept apart from study appointments. They exist only when the learner
 * creates them, and assessment or examination deadlines only when those modes are switched on.
 * Milestones are optional targets and never binding.
 */
export const academicDeadline = pgTable(
  "academic_deadline",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    enrolmentId: uuid("enrolment_id").references(() => enrolment.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").references(() => unitExercise.id),
    kind: text("kind").$type<"assessment" | "examination" | "milestone">().notNull(),
    title: text("title").notNull(),
    dueAt: tz("due_at").notNull(),
    binding: boolean("binding").notNull(),
    status: text("status").$type<"open" | "met" | "withdrawn">().notNull().default("open"),
    createdBy: text("created_by").$type<"learner">().notNull().default("learner"),
    metAt: tz("met_at"),
    createdAt: createdAt(),
  },
  (t) => [index("academic_deadline_owner_idx").on(t.ownerId, t.status)],
);
