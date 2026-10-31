import { createBlobStore } from "@corniversity/db/blob";
import { ExportRecordsPayload } from "@corniversity/db/jobs";
import { exportRecord } from "@corniversity/db/schema/index";
import { buildRecordsBundle, renderMarkdownExport } from "@corniversity/db/services/records";
import { eq } from "drizzle-orm";
import type { HandlerContext } from "./index";

/**
 * Builds a portable export from the database (the source of truth) and stores it as a private
 * blob the owner downloads from the Records page. Formats: the JSON bundle (`full`, `records`),
 * the notebook alone (`notebook`) and a human-readable Markdown document (`alter_markdown`).
 */
export async function exportHandler(ctx: HandlerContext, raw: unknown): Promise<Record<string, unknown>> {
  const payload = ExportRecordsPayload.parse(raw);
  const bundle = await buildRecordsBundle(ctx.db, payload.ownerId);
  let body: Buffer;
  if (payload.kind === "alter_markdown") body = Buffer.from(renderMarkdownExport(bundle), "utf8");
  else if (payload.kind === "notebook")
    body = Buffer.from(
      JSON.stringify(
        {
          format: "corniversity-notebook/1",
          generatedAt: bundle.generatedAt,
          disclaimer: bundle.disclaimer,
          notebook: bundle.notebook,
          annotations: bundle.annotations,
        },
        null,
        2,
      ),
      "utf8",
    );
  else if (payload.kind === "records")
    body = Buffer.from(JSON.stringify({ ...bundle, notebook: undefined, annotations: undefined }, null, 2), "utf8");
  else body = Buffer.from(JSON.stringify(bundle, null, 2), "utf8");
  const blobs = createBlobStore(ctx.env.BLOB_STORE, ctx.db, ctx.env.CORNIVERSITY_DATA_ROOT);
  const stored = await blobs.put(body);
  await ctx.db
    .update(exportRecord)
    .set({ status: "ready", storageKey: stored.key, completedAt: new Date() })
    .where(eq(exportRecord.id, payload.exportId));
  return { bytes: body.byteLength, kind: payload.kind };
}
