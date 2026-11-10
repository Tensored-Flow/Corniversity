import { createHash, randomBytes, randomInt } from "node:crypto";
import type { Locator } from "@corniversity/core";
import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, like, sql } from "drizzle-orm";
import type { BlobStore } from "../blob";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { IngestAssetPayload, QUEUES } from "../jobs";
import { enqueue } from "../queue";
import {
  annotation,
  auditEvent,
  course,
  courseVersion,
  devicePairing,
  extractedPage,
  locator,
  pairingCode,
  passage,
  processingPermission,
  programme,
  programmeParticipation,
  readingProgress,
  resourceAsset,
  resourceRequest,
  source,
  sourceVersion,
} from "../schema/index";
import { jobRecord } from "../schema/operations";

export type AssetRow = typeof resourceAsset.$inferSelect;
export type PermissionRow = typeof processingPermission.$inferSelect;
export type RequestRow = typeof resourceRequest.$inferSelect;
export type PairingRow = typeof devicePairing.$inferSelect;

export const MAX_PDF_PAGES = 2000;
const ACCEPTED_MEDIA = new Set(["application/pdf", "text/plain", "text/markdown"]);

export class LibraryError extends Error {
  constructor(
    readonly code:
      | "too_large"
      | "unsupported_type"
      | "not_pdf"
      | "duplicate"
      | "not_found"
      | "permission_denied"
      | "invalid_state"
      | "bad_code"
      | "revoked",
    message: string,
  ) {
    super(message);
    this.name = "LibraryError";
  }
}

export function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Validation at the quarantine boundary: size, declared type, and the file's real signature. */
export function validateUpload(data: Buffer, mediaType: string, filename: string, maxBytes: number): { mediaType: string } {
  if (data.byteLength > maxBytes)
    throw new LibraryError(
      "too_large",
      `The file is ${(data.byteLength / 1_048_576).toFixed(1)} MB; the limit is ${(maxBytes / 1_048_576).toFixed(0)} MB.`,
    );
  if (data.byteLength === 0) throw new LibraryError("unsupported_type", "The file is empty.");
  const lower = filename.toLowerCase();
  let type = mediaType.split(";")[0]?.trim() ?? "";
  if (lower.endsWith(".pdf") || type === "application/pdf") {
    if (data.subarray(0, 5).toString("latin1") !== "%PDF-")
      throw new LibraryError("not_pdf", "The file does not start with a PDF signature; it was not stored.");
    type = "application/pdf";
  } else if (lower.endsWith(".md") || type === "text/markdown") {
    type = "text/markdown";
  } else if (lower.endsWith(".txt") || type === "text/plain") {
    type = "text/plain";
  } else {
    throw new LibraryError(
      "unsupported_type",
      "Only PDF, Markdown and plain-text files are accepted as library assets. Scripts, notebooks and executables are refused.",
    );
  }
  if (!ACCEPTED_MEDIA.has(type)) throw new LibraryError("unsupported_type", `Unsupported type ${type}.`);
  if (/[\\/]|\.\./.test(filename) || filename.length > 200) throw new LibraryError("unsupported_type", "The filename is not acceptable.");
  return { mediaType: type };
}

/**
 * Registers a file the companion has seen on the desktop. Only bibliographic metadata arrives;
 * the bytes stay on the device until the owner grants private cloud storage.
 */
export async function registerLocalAsset(
  db: DbOrTx,
  input: {
    ownerId: string;
    devicePairingId: string;
    filename: string;
    mediaType: string;
    sizeBytes: number;
    sha256: string;
    candidateMetadata: AssetRow["candidateMetadata"];
    localPathHint: string;
  },
): Promise<{ asset: AssetRow; outcome: "registered" | "duplicate" | "known" }> {
  const [existing] = await db
    .select()
    .from(resourceAsset)
    .where(and(eq(resourceAsset.ownerId, input.ownerId), eq(resourceAsset.sha256, input.sha256)))
    .limit(1);
  if (existing) {
    if (existing.filename !== input.filename || existing.localPathHint !== input.localPathHint) {
      const [updated] = await db
        .update(resourceAsset)
        .set({ localPathHint: input.localPathHint, devicePairingId: input.devicePairingId })
        .where(eq(resourceAsset.id, existing.id))
        .returning();
      return { asset: updated!, outcome: "duplicate" };
    }
    return { asset: existing, outcome: "known" };
  }
  const [asset] = await db
    .insert(resourceAsset)
    .values({
      ownerId: input.ownerId,
      filename: input.filename,
      mediaType: input.mediaType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256,
      status: "registered_local",
      origin: "companion",
      candidateMetadata: input.candidateMetadata,
      localOnly: true,
      devicePairingId: input.devicePairingId,
      localPathHint: input.localPathHint,
    })
    .returning();
  await db.insert(auditEvent).values({
    ownerId: input.ownerId,
    actor: `companion:${input.devicePairingId}`,
    action: "asset:register",
    entity: "resource_asset",
    entityId: asset!.id,
    details: { filename: input.filename, sizeBytes: input.sizeBytes },
  });
  return { asset: asset!, outcome: "registered" };
}

/**
 * Receives bytes (web upload or companion upload after permission). Dedupes by hash, validates,
 * stores the immutable original, and leaves the asset in quarantine until metadata is confirmed.
 */
export async function receiveUpload(
  db: DbOrTx,
  blobs: BlobStore,
  input: {
    ownerId: string;
    filename: string;
    mediaType: string;
    data: Buffer;
    origin: "web_upload" | "companion" | "open_import";
    maxBytes: number;
    devicePairingId?: string;
    assetId?: string;
  },
): Promise<{ asset: AssetRow; outcome: "stored" | "duplicate" }> {
  const { mediaType } = validateUpload(input.data, input.mediaType, input.filename, input.maxBytes);
  const hash = sha256(input.data);
  const [existing] = await db
    .select()
    .from(resourceAsset)
    .where(and(eq(resourceAsset.ownerId, input.ownerId), eq(resourceAsset.sha256, hash)))
    .limit(1);
  if (existing?.storageKey) return { asset: existing, outcome: "duplicate" };

  const stored = await blobs.put(input.data);
  if (existing) {
    // A locally registered asset whose bytes have now been permitted to arrive.
    if (existing.status !== "upload_requested" && existing.status !== "registered_local")
      throw new LibraryError("invalid_state", `Asset is ${existing.status}; bytes were not expected.`);
    const [updated] = await db
      .update(resourceAsset)
      .set({ storageKey: stored.key, status: "quarantined", localOnly: false, mediaType })
      .where(eq(resourceAsset.id, existing.id))
      .returning();
    return { asset: updated!, outcome: "stored" };
  }
  const [asset] = await db
    .insert(resourceAsset)
    .values({
      ownerId: input.ownerId,
      filename: input.filename,
      mediaType,
      sizeBytes: input.data.byteLength,
      sha256: hash,
      storageKey: stored.key,
      status: "quarantined",
      origin: input.origin,
      localOnly: false,
      devicePairingId: input.devicePairingId ?? null,
    })
    .returning();
  await db.insert(auditEvent).values({
    ownerId: input.ownerId,
    actor: input.origin === "companion" ? `companion:${input.devicePairingId}` : "learner",
    action: "asset:upload",
    entity: "resource_asset",
    entityId: asset!.id,
    details: { filename: input.filename, sizeBytes: input.data.byteLength, mediaType },
  });
  return { asset: asset!, outcome: "stored" };
}

export async function setCandidateMetadata(
  db: DbOrTx,
  ownerId: string,
  assetId: string,
  metadata: AssetRow["candidateMetadata"],
  pageCount?: number,
): Promise<void> {
  await db
    .update(resourceAsset)
    .set({ candidateMetadata: metadata, pageCount: pageCount ?? undefined })
    .where(and(eq(resourceAsset.id, assetId), eq(resourceAsset.ownerId, ownerId)));
}

/** Owner confirms what the file is and which courses it supports; validated assets may be processed. */
export async function confirmMetadata(
  db: DbOrTx,
  ownerId: string,
  assetId: string,
  input: { title: string; authors: string[]; edition?: string; courseIds: string[]; sourceVersionId?: string | null },
): Promise<AssetRow> {
  const [asset] = await db
    .select()
    .from(resourceAsset)
    .where(and(eq(resourceAsset.id, assetId), eq(resourceAsset.ownerId, ownerId)))
    .limit(1);
  if (!asset) throw new LibraryError("not_found", "Asset not found.");
  const nextStatus = asset.status === "quarantined" ? "validated" : asset.status;
  const [updated] = await db
    .update(resourceAsset)
    .set({
      confirmedTitle: input.title,
      confirmedAuthors: input.authors,
      confirmedEdition: input.edition ?? null,
      courseIds: input.courseIds,
      sourceVersionId: input.sourceVersionId ?? null,
      status: nextStatus,
    })
    .where(eq(resourceAsset.id, assetId))
    .returning();
  return updated!;
}

export type ProcessingAction = "local_read" | "local_extract" | "private_cloud_store" | "external_ai" | "external_embedding" | "share";

/** Latest non-revoked decision per action; unknown by default (reference-only). */
export async function getPermissions(
  db: DbOrTx,
  ownerId: string,
  assetId: string,
): Promise<Record<ProcessingAction, { status: "unknown" | "allowed" | "denied"; basis?: string }>> {
  const rows = await db
    .select()
    .from(processingPermission)
    .where(
      and(eq(processingPermission.ownerId, ownerId), eq(processingPermission.assetId, assetId), isNull(processingPermission.revokedAt)),
    )
    .orderBy(desc(processingPermission.recordedAt));
  const result: Record<ProcessingAction, { status: "unknown" | "allowed" | "denied"; basis?: string }> = {
    local_read: { status: "unknown" },
    local_extract: { status: "unknown" },
    private_cloud_store: { status: "unknown" },
    external_ai: { status: "unknown" },
    external_embedding: { status: "unknown" },
    share: { status: "unknown" },
  };
  for (const r of rows) {
    if (result[r.action as ProcessingAction].status === "unknown")
      result[r.action as ProcessingAction] = { status: r.status, basis: r.basis };
  }
  return result;
}

export async function isAllowed(db: DbOrTx, ownerId: string, assetId: string, action: ProcessingAction): Promise<boolean> {
  const p = await getPermissions(db, ownerId, assetId);
  return p[action].status === "allowed";
}

/**
 * Records a permission decision for one action. Denying `private_cloud_store` on a stored asset
 * removes the stored copy and everything derived from it at once (the blob store is required for
 * that); denying `external_ai` or `external_embedding` takes effect immediately for every later
 * tutor turn and job (jobs re-check before each step). The asset must belong to the caller.
 */
export async function setPermission(
  db: DbOrTx,
  ownerId: string,
  assetId: string,
  action: ProcessingAction,
  status: "allowed" | "denied",
  basis: string,
  blobs?: BlobStore,
): Promise<void> {
  const asset = await getAsset(db, ownerId, assetId);
  if (!asset) throw new LibraryError("not_found", "Asset not found.");
  if (action === "private_cloud_store" && status === "denied" && asset.storageKey && !blobs) {
    throw new Error("withdrawing private storage needs the blob store so the stored copy can be removed");
  }
  await db
    .update(processingPermission)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(processingPermission.ownerId, ownerId),
        eq(processingPermission.assetId, assetId),
        eq(processingPermission.action, action),
        isNull(processingPermission.revokedAt),
      ),
    );
  await db.insert(processingPermission).values({ ownerId, assetId, action, status, basis });
  await db.insert(auditEvent).values({
    ownerId,
    actor: "learner",
    action: `permission:${action}:${status}`,
    entity: "resource_asset",
    entityId: assetId,
    details: { basis },
  });
  if (action === "private_cloud_store") {
    if (status === "allowed" && asset.status === "registered_local") {
      await db.update(resourceAsset).set({ status: "upload_requested" }).where(eq(resourceAsset.id, assetId));
    }
    if (status === "denied" && asset.storageKey && blobs) {
      // The learner withdrew storage: the copy and everything derived from it go now. A file
      // the companion registered stays on the shelf as a local-only record; a web upload has
      // no other home and is deleted.
      await blobs.delete(asset.storageKey).catch(() => undefined);
      await db.delete(passage).where(eq(passage.assetId, assetId));
      await db.delete(extractedPage).where(eq(extractedPage.assetId, assetId));
      await db.update(annotation).set({ assetId: null, mappingStatus: "needs_repair" }).where(eq(annotation.assetId, assetId));
      const localOnly = asset.origin === "companion";
      await db
        .update(resourceAsset)
        .set(
          localOnly
            ? { status: "registered_local", localOnly: true, storageKey: null, pageCount: null }
            : { status: "deleted", deletedAt: new Date(), storageKey: null },
        )
        .where(eq(resourceAsset.id, assetId));
    }
  }
}

export async function listAssets(db: DbOrTx, ownerId: string): Promise<AssetRow[]> {
  return db
    .select()
    .from(resourceAsset)
    .where(and(eq(resourceAsset.ownerId, ownerId), isNull(resourceAsset.deletedAt)))
    .orderBy(desc(resourceAsset.createdAt));
}

export async function getAsset(db: DbOrTx, ownerId: string, assetId: string): Promise<AssetRow | null> {
  if (!isUuid(assetId)) return null;
  const rows = await db
    .select()
    .from(resourceAsset)
    .where(and(eq(resourceAsset.id, assetId), eq(resourceAsset.ownerId, ownerId), isNull(resourceAsset.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Queues ingestion when the asset is validated and processing is permitted. Every request gets
 * its own job record (a re-extraction of a processed item, or an extraction after a cancelled
 * job, must not collide with a finished record under the same key); pg-boss's singleton key on
 * the hash keeps two jobs for the same bytes from running at once.
 */
export async function requestIngestion(db: DbOrTx, ownerId: string, assetId: string): Promise<{ queued: boolean; reason?: string }> {
  const asset = await getAsset(db, ownerId, assetId);
  if (!asset) throw new LibraryError("not_found", "Asset not found.");
  if (!asset.storageKey)
    return { queued: false, reason: "The file has not been stored; grant private cloud storage first (or upload it)." };
  if (asset.status === "processing") return { queued: false, reason: "This item is already being processed." };
  if (asset.status === "rejected")
    return {
      queued: false,
      reason: `This file was rejected: ${asset.rejectionReason ?? "unknown reason"}. Retry from the jobs page if the cause was transient.`,
    };
  if (asset.status !== "validated" && asset.status !== "processed")
    return { queued: false, reason: `Confirm the metadata first (status: ${asset.status}).` };
  const permitted = await isAllowed(db, ownerId, assetId, "local_extract");
  if (!permitted)
    return { queued: false, reason: "Text extraction is not permitted for this item. Allow 'extraction and indexing' on the item page." };
  const baseKey = `ingest:${asset.sha256}:${asset.id}`;
  const [prior] = await db
    .select({ n: count() })
    .from(jobRecord)
    .where(like(jobRecord.idempotencyKey, `${baseKey}%`));
  const idempotencyKey = prior && prior.n > 0 ? `${baseKey}#r${prior.n}` : baseKey;
  const previousStatus = asset.status;
  await db.update(resourceAsset).set({ status: "processing" }).where(eq(resourceAsset.id, assetId));
  const payload = IngestAssetPayload.parse({ idempotencyKey, ownerId, assetId });
  const result = await enqueue(db, { queue: QUEUES.ingestAsset, kind: "ingest-asset", payload, singletonKey: asset.sha256 });
  if (!result.created) {
    await db.update(resourceAsset).set({ status: previousStatus }).where(eq(resourceAsset.id, assetId));
    return { queued: false, reason: "A job for this file already exists; see the jobs page." };
  }
  return { queued: true };
}

/** Deletes originals, extracted text, passages and annotations' mapping; keeps the audit trail. */
export async function deleteAsset(db: DbOrTx, blobs: BlobStore, ownerId: string, assetId: string): Promise<void> {
  const asset = await getAsset(db, ownerId, assetId);
  if (!asset) return;
  if (asset.storageKey) await blobs.delete(asset.storageKey).catch(() => undefined);
  await db.delete(passage).where(eq(passage.assetId, assetId));
  await db.delete(extractedPage).where(eq(extractedPage.assetId, assetId));
  await db.update(annotation).set({ assetId: null, mappingStatus: "needs_repair" }).where(eq(annotation.assetId, assetId));
  await db.update(resourceAsset).set({ status: "deleted", deletedAt: new Date(), storageKey: null }).where(eq(resourceAsset.id, assetId));
  await db.insert(auditEvent).values({
    ownerId,
    actor: "learner",
    action: "asset:delete",
    entity: "resource_asset",
    entityId: assetId,
    details: { filename: asset.filename },
  });
}

export async function listPages(db: DbOrTx, assetId: string) {
  return db.select().from(extractedPage).where(eq(extractedPage.assetId, assetId)).orderBy(asc(extractedPage.physicalIndex));
}

export async function getPage(db: DbOrTx, assetId: string, physicalIndex: number) {
  const rows = await db
    .select()
    .from(extractedPage)
    .where(and(eq(extractedPage.assetId, assetId), eq(extractedPage.physicalIndex, physicalIndex)))
    .limit(1);
  return rows[0] ?? null;
}

/** Full-text search inside one asset, returning page hits with headline snippets. */
export async function searchAsset(db: DbOrTx, assetId: string, query: string, limit = 20) {
  const q = query.trim();
  if (!q) return [];
  const rows = await db.execute(sql`
    select physical_index, printed_label,
           ts_headline('english', text, websearch_to_tsquery('english', ${q}), 'MaxFragments=2, MaxWords=25, MinWords=8, StartSel=[[, StopSel=]]') as snippet,
           ts_rank(tsv, websearch_to_tsquery('english', ${q})) as rank
    from extracted_page
    where asset_id = ${assetId} and tsv @@ websearch_to_tsquery('english', ${q})
    order by rank desc, physical_index asc
    limit ${limit}`);
  return rows.rows as { physical_index: number; printed_label: string | null; snippet: string; rank: number }[];
}

/**
 * Evidence passages for tutoring: only from assets that are processed, assigned to the course,
 * and permitted for external AI processing. A semantically similar chunk from another course
 * or an unpermitted book never reaches a model.
 */
/**
 * A learner's question as a full-text query that any of its words satisfies; ranking puts the
 * passages that share the most words first. Websearch syntax alone would require every word of
 * the question to appear in one passage, which a sentence such as "Why must every Cauchy sequence
 * converge?" almost never does, so the tutor would see no passage at all.
 */
function anyOfTheWords(question: string): string {
  return (question.match(/[\p{L}\p{N}]+/gu) ?? []).join(" or ");
}

export async function permittedPassagesForCourse(db: DbOrTx, ownerId: string, courseId: string, query: string, limit = 6) {
  const assets = await db
    .select()
    .from(resourceAsset)
    .where(
      and(
        eq(resourceAsset.ownerId, ownerId),
        eq(resourceAsset.status, "processed"),
        isNull(resourceAsset.deletedAt),
        sql`${resourceAsset.courseIds} ? ${courseId}`,
      ),
    );
  const allowed: AssetRow[] = [];
  for (const a of assets) if (await isAllowed(db, ownerId, a.id, "external_ai")) allowed.push(a);
  if (allowed.length === 0 || !query.trim()) return [];
  const words = anyOfTheWords(query);
  const rows = await db.execute(sql`
    select p.id, p.asset_id, p.text, p.heading, e.physical_index, e.printed_label,
           ts_rank(p.tsv, websearch_to_tsquery('english', ${words})) as rank
    from passage p join extracted_page e on e.id = p.page_id
    where p.asset_id in (${sql.join(
      allowed.map((a) => sql`${a.id}::uuid`),
      sql`, `,
    )}) and p.tsv @@ websearch_to_tsquery('english', ${words})
    order by rank desc limit ${limit}`);
  return (
    rows.rows as {
      id: string;
      asset_id: string;
      text: string;
      heading: string | null;
      physical_index: number;
      printed_label: string | null;
      rank: number;
    }[]
  ).map((r) => ({
    ...r,
    asset: allowed.find((a) => a.id === r.asset_id)!,
  }));
}

// ---------------------------------------------------------------------------------------------
// Resource requests

export async function createResourceRequest(
  db: DbOrTx,
  ownerId: string,
  input: Omit<typeof resourceRequest.$inferInsert, "ownerId" | "id" | "createdAt" | "updatedAt">,
): Promise<RequestRow> {
  const [row] = await db
    .insert(resourceRequest)
    .values({ ...input, ownerId })
    .returning();
  return row!;
}

export async function listResourceRequests(db: DbOrTx, ownerId: string): Promise<RequestRow[]> {
  return db
    .select()
    .from(resourceRequest)
    .where(eq(resourceRequest.ownerId, ownerId))
    .orderBy(asc(resourceRequest.status), desc(resourceRequest.createdAt));
}

export async function setRequestStatus(db: DbOrTx, ownerId: string, id: string, status: "open" | "obtained" | "declined"): Promise<void> {
  await db
    .update(resourceRequest)
    .set({ status })
    .where(and(eq(resourceRequest.id, id), eq(resourceRequest.ownerId, ownerId)));
}

export function renderRequestsMarkdown(requests: RequestRow[], institution: string, suggestions: SuggestedRequest[] = []): string {
  const lines = [
    `# ${institution}: books and materials to obtain`,
    "",
    `Generated ${new Date().toISOString().slice(0, 10)}. Obtain through legitimate channels only (publisher, author page, library). Place files in the folder shown; metadata is confirmed in the app before anything is processed.`,
    "",
  ];
  for (const r of requests) {
    lines.push(`## ${r.title}${r.authors ? ` — ${r.authors}` : ""}${r.edition ? ` (${r.edition})` : ""}`);
    lines.push("");
    lines.push(`- Status: ${r.status}${r.essential ? " · essential" : " · optional"}`);
    if (r.isbn) lines.push(`- ISBN: ${r.isbn}`);
    if (r.courseId) lines.push(`- Course: ${r.courseId}${r.unitIds.length ? ` (units ${r.unitIds.join(", ")})` : ""}`);
    lines.push(`- Why: ${r.why}`);
    if (r.chaptersNeeded.length) lines.push(`- Sections needed (verified): ${r.chaptersNeeded.join("; ")}`);
    for (const l of r.links) lines.push(`- ${l.label}: ${l.url}`);
    if (r.openAlternative) lines.push(`- Open alternative: ${r.openAlternative}`);
    lines.push(`- Accepted formats: ${r.acceptedFormats.join(", ")} · destination folder: ${r.destinationFolder}`);
    lines.push(`- Minimum processing permission needed: ${r.minPermission}`);
    if (r.caveats) lines.push(`- Access/licensing: ${r.caveats}`);
    lines.push("");
  }
  if (requests.length === 0) lines.push("Nothing is on the list at the moment.", "");
  if (suggestions.length) {
    lines.push("## Suggested by the catalogue (not yet on the list)", "");
    for (const s of suggestions) {
      lines.push(
        `- **${s.title}**${s.authors ? ` — ${s.authors}` : ""}${s.edition ? ` (${s.edition})` : ""} · ${s.courseId} · ${s.essential ? "essential" : "optional"} · ${s.caveats}`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------------------------
// Desktop companion pairing

export async function createPairingCode(db: DbOrTx, ownerId: string): Promise<{ code: string; expiresAt: Date }> {
  const code = `${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`;
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await db.insert(pairingCode).values({ userId: ownerId, codeHash: hashToken(code), expiresAt });
  return { code, expiresAt };
}

/** Exchanges a one-time code for a narrow device token (returned once; stored hashed). */
export async function redeemPairingCode(
  db: DbOrTx,
  code: string,
  deviceName: string,
  roots: string[],
): Promise<{ token: string; pairing: PairingRow }> {
  const [row] = await db
    .select()
    .from(pairingCode)
    .where(and(eq(pairingCode.codeHash, hashToken(code.trim())), isNull(pairingCode.consumedAt), gt(pairingCode.expiresAt, new Date())))
    .limit(1);
  if (!row) throw new LibraryError("bad_code", "That pairing code is not valid or has expired. Create a new one in the Library.");
  await db.update(pairingCode).set({ consumedAt: new Date() }).where(eq(pairingCode.id, row.id));
  const token = `cvt_${randomBytes(32).toString("base64url")}`;
  const [pairing] = await db
    .insert(devicePairing)
    .values({ userId: row.userId, name: deviceName.slice(0, 80), tokenHash: hashToken(token), roots })
    .returning();
  await db.insert(auditEvent).values({
    ownerId: row.userId,
    actor: "learner",
    action: "companion:pair",
    entity: "device_pairing",
    entityId: pairing!.id,
    details: { deviceName },
  });
  return { token, pairing: pairing! };
}

export async function authenticateDevice(db: DbOrTx, token: string): Promise<PairingRow | null> {
  if (!token.startsWith("cvt_")) return null;
  const rows = await db
    .select()
    .from(devicePairing)
    .where(and(eq(devicePairing.tokenHash, hashToken(token)), isNull(devicePairing.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (row) await db.update(devicePairing).set({ lastSeenAt: new Date() }).where(eq(devicePairing.id, row.id));
  return row ?? null;
}

export async function reportDeviceStatus(db: DbOrTx, pairingId: string, status: NonNullable<PairingRow["lastStatus"]>): Promise<void> {
  await db.update(devicePairing).set({ lastStatus: status, lastSeenAt: new Date() }).where(eq(devicePairing.id, pairingId));
}

export async function listPairings(db: DbOrTx, ownerId: string): Promise<PairingRow[]> {
  return db.select().from(devicePairing).where(eq(devicePairing.userId, ownerId)).orderBy(desc(devicePairing.createdAt));
}

export async function revokePairing(db: DbOrTx, ownerId: string, pairingId: string): Promise<void> {
  await db
    .update(devicePairing)
    .set({ revokedAt: new Date() })
    .where(and(eq(devicePairing.id, pairingId), eq(devicePairing.userId, ownerId)));
}

/** Work for the companion: assets whose bytes the owner has permitted to be stored. */
export async function pendingUploadTasks(
  db: DbOrTx,
  pairingId: string,
  ownerId: string,
): Promise<{ assetId: string; sha256: string; localPathHint: string | null }[]> {
  const rows = await db
    .select({ assetId: resourceAsset.id, sha256: resourceAsset.sha256, localPathHint: resourceAsset.localPathHint })
    .from(resourceAsset)
    .where(
      and(eq(resourceAsset.ownerId, ownerId), eq(resourceAsset.devicePairingId, pairingId), eq(resourceAsset.status, "upload_requested")),
    );
  return rows;
}

/**
 * Companion state for the Library page. "online" needs a heartbeat in the last 2 minutes from a
 * watcher that reports itself as watching; a recent contact that is not watching is "paused";
 * anything else is "offline" and the page says so plainly.
 */
export function companionState(pairings: PairingRow[], now = Date.now()): "online" | "paused" | "offline" {
  const recent = pairings.filter((p) => !p.revokedAt && p.lastSeenAt && now - p.lastSeenAt.getTime() < 2 * 60_000);
  if (recent.some((p) => p.lastStatus?.watching)) return "online";
  if (recent.some((p) => p.lastStatus?.paused)) return "paused";
  return "offline";
}

export async function assetsByIds(db: DbOrTx, ids: string[]): Promise<AssetRow[]> {
  if (ids.length === 0) return [];
  return db.select().from(resourceAsset).where(inArray(resourceAsset.id, ids));
}

/** Local-only items assigned to a course: the tutor is told they exist and that it has not seen them. */
export async function localOnlyAssetsForCourse(db: DbOrTx, ownerId: string, courseId: string): Promise<AssetRow[]> {
  return db
    .select()
    .from(resourceAsset)
    .where(
      and(
        eq(resourceAsset.ownerId, ownerId),
        isNull(resourceAsset.deletedAt),
        eq(resourceAsset.localOnly, true),
        sql`${resourceAsset.courseIds} ? ${courseId}`,
      ),
    );
}

// ---------------------------------------------------------------------------------------------
// Reading progress, table of contents and annotations

export type AnnotationRow = typeof annotation.$inferSelect;

export async function getReadingProgress(db: DbOrTx, ownerId: string, assetId: string): Promise<number> {
  const rows = await db
    .select({ physicalIndex: readingProgress.physicalIndex })
    .from(readingProgress)
    .where(and(eq(readingProgress.ownerId, ownerId), eq(readingProgress.assetId, assetId)))
    .limit(1);
  return rows[0]?.physicalIndex ?? 0;
}

export async function saveReadingProgress(db: DbOrTx, ownerId: string, assetId: string, physicalIndex: number): Promise<void> {
  if (!(await getAsset(db, ownerId, assetId))) throw new LibraryError("not_found", "Asset not found.");
  await db
    .insert(readingProgress)
    .values({ ownerId, assetId, physicalIndex })
    .onConflictDoUpdate({ target: [readingProgress.ownerId, readingProgress.assetId], set: { physicalIndex, updatedAt: new Date() } });
}

/** Headings seen in the extracted text (theorem, definition, chapter labels), in page order. */
export async function tableOfContents(db: DbOrTx, assetId: string, limit = 400) {
  const rows = await db
    .select({
      heading: passage.heading,
      kind: passage.kind,
      physicalIndex: extractedPage.physicalIndex,
      printedLabel: extractedPage.printedLabel,
    })
    .from(passage)
    .innerJoin(extractedPage, eq(passage.pageId, extractedPage.id))
    .where(and(eq(passage.assetId, assetId), isNotNull(passage.heading)))
    .orderBy(asc(extractedPage.physicalIndex), asc(passage.ordinal))
    .limit(limit);
  return rows as { heading: string; kind: string; physicalIndex: number; printedLabel: string | null }[];
}

export async function passagesForPage(db: DbOrTx, pageId: string) {
  return db.select().from(passage).where(eq(passage.pageId, pageId)).orderBy(asc(passage.ordinal));
}

export interface ReadingNote {
  id: string;
  assetId: string | null;
  item: string;
  note: string;
  selectedText: string | null;
  page: number | null;
  createdAt: Date;
  mappingStatus: "resolved" | "needs_repair";
}

/** Notes written in the reading room, newest first, so the notebook can show and search them. */
export async function listReadingNotes(db: DbOrTx, ownerId: string, query?: string, limit = 50): Promise<ReadingNote[]> {
  const rows = await db
    .select({ annotation, title: resourceAsset.confirmedTitle, filename: resourceAsset.filename })
    .from(annotation)
    .leftJoin(resourceAsset, eq(annotation.assetId, resourceAsset.id))
    .where(and(eq(annotation.ownerId, ownerId), sql`length(${annotation.noteMarkdown}) > 0`))
    .orderBy(desc(annotation.updatedAt))
    .limit(limit);
  const q = query?.trim().toLowerCase();
  return rows
    .filter((r) => !q || r.annotation.noteMarkdown.toLowerCase().includes(q) || (r.annotation.selectedText ?? "").toLowerCase().includes(q))
    .map((r) => ({
      id: r.annotation.id,
      assetId: r.annotation.assetId,
      item: r.title ?? r.filename ?? "(item removed)",
      note: r.annotation.noteMarkdown,
      selectedText: r.annotation.selectedText,
      page: r.annotation.locator.kind === "pdf" ? r.annotation.locator.physicalPageIndex + 1 : null,
      createdAt: r.annotation.createdAt,
      mappingStatus: r.annotation.mappingStatus,
    }));
}

export async function listAnnotations(db: DbOrTx, ownerId: string, assetId: string): Promise<AnnotationRow[]> {
  return db
    .select()
    .from(annotation)
    .where(and(eq(annotation.ownerId, ownerId), eq(annotation.assetId, assetId)))
    .orderBy(asc(annotation.createdAt));
}

/**
 * An annotation stores a locator (physical page, printed label, passage) rather than a row
 * reference, so it survives re-ingestion; `reconcileAnnotations` re-checks the mapping and
 * flags, never moves, anything that no longer resolves.
 */
export async function createAnnotation(
  db: DbOrTx,
  ownerId: string,
  input: { assetId: string; physicalIndex: number; selectedText?: string; noteMarkdown: string; passageId?: string },
): Promise<AnnotationRow> {
  const asset = await getAsset(db, ownerId, input.assetId);
  if (!asset) throw new LibraryError("not_found", "Asset not found.");
  const page = await getPage(db, asset.id, input.physicalIndex);
  const loc: Locator = {
    kind: "pdf",
    sourceVersionId: asset.sourceVersionId ?? `asset:${asset.sha256.slice(0, 16)}`,
    physicalPageIndex: input.physicalIndex,
    printedPageLabel: page?.printedLabel ?? undefined,
    passageId: input.passageId,
  };
  const [row] = await db
    .insert(annotation)
    .values({
      ownerId,
      assetId: asset.id,
      sourceVersionId: asset.sourceVersionId ?? null,
      locator: loc,
      selectedText: input.selectedText?.slice(0, 2000) ?? null,
      noteMarkdown: input.noteMarkdown,
      mappingStatus: page ? "resolved" : "needs_repair",
    })
    .returning();
  return row!;
}

export async function deleteAnnotation(db: DbOrTx, ownerId: string, id: string): Promise<void> {
  await db.delete(annotation).where(and(eq(annotation.id, id), eq(annotation.ownerId, ownerId)));
}

export async function reconcileAnnotations(
  db: DbOrTx,
  ownerId: string,
  assetId: string,
): Promise<{ resolved: number; needsRepair: number }> {
  const rows = await listAnnotations(db, ownerId, assetId);
  let resolved = 0;
  let needsRepair = 0;
  for (const a of rows) {
    if (a.locator.kind !== "pdf") continue;
    const page = await getPage(db, assetId, a.locator.physicalPageIndex);
    const ok = Boolean(page) && (!a.selectedText || squash(page!.text).includes(squash(a.selectedText)));
    await db
      .update(annotation)
      .set({ mappingStatus: ok ? "resolved" : "needs_repair" })
      .where(eq(annotation.id, a.id));
    if (ok) resolved++;
    else needsRepair++;
  }
  return { resolved, needsRepair };
}

function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

// ---------------------------------------------------------------------------------------------
// Source registry and catalogue-derived acquisition requests

export interface SourceRegistryEntry {
  source: typeof source.$inferSelect;
  version: typeof sourceVersion.$inferSelect;
  locatorCount: number;
  pdfLocatorCount: number;
  courses: { id: string; title: string; role: "primary" | "supplemental"; launch: boolean; departmentId: string }[];
}

/** Every verified source with its current version, how many places are pinned in it, and which courses rest on it. */
export async function listSourceRegistry(db: DbOrTx): Promise<SourceRegistryEntry[]> {
  const sources = await db.select().from(source).orderBy(asc(source.title));
  const versions = await db.select().from(sourceVersion);
  const counts = await db
    .select({
      sourceVersionId: locator.sourceVersionId,
      n: sql<number>`count(*)::int`,
      pdf: sql<number>`count(*) filter (where ${locator.kind} = 'pdf')::int`,
    })
    .from(locator)
    .groupBy(locator.sourceVersionId);
  const uses = await db
    .select({
      courseId: courseVersion.courseId,
      title: course.title,
      launch: course.launch,
      departmentId: course.primaryDepartmentId,
      primary: courseVersion.primarySourceIds,
      supplemental: courseVersion.supplementalSourceIds,
    })
    .from(courseVersion)
    .innerJoin(course, eq(course.id, courseVersion.courseId))
    .where(eq(courseVersion.isCurrent, true));
  const entries: SourceRegistryEntry[] = [];
  for (const s of sources) {
    const version = versions.find((v) => v.id === s.currentVersionId) ?? versions.find((v) => v.sourceId === s.id);
    if (!version) continue;
    const count = counts.find((c) => c.sourceVersionId === version.id);
    const courses: SourceRegistryEntry["courses"] = [];
    for (const u of uses) {
      if (u.primary.includes(s.id))
        courses.push({ id: u.courseId, title: u.title, role: "primary", launch: u.launch, departmentId: u.departmentId });
      else if (u.supplemental.includes(s.id))
        courses.push({ id: u.courseId, title: u.title, role: "supplemental", launch: u.launch, departmentId: u.departmentId });
    }
    entries.push({ source: s, version, locatorCount: count?.n ?? 0, pdfLocatorCount: count?.pdf ?? 0, courses });
  }
  return entries;
}

export interface SuggestedRequest {
  key: string;
  title: string;
  authors: string;
  edition?: string;
  isbn?: string;
  courseId: string;
  why: string;
  essential: boolean;
  chaptersNeeded: string[];
  links: { label: string; url: string }[];
  openAlternative?: string;
  acceptedFormats: string[];
  destinationFolder: string;
  caveats: string;
  minPermission: string;
  /** A source still to be identified, named by a course as a lead; it has no verified record. */
  lead?: boolean;
}

/**
 * Books the launch catalogue depends on but cannot fetch: commercial or institutional sources
 * named by a launch course's current version. Everything in such a suggestion comes from the
 * verified source record; sections are listed only where a verified book-reference locator
 * names them. Then the sources still missing from the programmes the owner follows: the leads
 * that courses mapped by those programmes name, labelled as leads, with nothing presented as a
 * citation. Titles already on the owner's list are not suggested again.
 */
export async function suggestedRequests(db: DbOrTx, ownerId: string): Promise<SuggestedRequest[]> {
  const registry = await listSourceRegistry(db);
  const existing = await listResourceRequests(db, ownerId);
  const existingTitles = new Set(existing.map((r) => r.title.trim().toLowerCase()));
  const refs = await db.select({ sourceVersionId: locator.sourceVersionId, payload: locator.payload }).from(locator);
  const out: SuggestedRequest[] = [];
  for (const entry of registry) {
    if (entry.version.accessStatus !== "commercial" && entry.version.accessStatus !== "institutional") continue;
    if (existingTitles.has(entry.source.title.trim().toLowerCase())) continue;
    const chapters = [
      ...new Set(
        refs
          .filter((r) => r.sourceVersionId === entry.version.id)
          .map((r) => (r.payload.kind === "book_reference" ? r.payload.sectionLabel : ""))
          .filter(Boolean),
      ),
    ];
    for (const c of entry.courses.filter((x) => x.launch)) {
      const open = registry
        .filter((e) => e.version.accessStatus === "open" && e.courses.some((cc) => cc.id === c.id))
        .map((e) => e.source.title);
      out.push({
        key: `${entry.source.id}:${c.id}`,
        title: entry.source.title,
        authors: entry.source.authors.join(", "),
        edition: entry.version.label,
        isbn: entry.source.isbn ?? undefined,
        courseId: c.id,
        why: `${c.role === "primary" ? "Primary" : "Supplemental"} source named by ${c.title} (${c.id}).${entry.source.description ? ` ${entry.source.description}` : ""}`,
        essential: c.role === "primary",
        chaptersNeeded: chapters,
        links: [
          { label: "Canonical page", url: entry.source.canonicalUrl },
          ...(entry.version.licenceUrl ? [{ label: "Licence or terms", url: entry.version.licenceUrl }] : []),
        ],
        openAlternative: open.length
          ? `Open sources this course already rests on: ${open.join("; ")}. The course page shows which units they cover; they are not claimed to be equivalent to this book.`
          : undefined,
        acceptedFormats: ["pdf"],
        destinationFolder: `inbox/${c.departmentId}`,
        caveats: [`Access status: ${entry.version.accessStatus}. Licence: ${entry.version.licence}.`, ...entry.version.limitations].join(
          " ",
        ),
        minPermission: "local_read",
      });
    }
  }
  out.push(...(await programmeLeads(db, ownerId, existingTitles)));
  return out;
}

/** Leads named by the courses that the owner's followed programmes map to their blocks. */
async function programmeLeads(db: DbOrTx, ownerId: string, existingTitles: Set<string>): Promise<SuggestedRequest[]> {
  const followed = await db
    .select({ blocks: programme.blocks })
    .from(programmeParticipation)
    .innerJoin(programme, eq(programme.id, programmeParticipation.programmeId))
    .where(and(eq(programmeParticipation.ownerId, ownerId), eq(programmeParticipation.status, "following")));
  const courseIds = [...new Set(followed.flatMap((p) => p.blocks.flatMap((b) => b.courseMappings.map((m) => m.courseId))))];
  if (courseIds.length === 0) return [];
  const versions = await db
    .select({ courseId: course.id, title: course.title, departmentId: course.primaryDepartmentId, notes: courseVersion.catalogueNotes })
    .from(courseVersion)
    .innerJoin(course, eq(course.id, courseVersion.courseId))
    .where(and(eq(courseVersion.isCurrent, true), inArray(courseVersion.courseId, courseIds)))
    .orderBy(asc(course.id));
  const out: SuggestedRequest[] = [];
  for (const v of versions) {
    for (const lead of v.notes.sourceCandidates ?? []) {
      if (existingTitles.has(lead.name.trim().toLowerCase())) continue;
      out.push({
        key: `lead:${v.courseId}:${lead.name}`,
        title: lead.name,
        authors: "",
        edition: "To be identified",
        courseId: v.courseId,
        why: `Lead named by ${v.title} (${v.courseId}): ${lead.note}`,
        essential: false,
        chaptersNeeded: [],
        links: [],
        acceptedFormats: ["pdf"],
        destinationFolder: `inbox/${v.departmentId}`,
        caveats:
          "Lead only: no edition has been chosen and no source record is verified, so nothing here is a citation. Identify an edition through legitimate channels and register it in the source registry before any unit cites it.",
        minPermission: "local_read",
        lead: true,
      });
    }
  }
  return out;
}

export function requestsToJson(requests: RequestRow[], suggestions: SuggestedRequest[], institution: string) {
  return {
    institution,
    generatedAt: new Date().toISOString(),
    note: "Obtain through legitimate channels only. Metadata is confirmed in the app before any processing; the permission named is the minimum needed to use the item for its course.",
    requests: requests.map((r) => ({
      id: r.id,
      title: r.title,
      authors: r.authors,
      edition: r.edition,
      isbn: r.isbn,
      courseId: r.courseId,
      unitIds: r.unitIds,
      why: r.why,
      essential: r.essential,
      chaptersNeeded: r.chaptersNeeded,
      links: r.links,
      openAlternative: r.openAlternative,
      acceptedFormats: r.acceptedFormats,
      destinationFolder: r.destinationFolder,
      caveats: r.caveats,
      minPermission: r.minPermission,
      status: r.status,
    })),
    suggestedByCatalogue: suggestions,
  };
}
