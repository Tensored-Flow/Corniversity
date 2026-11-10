import { prepareWorkFile, WorkFileError } from "@corniversity/core/paper/files";
import { canConfirm, uncertainMarks } from "@corniversity/core/paper/transcription";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { BlobStore } from "../blob";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { QUEUES, TranscribePagesPayload } from "../jobs";
import { enqueue } from "../queue";
import { auditEvent, consentRecord, jobRecord, submissionVersion, transcriptionVersion, workPage } from "../schema/index";
import { getAttempt, LearningError, submitAttempt } from "./learning";
import { assistanceCounts } from "./study-session";

/**
 * Paper work: photographs or PDFs of handwritten work attached to an attempt, a transcription the
 * learner confirms, and submission of the confirmed transcription with its pages. The originals
 * are kept apart from any reading of them; a correction is a new transcription version; nothing
 * leaves the server except under the learner's explicit consent for those pages.
 */

export class PaperWorkError extends Error {
  constructor(
    readonly code: "not_found" | "invalid_file" | "not_confirmed" | "no_pages" | "closed" | "too_many" | "consent" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "PaperWorkError";
  }
}

export type WorkPageRow = typeof workPage.$inferSelect;
export type TranscriptionRow = typeof transcriptionVersion.$inferSelect;

export const MAX_PAGES_PER_ATTEMPT = 12;

async function ownedAttempt(db: DbOrTx, ownerId: string, attemptId: string) {
  const a = await getAttempt(db, ownerId, attemptId);
  if (!a) throw new PaperWorkError("not_found", "Attempt not found.");
  return a;
}

export async function listWorkPages(db: DbOrTx, ownerId: string, attemptId: string): Promise<WorkPageRow[]> {
  if (!isUuid(attemptId)) return [];
  return db
    .select()
    .from(workPage)
    .where(and(eq(workPage.ownerId, ownerId), eq(workPage.attemptId, attemptId), isNull(workPage.removedAt)))
    .orderBy(asc(workPage.position));
}

/** Validates the bytes (real signature, size, no active content), strips image metadata and stores the page privately. */
export async function addWorkPage(
  db: DbOrTx,
  blobs: BlobStore,
  input: { ownerId: string; attemptId: string; bytes: Uint8Array; filename?: string | null },
): Promise<WorkPageRow> {
  const a = await ownedAttempt(db, input.ownerId, input.attemptId);
  if (a.state === "accepted") throw new PaperWorkError("closed", "This attempt has been accepted; start a new attempt to add pages.");
  const current = await listWorkPages(db, input.ownerId, input.attemptId);
  if (current.length >= MAX_PAGES_PER_ATTEMPT)
    throw new PaperWorkError("too_many", `An attempt can carry at most ${MAX_PAGES_PER_ATTEMPT} pages.`);
  let prepared: ReturnType<typeof prepareWorkFile>;
  try {
    prepared = prepareWorkFile(input.bytes);
  } catch (error) {
    if (error instanceof WorkFileError) throw new PaperWorkError("invalid_file", error.message);
    throw error;
  }
  const stored = await blobs.put(Buffer.from(prepared.bytes));
  const [max] = await db
    .select({ position: sql<number>`coalesce(max(${workPage.position}), 0)` })
    .from(workPage)
    .where(eq(workPage.attemptId, input.attemptId));
  const [row] = await db
    .insert(workPage)
    .values({
      ownerId: input.ownerId,
      attemptId: input.attemptId,
      position: Number(max?.position ?? 0) + 1,
      blobKey: stored.key,
      mime: prepared.mime,
      byteSize: stored.sizeBytes,
      sha256: stored.sha256,
      width: prepared.width ?? null,
      height: prepared.height ?? null,
      originalFilename: input.filename ? input.filename.replace(/[^\w.\- ]/g, "_").slice(0, 120) : null,
      metadataStripped: prepared.stripped,
    })
    .returning();
  return row!;
}

async function ownedPage(db: DbOrTx, ownerId: string, pageId: string): Promise<WorkPageRow> {
  if (!isUuid(pageId)) throw new PaperWorkError("not_found", "Page not found.");
  const [page] = await db
    .select()
    .from(workPage)
    .where(and(eq(workPage.id, pageId), eq(workPage.ownerId, ownerId)))
    .limit(1);
  if (!page) throw new PaperWorkError("not_found", "Page not found.");
  return page;
}

export async function rotateWorkPage(db: DbOrTx, ownerId: string, pageId: string, quarterTurns: number): Promise<void> {
  const page = await ownedPage(db, ownerId, pageId);
  const rotation = (((page.rotation + quarterTurns * 90) % 360) + 360) % 360;
  await db.update(workPage).set({ rotation }).where(eq(workPage.id, page.id));
}

/** Moves a page one place earlier (-1) or later (+1) in the attempt. */
export async function moveWorkPage(db: DbOrTx, ownerId: string, pageId: string, direction: -1 | 1): Promise<void> {
  const page = await ownedPage(db, ownerId, pageId);
  const pages = await listWorkPages(db, ownerId, page.attemptId);
  const index = pages.findIndex((p) => p.id === page.id);
  const other = pages[index + direction];
  if (!other) return;
  await db.update(workPage).set({ position: other.position }).where(eq(workPage.id, page.id));
  await db.update(workPage).set({ position: page.position }).where(eq(workPage.id, other.id));
}

/**
 * Removes a page from the attempt. A page that belongs to a submitted version stays stored (the
 * submission keeps exactly what was sent) and is only hidden from the editor; otherwise its bytes
 * are deleted.
 */
export async function removeWorkPage(db: DbOrTx, blobs: BlobStore, ownerId: string, pageId: string): Promise<void> {
  const page = await ownedPage(db, ownerId, pageId);
  const [submitted] = await db
    .select({ id: submissionVersion.id })
    .from(submissionVersion)
    .where(and(eq(submissionVersion.attemptId, page.attemptId), sql`${submissionVersion.pageIds} @> ${JSON.stringify([page.id])}::jsonb`))
    .limit(1);
  if (submitted) {
    await db.update(workPage).set({ removedAt: new Date() }).where(eq(workPage.id, page.id));
    return;
  }
  await db.delete(workPage).where(eq(workPage.id, page.id));
  await blobs.delete(page.blobKey).catch(() => undefined);
}

/** The original bytes of a page, for the owner only. */
export async function workPageFile(db: DbOrTx, blobs: BlobStore, ownerId: string, pageId: string) {
  const page = await ownedPage(db, ownerId, pageId);
  const bytes = await blobs.get(page.blobKey);
  if (!bytes) throw new PaperWorkError("not_found", "The page's file is missing.");
  return { page, bytes };
}

export async function listTranscriptions(db: DbOrTx, ownerId: string, attemptId: string): Promise<TranscriptionRow[]> {
  await ownedAttempt(db, ownerId, attemptId);
  return db
    .select()
    .from(transcriptionVersion)
    .where(eq(transcriptionVersion.attemptId, attemptId))
    .orderBy(desc(transcriptionVersion.version));
}

/** Saves the transcription as a new version; earlier versions, and feedback on them, are kept. */
export async function saveTranscription(
  db: DbOrTx,
  input: { ownerId: string; attemptId: string; text: string; source?: "manual" | "model"; providerRunId?: string | null },
): Promise<TranscriptionRow> {
  await ownedAttempt(db, input.ownerId, input.attemptId);
  const text = input.text.replace(/\r\n/g, "\n").slice(0, 50_000);
  const [latest] = await db
    .select()
    .from(transcriptionVersion)
    .where(eq(transcriptionVersion.attemptId, input.attemptId))
    .orderBy(desc(transcriptionVersion.version))
    .limit(1);
  if (latest && latest.text === text && !latest.confirmedAt) return latest;
  const [row] = await db
    .insert(transcriptionVersion)
    .values({
      attemptId: input.attemptId,
      version: (latest?.version ?? 0) + 1,
      text,
      uncertain: uncertainMarks(text),
      source: input.source ?? "manual",
      providerRunId: input.providerRunId ?? null,
      basedOnVersion: latest && latest.source === "model" ? latest.version : (latest?.basedOnVersion ?? null),
    })
    .returning();
  return row!;
}

/** Confirms the latest transcription; refused while any uncertain symbol remains. */
export async function confirmTranscription(db: DbOrTx, ownerId: string, attemptId: string): Promise<TranscriptionRow> {
  const [latest] = await listTranscriptions(db, ownerId, attemptId);
  if (!latest) throw new PaperWorkError("not_confirmed", "Write the transcription first.");
  const decision = canConfirm(latest.text);
  if (!decision.ok) throw new PaperWorkError("not_confirmed", decision.reason);
  if (latest.confirmedAt) return latest;
  const [row] = await db
    .update(transcriptionVersion)
    .set({ confirmedAt: new Date() })
    .where(eq(transcriptionVersion.id, latest.id))
    .returning();
  return row!;
}

/**
 * Submits paper work: the latest transcription, which must be confirmed, with the pages it reads.
 * The submission keeps that transcription version and those pages, so a later correction is a
 * new version and the earlier feedback stays attached to what was actually read.
 */
export async function submitPaperAttempt(
  db: DbOrTx,
  input: {
    ownerId: string;
    attemptId: string;
    graderConfig: { provider: string; model: string; promptVersion: string; roleVersion: string };
  },
): Promise<{ submissionVersionId: string; assessmentRunId: string; version: number }> {
  const a = await ownedAttempt(db, input.ownerId, input.attemptId);
  const pages = await listWorkPages(db, input.ownerId, input.attemptId);
  if (pages.length === 0) throw new PaperWorkError("no_pages", "Attach at least one page before submitting paper work.");
  const [latest] = await listTranscriptions(db, input.ownerId, input.attemptId);
  if (!latest?.confirmedAt)
    throw new PaperWorkError("not_confirmed", "Confirm the transcription before submitting; the review reads it, not the photograph.");
  try {
    return await submitAttempt(db, {
      ownerId: input.ownerId,
      attemptId: a.id,
      contentMarkdown: latest.text,
      assistanceDisclosed: {
        hintsUsed: a.hintsUsed,
        peersConsulted: false,
        externalSources: [],
        help: await assistanceCounts(db, input.ownerId, a.id),
        note: `Paper work: ${pages.length} page${pages.length === 1 ? "" : "s"}, transcription v${latest.version} (${latest.source === "model" ? "model transcription corrected and confirmed by the learner" : "written by the learner"}).`,
      },
      graderConfig: input.graderConfig,
      paper: { transcriptionVersionId: latest.id, pageIds: pages.map((p) => p.id) },
    });
  } catch (error) {
    if (error instanceof LearningError) throw new PaperWorkError("closed", error.message);
    throw error;
  }
}

const CONSENT_KIND = (attemptId: string) => `work-pages-external-ai:${attemptId}`;

/**
 * Asks for a model transcription of the attempt's pages. Requires the learner's explicit consent
 * to send these pages to the provider, recorded with the page ids; the worker re-checks that the
 * consent stands and the pages are unchanged before anything is sent.
 */
export async function requestModelTranscription(
  db: DbOrTx,
  input: { ownerId: string; attemptId: string; consent: boolean; providerLabel: string },
): Promise<{ consentId: string }> {
  if (!input.consent) throw new PaperWorkError("consent", "Tick the box to agree to sending these page images for transcription.");
  const pages = await listWorkPages(db, input.ownerId, input.attemptId);
  const images = pages.filter((p) => p.mime !== "application/pdf");
  if (images.length === 0)
    throw new PaperWorkError(
      "no_pages",
      "Model transcription reads photographs; attach images of the pages, or transcribe a PDF yourself.",
    );
  const [consent] = await db
    .insert(consentRecord)
    .values({
      userId: input.ownerId,
      kind: CONSENT_KIND(input.attemptId),
      granted: true,
      basis: `Learner agreed on ${new Date().toISOString()} to send ${images.length} page image(s) (${images.map((p) => p.id).join(", ")}) to ${input.providerLabel} for transcription.`,
    })
    .returning({ id: consentRecord.id });
  const payload = TranscribePagesPayload.parse({
    idempotencyKey: `transcribe:${consent!.id}`,
    ownerId: input.ownerId,
    attemptId: input.attemptId,
    consentId: consent!.id,
    pageIds: images.map((p) => p.id),
  });
  await enqueue(db, { queue: QUEUES.transcribePages, kind: "transcribe-pages", payload });
  await db.insert(auditEvent).values({
    ownerId: input.ownerId,
    actor: "learner",
    action: "paper:request-transcription",
    entity: "attempt",
    entityId: input.attemptId,
    details: { consentId: consent!.id, pages: images.length },
  });
  return { consentId: consent!.id };
}

/** Withdraws consent for this attempt's pages; a queued transcription then sends nothing. */
export async function withdrawTranscriptionConsent(db: DbOrTx, ownerId: string, attemptId: string): Promise<void> {
  await db
    .update(consentRecord)
    .set({ revokedAt: new Date() })
    .where(and(eq(consentRecord.userId, ownerId), eq(consentRecord.kind, CONSENT_KIND(attemptId)), isNull(consentRecord.revokedAt)));
}

/** Whether a consent still allows sending exactly these pages, checked at execution time. */
export async function transcriptionConsentStands(
  db: DbOrTx,
  input: { ownerId: string; attemptId: string; consentId: string; pageIds: string[] },
): Promise<{ ok: true; pages: WorkPageRow[] } | { ok: false; reason: string }> {
  const [consent] = await db
    .select()
    .from(consentRecord)
    .where(and(eq(consentRecord.id, input.consentId), eq(consentRecord.userId, input.ownerId)))
    .limit(1);
  if (!consent || consent.kind !== CONSENT_KIND(input.attemptId) || !consent.granted)
    return { ok: false, reason: "No consent was recorded for these pages." };
  if (consent.revokedAt) return { ok: false, reason: "Consent to send these pages was withdrawn, so nothing was sent." };
  const pages = await listWorkPages(db, input.ownerId, input.attemptId);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const chosen = input.pageIds.map((id) => byId.get(id));
  if (chosen.some((p) => !p)) return { ok: false, reason: "The pages changed after consent was given; ask again for the current pages." };
  return { ok: true, pages: chosen as WorkPageRow[] };
}

/** The most recent model-transcription job for an attempt, for its status line. */
export async function latestTranscriptionJob(db: DbOrTx, ownerId: string, attemptId: string) {
  const [row] = await db
    .select({ status: jobRecord.status, error: jobRecord.error, createdAt: jobRecord.createdAt })
    .from(jobRecord)
    .where(
      and(eq(jobRecord.ownerId, ownerId), eq(jobRecord.kind, "transcribe-pages"), sql`${jobRecord.payload}->>'attemptId' = ${attemptId}`),
    )
    .orderBy(desc(jobRecord.createdAt))
    .limit(1);
  return row ?? null;
}
