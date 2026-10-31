import type { Database } from "@corniversity/db/client";
import type { Env } from "@corniversity/db/env";
import { QUEUES } from "@corniversity/db/jobs";
import type { PgBoss } from "pg-boss";
import { assessHandler } from "./assess";
import { exportHandler } from "./export";
import { ingestHandler } from "./ingest";
import { markJob } from "./job-record";
import { maintenanceHandler } from "./maintenance";

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

  // Nightly revision-due pass; cheap, idempotent by key per day.
  await boss.schedule(QUEUES.maintenance, "15 3 * * *", {
    idempotencyKey: "maintenance:revision-due:daily",
    task: "revision-due",
  });
  await boss.schedule(QUEUES.maintenance, "45 3 * * *", {
    idempotencyKey: "maintenance:revoke-stale-pairing-codes:daily",
    task: "revoke-stale-pairing-codes",
  });
  await boss.schedule(QUEUES.maintenance, "30 4 * * 1", {
    idempotencyKey: "maintenance:purge-deleted-assets:weekly",
    task: "purge-deleted-assets",
  });
}
