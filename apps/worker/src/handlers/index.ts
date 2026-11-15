import type { Database } from "@corniversity/db/client";
import type { Env } from "@corniversity/db/env";
import { QUEUES } from "@corniversity/db/jobs";
import type { PgBoss } from "pg-boss";
import { assessHandler } from "./assess";
import { exportHandler } from "./export";
import { ingestHandler } from "./ingest";
import { markJob } from "./job-record";
import { maintenanceHandler } from "./maintenance";
import { prepareHandler } from "./prepare";
import { scholarlyArxivHandler, scholarlyRefreshHandler } from "./scholarly";
import { transcribeHandler } from "./transcribe";

export interface HandlerContext {
  db: Database;
  env: Env;
  boss: PgBoss;
}

type Handler = (ctx: HandlerContext, data: unknown) => Promise<Record<string, unknown>>;

/**
 * Thrown by a handler when retrying cannot help (a corrupt file, a payload that no longer
 * refers to anything). The job record is marked failed with the reason, but the error is not
 * re-thrown, so pg-boss does not spend its retry budget on a certain failure.
 */
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}

/**
 * Registers a handler per queue. Each handler receives a validated payload, updates the job
 * record, and records failures before re-throwing so pg-boss applies the retry policy.
 */
export async function registerHandlers(boss: PgBoss, db: Database, env: Env): Promise<void> {
  const ctx: HandlerContext = { db, env, boss };

  const wrap =
    (handler: Handler) =>
    async ([job]: { data: unknown }[]) => {
      if (!job) return;
      await markJob(db, job.data, "active");
      try {
        const result = await handler(ctx, job.data);
        await markJob(db, job.data, "completed", { result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await markJob(db, job.data, "failed", { error: message });
        if (error instanceof NonRetryableError) return;
        throw error;
      }
    };

  await boss.work(QUEUES.maintenance, { batchSize: 1 }, wrap(maintenanceHandler));
  await boss.work(QUEUES.assessSubmission, { batchSize: 1, pollingIntervalSeconds: 1 }, wrap(assessHandler));
  await boss.work(QUEUES.ingestAsset, { batchSize: 1, pollingIntervalSeconds: 2 }, wrap(ingestHandler));
  await boss.work(QUEUES.exportRecords, { batchSize: 1, pollingIntervalSeconds: 2 }, wrap(exportHandler));
  await boss.work(QUEUES.transcribePages, { batchSize: 1, pollingIntervalSeconds: 2 }, wrap(transcribeHandler));
  await boss.work(QUEUES.prepareUnit, { batchSize: 1, pollingIntervalSeconds: 2 }, wrap(prepareHandler));
  // arXiv: one job at a time (the queue's singleton key does the same across processes).
  await boss.work(QUEUES.scholarlyArxiv, { batchSize: 1, localConcurrency: 1, pollingIntervalSeconds: 2 }, wrap(scholarlyArxivHandler));
  await boss.work(QUEUES.scholarlyRefresh, { batchSize: 1, pollingIntervalSeconds: 5 }, wrap(scholarlyRefreshHandler));
  // scholarly-lists (subject-list refreshes) is defined in jobs.ts; its handler arrives with Discover.

  await scheduleMaintenance(boss);
}

/**
 * The maintenance schedules. pg-boss keys schedules by (queue, key), so each task carries its own
 * key; without one every schedule on the queue replaced the previous one and only the last ran.
 * The keyless row an earlier build left behind is removed.
 */
export const MAINTENANCE_SCHEDULES = [
  // Nightly revision-due pass; cheap, idempotent by key per day.
  { cron: "15 3 * * *", idempotencyKey: "maintenance:revision-due:daily", task: "revision-due" },
  { cron: "45 3 * * *", idempotencyKey: "maintenance:revoke-stale-pairing-codes:daily", task: "revoke-stale-pairing-codes" },
  { cron: "*/15 * * * *", idempotencyKey: "maintenance:unsettle-stale-runs", task: "unsettle-stale-runs" },
  { cron: "30 4 * * 1", idempotencyKey: "maintenance:expire-old-exports:weekly", task: "expire-old-exports" },
  { cron: "0 5 * * *", idempotencyKey: "maintenance:purge-provider-cache:daily", task: "purge-provider-cache" },
] as const;

export async function scheduleMaintenance(boss: Pick<PgBoss, "schedule" | "unschedule">): Promise<void> {
  await boss.unschedule(QUEUES.maintenance, "").catch(() => undefined);
  for (const s of MAINTENANCE_SCHEDULES) {
    await boss.schedule(QUEUES.maintenance, s.cron, { idempotencyKey: s.idempotencyKey, task: s.task }, { key: s.task });
  }
}
