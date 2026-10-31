import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, tz } from "./_shared";
import { department } from "./academic";
import { user } from "./auth";
import { learningSession } from "./learning";

export type PersonaRole =
  | "director"
  | "convenor"
  | "lecturer"
  | "tutor"
  | "librarian"
  | "assessor"
  | "seminar_chair"
  | "supervisor"
  | "peer";

export const persona = pgTable("persona", {
  id: text("id").primaryKey(),
  version: integer("version").notNull().default(1),
  name: text("name").notNull(),
  role: text("role").$type<PersonaRole>().notNull(),
  title: text("title").notNull(),
  departmentId: text("department_id").references(() => department.id),
  style: jsonb("style")
    .$type<{
      approach: string;
      habits: string[];
      officeHours: string;
      notation?: string;
      avoid?: string[];
    }>()
    .notNull(),
  introduction: text("introduction").notNull(),
  avatarKey: text("avatar_key").notNull(),
  promptKey: text("prompt_key").notNull(),
  isPeer: boolean("is_peer").notNull().default(false),
});

export const peerMembership = pgTable(
  "peer_membership",
  {
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    personaId: text("persona_id")
      .notNull()
      .references(() => persona.id),
    enabled: boolean("enabled").notNull().default(true),
    muted: boolean("muted").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.personaId] })],
);

export const society = pgTable("society", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  departmentId: text("department_id").references(() => department.id),
  cadence: text("cadence").notNull(),
  chairPersonaId: text("chair_persona_id").references(() => persona.id),
});

export const discussion = pgTable(
  "discussion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"seminar" | "common_room" | "society" | "tutorial_peer" | "office_hours">().notNull(),
    title: text("title").notNull(),
    societyId: text("society_id").references(() => society.id),
    learningSessionId: uuid("learning_session_id").references(() => learningSession.id, {
      onDelete: "set null",
    }),
    participantPersonaIds: jsonb("participant_persona_ids").$type<string[]>().notNull().default([]),
    maxRounds: integer("max_rounds").notNull().default(3),
    roundsUsed: integer("rounds_used").notNull().default(0),
    status: text("status").$type<"open" | "closed" | "muted">().notNull().default("open"),
    releasedMaterial: jsonb("released_material")
      .$type<{ unitIds: string[]; locatorIds: string[]; exerciseIds: string[] }>()
      .notNull()
      .default({ unitIds: [], locatorIds: [], exerciseIds: [] }),
    createdAt: createdAt(),
    closedAt: tz("closed_at"),
  },
  (t) => [index("discussion_owner_idx").on(t.ownerId, t.status)],
);

export const discussionTurn = pgTable(
  "discussion_turn",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discussionId: uuid("discussion_id")
      .notNull()
      .references(() => discussion.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    speaker: text("speaker").notNull(), // "learner" or a persona id
    contentMarkdown: text("content_markdown").notNull(),
    labels: jsonb("labels").$type<string[]>().notNull().default([]),
    providerRunId: uuid("provider_run_id"),
    createdAt: createdAt(),
  },
  (t) => [index("discussion_turn_discussion_idx").on(t.discussionId, t.sequence)],
);

export const personaMemory = pgTable(
  "persona_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    personaId: text("persona_id")
      .notNull()
      .references(() => persona.id),
    kind: text("kind").$type<"academic" | "preference" | "social">().notNull(),
    content: text("content").notNull(),
    provenance: text("provenance").notNull(),
    createdAt: createdAt(),
    deletedAt: tz("deleted_at"),
  },
  (t) => [index("persona_memory_owner_idx").on(t.ownerId, t.personaId)],
);
