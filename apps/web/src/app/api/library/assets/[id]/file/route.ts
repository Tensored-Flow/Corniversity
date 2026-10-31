import { NextResponse } from "next/server";
import { getAsset } from "@corniversity/db/services/library";
import { blobs } from "@/lib/blobs";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Serves the owner's original file for the reading room's source view. Session required; the
 * asset must belong to the signed-in owner; the response is sandboxed and never cached so a
 * PDF cannot run script in the application's origin and nothing lingers in shared caches.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const asset = await getAsset(db(), authed.session.user.id, id);
  if (!asset?.storageKey) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const data = await blobs().get(asset.storageKey);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const safeName = asset.filename.replace(/[^A-Za-z0-9._-]/g, "_");
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": asset.mediaType,
      "content-length": String(data.byteLength),
      "content-disposition": `inline; filename="${safeName}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox; default-src 'none'",
    },
  });
}
