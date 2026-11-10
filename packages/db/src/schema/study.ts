import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, tz, updatedAt } from "./_shared";
import { concept } from "./academic";
import { user } from "./auth";
import { attempt, learningSession } from "./learning";

/**
 * Where a note, question or help request points: a selection of lesson text, a source locator, a
 * moment of an external lecture (typed by the learner, since no external player is controlled),
 * lines of an attempt, or a region of a paper page.
 */
export interface StudyAnchor {
  kind: "selection" | "locator" | "timestamp" | "attempt_lines" | "page_region" | "external_progress";
  text?: string;
  unitId?: string;
  locatorId?: string;
  /** Seconds into an external video, as the learner typed it. */
  timestampSec?: number;
  lines?: [number, number];
  pageId?: string;
  region?: { x: number; y: number; w: number; h: number };
}

export type HelpMode =
  | "small_hint"
  | "discuss_approach"
  | "check_step"
  | "full_explanation"
  | "question"
  | "hint_ladder"
  | "reference_reveal"
  | "bridge_opened";

/**
 * Every kind of help the learner asked for, as provenance: never a penalty, never evidence of
 * understanding. Assessed work later records whether it was assisted from these rows.
 */
export const assistanceEvent = pgTable(
  "assistance_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    learningSessionId: uuid("learning_session_id").references(() => learningSession.id, { onDelete: "set null" }),
    attemptId: uuid("attempt_id").references(() => attempt.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id"),
    mode: text("mode").$type<HelpMode>().notNull(),
    anchor: jsonb("anchor").$type<StudyAnchor>(),
    providerRunId: uuid("provider_run_id"),
    createdAt: createdAt(),
  },
  (t) => [index("assistance_owner_idx").on(t.ownerId, t.createdAt), index("assistance_attempt_idx").on(t.attemptId)],
);

/**
 * One page of paper work (a photograph or a PDF page set) attached to an attempt. The original
 * bytes live in the private blob store, already stripped of location and camera metadata; the
 * row keeps the page's identity, order and rotation, separately from any transcription.
 */
export const workPage = pgTable(
  "work_page",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempt.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    blobKey: text("blob_key").notNull(),
    mime: text("mime").$type<"image/jpeg" | "image/png" | "application/pdf">().notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: text("sha256").notNull(),
    width: integer("width"),
    height: integer("height"),
    /** Degrees clockwise to display the original upright; the bytes are never rewritten for it. */
    rotation: integer("rotation").notNull().default(0),
    originalFilename: text("original_filename"),
    metadataStripped: boolean("metadata_stripped").notNull().default(false),
    createdAt: createdAt(),
    removedAt: tz("removed_at"),
  },
  (t) => [index("work_page_attempt_idx").on(t.attemptId, t.position)],
);

/** A symbol or phrase in a transcription that the learner must confirm before review. */
export interface UncertainMark {
  line: number;
  text: string;
}

/**
 * A transcription of an attempt's paper pages, versioned: a correction is a new version, so the
 * feedback on an earlier version stays attached to what was actually read. `confirmedAt` is set
 * only when no uncertain mark remains; only a confirmed version can be submitted.
 */
export const transcriptionVersion = pgTable(
  "transcription_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempt.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    text: text("text").notNull(),
    uncertain: jsonb("uncertain").$type<UncertainMark[]>().notNull().default([]),
    source: text("source").$type<"manual" | "model">().notNull(),
    providerRunId: uuid("provider_run_id"),
    /** The model transcription this version corrects, when it started from one. */
    basedOnVersion: integer("based_on_version"),
    confirmedAt: tz("confirmed_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("transcription_version_unique").on(t.attemptId, t.version)],
);

/**
 * A short teaching bridge for one concept, seeded from content/bridges. Its presence says only
 * that teaching material is prepared; it says nothing about the learner.
 */
export const conceptBridge = pgTable("concept_bridge", {
  conceptId: text("concept_id")
    .primaryKey()
    .references(() => concept.id),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  bodyMarkdown: text("body_markdown").notNull(),
  check: jsonb("check").$type<{ prompt: string; guidance: string } | null>(),
  assumesConceptIds: jsonb("assumes_concept_ids").$type<string[]>().notNull().default([]),
  sources: jsonb("sources").$type<{ sourceId: string; locatorId?: string; note: string }[]>().notNull().default([]),
  origin: text("origin").notNull(),
  status: text("status").$type<"draft" | "ready">().notNull(),
  checks: jsonb("checks").$type<{ name: string; result: string; evidence: string }[]>().notNull().default([]),
  contentHash: text("content_hash").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: updatedAt(),
});

/**
 * A learner's visit to a bridge, with the exact place to return to and the trail it was opened
 * from (depth 1 from a lesson, at most 2). Opening a bridge is recorded as assistance, never as
 * evidence; an answer to its self-check is kept as a note.
 */
export const bridgeVisit = pgTable(
  "bridge_visit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concept.id),
    learningSessionId: uuid("learning_session_id").references(() => learningSession.id, { onDelete: "set null" }),
    parentVisitId: uuid("parent_visit_id"),
    depth: integer("depth").notNull(),
    trail: jsonb("trail").$type<string[]>().notNull(),
    returnTo: jsonb("return_to").$type<{ path: string; label: string; exerciseId?: string; anchor?: string }>().notNull(),
    checkAnswer: text("check_answer"),
    openedAt: createdAt(),
    returnedAt: tz("returned_at"),
  },
  (t) => [index("bridge_visit_owner_idx").on(t.ownerId, t.openedAt)],
);
