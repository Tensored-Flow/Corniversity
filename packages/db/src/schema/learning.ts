import type { DeterministicCheck, Rubric } from "@corniversity/core";
import { type SQL, sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, primaryKey, real, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, evidenceStateEnum, submissionStateEnum, tsvector, tz, updatedAt } from "./_shared";
import { concept, course, teachingUnit, unitExercise } from "./academic";
import { user } from "./auth";
import { enrolment, scheduledSession } from "./planning";
import type { StudyAnchor } from "./study";

export interface Citation {
  tag: string; // E1, E2 … as shown to the model
  locatorId?: string;
  assetId?: string;
  passageId?: string;
  label: string;
}

export type StatementLabel = "source_backed" | "derived" | "conjecture" | "needs_checking" | "location_only";

export const learningSession = pgTable(
  "learning_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    enrolmentId: uuid("enrolment_id")
      .notNull()
      .references(() => enrolment.id, { onDelete: "cascade" }),
    unitId: text("unit_id")
      .notNull()
      .references(() => teachingUnit.id),
    activityId: text("activity_id").notNull(),
    sessionKind: text("session_kind").notNull(),
    scheduledSessionId: uuid("scheduled_session_id").references(() => scheduledSession.id, {
      onDelete: "set null",
    }),
    status: text("status").$type<"open" | "completed" | "abandoned">().notNull().default("open"),
    state: jsonb("state")
      .$type<{
        currentExerciseId?: string;
        readerLocator?: unknown;
        /** The heading of the lesson last in view, saved on the server so another device opens there. */
        readerAnchor?: string;
        /** What the learner typed about how far they got in an external reading. */
        externalProgress?: { text: string; at: string };
        pausedAt?: string;
        /** The learner's own summary at the close, editable; the facts are computed from records. */
        summary?: string;
        nextStep?: string;
      }>()
      .notNull()
      .default({}),
    startedAt: createdAt(),
    lastActiveAt: tz("last_active_at").notNull().defaultNow(),
    endedAt: tz("ended_at"),
  },
  (t) => [index("learning_session_owner_idx").on(t.ownerId, t.status)],
);

export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    learningSessionId: uuid("learning_session_id").references(() => learningSession.id, {
      onDelete: "cascade",
    }),
    role: text("role").notNull(), // tutor | lecturer | director | librarian | peer | supervisor | seminar_chair
    personaId: text("persona_id"),
    purpose: text("purpose").notNull(),
    context: jsonb("context")
      .$type<{
        unitId?: string;
        exerciseId?: string;
        allowedLocatorIds: string[];
        allowedAssetIds: string[];
      }>()
      .notNull(),
    createdAt: createdAt(),
    closedAt: tz("closed_at"),
  },
  (t) => [index("conversation_owner_idx").on(t.ownerId), index("conversation_session_idx").on(t.learningSessionId)],
);

export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    sender: text("sender").$type<"learner" | "persona" | "system">().notNull(),
    personaId: text("persona_id"),
    contentMarkdown: text("content_markdown").notNull(),
    citations: jsonb("citations").$type<Citation[]>().notNull().default([]),
    labels: jsonb("labels").$type<StatementLabel[]>().notNull().default([]),
    uncitedClaims: jsonb("uncited_claims").$type<string[]>().notNull().default([]),
    providerRunId: uuid("provider_run_id"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("message_conversation_sequence_unique").on(t.conversationId, t.sequence)],
);

export const attempt = pgTable(
  "attempt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => unitExercise.id),
    learningSessionId: uuid("learning_session_id").references(() => learningSession.id, {
      onDelete: "set null",
    }),
    mode: text("mode").$type<"practice" | "self_test">().notNull().default("practice"),
    state: submissionStateEnum("state").notNull().default("draft"),
    hintsUsed: integer("hints_used").notNull().default(0),
    solutionRevealedAt: tz("solution_revealed_at"),
    /** Unsubmitted work, saved as the learner types, so a closed tab never loses an argument. */
    draftMarkdown: text("draft_markdown"),
    /**
     * Increases with every saved draft. A save names the revision it was based on, so a stale
     * device cannot overwrite a newer draft written elsewhere; it gets a conflict instead.
     */
    draftRevision: integer("draft_revision").notNull().default(0),
    draftSavedAt: tz("draft_saved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("attempt_owner_exercise_idx").on(t.ownerId, t.exerciseId)],
);

export const submissionVersion = pgTable(
  "submission_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempt.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    contentMarkdown: text("content_markdown").notNull(),
    contentKind: text("content_kind").$type<"text" | "image" | "code" | "paper" | "oral">().notNull().default("text"),
    /** For paper work: the confirmed transcription that was submitted, and the pages it reads. */
    transcriptionVersionId: uuid("transcription_version_id"),
    pageIds: jsonb("page_ids").$type<string[]>().notNull().default([]),
    transcription: jsonb("transcription").$type<{
      text: string;
      confirmed: boolean;
      uncertainRegions: string[];
    }>(),
    assistanceDisclosed: jsonb("assistance_disclosed")
      .$type<{
        hintsUsed: number;
        peersConsulted: boolean;
        externalSources: string[];
        note?: string;
        /** Help asked for on this attempt before submitting, by kind (small hint, full explanation…). */
        help?: Record<string, number>;
      }>()
      .notNull()
      .default({ hintsUsed: 0, peersConsulted: false, externalSources: [] }),
    submittedAt: createdAt(),
  },
  (t) => [uniqueIndex("submission_version_unique").on(t.attemptId, t.version)],
);

export interface FeedbackCheck {
  criterionId: string;
  status: "met" | "partially_met" | "not_met" | "not_applicable";
  comment: string;
}

export interface StructuredFeedback {
  summary: string;
  firstGap?: { line: number; excerpt: string; issue: string };
  checks: FeedbackCheck[];
  strengths: string[];
  nextStep: string;
  alternateApproachRecognised: boolean;
  labels: StatementLabel[];
  citations: Citation[];
}

/**
 * The exercise as the learner answered it, kept with each assessment run: a later repair of the
 * exercise (its prompt, rubric or checks) never changes what a submission was assessed against.
 */
export interface ExerciseSnapshot {
  title: string;
  kind: string;
  promptMarkdown: string;
  rubricVersion: number;
  rubric: Rubric;
  deterministicChecks: DeterministicCheck[];
}

export const assessmentRun = pgTable(
  "assessment_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionVersionId: uuid("submission_version_id")
      .notNull()
      .references(() => submissionVersion.id, { onDelete: "cascade" }),
    rubricVersion: integer("rubric_version").notNull(),
    /** Null only for runs from before snapshots were kept; those were assessed against the exercise as it then stood. */
    exerciseSnapshot: jsonb("exercise_snapshot").$type<ExerciseSnapshot>(),
    graderConfig: jsonb("grader_config").$type<{ provider: string; model: string; promptVersion: string; roleVersion: string }>().notNull(),
    providerRunId: uuid("provider_run_id"),
    status: text("status").$type<"queued" | "reviewing" | "feedback_ready" | "needs_review" | "failed">().notNull().default("queued"),
    deterministicResults: jsonb("deterministic_results")
      .$type<{ checkId: string; passed: boolean; detail: string }[]>()
      .notNull()
      .default([]),
    feedback: jsonb("feedback").$type<StructuredFeedback>(),
    verdict: text("verdict").$type<"accepted" | "revision_requested" | "needs_review">(),
    confidence: real("confidence"),
    error: text("error"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: createdAt(),
    completedAt: tz("completed_at"),
  },
  (t) => [index("assessment_run_submission_idx").on(t.submissionVersionId)],
);

export const feedbackReview = pgTable(
  "feedback_review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentRunId: uuid("assessment_run_id")
      .notNull()
      .references(() => assessmentRun.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"appeal" | "regrade" | "learner_challenge">().notNull(),
    learnerNote: text("learner_note").notNull(),
    status: text("status").$type<"open" | "resolved">().notNull().default("open"),
    resolution: jsonb("resolution").$type<{ outcome: string; note: string; newRunId?: string }>(),
    createdAt: createdAt(),
    resolvedAt: tz("resolved_at"),
  },
  (t) => [index("feedback_review_run_idx").on(t.assessmentRunId)],
);

export const evidenceEvent = pgTable(
  "evidence_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concept.id),
    activityRef: text("activity_ref").notNull(),
    submissionVersionId: uuid("submission_version_id").references(() => submissionVersion.id),
    evidenceType: text("evidence_type")
      .$type<"self_report" | "practice" | "assessment" | "explain_back" | "reading" | "solution_revealed">()
      .notNull(),
    source: text("source").notNull(),
    observedAt: tz("observed_at").notNull().defaultNow(),
    assistance: text("assistance").notNull().default("none"),
    reviewStatus: text("review_status").$type<"provisional" | "reviewed" | "disputed">().notNull().default("provisional"),
    interpretation: text("interpretation").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("evidence_owner_concept_idx").on(t.ownerId, t.conceptId)],
);

export const conceptState = pgTable(
  "concept_state",
  {
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concept.id),
    state: evidenceStateEnum("state").notNull().default("unassessed"),
    selfConfidence: integer("self_confidence"), // 1–5, separate from evidence
    evidenceIds: jsonb("evidence_ids").$type<string[]>().notNull().default([]),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.conceptId] })],
);

export const misconceptionRecord = pgTable(
  "misconception_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concept.id),
    claim: text("claim").notNull(),
    evidenceIds: jsonb("evidence_ids").$type<string[]>().notNull().default([]),
    status: text("status").$type<"active" | "cleared">().notNull().default("active"),
    createdAt: createdAt(),
    clearedAt: tz("cleared_at"),
  },
  (t) => [index("misconception_owner_idx").on(t.ownerId, t.status)],
);

export const revisionItem = pgTable(
  "revision_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concept.id),
    kind: text("kind").$type<"definition" | "theorem" | "problem" | "explain">().notNull(),
    prompt: text("prompt").notNull(),
    dueAt: tz("due_at").notNull(),
    intervalDays: integer("interval_days").notNull().default(2),
    lastReviewedAt: tz("last_reviewed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("revision_owner_due_idx").on(t.ownerId, t.dueAt)],
);

export const notebookEntry = pgTable(
  "notebook_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    bodyMarkdown: text("body_markdown").notNull().default(""),
    kind: text("kind")
      .$type<"definition" | "theorem" | "example" | "proof_attempt" | "calculation" | "question" | "note">()
      .notNull()
      .default("note"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    sourceLinks: jsonb("source_links").$type<Citation[]>().notNull().default([]),
    courseId: text("course_id").references(() => course.id),
    unitId: text("unit_id"),
    resolved: boolean("resolved").notNull().default(false),
    /** The study session the note was written in, and exactly what it points at. */
    learningSessionId: uuid("learning_session_id").references(() => learningSession.id, { onDelete: "set null" }),
    anchor: jsonb("anchor").$type<StudyAnchor>(),
    tsv: tsvector("tsv").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', coalesce(${notebookEntry.title}, '') || ' ' || coalesce(${notebookEntry.bodyMarkdown}, ''))`,
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("notebook_owner_idx").on(t.ownerId, t.kind), index("notebook_tsv_idx").using("gin", t.tsv)],
);

export const portfolioArtifact = pgTable(
  "portfolio_artifact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    description: text("description").notNull(),
    links: jsonb("links").$type<{ label: string; href: string }[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [index("portfolio_owner_idx").on(t.ownerId)],
);
