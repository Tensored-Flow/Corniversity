import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  type AnchorRect,
  buildAnchor,
  checkDrift,
  clampPosition,
  type Locator,
  linkedDocumentKey,
  MAX_CHANGED_AGO_MS,
  PositionSaveSchema,
  quoteFoundIn,
  type ReadingPosition,
} from "@corniversity/core";
import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, like, ne, or, type SQL, sql } from "drizzle-orm";
import type { BlobStore } from "../blob";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { IngestAssetPayload, QUEUES } from "../jobs";
import { enqueue } from "../queue";
import {
  type AnnotationKind,
  type AssetOrigin,
  annotation,
  auditEvent,
  course,
  courseVersion,
  devicePairing,
  extractedPage,
  libraryCollectionItem,
  locator,
  pairingCode,
  passage,
  processingPermission,
  programme,
  programmeParticipation,
  readingProgress,
  resourceAsset,
  resourceRequest,
  scholarlyVersion,
  scholarlyWork,
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
      | "revoked"
      | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "LibraryError";
  }
}

/** An annotation edit whose expected version is stale: the route shows both texts. */
export class AnnotationConflictError extends LibraryError {
  constructor(readonly current: AnnotationRow) {
    super("conflict", "This note was changed elsewhere after you opened it. Both versions are shown; nothing was overwritten.");
    this.name = "AnnotationConflictError";
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
    // A Document of the research library (a paper's file, linked or stored) is never rewritten by
    // the companion: the sighting is recorded and nothing else changes.
    if (existing.status === "linked_remote" || existing.scholarlyVersionId) {
      await db.insert(auditEvent).values({
        ownerId: input.ownerId,
        actor: `companion:${input.devicePairingId}`,
        action: "asset:register-seen",
        entity: "resource_asset",
        entityId: existing.id,
        details: { filename: input.filename, sizeBytes: input.sizeBytes },
      });
      return { asset: existing, outcome: "known" };
    }
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
 * Every decision is taken by `placeDocumentBytes` before any bytes are written.
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
  const placed = await placeDocumentBytes(db, blobs, input);
  return { asset: placed.asset, outcome: placed.outcome === "duplicate" ? "duplicate" : "stored" };
}

/**
 * What arriving bytes do to the Document rows (contract §3, the transition table), decided from
 * the row already holding the same hash (`existing`, soft-deleted rows included) and, when the
 * bytes are meant for a linked arXiv Document, that row (`target`). Pure: nothing is written.
 *
 * Bytes for a linked Document that a soft-deleted row already held: that row is folded into the
 * linked Document (its notes and reading position move over, the empty row goes), so deleting a
 * file never blocks attaching it to a paper later. Bytes a live item already holds are refused with
 * an instruction: one Document per arXiv version, and an item's own notes and permissions are
 * never merged into another item's silently.
 */
export type DocumentPlacement =
  | { action: "store_new" }
  | { action: "duplicate"; asset: AssetRow }
  | { action: "fill_registered"; asset: AssetRow }
  | { action: "revive"; asset: AssetRow }
  | { action: "promote"; asset: AssetRow; fold?: AssetRow }
  | { action: "refuse"; code: "invalid_state" | "duplicate"; message: string; existing?: AssetRow };

export const FILE_IN_LIBRARY_AS_OTHER_ITEM =
  "This file is already in your library as another item. Delete that item first, then attach the file here; its notes come with it.";

export function decideDocumentPlacement(existing: AssetRow | null, target: AssetRow | null = null): DocumentPlacement {
  if (target) {
    if (target.status !== "linked_remote" || target.deletedAt)
      return { action: "refuse", code: "invalid_state", message: "This paper's file is already stored here." };
    if (!existing) return { action: "promote", asset: target };
    if (existing.deletedAt) return { action: "promote", asset: target, fold: existing };
    if (existing.storageKey && existing.scholarlyVersionId && existing.scholarlyVersionId !== target.scholarlyVersionId)
      return {
        action: "refuse",
        code: "duplicate",
        message: "This file is already stored for another version or paper in your library.",
        existing,
      };
    return { action: "refuse", code: "duplicate", message: FILE_IN_LIBRARY_AS_OTHER_ITEM, existing };
  }
  if (!existing) return { action: "store_new" };
  if (existing.deletedAt) return { action: "revive", asset: existing };
  if (existing.storageKey) return { action: "duplicate", asset: existing };
  if (existing.status === "upload_requested" || existing.status === "registered_local")
    return { action: "fill_registered", asset: existing };
  return { action: "refuse", code: "invalid_state", message: `Asset is ${existing.status}; bytes were not expected.`, existing };
}

export const REVIVE_BASIS = "re-added by the owner";

/**
 * The one routine through which bytes reach a Document. It reads the rows, decides with
 * `decideDocumentPlacement` before any `blobs.put`, writes the blob only when the decision stores
 * bytes, and deletes that blob again if the database write then fails, so no orphan is left.
 *  - new bytes: a new quarantined row;
 *  - the same bytes stored already: the existing row (duplicate);
 *  - bytes for a companion registration: that row, quarantined;
 *  - bytes of a soft-deleted row: the row revived (quarantined; private storage allowed with the
 *    basis "re-added by the owner", every other earlier decision revoked, metadata and course ids
 *    from the new upload, annotations re-attached, audit `asset:revive`); a paper's file takes its
 *    metadata from its work at once (validated), since the item form does not edit it;
 *  - bytes for a linked arXiv Document (`promoteAssetId`): the same row promoted in place (real
 *    sha256, storage key, quarantined), keeping its annotations, position and permissions. A
 *    soft-deleted row with the same bytes is folded into it first. Anchors made on arXiv's file
 *    take the new key at once only when these are the very bytes the reader received
 *    (`observed_sha256`); otherwise the geometry check after extraction decides.
 */
export async function placeDocumentBytes(
  db: DbOrTx,
  blobs: BlobStore,
  input: {
    ownerId: string;
    filename: string;
    mediaType: string;
    data: Buffer;
    origin: AssetOrigin;
    maxBytes: number;
    devicePairingId?: string;
    promoteAssetId?: string;
    actor?: string;
  },
): Promise<{ asset: AssetRow; outcome: "stored" | "duplicate" | "filled" | "revived" | "promoted" }> {
  const { mediaType } = validateUpload(input.data, input.mediaType, input.filename, input.maxBytes);
  const hash = sha256(input.data);
  const [existing] = await db
    .select()
    .from(resourceAsset)
    .where(and(eq(resourceAsset.ownerId, input.ownerId), eq(resourceAsset.sha256, hash)))
    .limit(1);
  let target: AssetRow | null = null;
  if (input.promoteAssetId) {
    target = await getAsset(db, input.ownerId, input.promoteAssetId);
    if (!target) throw new LibraryError("not_found", "Asset not found.");
  }
  const decision = decideDocumentPlacement(existing ?? null, target);
  if (decision.action === "duplicate") return { asset: decision.asset, outcome: "duplicate" };
  if (decision.action === "refuse") throw new LibraryError(decision.code, decision.message);

  const actor = input.actor ?? (input.origin === "companion" ? `companion:${input.devicePairingId}` : "learner");
  const stored = await blobs.put(input.data);
  try {
    return await db.transaction(async (tx) => {
      switch (decision.action) {
        case "fill_registered": {
          // A locally registered asset whose bytes have now been permitted to arrive.
          const [updated] = await tx
            .update(resourceAsset)
            .set({ storageKey: stored.key, status: "quarantined", localOnly: false, mediaType })
            .where(and(eq(resourceAsset.id, decision.asset.id), isNull(resourceAsset.storageKey)))
            .returning();
          if (!updated) throw new LibraryError("invalid_state", "The item changed while the file was arriving; nothing was stored.");
          return { asset: updated, outcome: "filled" as const };
        }
        case "revive": {
          let asset = await reviveDocument(tx, decision.asset, {
            storageKey: stored.key,
            filename: input.filename,
            mediaType,
            sizeBytes: input.data.byteLength,
            origin: input.origin,
            devicePairingId: input.devicePairingId ?? null,
            actor,
          });
          if (asset.scholarlyVersionId) asset = await confirmDocumentFromWork(tx, input.ownerId, asset.id);
          return { asset, outcome: "revived" as const };
        }
        case "promote": {
          if (decision.fold) await foldDeletedDocument(tx, decision.fold, decision.asset, actor);
          const [updated] = await tx
            .update(resourceAsset)
            .set({
              sha256: hash,
              storageKey: stored.key,
              sizeBytes: input.data.byteLength,
              mediaType,
              status: "quarantined",
              origin: input.origin,
              localOnly: false,
              rejectionReason: null,
            })
            .where(and(eq(resourceAsset.id, decision.asset.id), eq(resourceAsset.status, "linked_remote")))
            .returning();
          if (!updated) throw new LibraryError("invalid_state", "The item changed while the file was arriving; nothing was stored.");
          // The very bytes the owner's browser received from arXiv: notes made there are on this file.
          const sameAsObserved = decision.asset.observedSha256 === hash;
          const anchorsRekeyed = sameAsObserved ? await rekeyAnchors(tx, updated.id, decision.asset.sha256, hash) : 0;
          await tx.insert(auditEvent).values({
            ownerId: input.ownerId,
            actor,
            action: "asset:promote",
            entity: "resource_asset",
            entityId: updated.id,
            details: {
              from: decision.asset.sha256,
              sha256: hash,
              sizeBytes: input.data.byteLength,
              origin: input.origin,
              sameAsObserved,
              anchorsRekeyed,
              folded: decision.fold?.id ?? null,
            },
          });
          return { asset: updated, outcome: "promoted" as const };
        }
        case "store_new": {
          const [asset] = await tx
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
          await tx.insert(auditEvent).values({
            ownerId: input.ownerId,
            actor,
            action: "asset:upload",
            entity: "resource_asset",
            entityId: asset!.id,
            details: { filename: input.filename, sizeBytes: input.data.byteLength, mediaType },
          });
          return { asset: asset!, outcome: "stored" as const };
        }
      }
    });
  } catch (error) {
    await blobs.delete(stored.key).catch(() => undefined);
    throw error;
  }
}

/** Brings a soft-deleted row back with new bytes (see `placeDocumentBytes`). */
async function reviveDocument(
  db: DbOrTx,
  asset: AssetRow,
  input: {
    storageKey: string;
    filename: string;
    mediaType: string;
    sizeBytes: number;
    origin: AssetOrigin;
    devicePairingId: string | null;
    actor: string;
  },
): Promise<AssetRow> {
  const [revived] = await db
    .update(resourceAsset)
    .set({
      storageKey: input.storageKey,
      status: "quarantined",
      deletedAt: null,
      localOnly: false,
      filename: input.filename,
      mediaType: input.mediaType,
      sizeBytes: input.sizeBytes,
      origin: input.origin,
      devicePairingId: input.devicePairingId,
      localPathHint: null,
      candidateMetadata: {},
      confirmedTitle: null,
      confirmedAuthors: null,
      confirmedEdition: null,
      courseIds: [],
      sourceVersionId: null,
      pageCount: null,
      printedLabelsPresent: null,
      rejectionReason: null,
    })
    .where(and(eq(resourceAsset.id, asset.id), isNotNull(resourceAsset.deletedAt)))
    .returning();
  if (!revived) throw new LibraryError("invalid_state", "The item changed while the file was arriving; nothing was stored.");
  const now = new Date();
  await db
    .update(processingPermission)
    .set({ revokedAt: now })
    .where(and(eq(processingPermission.assetId, asset.id), isNull(processingPermission.revokedAt)));
  await db
    .insert(processingPermission)
    .values({ ownerId: asset.ownerId, assetId: asset.id, action: "private_cloud_store", status: "allowed", basis: REVIVE_BASIS });
  // Annotations detached by an earlier version of the delete path find their file again.
  const reattached = await db
    .update(annotation)
    .set({ assetId: asset.id, mappingStatus: "needs_repair", updatedAt: KEEP_UPDATED_AT })
    .where(
      and(
        eq(annotation.ownerId, asset.ownerId),
        isNull(annotation.assetId),
        sql`(${annotation.locator}->>'sourceVersionId' = ${`asset:${asset.sha256.slice(0, 16)}`} or ${annotation.anchor}->>'documentSha256' = ${asset.sha256})`,
      ),
    )
    .returning({ id: annotation.id });
  await db.insert(auditEvent).values({
    ownerId: asset.ownerId,
    actor: input.actor,
    action: "asset:revive",
    entity: "resource_asset",
    entityId: asset.id,
    details: { filename: input.filename, sizeBytes: input.sizeBytes, reattachedAnnotations: reattached.length },
  });
  return revived;
}

/**
 * Folds a soft-deleted row into the linked Document its bytes are now arriving for (same
 * transaction, before the promotion takes the hash): its annotations (and ones an earlier delete
 * path detached) move to the linked Document marked for repair, its reading position moves only
 * when the linked Document has none, and the empty row is removed with its earlier permission
 * decisions (a soft-deleted file's decisions are not carried over, as on revive). Audit `asset:fold`.
 */
async function foldDeletedDocument(tx: DbOrTx, from: AssetRow, into: AssetRow, actor: string): Promise<void> {
  const moved = await tx
    .update(annotation)
    .set({ assetId: into.id, mappingStatus: "needs_repair", updatedAt: KEEP_UPDATED_AT })
    .where(
      and(
        eq(annotation.ownerId, from.ownerId),
        or(
          eq(annotation.assetId, from.id),
          and(
            isNull(annotation.assetId),
            sql`(${annotation.locator}->>'sourceVersionId' = ${`asset:${from.sha256.slice(0, 16)}`} or ${annotation.anchor}->>'documentSha256' = ${from.sha256})`,
          ),
        ),
      ),
    )
    .returning({ id: annotation.id });
  const [intoProgress] = await tx
    .select({ assetId: readingProgress.assetId })
    .from(readingProgress)
    .where(and(eq(readingProgress.ownerId, into.ownerId), eq(readingProgress.assetId, into.id)))
    .limit(1);
  let position: "moved" | "kept" | "none" = intoProgress ? "kept" : "none";
  if (!intoProgress) {
    const carried = await tx
      .update(readingProgress)
      .set({ assetId: into.id })
      .where(and(eq(readingProgress.ownerId, from.ownerId), eq(readingProgress.assetId, from.id)))
      .returning({ assetId: readingProgress.assetId });
    if (carried.length) position = "moved";
  }
  const [gone] = await tx
    .delete(resourceAsset)
    .where(and(eq(resourceAsset.id, from.id), eq(resourceAsset.ownerId, from.ownerId), isNotNull(resourceAsset.deletedAt)))
    .returning({ id: resourceAsset.id });
  if (!gone) throw new LibraryError("invalid_state", "The item changed while the file was arriving; nothing was stored.");
  await tx.insert(auditEvent).values({
    ownerId: into.ownerId,
    actor,
    action: "asset:fold",
    entity: "resource_asset",
    entityId: into.id,
    details: { folded: from.id, filename: from.filename, sha256: from.sha256, annotations: moved.length, position },
  });
}

/**
 * Re-keys the anchors measured on one file of a Document (`fromKey`) to another key of the same
 * Document, when both are known to be the same file. `updated_at` is kept (a system update).
 */
async function rekeyAnchors(db: DbOrTx, assetId: string, fromKey: string, toKey: string): Promise<number> {
  const rows = await db
    .update(annotation)
    .set({ anchor: sql`jsonb_set(${annotation.anchor}, '{documentSha256}', to_jsonb(${toKey}::text))`, updatedAt: KEEP_UPDATED_AT })
    .where(and(eq(annotation.assetId, assetId), sql`${annotation.anchor}->>'documentSha256' = ${fromKey}`))
    .returning({ id: annotation.id });
  return rows.length;
}

/**
 * A paper's Document is described by its work: title and authors come from the work (when it has
 * them; an unidentified paper without a title leaves the file's own) and a quarantined Document is
 * validated at once (the item form refuses to edit it). Returns the row.
 */
export async function confirmDocumentFromWork(db: DbOrTx, ownerId: string, assetId: string): Promise<AssetRow> {
  const [row] = await db
    .select({ title: scholarlyWork.title, authors: scholarlyWork.authors })
    .from(resourceAsset)
    .innerJoin(scholarlyVersion, eq(scholarlyVersion.id, resourceAsset.scholarlyVersionId))
    .innerJoin(scholarlyWork, eq(scholarlyWork.id, scholarlyVersion.workId))
    .where(and(eq(resourceAsset.id, assetId), eq(resourceAsset.ownerId, ownerId)))
    .limit(1);
  if (row) {
    await db
      .update(resourceAsset)
      .set({
        ...(row.title ? { confirmedTitle: row.title } : {}),
        ...(row.authors.length ? { confirmedAuthors: row.authors.map((a) => a.name) } : {}),
        status: sql`case when ${resourceAsset.status} = 'quarantined' then 'validated' else ${resourceAsset.status} end`,
      })
      .where(eq(resourceAsset.id, assetId));
  }
  const [fresh] = await db.select().from(resourceAsset).where(eq(resourceAsset.id, assetId)).limit(1);
  if (!fresh) throw new LibraryError("not_found", "Asset not found.");
  return fresh;
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

/**
 * Owner confirms what the file is and which courses it supports; validated assets may be processed.
 * A registry link (`sourceVersionId`) is changed only when the caller passes one (null removes it).
 * A paper's Document is described by its work, so it is refused here.
 */
export async function confirmMetadata(
  db: DbOrTx,
  ownerId: string,
  assetId: string,
  input: { title: string; authors: string[]; edition?: string; courseIds: string[]; sourceVersionId?: string | null },
): Promise<AssetRow> {
  if (!isUuid(assetId)) throw new LibraryError("not_found", "Asset not found.");
  const [asset] = await db
    .select()
    .from(resourceAsset)
    .where(and(eq(resourceAsset.id, assetId), eq(resourceAsset.ownerId, ownerId), isNull(resourceAsset.deletedAt)))
    .limit(1);
  if (!asset) throw new LibraryError("not_found", "Asset not found.");
  if (asset.scholarlyVersionId || asset.status === "linked_remote")
    throw new LibraryError("invalid_state", "This file belongs to a paper in your library; its details are edited on the paper's page.");
  const nextStatus = asset.status === "quarantined" ? "validated" : asset.status;
  const [updated] = await db
    .update(resourceAsset)
    .set({
      confirmedTitle: input.title,
      confirmedAuthors: input.authors,
      confirmedEdition: input.edition ?? null,
      courseIds: input.courseIds,
      sourceVersionId: input.sourceVersionId === undefined ? asset.sourceVersionId : input.sourceVersionId,
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
  if (action === "private_cloud_store" && status === "allowed" && asset.status === "linked_remote")
    throw new LibraryError("invalid_state", "This paper is read from arxiv.org; keep a private copy from its paper page instead.");
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
      // The learner withdrew storage: the copy and everything derived from it go now. A stored
      // copy of an arXiv version goes back to being read from arxiv.org (same row); a file the
      // companion registered stays on the shelf as a local-only record; a web upload has no other
      // home and is deleted. Annotations always stay attached to their row.
      const arxiv = await arxivVersionOf(db, asset);
      if (arxiv) {
        await revertToLinked(db, blobs, asset, arxiv, "learner");
        return;
      }
      await db.delete(passage).where(eq(passage.assetId, assetId));
      await db.delete(extractedPage).where(eq(extractedPage.assetId, assetId));
      await db.update(annotation).set({ mappingStatus: "needs_repair", updatedAt: KEEP_UPDATED_AT }).where(eq(annotation.assetId, assetId));
      const localOnly = asset.origin === "companion";
      await db
        .update(resourceAsset)
        .set(
          localOnly
            ? { status: "registered_local", localOnly: true, storageKey: null, pageCount: null }
            : { status: "deleted", deletedAt: new Date(), storageKey: null },
        )
        .where(eq(resourceAsset.id, assetId));
      await blobs.delete(asset.storageKey).catch(() => undefined);
    }
  }
}

/** The arXiv id and version of a Document's scholarly version, or null when it has none. */
export async function arxivVersionOf(db: DbOrTx, asset: AssetRow): Promise<{ arxivId: string; arxivVersion: number } | null> {
  if (!asset.scholarlyVersionId) return null;
  const [version] = await db
    .select({ arxivId: scholarlyVersion.arxivId, arxivVersion: scholarlyVersion.arxivVersion })
    .from(scholarlyVersion)
    .where(and(eq(scholarlyVersion.id, asset.scholarlyVersionId), eq(scholarlyVersion.ownerId, asset.ownerId)))
    .limit(1);
  if (!version?.arxivId || !version.arxivVersion) return null;
  return { arxivId: version.arxivId, arxivVersion: version.arxivVersion };
}

/**
 * A stored copy of an arXiv version goes back to `linked_remote` under the same id: the stored
 * bytes and the text derived from them are deleted; annotations, the reading position and the
 * permission record stay. Anchors made on the stored copy take the linked key at once only when
 * the stored bytes are the very bytes the reader last received from arXiv (`observed_sha256`);
 * otherwise they keep the stored file's hash and the reader's drift check decides (accepting it
 * re-keys them). Another row already holding this version's linked key is refused with a notice.
 * The row is locked and re-read first: a copy that changed since the caller read it (removed in
 * another tab, or its bytes replaced) is refused with a notice, and an extraction finishing at the
 * same moment either commits before this (its text is then deleted here) or writes nothing. The
 * blob is deleted after the row no longer refers to it.
 */
export async function revertToLinked(
  db: DbOrTx,
  blobs: BlobStore,
  asset: AssetRow,
  arxiv: { arxivId: string; arxivVersion: number },
  actor: string,
): Promise<AssetRow> {
  const key = linkedDocumentKey(arxiv.arxivId, arxiv.arxivVersion);
  const reverted = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(resourceAsset).where(eq(resourceAsset.id, asset.id)).for("update");
    if (
      !locked ||
      locked.deletedAt !== null ||
      locked.status === "linked_remote" ||
      locked.storageKey !== asset.storageKey ||
      locked.sha256 !== asset.sha256
    )
      throw new LibraryError("invalid_state", COPY_CHANGED);
    const [holder] = await tx
      .select({ id: resourceAsset.id })
      .from(resourceAsset)
      .where(and(eq(resourceAsset.ownerId, asset.ownerId), eq(resourceAsset.sha256, key), ne(resourceAsset.id, asset.id)))
      .limit(1);
    if (holder) throw new LibraryError("invalid_state", LINKED_KEY_TAKEN);
    await tx.delete(passage).where(eq(passage.assetId, asset.id));
    await tx.delete(extractedPage).where(eq(extractedPage.assetId, asset.id));
    const sameAsObserved = locked.observedSha256 !== null && locked.observedSha256 === locked.sha256;
    const anchorsRekeyed = sameAsObserved ? await rekeyAnchors(tx, asset.id, asset.sha256, key) : 0;
    const [row] = await tx
      .update(resourceAsset)
      .set({
        status: "linked_remote",
        origin: "arxiv_link",
        sha256: key,
        storageKey: null,
        sizeBytes: 0,
        mediaType: "application/pdf",
        localOnly: false,
        rejectionReason: null,
      })
      .where(eq(resourceAsset.id, asset.id))
      .returning();
    await tx.insert(auditEvent).values({
      ownerId: asset.ownerId,
      actor,
      action: "asset:remove-copy",
      entity: "resource_asset",
      entityId: asset.id,
      details: { sha256: asset.sha256, arxiv: `${arxiv.arxivId}v${arxiv.arxivVersion}`, sameAsObserved, anchorsRekeyed },
    });
    return row!;
  });
  if (asset.storageKey) await blobs.delete(asset.storageKey).catch(() => undefined);
  return reverted;
}

const LINKED_KEY_TAKEN = "Another file in your library already stands for this arXiv version, so this copy was not removed.";
const COPY_CHANGED = "This file changed since the page was opened, so nothing was removed. The page now shows it as it is.";

export async function listAssets(db: DbOrTx, ownerId: string): Promise<AssetRow[]> {
  return db
    .select()
    .from(resourceAsset)
    .where(and(eq(resourceAsset.ownerId, ownerId), isNull(resourceAsset.deletedAt)))
    .orderBy(desc(resourceAsset.createdAt));
}

/** The owner's files: every non-deleted asset except papers read from arxiv.org (nothing of theirs is stored). */
export async function listStoredAssets(db: DbOrTx, ownerId: string): Promise<AssetRow[]> {
  return db
    .select()
    .from(resourceAsset)
    .where(and(eq(resourceAsset.ownerId, ownerId), isNull(resourceAsset.deletedAt), ne(resourceAsset.status, "linked_remote")))
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
  if (asset.status === "linked_remote") return { queued: false, reason: LINKED_NOT_EXTRACTED };
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
  const payload = IngestAssetPayload.parse({ idempotencyKey, ownerId, assetId });
  // The status change and the job are one transaction: a failed enqueue leaves the item as it was.
  try {
    await db.transaction(async (tx) => {
      await tx.update(resourceAsset).set({ status: "processing" }).where(eq(resourceAsset.id, assetId));
      const result = await enqueue(tx, { queue: QUEUES.ingestAsset, kind: "ingest-asset", payload, singletonKey: asset.sha256 });
      if (!result.created) throw new NotQueued();
    });
  } catch (error) {
    if (error instanceof NotQueued) return { queued: false, reason: "A job for this file already exists; see the jobs page." };
    throw error;
  }
  return { queued: true };
}

class NotQueued extends Error {}

const LINKED_NOT_EXTRACTED = "This paper is read from arxiv.org; nothing is stored here to extract.";

/**
 * Deletes originals, extracted text and passages; keeps the audit trail. Annotations stay attached
 * to the soft-deleted row and are marked for repair (readers check `deleted_at`), so re-adding the
 * same file brings them back. A stored copy of an arXiv version goes back to being read from
 * arxiv.org instead; a paper read from arxiv.org has nothing to delete.
 */
export async function deleteAsset(db: DbOrTx, blobs: BlobStore, ownerId: string, assetId: string): Promise<void> {
  const asset = await getAsset(db, ownerId, assetId);
  if (!asset) return;
  if (asset.status === "linked_remote")
    throw new LibraryError("invalid_state", "A paper read from arxiv.org has no stored file to delete.");
  const arxiv = await arxivVersionOf(db, asset);
  if (arxiv) {
    await revertToLinked(db, blobs, asset, arxiv, "learner");
    return;
  }
  await db.transaction(async (tx) => {
    await tx.delete(passage).where(eq(passage.assetId, assetId));
    await tx.delete(extractedPage).where(eq(extractedPage.assetId, assetId));
    await tx.update(annotation).set({ mappingStatus: "needs_repair", updatedAt: KEEP_UPDATED_AT }).where(eq(annotation.assetId, assetId));
    await tx.update(resourceAsset).set({ status: "deleted", deletedAt: new Date(), storageKey: null }).where(eq(resourceAsset.id, assetId));
    await tx.insert(auditEvent).values({
      ownerId,
      actor: "learner",
      action: "asset:delete",
      entity: "resource_asset",
      entityId: assetId,
      details: { filename: asset.filename },
    });
  });
  if (asset.storageKey) await blobs.delete(asset.storageKey).catch(() => undefined);
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
  return [...new Set(question.match(/[\p{L}\p{N}]+/gu) ?? [])].slice(0, 96).join(" or ");
}

export async function permittedPassagesForCourse(
  db: DbOrTx,
  ownerId: string,
  courseId: string,
  query: string,
  limit = 6,
  sourceVersionIds?: readonly string[],
) {
  const assets = await db
    .select()
    .from(resourceAsset)
    .where(
      and(
        eq(resourceAsset.ownerId, ownerId),
        eq(resourceAsset.status, "processed"),
        isNull(resourceAsset.deletedAt),
        eq(resourceAsset.localOnly, false),
        sql`${resourceAsset.courseIds} ? ${courseId}`,
      ),
    );
  const allowed: AssetRow[] = [];
  for (const a of assets) {
    if (sourceVersionIds && (!a.sourceVersionId || !sourceVersionIds.includes(a.sourceVersionId))) continue;
    if (await isAllowed(db, ownerId, a.id, "external_ai")) allowed.push(a);
  }
  if (allowed.length === 0 || !query.trim()) return [];
  const words = anyOfTheWords(query);
  if (!words) return [];
  const boundedLimit = Math.min(12, Math.max(1, Math.trunc(limit)));
  const rows = await db.execute(sql`
    select p.id, p.asset_id, p.text, p.heading, e.physical_index, e.printed_label,
           ts_rank(p.tsv, websearch_to_tsquery('english', ${words})) as rank
    from passage p join extracted_page e on e.id = p.page_id
    where p.asset_id in (${sql.join(
      allowed.map((a) => sql`${a.id}::uuid`),
      sql`, `,
    )}) and p.tsv @@ websearch_to_tsquery('english', ${words})
    order by rank desc, p.id asc limit ${boundedLimit}`);
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

/** Revalidate the exact cached passages immediately before sending a prompt. A permission
 * row alone is insufficient: deleting an asset or withdrawing storage removes its passages
 * without necessarily changing the separate external-AI permission. One query observes both
 * availability and the latest effective permission at the same database snapshot. */
export async function sourcePassagesStillPermitted(
  db: DbOrTx,
  ownerId: string,
  courseId: string,
  refs: readonly { assetId?: string; passageId?: string; sourceVersionId?: string | null }[],
  sourceVersionIds?: readonly string[],
): Promise<boolean> {
  const requested = refs.filter((ref) => ref.assetId || ref.passageId);
  if (!requested.length) return true;
  if (requested.some((ref) => !ref.assetId || !ref.passageId || !isUuid(ref.assetId) || !isUuid(ref.passageId))) return false;
  if (sourceVersionIds?.length === 0) return false;
  const rows = await db
    .select({ passageId: passage.id, assetId: passage.assetId, sourceVersionId: resourceAsset.sourceVersionId })
    .from(passage)
    .innerJoin(resourceAsset, eq(resourceAsset.id, passage.assetId))
    .where(
      and(
        inArray(
          passage.id,
          requested.map((ref) => ref.passageId!),
        ),
        eq(resourceAsset.ownerId, ownerId),
        sql`${resourceAsset.courseIds} ? ${courseId}`,
        eq(resourceAsset.status, "processed"),
        isNull(resourceAsset.deletedAt),
        eq(resourceAsset.localOnly, false),
        sourceVersionIds ? inArray(resourceAsset.sourceVersionId, [...sourceVersionIds]) : undefined,
        sql`(select ${processingPermission.status} from ${processingPermission}
          where ${processingPermission.assetId} = ${resourceAsset.id}
            and ${processingPermission.ownerId} = ${ownerId}
            and ${processingPermission.action} = 'external_ai'
            and ${processingPermission.revokedAt} is null
          order by ${processingPermission.recordedAt} desc limit 1) = 'allowed'`,
      ),
    );
  return requested.every((ref) =>
    rows.some(
      (row) =>
        row.passageId === ref.passageId &&
        row.assetId === ref.assetId &&
        (ref.sourceVersionId === undefined || ref.sourceVersionId === row.sourceVersionId),
    ),
  );
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

/** The engine an anchor's rects were measured with; the server fills it, never the client. */
export const ANNOTATION_ENGINE = "pdfjs-dist@6.4.299";
/** Annotation colours are colour-role names of the design system. */
export const ANNOTATION_COLORS = ["brass", "moss", "rust", "slate", "neutral"] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];
export const MAX_ANNOTATION_NOTE_CHARS = 20_000;
const MAX_SELECTED_TEXT_CHARS = 2000;
/**
 * System updates of an annotation (repair flags, re-attachment) keep its `updated_at`, so an edit
 * the owner has open does not report a conflict for a change it did not make.
 */
const KEEP_UPDATED_AT = sql`"annotation"."updated_at"`;

export async function getReadingProgress(db: DbOrTx, ownerId: string, assetId: string): Promise<number> {
  const rows = await db
    .select({ physicalIndex: readingProgress.physicalIndex })
    .from(readingProgress)
    .where(and(eq(readingProgress.ownerId, ownerId), eq(readingProgress.assetId, assetId)))
    .limit(1);
  return rows[0]?.physicalIndex ?? 0;
}

export interface ReadingPositionState {
  physicalIndex: number;
  position: ReadingPosition | null;
  effectiveAt: Date | null;
  lastOpenedAt: Date | null;
  updatedAt: Date;
}

/** Where the owner was in a Document (page and position inside it), or null when never saved or opened. */
export async function getReadingPosition(db: DbOrTx, ownerId: string, assetId: string): Promise<ReadingPositionState | null> {
  if (!isUuid(assetId)) return null;
  const [row] = await db
    .select({
      physicalIndex: readingProgress.physicalIndex,
      position: readingProgress.position,
      effectiveAt: readingProgress.effectiveAt,
      lastOpenedAt: readingProgress.lastOpenedAt,
      updatedAt: readingProgress.updatedAt,
    })
    .from(readingProgress)
    .where(and(eq(readingProgress.ownerId, ownerId), eq(readingProgress.assetId, assetId)))
    .limit(1);
  return row ?? null;
}

/**
 * The reading-position rule (contract §3), the one writer of `physical_index` and `position`.
 * Saves are ordered on the database server's clock: the reader sends how long ago it last moved
 * (`changedAgoMs`), the stored `effective_at` is `now() − clamp(changedAgoMs, 0, 10 min)`, and a
 * save replaces the stored position only when its effective time is strictly later. A device's
 * own clock never takes part, so devices that disagree about the time cannot freeze a position.
 */
export async function saveReadingPosition(
  db: DbOrTx,
  ownerId: string,
  assetId: string,
  save: unknown,
): Promise<{ accepted: boolean; position: ReadingPosition; effectiveAt: Date | null }> {
  const parsed = PositionSaveSchema.safeParse(save);
  if (!parsed.success) throw new LibraryError("invalid_state", "The reading position is not valid.");
  const asset = await getAsset(db, ownerId, assetId);
  if (!asset) throw new LibraryError("not_found", "Asset not found.");
  const position = clampPosition(parsed.data.position, asset.pageCount);
  const ageMs = Math.min(Math.max(parsed.data.changedAgoMs, 0), MAX_CHANGED_AGO_MS);
  const result = await db.execute(sql`
    insert into reading_progress (owner_id, asset_id, physical_index, position, effective_at, updated_at)
    values (${ownerId}, ${asset.id}, ${position.pageIndex}, ${JSON.stringify(position)}::jsonb,
            now() - make_interval(secs => ${ageMs / 1000}::double precision), now())
    on conflict (owner_id, asset_id) do update
      set physical_index = excluded.physical_index,
          position = excluded.position,
          effective_at = excluded.effective_at,
          updated_at = excluded.updated_at
      where reading_progress.effective_at is null or excluded.effective_at > reading_progress.effective_at
    returning effective_at`);
  const accepted = result.rows.length > 0;
  if (accepted) {
    const effectiveAt = (result.rows[0] as { effective_at: Date | string }).effective_at;
    return { accepted, position, effectiveAt: new Date(effectiveAt) };
  }
  const stored = await getReadingPosition(db, ownerId, asset.id);
  return { accepted, position: stored?.position ?? position, effectiveAt: stored?.effectiveAt ?? null };
}

/**
 * The Text view's page save: the same rule as `saveReadingPosition` with the position inside the
 * page cleared (top-left of the page, the remembered zoom kept).
 */
export async function saveReadingProgress(db: DbOrTx, ownerId: string, assetId: string, physicalIndex: number): Promise<void> {
  if (!(await getAsset(db, ownerId, assetId))) throw new LibraryError("not_found", "Asset not found.");
  const stored = await getReadingPosition(db, ownerId, assetId);
  await saveReadingPosition(db, ownerId, assetId, {
    position: { pageIndex: physicalIndex, top: 0, left: 0, zoom: stored?.position?.zoom ?? 1 },
    changedAgoMs: 0,
  });
}

/** Records that the owner opened a Document (for *Continue reading*); the position is not touched. */
export async function markDocumentOpened(db: DbOrTx, ownerId: string, assetId: string): Promise<void> {
  const asset = await getAsset(db, ownerId, assetId);
  if (!asset) throw new LibraryError("not_found", "Asset not found.");
  await db
    .insert(readingProgress)
    .values({ ownerId, assetId: asset.id, physicalIndex: 0, lastOpenedAt: new Date() })
    .onConflictDoUpdate({ target: [readingProgress.ownerId, readingProgress.assetId], set: { lastOpenedAt: new Date() } });
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
  kind: AnnotationKind;
  color: string | null;
  quoteMatched: boolean | null;
  updatedAt: Date;
  /** The paper the Document belongs to, when it is a paper's file. */
  workId: string | null;
  workTitle: string | null;
  versionLabel: string | null;
  /** The Document was deleted (the note stays, marked for repair). */
  documentDeleted: boolean;
}

export interface ReadingNotesQuery {
  /** Full-text search over the note and the selected text. */
  query?: string;
  kind?: AnnotationKind;
  workId?: string;
  collectionId?: string;
  /** An OpenAlex field id among the subjects of the paper the Document belongs to (as OpenAlex classified it). */
  subject?: string;
  limit?: number;
  offset?: number;
}

const READING_NOTE_KINDS: readonly AnnotationKind[] = ["note", "highlight", "bookmark"];

/**
 * Every annotation (notes, highlights, bookmarks), newest first, searched and filtered in SQL: by
 * kind, by paper, by shelf or trail, by the OpenAlex field of the Document's paper. An invalid id,
 * kind or field matches nothing. `nextOffset` is set when more follow.
 */
export async function readingNotesPage(
  db: DbOrTx,
  ownerId: string,
  filters: ReadingNotesQuery = {},
): Promise<{ notes: ReadingNote[]; nextOffset: number | null }> {
  const none = { notes: [], nextOffset: null };
  const limit = Math.min(Math.max(Math.trunc(filters.limit ?? 50), 1), 200);
  const offset = Math.max(Math.trunc(filters.offset ?? 0), 0);
  const conditions: SQL[] = [eq(annotation.ownerId, ownerId)];
  const q = filters.query?.trim();
  if (q) conditions.push(sql`${annotation.tsv} @@ websearch_to_tsquery('english', ${q.slice(0, 300)})`);
  if (filters.kind !== undefined) {
    if (!READING_NOTE_KINDS.includes(filters.kind)) return none;
    conditions.push(eq(annotation.kind, filters.kind));
  }
  if (filters.workId !== undefined) {
    if (!isUuid(filters.workId)) return none;
    conditions.push(eq(scholarlyVersion.workId, filters.workId));
  }
  if (filters.collectionId !== undefined) {
    if (!isUuid(filters.collectionId)) return none;
    conditions.push(
      inArray(
        scholarlyVersion.workId,
        db
          .select({ workId: libraryCollectionItem.workId })
          .from(libraryCollectionItem)
          .where(and(eq(libraryCollectionItem.collectionId, filters.collectionId), eq(libraryCollectionItem.ownerId, ownerId))),
      ),
    );
  }
  if (filters.subject !== undefined) {
    if (!/^\d{1,6}$/.test(filters.subject)) return none;
    conditions.push(sql`${scholarlyWork.subjects} @> ${JSON.stringify([{ id: filters.subject, level: "field" }])}::jsonb`);
  }
  const rows = await db
    .select({
      annotation,
      title: resourceAsset.confirmedTitle,
      filename: resourceAsset.filename,
      deletedAt: resourceAsset.deletedAt,
      versionLabel: scholarlyVersion.label,
      workId: scholarlyWork.id,
      workTitle: scholarlyWork.title,
    })
    .from(annotation)
    .leftJoin(resourceAsset, and(eq(annotation.assetId, resourceAsset.id), eq(resourceAsset.ownerId, ownerId)))
    .leftJoin(scholarlyVersion, eq(resourceAsset.scholarlyVersionId, scholarlyVersion.id))
    .leftJoin(scholarlyWork, eq(scholarlyVersion.workId, scholarlyWork.id))
    .where(and(...conditions))
    .orderBy(desc(annotation.updatedAt), desc(annotation.id))
    .limit(limit + 1)
    .offset(offset);
  const notes = rows.slice(0, limit).map((r) => ({
    id: r.annotation.id,
    assetId: r.annotation.assetId,
    item: r.workTitle ?? r.title ?? r.filename ?? "(item removed)",
    note: r.annotation.noteMarkdown,
    selectedText: r.annotation.selectedText,
    page: r.annotation.anchor
      ? r.annotation.anchor.pageIndex + 1
      : r.annotation.locator.kind === "pdf"
        ? r.annotation.locator.physicalPageIndex + 1
        : null,
    createdAt: r.annotation.createdAt,
    mappingStatus: r.annotation.mappingStatus,
    kind: r.annotation.kind,
    color: r.annotation.color,
    quoteMatched: r.annotation.quoteMatched,
    updatedAt: r.annotation.updatedAt,
    workId: r.workId,
    workTitle: r.workTitle,
    versionLabel: r.versionLabel,
    documentDeleted: Boolean(r.deletedAt),
  }));
  return { notes, nextOffset: rows.length > limit ? offset + limit : null };
}

/**
 * The notebook's reading notes (highlights, page and area notes, bookmarks), newest first: a search
 * string (the earlier form) or the full filter set of `readingNotesPage`, whose first page this is.
 */
export async function listReadingNotes(
  db: DbOrTx,
  ownerId: string,
  queryOrFilters?: string | ReadingNotesQuery,
  limit = 50,
): Promise<ReadingNote[]> {
  const filters: ReadingNotesQuery =
    typeof queryOrFilters === "string" || queryOrFilters === undefined ? { query: queryOrFilters } : queryOrFilters;
  return (await readingNotesPage(db, ownerId, { ...filters, limit: filters.limit ?? limit })).notes;
}

export async function listAnnotations(db: DbOrTx, ownerId: string, assetId: string): Promise<AnnotationRow[]> {
  return db
    .select()
    .from(annotation)
    .where(and(eq(annotation.ownerId, ownerId), eq(annotation.assetId, assetId)))
    .orderBy(asc(annotation.createdAt));
}

/** Whether page `index` exists on this Document as far as the server can tell. */
function pageKnownToExist(asset: AssetRow, index: number, extracted: boolean): boolean {
  if (extracted) return true;
  if (asset.pageCount != null) return index < asset.pageCount;
  // A paper read from arxiv.org whose page count the reader has not reported yet.
  return asset.status === "linked_remote";
}

/**
 * An annotation stores a locator (physical page, printed label, passage) rather than a row
 * reference, so it survives re-ingestion; `reconcileAnnotations` re-checks the mapping and
 * flags, never moves, anything that no longer resolves. Highlights, area notes and bookmarks also
 * carry an anchor: rects in PDF user space with the owner's quote; the server fills the engine and
 * the Document key (`documentSha256`). The quote never decides whether an annotation is drawable;
 * it only sets `quote_matched` when the extracted page can be compared.
 */
export async function createAnnotation(
  db: DbOrTx,
  ownerId: string,
  input: {
    assetId: string;
    physicalIndex: number;
    selectedText?: string;
    noteMarkdown?: string;
    passageId?: string;
    kind?: AnnotationKind;
    color?: string | null;
    /** What the reader sends (core `AnchorInputSchema`); validated and completed here. */
    anchor?: unknown;
    /** SHA-256 of the bytes the reader measured the anchor on (a linked Document; see `anchorDocumentKey`). */
    loadedSha256?: string;
  },
): Promise<AnnotationRow> {
  const asset = await getAsset(db, ownerId, input.assetId);
  if (!asset) throw new LibraryError("not_found", "Asset not found.");
  const kind = input.kind ?? "note";
  if (!READING_NOTE_KINDS.includes(kind)) throw new LibraryError("invalid_state", "Unknown annotation kind.");
  const color = parseColor(input.color);
  let anchor: AnnotationRow["anchor"] = null;
  if (input.anchor !== undefined && input.anchor !== null) {
    try {
      anchor = buildAnchor(input.anchor, { engine: ANNOTATION_ENGINE, documentSha256: anchorDocumentKey(asset, input.loadedSha256) });
    } catch {
      throw new LibraryError("invalid_state", "The annotation's place on the page is not valid.");
    }
    if (anchor.pageIndex !== input.physicalIndex)
      throw new LibraryError("invalid_state", "The annotation's place on the page is not valid.");
  }
  const note = (input.noteMarkdown ?? "").slice(0, MAX_ANNOTATION_NOTE_CHARS);
  if (kind === "note" && !note.trim()) throw new LibraryError("invalid_state", "Write a note before saving.");
  if (kind === "highlight" && !anchor?.rects.length)
    throw new LibraryError("invalid_state", "A highlight needs the marked area of the page.");
  if (!Number.isInteger(input.physicalIndex) || input.physicalIndex < 0)
    throw new LibraryError("invalid_state", "The annotation's place on the page is not valid.");
  const page = await getPage(db, asset.id, input.physicalIndex);
  const quote = anchor?.quote ?? input.selectedText?.trim() ?? null;
  const loc: Locator = {
    kind: "pdf",
    sourceVersionId: asset.sourceVersionId ?? `asset:${asset.sha256.slice(0, 16)}`,
    physicalPageIndex: input.physicalIndex,
    printedPageLabel: page?.printedLabel ?? undefined,
    passageId: input.passageId,
  };
  const anchored = Boolean(anchor) || kind === "bookmark";
  // An anchor measured on bytes the server has not accepted for this Document (anchorDocumentKey):
  // the recorded page count belongs to another file, so the reader's drift check decides instead.
  const onOtherBytes = anchor !== null && anchor.documentSha256 !== asset.sha256;
  const resolved = anchored ? onOtherBytes || pageKnownToExist(asset, input.physicalIndex, Boolean(page)) : Boolean(page);
  const [row] = await db
    .insert(annotation)
    .values({
      ownerId,
      assetId: asset.id,
      sourceVersionId: asset.sourceVersionId ?? null,
      locator: loc,
      selectedText: quote ? quote.slice(0, MAX_SELECTED_TEXT_CHARS) : null,
      noteMarkdown: note,
      mappingStatus: resolved ? "resolved" : "needs_repair",
      kind,
      color,
      anchor,
      quoteMatched: anchor?.quote && page ? quoteFoundIn(anchor.quote, page.text) : null,
      updatedAt: new Date(),
    })
    .returning();
  return row!;
}

const LOADED_SHA256 = /^[0-9a-f]{64}$/;

/**
 * The file an anchor's rects were measured on (contract §3: `documentSha256` names that file). For
 * a linked Document it is the Document key (`arxiv:{id}v{n}`, standing for the file the owner's
 * browser last had accepted, `observed_sha256`), except when the reader reports that it measured on
 * other bytes: arXiv's file changed and the owner has not kept the notes on it yet, or no file has
 * been recorded yet (the report failed or has not landed). The anchor then names the bytes it was
 * made on, and the drift check decides about it like any other. A stored Document's anchors always
 * name its own hash.
 */
function anchorDocumentKey(asset: AssetRow, loadedSha256: string | undefined): string {
  if (
    asset.status === "linked_remote" &&
    loadedSha256 !== undefined &&
    LOADED_SHA256.test(loadedSha256) &&
    loadedSha256 !== asset.observedSha256
  )
    return loadedSha256;
  return asset.sha256;
}

function parseColor(value: string | null | undefined): AnnotationColor | null {
  if (value === undefined || value === null || value === "") return null;
  if (!(ANNOTATION_COLORS as readonly string[]).includes(value)) throw new LibraryError("invalid_state", "Unknown highlight colour.");
  return value as AnnotationColor;
}

/**
 * Edits an annotation's note or colour. The edit carries the `updatedAt` the editor last saw; if
 * the row changed since (another device saved first), nothing is written and an
 * `AnnotationConflictError` carries the current row so both texts can be shown.
 */
export async function updateAnnotation(
  db: DbOrTx,
  ownerId: string,
  id: string,
  input: { noteMarkdown?: string; color?: string | null; expectedUpdatedAt: Date | string },
): Promise<AnnotationRow> {
  if (!isUuid(id)) throw new LibraryError("not_found", "Annotation not found.");
  const expected = new Date(input.expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) throw new LibraryError("invalid_state", "The edit does not say which version it changes.");
  const [current] = await db
    .select()
    .from(annotation)
    .where(and(eq(annotation.id, id), eq(annotation.ownerId, ownerId)))
    .limit(1);
  if (!current) throw new LibraryError("not_found", "Annotation not found.");
  const patch: Partial<typeof annotation.$inferInsert> = { updatedAt: new Date() };
  if (input.noteMarkdown !== undefined) {
    const note = input.noteMarkdown.slice(0, MAX_ANNOTATION_NOTE_CHARS);
    if (current.kind === "note" && !note.trim()) throw new LibraryError("invalid_state", "Write a note before saving.");
    patch.noteMarkdown = note;
  }
  if (input.color !== undefined) patch.color = parseColor(input.color);
  const [updated] = await db
    .update(annotation)
    .set(patch)
    .where(
      and(
        eq(annotation.id, id),
        eq(annotation.ownerId, ownerId),
        sql`date_trunc('milliseconds', ${annotation.updatedAt}) = date_trunc('milliseconds', ${expected.toISOString()}::timestamptz)`,
      ),
    )
    .returning();
  if (updated) return updated;
  const [latest] = await db.select().from(annotation).where(eq(annotation.id, id)).limit(1);
  throw new AnnotationConflictError(latest ?? current);
}

/** Deletes the owner's annotation; false when no such annotation of theirs exists. */
export async function deleteAnnotation(db: DbOrTx, ownerId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const deleted = await db
    .delete(annotation)
    .where(and(eq(annotation.id, id), eq(annotation.ownerId, ownerId)))
    .returning({ id: annotation.id });
  return deleted.length > 0;
}

/** The page geometry of a Document's file as the extraction measured it. */
export interface PageGeometry {
  /** [width, height] of every page in PDF user space, by index (pdf.js `page.view`, unrotated). */
  pageViews: readonly (readonly [number, number])[];
  /** The page count recorded for the Document before this extraction, when known. */
  previousPageCount?: number | null;
}

/**
 * Re-checks every annotation of a Document after a (re-)extraction. An annotation with rects is
 * drawable whenever its page exists on the same file (`documentSha256` equals the Document's
 * key), whatever its quote says; the quote only sets `quote_matched`. Rects measured on another
 * file of this Document (arXiv's file before a promotion, or an earlier stored copy) are carried
 * over only when the extraction's geometry passes the drift check for every annotation measured on
 * that file (page count unchanged when known, each annotated page the same size); they then take
 * this file's key. Without geometry, or when it differs, they need repair. An annotation without
 * rects (an older note) resolves when its page exists and its selected text is found there.
 */
export async function reconcileAnnotations(
  db: DbOrTx,
  ownerId: string,
  assetId: string,
  geometry?: PageGeometry,
): Promise<{ resolved: number; needsRepair: number }> {
  const asset = await getAsset(db, ownerId, assetId);
  if (!asset) return { resolved: 0, needsRepair: 0 };
  const rows = await listAnnotations(db, ownerId, assetId);
  const carried = new Set<string>();
  if (geometry) {
    const otherFiles = new Map<string, AnnotationRow[]>();
    for (const a of rows) {
      if (!a.anchor || (a.anchor.rects as AnchorRect[]).length === 0 || a.anchor.documentSha256 === asset.sha256) continue;
      otherFiles.set(a.anchor.documentSha256, [...(otherFiles.get(a.anchor.documentSha256) ?? []), a]);
    }
    for (const [key, group] of otherFiles) {
      const drift = checkDrift({
        anchors: group.map((a) => ({ pageIndex: a.anchor!.pageIndex, pageView: a.anchor!.pageView })),
        pageCount: geometry.pageViews.length,
        pageViews: geometry.pageViews,
        previousPageCount: geometry.previousPageCount,
      });
      if (!drift.geometryMatches) continue;
      await rekeyAnchors(db, asset.id, key, asset.sha256);
      for (const a of group) carried.add(a.id);
    }
  }
  let resolved = 0;
  let needsRepair = 0;
  for (const a of rows) {
    const index = a.anchor ? a.anchor.pageIndex : a.locator.kind === "pdf" ? a.locator.physicalPageIndex : null;
    if (index === null) continue;
    const page = await getPage(db, assetId, index);
    let ok: boolean;
    let quoteMatched: boolean | null = a.quoteMatched;
    if (a.anchor && (a.anchor.rects as AnchorRect[]).length > 0) {
      const sameFile = a.anchor.documentSha256 === asset.sha256 || carried.has(a.id);
      ok = sameFile && pageKnownToExist(asset, index, Boolean(page));
      quoteMatched = a.anchor.quote && page ? quoteFoundIn(a.anchor.quote, page.text) : null;
    } else if (a.kind === "bookmark") {
      ok = pageKnownToExist(asset, index, Boolean(page));
    } else {
      ok =
        Boolean(page) &&
        (!a.selectedText || squash(page!.text).includes(squash(a.selectedText)) || quoteFoundIn(a.selectedText, page!.text));
    }
    await db
      .update(annotation)
      .set({ mappingStatus: ok ? "resolved" : "needs_repair", quoteMatched, updatedAt: KEEP_UPDATED_AT })
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
