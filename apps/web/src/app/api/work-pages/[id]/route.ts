import { PaperWorkError, workPageFile } from "@corniversity/db/services/paper-work";
import { NextResponse } from "next/server";
import { blobs } from "@/lib/blobs";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Serves one page of the learner's own paper work. Owner only; never cached; sandboxed. Images
 * are shown inline; a PDF is offered as a download and never rendered by the application.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const { id } = await params;
  try {
    const { page, bytes } = await workPageFile(db(), blobs(), authed.session.user.id, id);
    const pdf = page.mime === "application/pdf";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": page.mime,
        "content-length": String(bytes.byteLength),
        "content-disposition": `${pdf ? "attachment" : "inline"}; filename="page-${page.position}.${pdf ? "pdf" : page.mime === "image/png" ? "png" : "jpg"}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'",
      },
    });
  } catch (error) {
    if (error instanceof PaperWorkError) return NextResponse.json({ error: "not_found" }, { status: 404 });
    throw error;
  }
}
