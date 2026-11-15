import { getEnv } from "@corniversity/db/env";
import { isUuid } from "@corniversity/db/ids";
import { LibraryError } from "@corniversity/db/services/library";
import { createWorkFromUpload, ScholarlyError } from "@corniversity/db/services/scholarly-works";
import { blobs } from "@/lib/blobs";
import { db } from "@/lib/db";
import { errorCode, errorHref } from "@/lib/notices";
import { formSession, fromThisSite, refusedCrossSite, seeOther, uploadedFile } from "../_form";

export const dynamic = "force-dynamic";

/**
 * *Add a paper without an identifier* (a plain multipart form from /library/papers/new): the PDF
 * becomes a new, unidentified paper with "Your copy" as its file (`createWorkFromUpload`), titled
 * only if the owner gave a title. A file already attached to another paper is refused with a link.
 */
export async function POST(request: Request): Promise<Response> {
  const back = "/library/papers/new";
  if (!fromThisSite(request)) return refusedCrossSite();
  const session = await formSession(request);
  if (!session) return seeOther(`/sign-in?next=${encodeURIComponent(back)}`);
  const env = getEnv();
  const maxBytes = env.MAX_UPLOAD_MB * 1_048_576;
  const fail = (message: string, other?: string) =>
    seeOther(errorHref(other && isUuid(other) ? `${back}?other=${other}` : back, errorCode(message)));
  const form = await request.formData().catch(() => null);
  const file = uploadedFile(form);
  if (!file) return fail("Choose a PDF file to attach.");
  if (file.size > maxBytes) return fail("The file is larger than this server's upload limit.");
  const title = String(form?.get("title") ?? "")
    .trim()
    .slice(0, 500);
  try {
    const result = await createWorkFromUpload(db(), blobs(), {
      ownerId: session.user.id,
      filename: file.name,
      mediaType: file.type || "application/octet-stream",
      data: Buffer.from(await file.arrayBuffer()),
      maxBytes,
      ...(title ? { title } : {}),
    });
    return seeOther(`/library/papers/${result.workId}?saved=added`);
  } catch (error) {
    if (error instanceof ScholarlyError) return fail(error.message, error.details.workId);
    if (error instanceof LibraryError) return fail(error.message);
    throw error;
  }
}
