import { createBlobStore } from "@corniversity/db/blob";
import { MaintenancePayload } from "@corniversity/db/jobs";
import { pairingCode } from "@corniversity/db/schema/learner";
import { exportRecord } from "@corniversity/db/schema/operations";
import { markStaleRunsUnsettled } from "@corniversity/db/services/provider-config";
import { and, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { HandlerContext } from "./index";

export async function maintenanceHandler(ctx: HandlerContext, raw: unknown): Promise<Record<string, unknown>> {
  const payload = MaintenancePayload.parse(raw);
  switch (payload.task) {
    case "revoke-stale-pairing-codes": {
      const result = await ctx.db
        .delete(pairingCode)
        .where(and(isNull(pairingCode.consumedAt), lt(pairingCode.expiresAt, new Date())))
        .returning({ id: pairingCode.id });
      return { removedPairingCodes: result.length };
    }
    case "revision-due": {
      // Revision items are surfaced by query at read time; this pass only records the run so
      // the owner can see maintenance is alive. No content is generated here.
      const result = await ctx.db.execute(sql`select count(*)::int as due from revision_item where due_at <= now()`);
      const due = (result.rows[0] as { due?: number } | undefined)?.due ?? 0;
      return { revisionItemsDue: due };
    }
    case "unsettle-stale-runs": {
      // A live run left "running" by a process that ended keeps its worst case and is marked
      // unsettled for the owner to settle; it is never released as free.
      return { unsettledRuns: await markStaleRunsUnsettled(ctx.db) };
    }
    case "expire-old-exports": {
      // Stored originals go the moment an item is deleted or its storage permission is withdrawn,
      // so nothing is left to purge there. Export files are kept for 30 days after they are
      // built, then removed; the export's row stays so the records page can say it expired.
      const blobs = createBlobStore(ctx.env.BLOB_STORE, ctx.db, ctx.env.CORNIVERSITY_DATA_ROOT);
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const stale = await ctx.db
        .select({ id: exportRecord.id, storageKey: exportRecord.storageKey })
        .from(exportRecord)
        .where(and(eq(exportRecord.status, "ready"), isNotNull(exportRecord.storageKey), lt(exportRecord.completedAt, cutoff)));
      for (const row of stale) {
        if (row.storageKey) await blobs.delete(row.storageKey).catch(() => undefined);
        await ctx.db.update(exportRecord).set({ status: "expired", storageKey: null }).where(eq(exportRecord.id, row.id));
      }
      return { expiredExports: stale.length };
    }
  }
}
