import { getExport } from "@corniversity/db/services/records";
import { NextResponse } from "next/server";
import { blobs } from "@/lib/blobs";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Downloads a finished export; session required and the export must belong to the signed-in owner. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const record = await getExport(db(), authed.session.user.id, id);
  if (record?.status !== "ready" || !record.storageKey) return NextResponse.json({ error: "not_ready" }, { status: 404 });
  const data = await blobs().get(record.storageKey);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const markdown = record.kind === "alter_markdown";
  const date = record.createdAt.toISOString().slice(0, 10);
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": markdown ? "text/markdown; charset=utf-8" : "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="corniversity-${record.kind}-${date}.${markdown ? "md" : "json"}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
