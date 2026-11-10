import type { PaidUseApproval } from "@corniversity/ai/state";
import type { ExplicitStudyPreferences } from "@corniversity/core";
import { boolean, index, integer, jsonb, numeric, pgTable, real, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, immersionEnum, tz, updatedAt } from "./_shared";
import { user } from "./auth";

export type LearningStyle = "proof_led" | "conceptual" | "computational" | "experimental" | "mixed";

export interface OnboardingAnswers {
  departmentIds?: string[];
  /** Programmes of interest chosen in orientation; following one never enrols in its courses. */
  programmeIds?: string[];
  interestCourseIds?: string[];
  goalsText?: string;
  priorKnowledge?: Record<string, string>; // concept or topic -> self-report text
  learningStyles?: Record<string, LearningStyle>; // departmentId -> style
  weeklyHours?: number;
  availability?: { weekday: number; startMinute: number; endMinute: number }[];
  commitments?: {
    title: string;
    weekday: number;
    startMinute: number;
    endMinute: number;
    protected: boolean;
  }[];
  rhythm?: "term" | "rolling" | "reading_course";
  /** Assessment choices made with the rhythm; both off unless the learner switches them on. */
  hardDeadlines?: boolean;
  examinations?: boolean;
  placement?: Record<string, "passed" | "skipped" | "attempted">;
  chosenPlanId?: string;
  chosenPlan?: { id: string; title: string; courses: { courseId: string; role: string; mode: string }[] };
  modes?: Record<string, "enrolled" | "audit" | "reading_seminar">;
  peerPersonaIds?: string[];
  termStart?: string; // ISO date
}

export const learnerProfile = pgTable("learner_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  timezone: text("timezone").notNull().default("Europe/London"),
  immersion: immersionEnum("immersion").notNull().default("collegiate"),
  accessibility: jsonb("accessibility")
    .$type<{ reducedMotion?: boolean; fontScale?: number; highContrast?: boolean; notes?: string }>()
    .notNull()
    .default({}),
  learningStyles: jsonb("learning_styles").$type<Record<string, LearningStyle>>().notNull().default({}),
  weeklyHoursCeiling: integer("weekly_hours_ceiling"),
  studyRhythm: text("study_rhythm").$type<"term" | "rolling" | "reading_course">(),
  /** Only the study preferences the learner has explicitly chosen; defaults are applied in code. */
  studyPreferences: jsonb("study_preferences").$type<ExplicitStudyPreferences>().notNull().default({}),
  /** Review choices the learner made (weekly number, pause, days kept free); unset means the default. */
  reviewPreferences: jsonb("review_preferences")
    .$type<{ budgetPerWeek?: number; paused?: boolean; restWeekdays?: number[] }>()
    .notNull()
    .default({}),
  goalsText: text("goals_text"),
  socialLayerEnabled: boolean("social_layer_enabled").notNull().default(true),
  notifications: jsonb("notifications").$type<{ inApp: boolean; email: boolean }>().notNull().default({ inApp: true, email: false }),
  onboardingStep: integer("onboarding_step").notNull().default(1),
  onboardingAnswers: jsonb("onboarding_answers").$type<OnboardingAnswers>().notNull().default({}),
  onboardingCompletedAt: tz("onboarding_completed_at"),
  theme: text("theme").$type<"light" | "dark" | "system">().notNull().default("light"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const providerSetting = pgTable("provider_setting", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  provider: text("provider").$type<"fixture" | "anthropic">().notNull().default("fixture"),
  apiKeyEncrypted: text("api_key_encrypted"),
  apiKeyHint: text("api_key_hint"),
  /** No longer read: every role uses `model`, so one approval covers every paid run. */
  modelMap: jsonb("model_map").$type<Record<string, string>>().notNull().default({}),
  /** The model every role uses; null means the deployment default (AI_MODEL_DEFAULT). */
  model: text("model"),
  /** Re-run a declined request on the provider's fallback model; on unless the owner turns it off. */
  refusalFallback: boolean("refusal_fallback").notNull().default(true),
  /** Null until the owner approves paid use. */
  paidUseApproval: jsonb("paid_use_approval").$type<PaidUseApproval>(),
  updatedAt: updatedAt(),
});

export const budgetSetting = pgTable("budget_setting", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  perRunUsd: numeric("per_run_usd", { precision: 10, scale: 4 }).notNull().default("0.50"),
  dailyUsd: numeric("daily_usd", { precision: 10, scale: 4 }).notNull().default("3.00"),
  monthlyUsd: numeric("monthly_usd", { precision: 10, scale: 4 }).notNull().default("40.00"),
  hardStop: boolean("hard_stop").notNull().default(true),
  warnFraction: real("warn_fraction").notNull().default(0.8),
  updatedAt: updatedAt(),
});

export const consentRecord = pgTable(
  "consent_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    granted: boolean("granted").notNull(),
    basis: text("basis").notNull(),
    recordedAt: createdAt(),
    revokedAt: tz("revoked_at"),
  },
  (t) => [index("consent_user_kind_idx").on(t.userId, t.kind)],
);

export const devicePairing = pgTable(
  "device_pairing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    roots: jsonb("roots").$type<string[]>().notNull().default([]),
    lastStatus: jsonb("last_status").$type<{
      watching: boolean;
      paused?: boolean;
      pendingFiles: number;
      version: string;
      reportedAt: string;
    }>(),
    createdAt: createdAt(),
    lastSeenAt: tz("last_seen_at"),
    revokedAt: tz("revoked_at"),
  },
  (t) => [index("device_pairing_user_idx").on(t.userId)],
);

export const pairingCode = pgTable("pairing_code", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull().unique(),
  expiresAt: tz("expires_at").notNull(),
  consumedAt: tz("consumed_at"),
  createdAt: createdAt(),
});

export const learnerConceptOverride = pgTable(
  "learner_concept_override",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    conceptId: text("concept_id").notNull(),
    claim: text("claim").$type<"known" | "not_known">().notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("concept_override_user_idx").on(t.userId, t.conceptId)],
);
