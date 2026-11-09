import type { ProjectKind, ProvenanceKind, StudioCheck } from "@corniversity/core";
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./_shared";
import { user } from "./auth";

/**
 * The research studio. A project holds the learner's question, its kind and a focused shelf of
 * verified sources; its documents (proposal, methods, report) are drafts that are saved as
 * immutable numbered versions; provenance records where every dataset or simulation came from;
 * artefacts are intermediate results; feedback is attached to a version; an oral discussion can
 * be requested. Demonstration projects belong to the labelled demo learner, never to the owner.
 */
export const researchProject = pgTable(
  "research_project",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    question: text("question").notNull(),
    kind: text("kind").$type<ProjectKind>().notNull(),
    status: text("status").$type<"formulating" | "working" | "reporting" | "completed" | "paused">().notNull().default("formulating"),
    programmeId: text("programme_id"),
    blockIds: jsonb("block_ids").$type<string[]>().notNull().default([]),
    /** Verified source records on the focused shelf. */
    sourceIds: jsonb("source_ids").$type<string[]>().notNull().default([]),
    /** Sources wanted but not yet verified: names only, sent to the library's request list. */
    sourceLeads: jsonb("source_leads").$type<string[]>().notNull().default([]),
    demo: boolean("demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("research_project_owner_idx").on(t.ownerId, t.updatedAt)],
);

export const researchDocument = pgTable(
  "research_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => researchProject.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"proposal" | "methods" | "report">().notNull(),
    draftMarkdown: text("draft_markdown").notNull().default(""),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("research_document_kind_idx").on(t.projectId, t.kind)],
);

export const researchVersion = pgTable(
  "research_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => researchDocument.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    bodyMarkdown: text("body_markdown").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("research_version_number_idx").on(t.documentId, t.version)],
);

export const researchProvenance = pgTable(
  "research_provenance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => researchProject.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ProvenanceKind>().notNull(),
    title: text("title").notNull(),
    origin: text("origin").notNull(),
    versionOrDate: text("version_or_date").notNull().default(""),
    licence: text("licence").notNull().default(""),
    humanParticipants: text("human_participants").$type<"none" | "existing_published">().notNull().default("none"),
    seed: text("seed"),
    generator: text("generator"),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("research_provenance_project_idx").on(t.projectId)],
);

export const researchArtifact = pgTable(
  "research_artifact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => researchProject.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind").$type<"figure" | "table" | "code" | "data" | "notes" | "other">().notNull(),
    description: text("description").notNull().default(""),
    /** A notebook entry the artefact is, when it is not a file. */
    notebookEntryId: uuid("notebook_entry_id"),
    blobKey: text("blob_key"),
    filename: text("filename"),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    createdAt: createdAt(),
  },
  (t) => [index("research_artifact_project_idx").on(t.projectId)],
);

export interface SupervisorFeedbackRecord {
  summary: string;
  strengths: string[];
  questions: string[];
  nextStep: string;
}

export const researchFeedback = pgTable(
  "research_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => researchProject.id, { onDelete: "cascade" }),
    versionId: uuid("version_id")
      .notNull()
      .references(() => researchVersion.id, { onDelete: "cascade" }),
    mode: text("mode").$type<"scripted" | "live" | "blocked">().notNull(),
    status: text("status").$type<"ok" | "failed" | "blocked">().notNull(),
    checks: jsonb("checks").$type<StudioCheck[]>().notNull(),
    /** Written feedback from a live model; null when no model read the work. */
    feedback: jsonb("feedback").$type<SupervisorFeedbackRecord>(),
    error: text("error"),
    providerRunId: uuid("provider_run_id"),
    createdAt: createdAt(),
  },
  (t) => [index("research_feedback_project_idx").on(t.projectId)],
);

export const researchOralRequest = pgTable(
  "research_oral_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => researchProject.id, { onDelete: "cascade" }),
    focus: text("focus").notNull(),
    preferredTimes: text("preferred_times").notNull().default(""),
    status: text("status").$type<"requested" | "held" | "withdrawn">().notNull().default("requested"),
    discussionId: uuid("discussion_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("research_oral_project_idx").on(t.projectId)],
);
