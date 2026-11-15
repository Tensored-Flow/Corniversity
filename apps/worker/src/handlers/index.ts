import type { Database } from "@corniversity/db/client";
import type { Env } from "@corniversity/db/env";
import { QUEUES } from "@corniversity/db/jobs";
import { discoverClient } from "@corniversity/db/services/discover";
import type { PgBoss } from "pg-boss";
import { assessHandler } from "./assess";
import { exportHandler } from "./export";
import { ingestHandler } from "./ingest";
import { markJob } from "./job-record";
import { maintenanceHandler } from "./maintenance";
import { prepareHandler } from "./prepare";
import { type ScholarlyHandlerContext, scholarlyArxivHandler, scholarlyRefreshHandler } from "./scholarly";
import { scholarlyListsHandler } from "./scholarly-lists";
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
    (handler: Handler, context: HandlerContext = ctx) =>
    async ([job]: { data: unknown }[]) => {
      if (!job) return;
      await markJob(db, job.data, "active");
      try {
        const result = await handler(context, job.data);
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
  // arXiv: one job at a time (the queue's singleton key does the same across processes). Its client
  // is Discover's, so newest-submission listings land in the cache Discover reads, in fixture mode too.
  const arxivCtx: ScholarlyHandlerContext = { ...ctx, scholarly: discoverClient(env, db) };
  await boss.work(
    QUEUES.scholarlyArxiv,
    { batchSize: 1, localConcurrency: 1, pollingIntervalSeconds: 2 },
    wrap(scholarlyArxivHandler, arxivCtx),
  );
  await boss.work(QUEUES.scholarlyRefresh, { batchSize: 1, pollingIntervalSeconds: 5 }, wrap(scholarlyRefreshHandler));
  await boss.work(QUEUES.scholarlyLists, { batchSize: 1, pollingIntervalSeconds: 2 }, wrap(scholarlyListsHandler));

  await scheduleMaintenance(boss);
  await scheduleSubjectLists(boss);
}

/** Discover's subject lists (and their arXiv listings) once a day; pages ask for a list when it is missing or out of date. */
export const SUBJECT_LISTS_SCHEDULE = {
  cron: "20 5 * * *",
  // pg-boss keys allow letters, digits, _ - . and / only.
  key: "subject-lists-daily",
  data: { idempotencyKey: "scholarly-lists:daily", task: "subject-lists", arxivListings: true },
} as const;

export async function scheduleSubjectLists(boss: Pick<PgBoss, "schedule">): Promise<void> {
  const s = SUBJECT_LISTS_SCHEDULE;
  await boss.schedule(QUEUES.scholarlyLists, s.cron, { ...s.data }, { key: s.key });
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
