import { getEnv } from "@corniversity/db/env";
import { isUuid } from "@corniversity/db/ids";
import { LibraryError } from "@corniversity/db/services/library";
import { attachUploadToWork, ScholarlyError } from "@corniversity/db/services/scholarly-works";
import { blobs } from "@/lib/blobs";
import { db } from "@/lib/db";
import { errorCode, errorHref } from "@/lib/notices";
import { formSession, fromThisSite, refusedCrossSite, seeOther, uploadedFile } from "../../_form";

export const dynamic = "force-dynamic";

/**
 * *Attach your copy* on a paper page (a plain multipart form): the owner's PDF becomes the paper's
 * file through `attachUploadToWork` (a linked arXiv version is promoted in place; bytes already in
 * the library are adopted, reused or refused by the contract's rules). Refusals return to the paper
 * page with their registered notice, and, for a file that belongs to another paper, a link to it.
 */
export async function POST(request: Request, context: { params: Promise<{ workId: string }> }): Promise<Response> {
  const { workId } = await context.params;
  if (!isUuid(workId)) return seeOther("/library/find");
  const back = `/library/papers/${workId}`;
  if (!fromThisSite(request)) return refusedCrossSite();
  const session = await formSession(request);
  if (!session) return seeOther(`/sign-in?next=${encodeURIComponent(back)}`);
  const env = getEnv();
  const maxBytes = env.MAX_UPLOAD_MB * 1_048_576;
  const fail = (message: string, other?: string) =>
    seeOther(errorHref(other && isUuid(other) ? `${back}?other=${other}` : back, errorCode(message), "#files"));
  const form = await request.formData().catch(() => null);
  const file = uploadedFile(form);
  if (!file) return fail("Choose a PDF file to attach.");
  if (file.size > maxBytes) return fail("The file is larger than this server's upload limit.");
  const versionId = String(form?.get("versionId") ?? "").trim();
  try {
    const result = await attachUploadToWork(db(), blobs(), {
      ownerId: session.user.id,
      workId,
      ...(versionId ? { versionId } : {}),
      filename: file.name,
      mediaType: file.type || "application/octet-stream",
      data: Buffer.from(await file.arrayBuffer()),
      maxBytes,
    });
    return seeOther(`${back}?saved=attached-${result.outcome}#files`);
  } catch (error) {
    if (error instanceof ScholarlyError && error.code === "not_found" && error.message === "Paper not found.")
      return seeOther(errorHref("/library/find", errorCode(error.message)));
    if (error instanceof ScholarlyError) return fail(error.message, error.details.workId);
    if (error instanceof LibraryError) return fail(error.message);
    throw error;
  }
}
