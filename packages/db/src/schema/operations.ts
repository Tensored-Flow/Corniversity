import { index, integer, jsonb, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";

/** One model attempt within a recorded run, as the provider reported it, with its own cost. */
export interface AttemptRecord {
  kind: "message" | "fallback_message";
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

import { createdAt, tz, updatedAt } from "./_shared";
import { user } from "./auth";

export type JobStatus = "queued" | "active" | "completed" | "failed" | "cancelled";

export const jobRecord = pgTable(
  "job_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    queue: text("queue").notNull(),
    pgbossJobId: text("pgboss_job_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: text("status").$type<JobStatus>().notNull().default("queued"),
    progress: jsonb("progress").$type<{ stage: string; percent?: number; detail?: string }>().notNull().default({ stage: "queued" }),
    payload: jsonb("payload").notNull(),
    result: jsonb("result"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    startedAt: tz("started_at"),
    finishedAt: tz("finished_at"),
  },
  (t) => [index("job_record_owner_idx").on(t.ownerId, t.status), index("job_record_kind_idx").on(t.kind)],
);

export const providerRun = pgTable(
  "provider_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    role: text("role").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    purpose: text("purpose").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    pricingVersion: text("pricing_version").notNull(),
    promptVersion: text("prompt_version").notNull(),
    /**
     * "running" while a live run is in progress and "unsettled" when the provider may have billed
     * more than is known (a broken stream, a lost connection, a process that ended mid-run): both
     * hold the run's worst case against the limits until it is finished or settled.
     */
    status: text("status").$type<"ok" | "error" | "refused" | "budget_blocked" | "blocked" | "running" | "unsettled">().notNull(),
    error: text("error"),
    /** Each model attempt with its usage and model; a fallback model taking over adds one. */
    attempts: jsonb("attempts").$type<AttemptRecord[]>().notNull().default([]),
    /** The worst case the budget gate checked before the run started. */
    worstCaseUsd: numeric("worst_case_usd", { precision: 12, scale: 6 }),
    /** One provider call: a duplicate request for the same call cannot reserve or bill twice. */
    idempotencyKey: text("idempotency_key").unique(),
    /** The run that started this one, when one learner action makes several calls (a discussion). */
    parentRunId: uuid("parent_run_id"),
    /** How an unsettled run was resolved: the amount the owner recorded from the provider console. */
    settlement: jsonb("settlement").$type<{ method: "owner_recorded"; amountUsd: string; note: string; at: string }>(),
    startedAt: createdAt(),
    finishedAt: tz("finished_at"),
  },
  (t) => [index("provider_run_owner_time_idx").on(t.ownerId, t.startedAt), index("provider_run_status_idx").on(t.status)],
);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    actor: text("actor").notNull(), // learner | director | system | companion:<id>
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_owner_time_idx").on(t.ownerId, t.createdAt)],
);

export const exportRecord = pgTable(
  "export_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"full" | "notebook" | "records" | "alter_markdown">().notNull(),
    status: text("status").$type<"queued" | "ready" | "failed" | "expired">().notNull().default("queued"),
    storageKey: text("storage_key"),
    createdAt: createdAt(),
    completedAt: tz("completed_at"),
  },
  (t) => [index("export_owner_idx").on(t.ownerId)],
);

export const appSetting = pgTable("app_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});
