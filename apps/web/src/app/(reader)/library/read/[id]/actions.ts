"use server";
import { LibraryError, markDocumentOpened } from "@corniversity/db/services/library";
import { readerDocument } from "@corniversity/db/services/reader";
import { acceptNewFile, openArxivVersion, recordObservedHash, ScholarlyError } from "@corniversity/db/services/scholarly-works";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ERROR_NOTICES, errorCode, errorHref } from "@/lib/notices";
import { requireSession } from "@/lib/session";

/**
 * The reading room's server actions. Each requires the session, validates its input before any
 * query and acts only on the owner's own Document; a service refusal comes back as the registered
 * sentence, never the service's or a provider's own text.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

export type ActionRefusal = { error: string };

function refusal(error: unknown): ActionRefusal {
  if (!(error instanceof LibraryError) && !(error instanceof ScholarlyError)) throw error;
  return { error: ERROR_NOTICES[errorCode(error.message)] };
}

/** The reader opened this Document (for *Continue reading*); the position is not touched. */
export async function markOpenedAction(assetId: string): Promise<void> {
  const session = await requireSession("/library");
  if (typeof assetId !== "string" || !UUID.test(assetId)) return;
  await markDocumentOpened(db(), session.user.id, assetId).catch((error: unknown) => {
    if (!(error instanceof LibraryError)) throw error;
  });
}

/**
 * Reports the SHA-256 of the bytes the owner's browser received from arxiv.org for a linked
 * Document: the first hash is kept; a different one is a change the owner has not accepted yet.
 */
export async function reportObservedHashAction(
  assetId: string,
  observed: { sha256: string; pageCount: number },
): Promise<{ status: "first" | "same" | "changed" } | ActionRefusal> {
  const session = await requireSession("/library");
  if (typeof assetId !== "string" || !UUID.test(assetId) || typeof observed?.sha256 !== "string" || !SHA256.test(observed.sha256))
    return { error: ERROR_NOTICES["observed-hash-invalid"] };
  try {
    const result = await recordObservedHash(db(), session.user.id, assetId, {
      sha256: observed.sha256,
      pageCount: Number.isInteger(observed.pageCount) ? observed.pageCount : undefined,
    });
    return { status: result.status };
  } catch (error) {
    return refusal(error);
  }
}

/**
 * "Keep my notes on the new file": accepted by the service only when the page count and the page
 * views of every annotated page are unchanged; the notes then take the Document's key. Otherwise
 * the service marks them for repair, and the drift check's findings (core `checkDrift` sentences
 * about page counts and sizes) say why.
 */
export async function keepNotesOnNewFileAction(
  assetId: string,
  file: { observedSha256: string; pageCount: number; pageViews: [number, number][] },
): Promise<{ accepted: boolean; problems: string[] } | ActionRefusal> {
  const session = await requireSession("/library");
  if (typeof assetId !== "string" || !UUID.test(assetId)) return { error: ERROR_NOTICES["asset-not-found"] };
  try {
    const result = await acceptNewFile(db(), session.user.id, assetId, file);
    return { accepted: result.accepted, problems: result.accepted ? [] : result.problems };
  } catch (error) {
    return refusal(error);
  }
}

/**
 * Opens another arXiv version of the paper this Document belongs to (the reader's "newer version"
 * link). The paper and the arXiv id come from the owner's own Document, never from the form; only the
 * version number is read from it.
 */
export async function openArxivVersionAction(form: FormData): Promise<void> {
  const session = await requireSession("/library");
  const assetId = String(form.get("assetId") ?? "");
  if (!UUID.test(assetId)) redirect("/library");
  const version = Number(form.get("version"));
  const back = `/library/read/${assetId}`;
  const doc = await readerDocument(db(), session.user.id, assetId);
  if (!doc) redirect("/library");
  if (!doc.work || !doc.arxiv || !Number.isInteger(version) || version < 1) redirect(errorHref(back, "identifier-not-valid"));
  let target: string;
  try {
    const opened = await openArxivVersion(db(), session.user.id, doc.work.id, doc.arxiv.id, version);
    target = `/library/read/${opened.id}`;
  } catch (error) {
    if (!(error instanceof LibraryError) && !(error instanceof ScholarlyError)) throw error;
    redirect(errorHref(back, errorCode(error.message)));
  }
  redirect(target);
}
