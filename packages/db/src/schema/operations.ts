import { index, integer, jsonb, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
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
    progress: jsonb("progress")
      .$type<{ stage: string; percent?: number; detail?: string }>()
      .notNull()
      .default({ stage: "queued" }),
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
    status: text("status").$type<"ok" | "error" | "refused" | "budget_blocked">().notNull(),
    error: text("error"),
    startedAt: createdAt(),
    finishedAt: tz("finished_at"),
  },
  (t) => [index("provider_run_owner_time_idx").on(t.ownerId, t.startedAt)],
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
    status: text("status").$type<"queued" | "ready" | "failed">().notNull().default("queued"),
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
