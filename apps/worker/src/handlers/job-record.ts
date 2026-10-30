import { eq } from "drizzle-orm";
import type { Database } from "@corniversity/db/client";
import { jobRecord } from "@corniversity/db/schema/operations";

interface Carrier {
  jobRecordId?: string;
  idempotencyKey?: string;
}

export async function markJob(
  db: Database,
  data: unknown,
  status: "active" | "completed" | "failed" | "cancelled",
  extra: { result?: unknown; error?: string; progress?: { stage: string; percent?: number; detail?: string } } = {},
): Promise<void> {
  const carrier = (data ?? {}) as Carrier;
  const now = new Date();
  const patch: Partial<typeof jobRecord.$inferInsert> = { status };
  if (status === "active") patch.startedAt = now;
  if (status === "completed" || status === "failed" || status === "cancelled") patch.finishedAt = now;
  if (extra.result !== undefined) patch.result = extra.result;
  if (extra.error !== undefined) patch.error = extra.error;
  if (extra.progress) patch.progress = extra.progress;

  if (carrier.jobRecordId) {
    await db.update(jobRecord).set(patch).where(eq(jobRecord.id, carrier.jobRecordId));
  } else if (carrier.idempotencyKey) {
    await db.update(jobRecord).set(patch).where(eq(jobRecord.idempotencyKey, carrier.idempotencyKey));
  }
}

export async function reportProgress(
  db: Database,
  data: unknown,
  progress: { stage: string; percent?: number; detail?: string },
): Promise<void> {
  const carrier = (data ?? {}) as Carrier;
  if (!carrier.jobRecordId) return;
  await db.update(jobRecord).set({ progress }).where(eq(jobRecord.id, carrier.jobRecordId));
}
