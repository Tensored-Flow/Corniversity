import { index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, tz, updatedAt } from "./_shared";
import { course, department } from "./academic";
import { user } from "./auth";

export type ProposalKind = "reading_course" | "seminar" | "structured_curriculum" | "cross_disciplinary_programme";
export type ProposalStatus = "draft" | "rejected" | "published" | "withdrawn";
export interface OverlapDecision {
  courseId: string;
  decision: "reuse" | "distinct";
  note: string;
}

/**
 * A proposed subject or reading programme inside one of the existing departments: its purpose,
 * scope, depth, the concepts and prepared units it reuses, source leads, and the owner's decision
 * on each overlapping course. Publishing lists a catalogue item at readiness "proposed"; it
 * enrols nobody, verifies no source and prepares no teaching.
 */
export const curriculumProposal = pgTable(
  "curriculum_proposal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ProposalKind>().notNull(),
    departmentId: text("department_id")
      .notNull()
      .references(() => department.id),
    title: text("title").notNull(),
    purpose: text("purpose").notNull(),
    scope: text("scope").notNull(),
    depth: text("depth").$type<"survey" | "standard" | "rigorous">().notNull(),
    conceptIds: jsonb("concept_ids").$type<string[]>().notNull().default([]),
    reusedUnitIds: jsonb("reused_unit_ids").$type<string[]>().notNull().default([]),
    sourceCandidates: jsonb("source_candidates").$type<{ title: string; note: string }[]>().notNull().default([]),
    overlapDecisions: jsonb("overlap_decisions").$type<OverlapDecision[]>().notNull().default([]),
    status: text("status").$type<ProposalStatus>().notNull().default("draft"),
    decisionNote: text("decision_note"),
    version: integer("version").notNull().default(1),
    publishedCourseId: text("published_course_id").references(() => course.id),
    publishedAt: tz("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("curriculum_proposal_owner_idx").on(t.ownerId)],
);

/** Every revision of a proposal, kept as it was. */
export const curriculumProposalVersion = pgTable(
  "curriculum_proposal_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => curriculumProposal.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("curriculum_proposal_version_unique").on(t.proposalId, t.version)],
);
