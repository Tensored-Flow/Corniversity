import { getEnv } from "@corniversity/db/env";
import { LibraryError, receiveUpload, setCandidateMetadata } from "@corniversity/db/services/library";
import { NextResponse } from "next/server";
import { getDocumentProxy, getMeta } from "unpdf";
import { blobs } from "@/lib/blobs";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Web upload: the file goes straight into quarantine after signature and size validation.
 * Candidate metadata is read from a PDF's information dictionary so the confirmation form is
 * pre-filled; nothing is processed until the owner confirms it and grants extraction.
 */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const env = getEnv();
  const maxBytes = env.MAX_UPLOAD_MB * 1_048_576;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  if (file.size > maxBytes)
    return NextResponse.json({ error: `The file is larger than the ${env.MAX_UPLOAD_MB} MB limit.` }, { status: 413 });
  const data = Buffer.from(await file.arrayBuffer());
  try {
    const result = await receiveUpload(db(), blobs(), {
      ownerId: authed.session.user.id,
      filename: file.name,
      mediaType: file.type || "application/octet-stream",
      data,
      origin: "web_upload",
      maxBytes,
    });
    if (result.outcome === "stored" && result.asset.mediaType === "application/pdf") {
      try {
        const pdf = await getDocumentProxy(new Uint8Array(data));
        const meta = await getMeta(pdf).catch(() => ({ info: {} as Record<string, unknown> }));
        const info = (meta.info ?? {}) as Record<string, unknown>;
        const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : undefined);
        await setCandidateMetadata(
          db(),
          authed.session.user.id,
          result.asset.id,
          { title: str(info.Title), author: str(info.Author), producer: str(info.Producer), pageCount: pdf.numPages },
          pdf.numPages,
        );
      } catch {
        // Unreadable metadata is not an error at this stage; ingestion will report a corrupt file properly.
      }
    }
    return NextResponse.json({ assetId: result.asset.id, outcome: result.outcome });
  } catch (error) {
    if (error instanceof LibraryError) return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    throw error;
  }
}
