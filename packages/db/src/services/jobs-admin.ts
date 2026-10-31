import { and, desc, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { QUEUES, type QueueName } from "../jobs";
import { enqueue, getBoss } from "../queue";
import { jobRecord, resourceAsset } from "../schema/index";

export type JobRow = typeof jobRecord.$inferSelect;

/** The owner's background jobs, newest first. */
export async function listJobs(db: DbOrTx, ownerId: string, limit = 50): Promise<JobRow[]> {
  return db.select().from(jobRecord).where(eq(jobRecord.ownerId, ownerId)).orderBy(desc(jobRecord.createdAt)).limit(limit);
}

export async function getJob(db: DbOrTx, ownerId: string, jobId: string): Promise<JobRow | null> {
  const rows = await db.select().from(jobRecord).where(and(eq(jobRecord.id, jobId), eq(jobRecord.ownerId, ownerId))).limit(1);
  return rows[0] ?? null;
}

/** Latest ingestion job for an asset, so the item page can show progress and errors. */
export async function latestIngestJob(db: DbOrTx, ownerId: string, assetId: string): Promise<JobRow | null> {
  const rows = await db
    .select()
    .from(jobRecord)
    .where(and(eq(jobRecord.ownerId, ownerId), eq(jobRecord.kind, "ingest-asset"), sql`${jobRecord.payload}->>'assetId' = ${assetId}`))
    .orderBy(desc(jobRecord.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Cancels a queued or active job. pg-boss stops delivering it (an active handler finishes its
 * current step and its completion is then ignored); the record is marked cancelled and an
 * ingestion's asset goes back to "validated" so it can be processed again later.
 */
export async function cancelJob(db: DbOrTx, ownerId: string, jobId: string): Promise<{ ok: boolean; reason?: string }> {
  const job = await getJob(db, ownerId, jobId);
  if (!job) return { ok: false, reason: "Job not found." };
  if (job.status !== "queued" && job.status !== "active") return { ok: false, reason: `A ${job.status} job cannot be cancelled.` };
  if (job.pgbossJobId) {
    const boss = await getBoss();
    await boss.cancel(job.queue, job.pgbossJobId).catch(() => undefined);
  }
  await db.update(jobRecord).set({ status: "cancelled", finishedAt: new Date(), progress: { stage: "cancelled" } }).where(eq(jobRecord.id, job.id));
  if (job.kind === "ingest-asset") {
    const assetId = (job.payload as { assetId?: string }).assetId;
    if (assetId) await db.update(resourceAsset).set({ status: "validated" }).where(and(eq(resourceAsset.id, assetId), eq(resourceAsset.status, "processing")));
  }
  return { ok: true };
}

/**
 * Re-runs a failed or cancelled job as a new job with a derived idempotency key
 * (`<key>#r2`, `#r3`, …). The original record stays as history; the new one is linked by key.
 */
export async function retryJob(db: DbOrTx, ownerId: string, jobId: string): Promise<{ ok: boolean; reason?: string; newJobId?: string }> {
  const job = await getJob(db, ownerId, jobId);
  if (!job) return { ok: false, reason: "Job not found." };
  if (job.status !== "failed" && job.status !== "cancelled") return { ok: false, reason: `A ${job.status} job cannot be retried.` };
  if (!Object.values(QUEUES).includes(job.queue as QueueName)) return { ok: false, reason: "Unknown queue." };
  const base = job.idempotencyKey.replace(/#r\d+$/, "");
  const previous = Number(/#r(\d+)$/.exec(job.idempotencyKey)?.[1] ?? "1");
  const payload = { ...(job.payload as Record<string, unknown>), idempotencyKey: `${base}#r${previous + 1}`, ownerId } as { idempotencyKey: string; ownerId: string };
  if (job.kind === "ingest-asset") {
    const assetId = (job.payload as { assetId?: string }).assetId;
    if (assetId) {
      const [asset] = await db.select().from(resourceAsset).where(and(eq(resourceAsset.id, assetId), eq(resourceAsset.ownerId, ownerId))).limit(1);
      if (!asset || asset.deletedAt) return { ok: false, reason: "The asset no longer exists." };
      if (!asset.storageKey) return { ok: false, reason: "The asset's bytes are not stored." };
      await db.update(resourceAsset).set({ status: "processing", rejectionReason: null }).where(eq(resourceAsset.id, assetId));
    }
  }
  const result = await enqueue(db, { queue: job.queue as QueueName, kind: job.kind, payload, singletonKey: `${job.kind}:${payload.idempotencyKey}` });
  return { ok: true, newJobId: result.jobRecordId };
}
