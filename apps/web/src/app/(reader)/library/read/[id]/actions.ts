"use server";
import { CompanionError, recordCompanionPermission } from "@corniversity/db/services/companion";
import { LibraryError, markDocumentOpened } from "@corniversity/db/services/library";
import { readerDocument } from "@corniversity/db/services/reader";
import { acceptNewFile, openArxivVersion, recordObservedHash, ScholarlyError } from "@corniversity/db/services/scholarly-works";
import { redirect } from "next/navigation";
import type { CompanionAnswerView, PermissionFormState } from "@/components/reader/ask";
import { db } from "@/lib/db";
import { ERROR_NOTICES, errorCode } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import { companionAnswerView } from "./companion-data";

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
  // Any client can call an action with any arguments: the shape is checked here, the page geometry by the service.
  if (typeof file !== "object" || file === null || typeof file.observedSha256 !== "string" || !SHA256.test(file.observedSha256))
    return { error: ERROR_NOTICES["observed-hash-invalid"] };
  try {
    const result = await acceptNewFile(db(), session.user.id, assetId, {
      observedSha256: file.observedSha256,
      pageCount: file.pageCount,
      pageViews: file.pageViews,
    });
    return { accepted: result.accepted, problems: result.accepted ? [] : result.problems };
  } catch (error) {
    return refusal(error);
  }
}

/**
 * Opens another arXiv version of the paper this Document belongs to (the reader's "newer version"
 * link). The paper and the arXiv id come from the owner's own Document, never from the form; only the
 * version number is read from it. A refusal is returned to the form, which shows it in place, so the
 * reader (and the PDF it fetched) is not loaded again.
 */
export async function openArxivVersionAction(_state: ActionRefusal | null, form: FormData): Promise<ActionRefusal | null> {
  const session = await requireSession("/library");
  const assetId = String(form.get("assetId") ?? "");
  if (!UUID.test(assetId)) redirect("/library");
  const version = Number(form.get("version"));
  const doc = await readerDocument(db(), session.user.id, assetId);
  if (!doc) redirect("/library");
  if (!doc.work || !doc.arxiv || !Number.isInteger(version) || version < 1) return { error: ERROR_NOTICES["identifier-not-valid"] };
  let target: string;
  try {
    const opened = await openArxivVersion(db(), session.user.id, doc.work.id, doc.arxiv.id, version);
    target = `/library/read/${opened.id}`;
  } catch (error) {
    return refusal(error);
  }
  redirect(target);
}

/**
 * The owner's external-AI decision for this Document, from the Ask panel's form: the basis they
 * write and the licence they were shown are recorded with it (services/companion.ts). Allow and Deny
 * are the form's two submit buttons; nothing is granted any other way. The reader is not re-rendered:
 * the panel shows the returned state.
 */
export async function companionPermissionAction(state: PermissionFormState, form: FormData): Promise<PermissionFormState> {
  const session = await requireSession("/library");
  const assetId = String(form.get("assetId") ?? "");
  const status = String(form.get("status") ?? "");
  if (!UUID.test(assetId) || (status !== "allowed" && status !== "denied"))
    return { ...state, error: ERROR_NOTICES["unknown-permission"], saved: false };
  try {
    const recorded = await recordCompanionPermission(db(), session.user.id, assetId, status, String(form.get("basis") ?? ""));
    return { status: recorded.status, basis: recorded.basis, error: null, saved: true };
  } catch (error) {
    if (!(error instanceof CompanionError) && !(error instanceof LibraryError)) throw error;
    return { ...state, error: ERROR_NOTICES[errorCode(error.message)], saved: false };
  }
}

/** The last request and answer stored for this Document (after a streamed answer ends), rendered by the server. */
export async function companionAnswerAction(assetId: string): Promise<CompanionAnswerView | null> {
  const session = await requireSession("/library");
  if (typeof assetId !== "string" || !UUID.test(assetId)) return null;
  return companionAnswerView(db(), session.user.id, assetId);
}
