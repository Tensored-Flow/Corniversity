import type { PgBoss } from "pg-boss";
import type { Database } from "@corniversity/db/client";
import type { Env } from "@corniversity/db/env";
import { QUEUES } from "@corniversity/db/jobs";
import { maintenanceHandler } from "./maintenance";
import { markJob } from "./job-record";

export interface HandlerContext {
  db: Database;
  env: Env;
  boss: PgBoss;
}

/**
 * Registers a handler per queue. Handlers receive validated payloads, update the job record,
 * and never throw raw errors upward without recording them.
 */
export async function registerHandlers(boss: PgBoss, db: Database, env: Env): Promise<void> {
  const ctx: HandlerContext = { db, env, boss };

  await boss.work(QUEUES.maintenance, { batchSize: 1 }, async ([job]) => {
    if (!job) return;
    await markJob(db, job.data, "active");
    try {
      const result = await maintenanceHandler(ctx, job.data as never);
      await markJob(db, job.data, "completed", { result });
    } catch (error) {
      await markJob(db, job.data, "failed", { error: (error as Error).message });
      throw error;
    }
  });

  // Nightly revision-due pass; cheap, idempotent by key per day.
  await boss.schedule(QUEUES.maintenance, "15 3 * * *", {
    idempotencyKey: "maintenance:revision-due:daily",
    task: "revision-due",
  });
}
