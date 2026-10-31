"use server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getEnv } from "@corniversity/db/env";
import { cancelJob, retryJob } from "@corniversity/db/services/jobs-admin";
import {
  LibraryError,
  type ProcessingAction,
  confirmMetadata,
  createAnnotation,
  createPairingCode,
  createResourceRequest,
  deleteAnnotation,
  deleteAsset,
  listResourceRequests,
  renderRequestsMarkdown,
  requestIngestion,
  requestsToJson,
  revokePairing,
  saveReadingProgress,
  setPermission,
  setRequestStatus,
  suggestedRequests,
} from "@corniversity/db/services/library";
import { blobs } from "@/lib/blobs";
import { db } from "@/lib/db";
import { importOpenResource } from "@/lib/open-import";
import { requireSession } from "@/lib/session";

const PERMISSION_ACTIONS: readonly ProcessingAction[] = ["local_read", "local_extract", "private_cloud_store", "external_ai", "external_embedding", "share"];
const UUID = /^[0-9a-f-]{36}$/;
const COURSE_ID = /^[A-Z]{3}-\d{3}$/;

const text = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();
const lines = (form: FormData, key: string): string[] => text(form, key).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
function failTo(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function confirmMetadataAction(form: FormData): Promise<void> {
  const session = await requireSession("/library");
  const assetId = text(form, "assetId");
  if (!UUID.test(assetId)) redirect("/library");
  const item = `/library/items/${assetId}`;
  const title = text(form, "title");
  if (!title) failTo(item, "A title is required.");
  const authors = text(form, "authors").split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  const edition = text(form, "edition") || undefined;
  const courseIds = form.getAll("courseIds").map(String).filter((id) => COURSE_ID.test(id));
  await confirmMetadata(db(), session.user.id, assetId, { title, authors, edition, courseIds });
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
  if (!basis) failTo(item, "Say briefly on what basis you are deciding (for example the licence, or 'my own notes'). It is recorded with the decision.");
  await setPermission(db(), session.user.id, assetId, action, status, basis);
  revalidatePath(item);
  revalidatePath("/library");
  redirect(`${item}?saved=permission`);
}

export async function requestIngestionAction(form: FormData): Promise<void> {
  const session = await requireSession("/library");
  const assetId = text(form, "assetId");
  if (!UUID.test(assetId)) redirect("/library");
  const item = `/library/items/${assetId}`;
  const result = await requestIngestion(db(), session.user.id, assetId).catch((error: unknown) => ({ queued: false, reason: error instanceof LibraryError ? error.message : "The request failed." }));
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
  await deleteAsset(db(), blobs(), session.user.id, assetId);
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
    minPermission: PERMISSION_ACTIONS.includes(text(form, "minPermission") as ProcessingAction) ? text(form, "minPermission") : "local_read",
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
  if (env.DEPLOYMENT_MODE !== "local") failTo("/library/requests", "In production the data root is the server's; use the download buttons instead.");
  const [requests, suggestions] = await Promise.all([listResourceRequests(db(), session.user.id), suggestedRequests(db(), session.user.id)]);
  const dir = join(env.CORNIVERSITY_DATA_ROOT, "requests");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "requests.md"), renderRequestsMarkdown(requests, env.INSTITUTION_NAME, suggestions), "utf8");
  await writeFile(join(dir, "requests.json"), JSON.stringify(requestsToJson(requests, suggestions, env.INSTITUTION_NAME), null, 2), "utf8");
  redirect(`/library/requests?written=${encodeURIComponent(dir)}`);
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
  const back = `/library/read/${assetId}?page=${Number.isFinite(physicalIndex) ? physicalIndex + 1 : 1}`;
  if (!note) failTo(back, "Write a note before saving.");
  await createAnnotation(db(), session.user.id, { assetId, physicalIndex: Number.isFinite(physicalIndex) ? physicalIndex : 0, selectedText, noteMarkdown: note });
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
