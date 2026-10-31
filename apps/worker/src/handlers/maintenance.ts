import { MaintenancePayload } from "@corniversity/db/jobs";
import { pairingCode } from "@corniversity/db/schema/learner";
import { and, isNull, lt, sql } from "drizzle-orm";
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
    case "purge-deleted-assets": {
      const result = await ctx.db.execute(
        sql`delete from asset_blob where storage_key in (
              select storage_key from resource_asset where deleted_at is not null and deleted_at < now() - interval '30 days' and storage_key is not null)`,
      );
      return { purgedBlobs: result.rowCount ?? 0 };
    }
  }
}
