import { MAX_WORK_PAGE_BYTES } from "@corniversity/core/paper/files";
import { getOrCreateAttempt, getSession } from "@corniversity/db/services/learning";
import { addWorkPage, PaperWorkError } from "@corniversity/db/services/paper-work";
import { NextResponse } from "next/server";
import { blobs } from "@/lib/blobs";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Upload of one paper page (a photograph, already re-encoded on the device, or a PDF) to the
 * learner's attempt on an exercise of their own session. The server checks the real signature,
 * strips any image metadata the device left, refuses PDFs with active content, and stores the
 * bytes privately; nothing is processed or sent anywhere.
 */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const ownerId = authed.session.user.id;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const sessionId = String(form?.get("sessionId") ?? "");
  const exerciseId = String(form?.get("exerciseId") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photograph or PDF of your work." }, { status: 400 });
  if (file.size > MAX_WORK_PAGE_BYTES) return NextResponse.json({ error: "That file is too large for one page." }, { status: 413 });
  const session = await getSession(db(), ownerId, sessionId);
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!/^[\w-]{1,120}$/.test(exerciseId)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const attempt = await getOrCreateAttempt(db(), { ownerId, exerciseId, sessionId: session.id });
    const page = await addWorkPage(db(), blobs(), {
      ownerId,
      attemptId: attempt.id,
      bytes: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
    });
    return NextResponse.json({ pageId: page.id, position: page.position, metadataStripped: page.metadataStripped });
  } catch (error) {
    if (error instanceof PaperWorkError) return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    throw error;
  }
}
