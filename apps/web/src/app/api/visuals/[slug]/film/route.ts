import { VisualError, visualFilm } from "@corniversity/db/services/visuals";
import { NextResponse } from "next/server";
import { blobs } from "@/lib/blobs";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Serves a visual's film to a signed-in learner for whom the visual is open, with byte ranges so
 * the player can seek. Never cached publicly; a closed or stale film is simply not found.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const { slug } = await params;
  try {
    const { bytes } = await visualFilm(db(), blobs(), authed.session.user.id, slug);
    const headers: Record<string, string> = {
      "content-type": "video/webm",
      "accept-ranges": "bytes",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    };
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
    if (range && (range[1] || range[2])) {
      const size = bytes.byteLength;
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
      }
      return new Response(new Uint8Array(bytes.subarray(start, end + 1)), {
        status: 206,
        headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
      });
    }
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "content-length": String(bytes.byteLength) } });
  } catch (error) {
    if (error instanceof VisualError) return NextResponse.json({ error: "not_found" }, { status: 404 });
    throw error;
  }
}
