"use server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getEnv } from "@corniversity/db/env";
import type { CollectionKind } from "@corniversity/db/schema/scholarly";
import { cancelJob, retryJob } from "@corniversity/db/services/jobs-admin";
import {
  confirmMetadata,
  createAnnotation,
  createPairingCode,
  createResourceRequest,
  deleteAnnotation,
  deleteAsset,
  LibraryError,
  listResourceRequests,
  type ProcessingAction,
  renderRequestsMarkdown,
  requestIngestion,
  requestsToJson,
  revokePairing,
  saveReadingProgress,
  setPermission,
  setRequestStatus,
  suggestedRequests,
} from "@corniversity/db/services/library";
import {
  addToCollection,
  type CollectionEntry,
  CollectionError,
  createCollection,
  deleteCollection,
  describeCollection,
  getCollection,
  moveInCollection,
  removeFromCollection,
  renameCollection,
  setItemReason,
} from "@corniversity/db/services/library-collections";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { blobs } from "@/lib/blobs";
import { db } from "@/lib/db";
import { errorCode, errorHref, placed } from "@/lib/notices";
import { importOpenResource } from "@/lib/open-import";
import { requireSession } from "@/lib/session";

const PERMISSION_ACTIONS: readonly ProcessingAction[] = [
  "local_read",
  "local_extract",
  "private_cloud_store",
  "external_ai",
  "external_embedding",
  "share",
];
const UUID = /^[0-9a-f-]{36}$/;
const COURSE_ID = /^[A-Z]{3}-\d{3}$/;

const text = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();
const lines = (form: FormData, key: string): string[] =>
  text(form, key)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
function failTo(path: string, message: string): never {
  redirect(errorHref(path, errorCode(message)));
}
/** A library refusal (a paper's file through the old item forms, for instance) as its message; other errors are thrown. */
async function refusal(work: Promise<unknown>): Promise<string | null> {
  try {
    await work;
    return null;
  } catch (error) {
    if (error instanceof LibraryError) return error.message;
    throw error;
  }
}

export async function confirmMetadataAction(form: FormData): Promise<void> {
  const session = await requireSession("/library");
  const assetId = text(form, "assetId");
  if (!UUID.test(assetId)) redirect("/library");
  const item = `/library/items/${assetId}`;
  const title = text(form, "title");
  if (!title) failTo(item, "A title is required.");
  const authors = text(form, "authors")
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const edition = text(form, "edition") || undefined;
  const courseIds = form
    .getAll("courseIds")
    .map(String)
    .filter((id) => COURSE_ID.test(id));
  const refused = await refusal(confirmMetadata(db(), session.user.id, assetId, { title, authors, edition, courseIds }));
  if (refused) failTo(item, refused);
  revalidatePath(item);
  revalidatePath("/library");
  redirect(`${item}?saved=metadata`);
}

export async function setPermissionAction(form: FormData): Promise<void> {
  const session = await requireSession("/library");
  const assetId = text(form, "assetId");
  if (!UUID.test(assetId)) redirect("/library");
  const item = `/library/items/${assetId}`;
  const action = text(form, "action") as ProcessingAction;
  const status = text(form, "status");
  const basis = text(form, "basis").slice(0, 300);
  if (!PERMISSION_ACTIONS.includes(action) || (status !== "allowed" && status !== "denied")) failTo(item, "Unknown permission.");
  if (!basis)
    failTo(
      item,
      "Say briefly on what basis you are deciding (for example the licence, or 'my own notes'). It is recorded with the decision.",
    );
  const refused = await refusal(setPermission(db(), session.user.id, assetId, action, status, basis, blobs()));
  if (refused) failTo(item, refused);
  revalidatePath(item);
  revalidatePath("/library");
  redirect(`${item}?saved=permission`);
}

export async function requestIngestionAction(form: FormData): Promise<void> {
  const session = await requireSession("/library");
  const assetId = text(form, "assetId");
  if (!UUID.test(assetId)) redirect("/library");
  const item = `/library/items/${assetId}`;
  const result = await requestIngestion(db(), session.user.id, assetId).catch((error: unknown) => ({
    queued: false,
    reason: error instanceof LibraryError ? error.message : "The request failed.",
  }));
  if (!result.queued) failTo(item, result.reason ?? "Processing could not be started.");
  revalidatePath(item);
  revalidatePath("/library/jobs");
  redirect(`${item}?saved=processing`);
}

export async function deleteAssetAction(form: FormData): Promise<void> {
  const session = await requireSession("/library");
  const assetId = text(form, "assetId");
  if (!UUID.test(assetId)) redirect("/library");
  if (form.get("confirm") !== "1") failTo(`/library/items/${assetId}`, "Tick the confirmation box to delete this item.");
  const refused = await refusal(deleteAsset(db(), blobs(), session.user.id, assetId));
  if (refused) failTo(`/library/items/${assetId}`, refused);
  revalidatePath("/library");
  redirect("/library?deleted=1");
}

export async function createRequestAction(form: FormData): Promise<void> {
  const session = await requireSession("/library/requests");
  const title = text(form, "title");
  const why = text(form, "why");
  if (!title || !why) failTo("/library/requests", "A title and a reason are required.");
  const courseId = text(form, "courseId");
  const links = lines(form, "links")
    .map((l) => {
      const [label, url] = l.split("|").map((s) => s.trim());
      return label && url && /^https?:\/\//.test(url) ? { label, url } : null;
    })
    .filter((l): l is { label: string; url: string } => l !== null);
  await createResourceRequest(db(), session.user.id, {
    title,
    authors: text(form, "authors") || null,
    edition: text(form, "edition") || null,
    isbn: text(form, "isbn") || null,
    courseId: COURSE_ID.test(courseId) ? courseId : null,
    unitIds: lines(form, "unitIds"),
    why,
    essential: form.get("essential") === "1",
    chaptersNeeded: lines(form, "chaptersNeeded"),
    links,
    openAlternative: text(form, "openAlternative") || null,
    acceptedFormats: ["pdf"],
    destinationFolder: text(form, "destinationFolder") || "inbox",
    caveats: text(form, "caveats") || null,
    minPermission: PERMISSION_ACTIONS.includes(text(form, "minPermission") as ProcessingAction)
      ? text(form, "minPermission")
      : "local_read",
    status: "open",
  });
  revalidatePath("/library/requests");
  redirect("/library/requests?saved=1");
}

export async function addSuggestedRequestAction(form: FormData): Promise<void> {
  const session = await requireSession("/library/requests");
  const key = text(form, "key");
  const suggestion = (await suggestedRequests(db(), session.user.id)).find((s) => s.key === key);
  if (!suggestion) failTo("/library/requests", "That suggestion is no longer available.");
  await createResourceRequest(db(), session.user.id, {
    title: suggestion.title,
    authors: suggestion.authors || null,
    edition: suggestion.edition ?? null,
    isbn: suggestion.isbn ?? null,
    courseId: suggestion.courseId,
    unitIds: [],
    why: suggestion.why,
    essential: suggestion.essential,
    chaptersNeeded: suggestion.chaptersNeeded,
    links: suggestion.links,
    openAlternative: suggestion.openAlternative ?? null,
    acceptedFormats: suggestion.acceptedFormats,
    destinationFolder: suggestion.destinationFolder,
    caveats: suggestion.caveats,
    minPermission: suggestion.minPermission,
    status: "open",
  });
  revalidatePath("/library/requests");
  redirect("/library/requests?saved=1");
}

export async function setRequestStatusAction(form: FormData): Promise<void> {
  const session = await requireSession("/library/requests");
  const id = text(form, "id");
  const status = text(form, "status");
  if (!UUID.test(id) || !["open", "obtained", "declined"].includes(status)) redirect("/library/requests");
  await setRequestStatus(db(), session.user.id, id, status as "open" | "obtained" | "declined");
  revalidatePath("/library/requests");
}

/** Writes requests.md and requests.json into <data root>/requests (local mode: the data root is on this machine). */
export async function writeRequestsToDataFolderAction(): Promise<void> {
  const session = await requireSession("/library/requests");
  const env = getEnv();
  if (env.DEPLOYMENT_MODE !== "local")
    failTo("/library/requests", "In production the data root is the server's; use the download buttons instead.");
  const [requests, suggestions] = await Promise.all([
    listResourceRequests(db(), session.user.id),
    suggestedRequests(db(), session.user.id),
  ]);
  const dir = join(env.CORNIVERSITY_DATA_ROOT, "requests");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "requests.md"), renderRequestsMarkdown(requests, env.INSTITUTION_NAME, suggestions), "utf8");
  await writeFile(join(dir, "requests.json"), JSON.stringify(requestsToJson(requests, suggestions, env.INSTITUTION_NAME), null, 2), "utf8");
  redirect("/library/requests?written=1");
}

export type PairingCodeState = { code: string; expiresAt: string } | { error: string } | null;

export async function createPairingCodeAction(_previous: PairingCodeState, _form: FormData): Promise<PairingCodeState> {
  const session = await requireSession("/library/sync");
  const { code, expiresAt } = await createPairingCode(db(), session.user.id);
  revalidatePath("/library/sync");
  return { code, expiresAt: expiresAt.toISOString() };
}

export async function revokePairingAction(form: FormData): Promise<void> {
  const session = await requireSession("/library/sync");
  const id = text(form, "pairingId");
  if (!UUID.test(id)) redirect("/library/sync");
  await revokePairing(db(), session.user.id, id);
  revalidatePath("/library/sync");
  revalidatePath("/library");
}

export async function saveAnnotationAction(form: FormData): Promise<void> {
  const session = await requireSession("/library");
  const assetId = text(form, "assetId");
  if (!UUID.test(assetId)) redirect("/library");
  const physicalIndex = Number(text(form, "physicalIndex"));
  const note = text(form, "note").slice(0, 8000);
  const selectedText = text(form, "selectedText").slice(0, 2000) || undefined;
  // A note written in the reading room's Text view returns to the Text view.
  const view = text(form, "view") === "text" ? "&view=text" : "";
  const back = `/library/read/${assetId}?page=${Number.isFinite(physicalIndex) ? physicalIndex + 1 : 1}${view}`;
  if (!note) failTo(back, "Write a note before saving.");
  await createAnnotation(db(), session.user.id, {
    assetId,
    physicalIndex: Number.isFinite(physicalIndex) ? physicalIndex : 0,
    selectedText,
    noteMarkdown: note,
  });
  revalidatePath(`/library/read/${assetId}`);
  redirect(`${back}&saved=note`);
}

export async function deleteAnnotationAction(form: FormData): Promise<void> {
  const session = await requireSession("/library");
  const id = text(form, "id");
  const assetId = text(form, "assetId");
  if (UUID.test(id)) await deleteAnnotation(db(), session.user.id, id);
  if (UUID.test(assetId)) revalidatePath(`/library/read/${assetId}`);
}

export async function saveProgressAction(assetId: string, physicalIndex: number): Promise<void> {
  const session = await requireSession("/library");
  if (!UUID.test(assetId) || !Number.isInteger(physicalIndex) || physicalIndex < 0) return;
  await saveReadingProgress(db(), session.user.id, assetId, physicalIndex);
}

export async function cancelJobAction(form: FormData): Promise<void> {
  const session = await requireSession("/library/jobs");
  const id = text(form, "jobId");
  if (!UUID.test(id)) redirect("/library/jobs");
  const result = await cancelJob(db(), session.user.id, id);
  revalidatePath("/library/jobs");
  if (!result.ok) failTo("/library/jobs", result.reason ?? "The job could not be cancelled.");
}

export async function retryJobAction(form: FormData): Promise<void> {
  const session = await requireSession("/library/jobs");
  const id = text(form, "jobId");
  if (!UUID.test(id)) redirect("/library/jobs");
  const result = await retryJob(db(), session.user.id, id);
  revalidatePath("/library/jobs");
  if (!result.ok) failTo("/library/jobs", result.reason ?? "The job could not be retried.");
}

export async function importOpenFileAction(form: FormData): Promise<void> {
  const session = await requireSession("/library/sources");
  const sourceId = text(form, "sourceId");
  const url = text(form, "url");
  const result = await importOpenResource(session.user.id, sourceId, url);
  revalidatePath("/library/sources");
  revalidatePath("/library");
  if (!result.ok) failTo("/library/sources", result.reason);
  redirect(`/library/items/${result.assetId}?saved=${result.outcome === "duplicate" ? "duplicate" : "imported"}`);
}

// ---------------------------------------------------------------------------------------------
// Shelves and trails (contract §2, §3). Each action takes the session's owner, lets the service
// check that the collection and the paper are the owner's, and returns with a registered notice
// code on a refusal. Removing a paper or deleting a collection never deletes a paper.

const COLLECTION_PATH: Record<CollectionKind, string> = { shelf: "/library/shelves", trail: "/library/trails" };
/** Where a create form may return to on a refusal (the home page's form, or a list page's form). */
const CREATE_BACK: Record<string, string> = {
  home: "/library#new-collection",
  shelves: "/library/shelves#new",
  trails: "/library/trails#new",
};

/** A refusal of a collection form: back to `back` (which may carry a #fragment) with the registered code. */
function refuse(back: string, message: string): never {
  redirect(placed(back, `error=${errorCode(message)}`));
}

/** Runs a collection service call; its refusal returns to `back` as the registered notice code. */
async function collectionAttempt<T>(back: string, work: () => Promise<T>): Promise<T> {
  let message: string | null = null;
  let value: T | undefined;
  try {
    value = await work();
  } catch (error) {
    if (error instanceof CollectionError) message = error.message;
    else throw error;
  }
  if (message !== null) refuse(back, message);
  return value as T;
}

/** The owner's collection the form names, with its page; anything else returns to the shelves with a notice. */
async function ownedCollection(form: FormData): Promise<{
  ownerId: string;
  id: string;
  kind: CollectionKind;
  path: string;
  items: CollectionEntry[];
}> {
  const session = await requireSession("/library/shelves");
  const id = text(form, "collectionId");
  const detail = UUID.test(id) ? await getCollection(db(), session.user.id, id) : null;
  if (!detail) failTo("/library/shelves", "Shelf or trail not found.");
  const { kind } = detail.collection;
  return {
    ownerId: session.user.id,
    id: detail.collection.id,
    kind,
    path: `${COLLECTION_PATH[kind]}/${detail.collection.id}`,
    items: detail.items,
  };
}

/** Back to the collection page with `query`; a `hash` names the section the notice is shown in (`at`). */
function collectionDone(path: string, query: string, hash = ""): never {
  revalidatePath("/library");
  revalidatePath("/library/shelves");
  revalidatePath("/library/trails");
  revalidatePath(path);
  redirect(placed(`${path}${hash}`, query));
}

/**
 * A new shelf or trail (name and optional description); it opens on its own page. A refusal returns
 * to the form with the kind and the name the owner typed (`kind=`, `name=`), so the form shows them
 * again, without JavaScript too.
 */
export async function createCollectionAction(form: FormData): Promise<void> {
  const session = await requireSession("/library");
  const kind = text(form, "kind");
  const from = text(form, "from");
  const typed = new URLSearchParams({ kind: kind === "trail" ? "trail" : "shelf", name: text(form, "name").slice(0, 120) }).toString();
  const formBack = Object.hasOwn(CREATE_BACK, from) ? CREATE_BACK[from]! : CREATE_BACK.home!;
  const hash = formBack.indexOf("#");
  const back = `${formBack.slice(0, hash)}?${typed}${formBack.slice(hash)}`;
  if (kind !== "shelf" && kind !== "trail") refuse(back, "Choose a shelf or a trail.");
  const created = await collectionAttempt(back, () =>
    createCollection(db(), session.user.id, { kind, name: text(form, "name"), description: String(form.get("description") ?? "") }),
  );
  collectionDone(`${COLLECTION_PATH[kind]}/${created.id}`, "saved=created");
}

export async function renameCollectionAction(form: FormData): Promise<void> {
  const { ownerId, id, path } = await ownedCollection(form);
  await collectionAttempt(`${path}#details`, () => renameCollection(db(), ownerId, id, text(form, "name")));
  collectionDone(path, "saved=renamed", "#details");
}

/** The description: owner Markdown with LaTeX (rendered through the sanitiser); empty clears it. */
export async function describeCollectionAction(form: FormData): Promise<void> {
  const { ownerId, id, path } = await ownedCollection(form);
  await collectionAttempt(`${path}#details`, () => describeCollection(db(), ownerId, id, String(form.get("description") ?? "")));
  collectionDone(path, "saved=described", "#details");
}

/** Deletes the shelf or trail after its confirmation box; its papers, their notes and files stay. */
export async function deleteCollectionAction(form: FormData): Promise<void> {
  const { ownerId, id, kind, path } = await ownedCollection(form);
  if (form.get("confirm") !== "1")
    refuse(`${path}#delete`, kind === "trail" ? "Tick the box to delete this trail." : "Tick the box to delete this shelf.");
  await collectionAttempt(`${path}#delete`, () => deleteCollection(db(), ownerId, id));
  collectionDone(COLLECTION_PATH[kind], "deleted=1");
}

/** Adds one of the owner's papers at the end (a trail's next step), with an optional reason. */
export async function addCollectionItemAction(form: FormData): Promise<void> {
  const { ownerId, id, path } = await ownedCollection(form);
  const words = text(form, "add").slice(0, 300);
  const keep = words ? `&add=${encodeURIComponent(words)}` : "";
  const result = await collectionAttempt(`${path}${words ? `?add=${encodeURIComponent(words)}` : ""}#add`, () =>
    addToCollection(db(), ownerId, id, text(form, "workId"), text(form, "reason").slice(0, 2000) || null),
  );
  collectionDone(path, `saved=${result.added ? "added" : "already"}${keep}`, "#add");
}

/**
 * Takes a paper off the shelf or trail; the paper, its notes and files stay in the library. A paper
 * with a note (a trail step's reason) written here asks first, on its own row, because that text is
 * deleted with it: only a form carrying `confirm=1` removes it.
 */
export async function removeCollectionItemAction(form: FormData): Promise<void> {
  const { ownerId, id, path, items } = await ownedCollection(form);
  const workId = text(form, "workId");
  if (UUID.test(workId) && items.some((i) => i.work.id === workId && i.item.reason) && form.get("confirm") !== "1")
    redirect(placed(`${path}#item-${workId}`, `remove=${workId}`));
  const removed = await collectionAttempt(`${path}#papers`, () => removeFromCollection(db(), ownerId, id, workId));
  collectionDone(path, removed.reason ? "saved=removed-note" : "saved=removed", "#papers");
}

export async function moveCollectionItemAction(form: FormData): Promise<void> {
  const { ownerId, id, path } = await ownedCollection(form);
  const workId = text(form, "workId");
  const direction = text(form, "direction");
  if (direction !== "up" && direction !== "down") refuse(`${path}#papers`, "Move a paper up or down.");
  await collectionAttempt(`${path}#papers`, () => moveInCollection(db(), ownerId, id, workId, direction));
  collectionDone(path, "saved=moved", UUID.test(workId) ? `#item-${workId}` : "#papers");
}

/** A trail step's reason or a shelf paper's note (Markdown with LaTeX); empty clears it. */
export async function setCollectionItemReasonAction(form: FormData): Promise<void> {
  const { ownerId, id, path } = await ownedCollection(form);
  const workId = text(form, "workId");
  await collectionAttempt(`${path}#papers`, () => setItemReason(db(), ownerId, id, workId, String(form.get("reason") ?? "")));
  collectionDone(path, "saved=reason", UUID.test(workId) ? `#item-${workId}` : "#papers");
}
