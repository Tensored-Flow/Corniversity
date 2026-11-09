import { getArtifactFile } from "@corniversity/db/services/research";
import { NextResponse } from "next/server";
import { blobs } from "@/lib/blobs";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Serves an artefact to its owner only, as a download, sandboxed and never cached. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const { id } = await context.params;
  const file = await getArtifactFile(db(), blobs(), authed.session.user.id, id);
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "content-type": file.contentType,
      "content-length": String(file.data.byteLength),
      "content-disposition": `attachment; filename="${file.filename}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox; default-src 'none'",
    },
  });
}
