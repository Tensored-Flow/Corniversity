import { PgBoss } from "pg-boss";
import { sql } from "drizzle-orm";
import { fromDrizzle } from "pg-boss";
import { DEAD_LETTER_QUEUES, QUEUES, QUEUE_CONFIG, type QueueName } from "./jobs";
import type { DbOrTx } from "./client";
import { jobRecord } from "./schema/operations";
import { getEnv } from "./env";

let boss: PgBoss | undefined;
let starting: Promise<PgBoss> | undefined;

/**
 * One pg-boss instance per process. The web app uses it only to enqueue (and to read job
 * state); the worker calls `work()` on each queue. Both ensure the queues exist, so whichever
 * process starts first creates them.
 */
export async function getBoss(options: { connectionString?: string; supervise?: boolean } = {}): Promise<PgBoss> {
  if (boss) return boss;
  if (starting) return starting;
  starting = (async () => {
    const instance = new PgBoss({
      connectionString: options.connectionString ?? getEnv().DATABASE_URL,
      schema: "pgboss",
      max: 4,
      supervise: options.supervise ?? false,
      schedule: options.supervise ?? false,
      application_name: "corniversity",
    });
    instance.on("error", (error) => console.error("[queue]", error));
    await instance.start();
    await ensureQueues(instance);
    boss = instance;
    return instance;
  })();
  return starting;
}

async function ensureQueues(instance: PgBoss): Promise<void> {
  for (const dlq of DEAD_LETTER_QUEUES) {
    await instance.createQueue(dlq).catch(swallowExists);
  }
  for (const name of Object.values(QUEUES)) {
    const config = QUEUE_CONFIG[name];
    await instance.createQueue(name, config).catch(swallowExists);
  }
}

function swallowExists(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (!/already exists|duplicate/i.test(message)) throw error;
}

export async function stopBoss(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 10_000 });
    boss = undefined;
    starting = undefined;
  }
}

export interface EnqueueInput<T extends { idempotencyKey: string; ownerId?: string }> {
  queue: QueueName;
  kind: string;
  payload: T;
  tx?: DbOrTx;
  singletonKey?: string;
}

/**
 * Creates the application-level job record and the pg-boss job in one database transaction
 * when a transaction is supplied, so a rolled-back domain write never leaves a dangling job.
 * Re-sending with the same idempotency key returns the existing record without a new job.
 */
export async function enqueue<T extends { idempotencyKey: string; ownerId?: string }>(
  db: DbOrTx,
  input: EnqueueInput<T>,
): Promise<{ jobRecordId: string; created: boolean }> {
  const instance = await getBoss();
  const existing = await db
    .select({ id: jobRecord.id })
    .from(jobRecord)
    .where(sql`${jobRecord.idempotencyKey} = ${input.payload.idempotencyKey}`)
    .limit(1);
  if (existing[0]) return { jobRecordId: existing[0].id, created: false };

  const [record] = await db
    .insert(jobRecord)
    .values({
      ownerId: input.payload.ownerId ?? null,
      kind: input.kind,
      queue: input.queue,
      idempotencyKey: input.payload.idempotencyKey,
      payload: input.payload,
      status: "queued",
    })
    .returning({ id: jobRecord.id });
  if (!record) throw new Error("job record insert returned nothing");

  const jobId = await instance.send(input.queue, { ...input.payload, jobRecordId: record.id }, {
    singletonKey: input.singletonKey ?? input.payload.idempotencyKey,
    db: fromDrizzle(db as never, sql),
  });
  if (jobId) {
    await db.update(jobRecord).set({ pgbossJobId: jobId }).where(sql`${jobRecord.id} = ${record.id}`);
  }
  return { jobRecordId: record.id, created: true };
}
