import type { DraftCheck, UnitDraft } from "@corniversity/core/preparation/pipeline";
import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, tz, updatedAt } from "./_shared";
import { course, teachingUnit } from "./academic";
import { user } from "./auth";

export interface PreparationIntake {
  goal: string;
  depth: "survey" | "standard" | "rigorous";
  weeklyHours: number;
  preferredSources: string;
  balance: "more_lecture" | "balanced" | "more_reading";
  assessment: "none" | "feedback" | "self_test";
  materials: string;
  /** How many upcoming outlined units to prepare: a bounded buffer, never the whole catalogue. */
  bufferUnits: number;
}

/**
 * A request to prepare a course: the learner's intake, a finite budget and an optional opt-in to
 * keep a small buffer prepared. Browsing never creates one; confirming it runs the pipeline; it
 * never enrols anyone and never replaces a published lesson silently.
 */
export const preparationRequest = pgTable(
  "preparation_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => course.id),
    intake: jsonb("intake").$type<PreparationIntake>().notNull(),
    budgetUsd: numeric("budget_usd", { precision: 12, scale: 6 }).notNull(),
    autoPrepare: boolean("auto_prepare").notNull().default(false),
    status: text("status")
      .$type<"draft" | "running" | "blocked" | "awaiting_review" | "completed" | "cancelled" | "failed">()
      .notNull()
      .default("draft"),
    /** Why the request stopped, in words the learner can act on. */
    statusNote: text("status_note"),
    runs: integer("runs").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    confirmedAt: tz("confirmed_at"),
    cancelledAt: tz("cancelled_at"),
  },
  (t) => [index("preparation_request_owner_idx").on(t.ownerId, t.createdAt)],
);

/**
 * One stage of a request (once per unit for unit-level stages), with its role and artifact. A
 * stage is a checkpoint: a resumed request skips finished stages; a worker claims a stage with a
 * lease, so two workers never run it at once and a crashed one is retaken after the lease expires.
 */
export const preparationStage = pgTable(
  "preparation_stage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => preparationRequest.id, { onDelete: "cascade" }),
    stageKey: text("stage_key").notNull(),
    /** The unit a unit-level stage is about; '' for course-level stages. */
    unitKey: text("unit_key").notNull().default(""),
    sequence: integer("sequence").notNull(),
    role: text("role").notNull(),
    status: text("status")
      .$type<"pending" | "running" | "done" | "blocked" | "failed" | "cancelled" | "skipped">()
      .notNull()
      .default("pending"),
    artifact: jsonb("artifact").$type<Record<string, unknown>>(),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    leaseUntil: tz("lease_until"),
    startedAt: tz("started_at"),
    finishedAt: tz("finished_at"),
  },
  (t) => [uniqueIndex("preparation_stage_unique").on(t.requestId, t.stageKey, t.unitKey)],
);

/** A model-authored unit draft and its checks; instructor-only parts are never shown to learners. */
export const unitDraft = pgTable(
  "unit_draft",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => preparationRequest.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    unitId: text("unit_id")
      .notNull()
      .references(() => teachingUnit.id),
    version: integer("version").notNull(),
    draft: jsonb("draft").$type<UnitDraft>().notNull(),
    checks: jsonb("checks").$type<DraftCheck[]>().notNull().default([]),
    status: text("status").$type<"checked" | "failed_checks" | "published" | "rejected">().notNull(),
    providerRunId: uuid("provider_run_id"),
    decisionNote: text("decision_note"),
    createdAt: createdAt(),
    decidedAt: tz("decided_at"),
  },
  (t) => [uniqueIndex("unit_draft_version_unique").on(t.unitId, t.version)],
);

/**
 * A published draft: the unit as it was before (for an honest history and a way back) and the
 * draft that now supplies it. One active publication per unit; the content seeder leaves a unit
 * with an active publication alone instead of restoring its outline.
 */
export const unitPublication = pgTable(
  "unit_publication",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: text("unit_id")
      .notNull()
      .references(() => teachingUnit.id),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => unitDraft.id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    active: boolean("active").notNull().default(true),
    previous: jsonb("previous").$type<{ status: string; lessonMarkdown: string; exerciseIds: string[] }>().notNull(),
    publishedAt: createdAt(),
  },
  (t) => [uniqueIndex("unit_publication_active_unique").on(t.unitId).where(sql`${t.active}`)],
);
