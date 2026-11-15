"use server";
import { deleteAsset, LibraryError, type ProcessingAction, requestIngestion, setPermission } from "@corniversity/db/services/library";
import {
  addToCollection,
  CollectionError,
  collectionsForWork,
  createCollection,
  removeFromCollection,
} from "@corniversity/db/services/library-collections";
import {
  deleteWorkCompletely,
  editWorkFields,
  getWork,
  mergeWorks,
  openArxivVersion,
  requestPrivateCopy,
  ScholarlyError,
  saveWork,
  setWorkFlags,
  unsaveWork,
} from "@corniversity/db/services/scholarly-works";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { blobs } from "@/lib/blobs";
import { db } from "@/lib/db";
import { errorCode, placed } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import { editFormValues, workEditFromForm } from "./edit-form";

/**
 * The paper page's actions. Each takes the session's owner, validates ids, lets the service check
 * ownership, and returns to the paper page with a registered notice code (never a message) on a
 * refusal. A form returns to its own section (`#…`, named again as `at=`), where the page shows its
 * notice. Files arrive through /api/library/papers/[workId]/attach instead (no 1 MB action limit).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PERMISSION_ACTIONS: readonly ProcessingAction[] = [
  "local_read",
  "local_extract",
  "private_cloud_store",
  "external_ai",
  "external_embedding",
  "share",
];

const text = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();
const paper = (workId: string, query = "", hash = "") => `/library/papers/${workId}${query ? `?${query}` : ""}${hash}`;

/** A refusal's return address: the registered code goes into the query, and the #fragment of `back` names where it is shown. */
function errorTo(back: string, message: string): string {
  return placed(back, `error=${errorCode(message)}`);
}

/** The work id the form names (a UUID), or back to Find papers. */
async function owned(form: FormData): Promise<{ ownerId: string; workId: string }> {
  const session = await requireSession("/library/find");
  const workId = text(form, "workId");
  if (!UUID.test(workId)) redirect("/library/find");
  return { ownerId: session.user.id, workId };
}

/** Runs a service call; a refusal (its own message) returns to the paper page as a notice code. */
async function attempt<T>(back: string, work: () => Promise<T>): Promise<T> {
  let message: string | null = null;
  let value: T | undefined;
  try {
    value = await work();
  } catch (error) {
    if (error instanceof ScholarlyError || error instanceof LibraryError || error instanceof CollectionError) message = error.message;
    else throw error;
  }
  if (message !== null) redirect(errorTo(back, message));
  return value as T;
}

/**
 * The file forms name one of this paper's stored files: any other asset id (another paper's file,
 * a linked arXiv version, someone else's) is refused here, so the page never reports a change it
 * did not make to this paper.
 */
async function requirePaperFile(ownerId: string, workId: string, assetId: string, back: string): Promise<void> {
  const detail = UUID.test(assetId) ? await getWork(db(), ownerId, workId) : null;
  if (!detail?.documents.some((d) => d.asset.id === assetId && d.asset.status !== "linked_remote"))
    redirect(errorTo(back, "Asset not found."));
}

/** Back to the paper page with its confirmation; `hash` names the section the notice is shown in. */
function done(workId: string, saved: string, hash = ""): never {
  revalidatePath(paper(workId));
  revalidatePath("/library");
  redirect(placed(paper(workId, "", hash), `saved=${saved}`));
}

/** Favourite, read later and read: each a toggle with the value it sets. */
export async function setFlagAction(form: FormData): Promise<void> {
  const { ownerId, workId } = await owned(form);
  const flag = text(form, "flag");
  const value = text(form, "value") === "1";
  const flags =
    flag === "favourite" ? { favourite: value } : flag === "readLater" ? { readLater: value } : flag === "read" ? { read: value } : null;
  if (!flags) redirect(paper(workId));
  await attempt(paper(workId), () => setWorkFlags(db(), ownerId, workId, flags));
  done(workId, "flags");
}

/** *Remove from library* clears the saved mark; the paper, its files and notes stay. */
export async function unsaveAction(form: FormData): Promise<void> {
  const { ownerId, workId } = await owned(form);
  await attempt(paper(workId), () => unsaveWork(db(), ownerId, workId));
  done(workId, "removed");
}

export async function saveAgainAction(form: FormData): Promise<void> {
  const { ownerId, workId } = await owned(form);
  await attempt(paper(workId), () => saveWork(db(), ownerId, workId));
  done(workId, "saved");
}

/**
 * The owner's corrections. Only the fields changed in this form (against the values it showed,
 * which travel as `shown_*`) become owner edits, and the service refuses them if one of those
 * fields changed meanwhile, so an open form never blanks or reverts details that arrived since.
 * A form without the shown values (an older page) is compared with the stored values instead.
 */
export async function editFieldsAction(form: FormData): Promise<void> {
  const { ownerId, workId } = await owned(form);
  const back = paper(workId, "", "#edit");
  const submitted = editFormValues(form);
  if (form.has("shown_title")) {
    const { edit, expected } = workEditFromForm(submitted, editFormValues(form, "shown_"));
    await attempt(back, () => editWorkFields(db(), ownerId, workId, edit, expected));
    done(workId, "edited", "#edit");
  }
  const detail = await getWork(db(), ownerId, workId);
  if (!detail) redirect("/library/find");
  const { work } = detail;
  const stored = {
    title: work.title ?? "",
    authors: work.authors.map((a) => a.name).join("\n"),
    abstract: work.abstract ?? "",
    year: work.publicationYear === null ? "" : String(work.publicationYear),
    venue: work.venue ?? "",
    workType: work.workType ?? "",
  };
  const { edit } = workEditFromForm(submitted, stored);
  await attempt(back, () => editWorkFields(db(), ownerId, workId, edit));
  done(workId, "edited", "#edit");
}

/**
 * *Read* on an arXiv version: its Document (linked to arxiv.org, or the stored copy), then the
 * reader. A refusal returns to the form it came from (the Read block or the version's row).
 */
export async function readArxivAction(form: FormData): Promise<void> {
  const { ownerId, workId } = await owned(form);
  const version = Number(text(form, "version"));
  const back = paper(workId, "", text(form, "from") === "read" ? "#read" : "#versions");
  const asset = await attempt(back, () => openArxivVersion(db(), ownerId, workId, text(form, "arxivId"), version));
  redirect(`/library/read/${asset.id}`);
}

/** *Keep a private copy* of an openly licensed arXiv version: its Document, then the worker's job. */
export async function privateCopyAction(form: FormData): Promise<void> {
  const { ownerId, workId } = await owned(form);
  const back = paper(workId, "", "#versions");
  const version = Number(text(form, "version"));
  const asset = await attempt(back, () => openArxivVersion(db(), ownerId, workId, text(form, "arxivId"), version));
  const result = await attempt(back, () => requestPrivateCopy(db(), ownerId, asset.id));
  if (!result.queued) redirect(errorTo(back, result.reason ?? "Processing could not be started."));
  done(workId, "private-copy", "#versions");
}

/** One processing permission of one of the paper's stored files, with the owner's basis. */
export async function documentPermissionAction(form: FormData): Promise<void> {
  const { ownerId, workId } = await owned(form);
  const back = paper(workId, "", "#files");
  const assetId = text(form, "assetId");
  const action = text(form, "action") as ProcessingAction;
  const status = text(form, "status");
  const basis = text(form, "basis").slice(0, 300);
  if (!UUID.test(assetId) || !PERMISSION_ACTIONS.includes(action) || (status !== "allowed" && status !== "denied"))
    redirect(errorTo(back, "Unknown permission."));
  if (!basis)
    redirect(
      errorTo(
        back,
        "Say briefly on what basis you are deciding (for example the licence, or 'my own notes'). It is recorded with the decision.",
      ),
    );
  await requirePaperFile(ownerId, workId, assetId, back);
  await attempt(back, () => setPermission(db(), ownerId, assetId, action, status, basis, blobs()));
  done(workId, "permission", "#files");
}

/** Extraction and indexing of one of the paper's stored files (needs its extraction permission). */
export async function extractAction(form: FormData): Promise<void> {
  const { ownerId, workId } = await owned(form);
  const back = paper(workId, "", "#files");
  const assetId = text(form, "assetId");
  if (!UUID.test(assetId)) redirect(back);
  await requirePaperFile(ownerId, workId, assetId, back);
  const result = await attempt(back, () => requestIngestion(db(), ownerId, assetId));
  if (!result.queued) redirect(errorTo(back, result.reason ?? "Processing could not be started."));
  done(workId, "processing", "#files");
}

/** Removes one stored file of the paper (a stored arXiv version goes back to being read from arxiv.org). */
export async function removeCopyAction(form: FormData): Promise<void> {
  const { ownerId, workId } = await owned(form);
  const back = paper(workId, "", "#files");
  const assetId = text(form, "assetId");
  if (!UUID.test(assetId)) redirect(back);
  if (form.get("confirm") !== "1") redirect(errorTo(back, "Tick the box to remove this file."));
  await requirePaperFile(ownerId, workId, assetId, back);
  await attempt(back, () => deleteAsset(db(), blobs(), ownerId, assetId));
  done(workId, "copy-removed", "#files");
}

/** The owner merges another paper into this one (confirmed); the other becomes a pointer to this one. */
export async function mergeAction(form: FormData): Promise<void> {
  const { ownerId, workId } = await owned(form);
  const back = paper(workId, "", "#duplicates");
  const mergeId = text(form, "mergeId");
  if (!UUID.test(mergeId)) redirect(back);
  if (form.get("confirm") !== "1") redirect(errorTo(back, "Tick the box to merge these papers."));
  await attempt(back, () => mergeWorks(db(), ownerId, workId, mergeId));
  done(workId, "merged");
}

/**
 * *Delete this paper and its notes*, for exactly the id confirmed. A paper merged meanwhile is
 * refused and the page opens the paper it was merged into.
 */
export async function deleteWorkAction(form: FormData): Promise<void> {
  const { ownerId, workId } = await owned(form);
  const back = paper(workId, "delete=confirm", "#delete");
  if (form.get("confirm") !== "1") redirect(errorTo(back, "Tick the box to delete this paper and its notes."));
  let refusal: { message: string; workId?: string } | null = null;
  try {
    await deleteWorkCompletely(db(), blobs(), ownerId, workId);
  } catch (error) {
    if (!(error instanceof ScholarlyError)) throw error;
    refusal = { message: error.message, workId: error.details.workId };
  }
  if (refusal) redirect(errorTo(refusal.workId && UUID.test(refusal.workId) ? paper(refusal.workId) : back, refusal.message));
  revalidatePath("/library");
  redirect("/library/find?deleted=paper");
}

/** Adds the paper to one of the owner's shelves or trails, with an optional reason. */
export async function addToCollectionAction(form: FormData): Promise<void> {
  const { ownerId, workId } = await owned(form);
  const back = paper(workId, "", "#collections");
  const collectionId = text(form, "collectionId");
  if (!UUID.test(collectionId)) redirect(errorTo(back, "Shelf or trail not found."));
  await attempt(back, () => addToCollection(db(), ownerId, collectionId, workId, text(form, "reason").slice(0, 2000) || null));
  done(workId, "collection", "#collections");
}

/** A new shelf or trail with this paper as its first item. */
export async function createCollectionAction(form: FormData): Promise<void> {
  const { ownerId, workId } = await owned(form);
  const back = paper(workId, "", "#collections");
  const kind = text(form, "kind");
  if (kind !== "shelf" && kind !== "trail") redirect(errorTo(back, "Choose a shelf or a trail."));
  const collection = await attempt(back, () => createCollection(db(), ownerId, { kind, name: text(form, "name") }));
  await attempt(back, () => addToCollection(db(), ownerId, collection.id, workId, text(form, "reason").slice(0, 2000) || null));
  done(workId, "collection", "#collections");
}

/**
 * Takes the paper off a shelf or trail (the paper, its notes and files stay). When a note or a
 * step's reason is written there, the row asks first, as the shelf and trail pages do, because that
 * text goes with the paper's place: only a form carrying `confirm=1` removes it.
 */
export async function removeFromCollectionAction(form: FormData): Promise<void> {
  const { ownerId, workId } = await owned(form);
  const back = paper(workId, "", "#collections");
  const collectionId = text(form, "collectionId");
  if (!UUID.test(collectionId)) redirect(back);
  if (form.get("confirm") !== "1") {
    const memberships = await collectionsForWork(db(), ownerId, workId);
    if (memberships.some((m) => m.id === collectionId && m.reason))
      redirect(placed(paper(workId, "", `#collection-${collectionId}`), `remove=${collectionId}`));
  }
  const removed = await attempt(back, () => removeFromCollection(db(), ownerId, collectionId, workId));
  // The note (a trail step's reason) written there goes with the paper's place; the notice says so.
  done(workId, removed.reason ? "collection-removed-note" : "collection-removed", "#collections");
}
