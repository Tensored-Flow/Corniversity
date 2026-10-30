import type { PgBoss } from "pg-boss";
import type { Database } from "@corniversity/db/client";
import type { Env } from "@corniversity/db/env";
import { QUEUES } from "@corniversity/db/jobs";
import { assessHandler } from "./assess";
import { markJob } from "./job-record";
import { maintenanceHandler } from "./maintenance";

export interface HandlerContext {
  db: Database;
  env: Env;
  boss: PgBoss;
}

type Handler = (ctx: HandlerContext, data: unknown) => Promise<Record<string, unknown>>;

/**
 * Registers a handler per queue. Each handler receives a validated payload, updates the job
 * record, and records failures before re-throwing so pg-boss applies the retry policy.
 */
export async function registerHandlers(boss: PgBoss, db: Database, env: Env): Promise<void> {
  const ctx: HandlerContext = { db, env, boss };

  const wrap = (handler: Handler) => async ([job]: { data: unknown }[]) => {
    if (!job) return;
    await markJob(db, job.data, "active");
    try {
      const result = await handler(ctx, job.data);
      await markJob(db, job.data, "completed", { result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markJob(db, job.data, "failed", { error: message });
      throw error;
    }
  };

  await boss.work(QUEUES.maintenance, { batchSize: 1 }, wrap(maintenanceHandler));
  await boss.work(QUEUES.assessSubmission, { batchSize: 1, pollingIntervalSeconds: 1 }, wrap(assessHandler));

  // Nightly revision-due pass; cheap, idempotent by key per day.
  await boss.schedule(QUEUES.maintenance, "15 3 * * *", {
    idempotencyKey: "maintenance:revision-due:daily",
    task: "revision-due",
  });
}
