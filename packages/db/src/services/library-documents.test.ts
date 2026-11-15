import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type BlobStore, FsBlobStore, PgBlobStore } from "../blob";
import { createDb } from "../client";
import { stopBoss } from "../queue";
import { user } from "../schema/auth";
import { annotation, extractedPage, processingPermission, readingProgress, resourceAsset } from "../schema/library";
import { auditEvent, jobRecord } from "../schema/operations";
import { scholarlyIdentifier, scholarlyVersion, scholarlyWork } from "../schema/scholarly";
import type { ScholarlyClient } from "../scholarly/client";
import {
  type AssetRow,
  confirmMetadata,
  createAnnotation,
  decideDocumentPlacement,
  deleteAsset,
  FILE_IN_LIBRARY_AS_OTHER_ITEM,
  getAsset,
  getPermissions,
  getReadingPosition,
  LibraryError,
  listAssets,
  listStoredAssets,
  placeDocumentBytes,
  REVIVE_BASIS,
  receiveUpload,
  reconcileAnnotations,
  registerLocalAsset,
  requestIngestion,
  saveReadingProgress,
  setPermission,
  sha256,
} from "./library";
import {
  acceptNewFile,
  attachUploadToWork,
  createWorkFromUpload,
  keepPrivateCopy,
  openArxivVersion,
  recordObservedHash,
  requestPrivateCopy,
} from "./scholarly-works";

/**
 * The Document transition table (contract §3): one routine decides before any bytes are written,
 * a database failure after the write deletes the blob again, linked arXiv Documents are promoted in
 * place and revert in place, soft-deleted rows revive with the stated permission and metadata
 * rules, the companion never rewrites a paper's file, and the attach rules adopt, reuse or refuse.
 * Each row runs on both blob drivers.
 */
const OWNER = "documents-test-owner";
const OTHER = "documents-test-other";
let handle: ReturnType<typeof createDb>;
let dataRoot: string;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 4 });
  dataRoot = mkdtempSync(join(tmpdir(), "corniversity-documents-"));
  await handle.db
    .insert(user)
    .values([
      { id: OWNER, name: "Documents Test", email: "documents-test@example.test" },
      { id: OTHER, name: "Documents Other", email: "documents-other@example.test" },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await stopBoss();
  await handle.close();
  rmSync(dataRoot, { recursive: true, force: true });
});

function pdf(label: string): Buffer {
  return Buffer.from(`%PDF-1.4\n% ${label} ${randomUUID()}\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n`, "latin1");
}

/** A work with an arXiv identifier and one version (licence as given), created directly. */
async function arxivWork(
  ownerId: string,
  arxivId: string,
  version: number,
  licence: string | null = "http://creativecommons.org/licenses/by/4.0/",
) {
  const [work] = await handle.db
    .insert(scholarlyWork)
    .values({ ownerId, title: `Paper ${arxivId}`, savedAt: new Date() })
    .returning();
  await handle.db.insert(scholarlyIdentifier).values({ ownerId, workId: work!.id, scheme: "arxiv", value: arxivId, source: "fixture" });
  const [v] = await handle.db
    .insert(scholarlyVersion)
    .values({
      ownerId,
      workId: work!.id,
      kind: "preprint",
      label: `arXiv v${version}`,
      arxivId,
      arxivVersion: version,
      licence,
      licenceSource: licence ? "arxiv-oai" : null,
      licenceRetrievedAt: licence ? new Date("2026-11-15T00:00:00Z") : null,
      source: "fixture",
    })
    .returning();
  return { work: work!, version: v! };
}

let arxivCounter = 0;
function nextArxivId(): string {
  arxivCounter += 1;
  return `2501.${String(10000 + arxivCounter).padStart(5, "0")}`;
}

for (const driver of ["fs", "pg"] as const) {
  describe(`Document transitions (${driver} blobs)`, () => {
    let blobs: BlobStore;
    beforeAll(() => {
      blobs = driver === "fs" ? new FsBlobStore(join(dataRoot, driver)) : new PgBlobStore(handle.db);
    });

    it("— → open an arXiv version: a linked Document, reused on the next open and under concurrency", async () => {
      const id = nextArxivId();
      const { work } = await arxivWork(OWNER, id, 1);
      const [a, b] = await Promise.all([
        openArxivVersion(handle.db, OWNER, work.id, id, 1),
        openArxivVersion(handle.db, OWNER, work.id, id, 1),
      ]);
      expect(a.id).toBe(b.id);
      expect(a.status).toBe("linked_remote");
      expect(a.sha256).toBe(`arxiv:${id}v1`);
      expect(a.storageKey).toBeNull();
      expect(a.localOnly).toBe(false);
      expect((await openArxivVersion(handle.db, OWNER, work.id, id, 1)).id).toBe(a.id);
      // Linking records no permissions.
      expect(Object.values(await getPermissions(handle.db, OWNER, a.id)).every((p) => p.status === "unknown")).toBe(true);
      // The Files list never shows it; the full listing does.
      expect((await listStoredAssets(handle.db, OWNER)).some((x) => x.id === a.id)).toBe(false);
      expect((await listAssets(handle.db, OWNER)).some((x) => x.id === a.id)).toBe(true);
    });

    it("linked_remote → the owner uploads a copy for that version: the same row is promoted in place", async () => {
      const id = nextArxivId();
      const { work, version } = await arxivWork(OWNER, id, 2);
      const linked = await openArxivVersion(handle.db, OWNER, work.id, id, 2);
      await createAnnotation(handle.db, OWNER, { assetId: linked.id, physicalIndex: 0, kind: "bookmark" });
      await saveReadingProgress(handle.db, OWNER, linked.id, 3);
      const bytes = pdf("owner copy");
      const result = await attachUploadToWork(handle.db, blobs, {
        ownerId: OWNER,
        workId: work.id,
        versionId: version.id,
        filename: "copy.pdf",
        mediaType: "application/pdf",
        data: bytes,
        maxBytes: 1_000_000,
      });
      expect(result.outcome).toBe("promoted");
      expect(result.asset.id).toBe(linked.id);
      expect(result.asset.sha256).toBe(sha256(bytes));
      expect(result.asset.status).toBe("validated");
      expect(result.asset.origin).toBe("scholarly_upload");
      expect(await blobs.exists(result.asset.storageKey!)).toBe(true);
      const notes = await handle.db.select().from(annotation).where(eq(annotation.assetId, linked.id));
      expect(notes).toHaveLength(1);
      const [progress] = await handle.db.select().from(readingProgress).where(eq(readingProgress.assetId, linked.id));
      expect(progress?.physicalIndex).toBe(3);
    });

    it("stored arXiv-version Document → withdraw private storage: the same row goes back to linked_remote", async () => {
      const id = nextArxivId();
      const { work, version } = await arxivWork(OWNER, id, 1);
      const linked = await openArxivVersion(handle.db, OWNER, work.id, id, 1);
      const promoted = (
        await attachUploadToWork(handle.db, blobs, {
          ownerId: OWNER,
          workId: work.id,
          versionId: version.id,
          filename: "copy.pdf",
          mediaType: "application/pdf",
          data: pdf("withdraw"),
          maxBytes: 1_000_000,
        })
      ).asset;
      await handle.db.insert(extractedPage).values({
        assetId: promoted.id,
        physicalIndex: 0,
        text: "derived text",
        charCount: 12,
        quality: { scannedSuspected: false, lowText: true, invisibleText: 0, imageCoverage: 0 },
      });
      const note = await createAnnotation(handle.db, OWNER, { assetId: promoted.id, physicalIndex: 0, noteMarkdown: "keep me" });
      await setPermission(handle.db, OWNER, promoted.id, "external_ai", "allowed", "my decision");
      await setPermission(handle.db, OWNER, promoted.id, "private_cloud_store", "denied", "changed my mind", blobs);
      const after = (await getAsset(handle.db, OWNER, promoted.id))!;
      expect(after.id).toBe(linked.id);
      expect(after.status).toBe("linked_remote");
      expect(after.sha256).toBe(`arxiv:${id}v1`);
      expect(after.storageKey).toBeNull();
      expect(await blobs.exists(promoted.storageKey!)).toBe(false);
      expect(await handle.db.select().from(extractedPage).where(eq(extractedPage.assetId, promoted.id))).toEqual([]);
      const [kept] = await handle.db.select().from(annotation).where(eq(annotation.id, note.id));
      expect(kept?.assetId).toBe(promoted.id);
      expect((await getPermissions(handle.db, OWNER, promoted.id)).external_ai.status).toBe("allowed");
    });

    it("stored arXiv-version Document → remove copy (delete): back to linked_remote, never deleted", async () => {
      const id = nextArxivId();
      const { work, version } = await arxivWork(OWNER, id, 1);
      await openArxivVersion(handle.db, OWNER, work.id, id, 1);
      const promoted = (
        await attachUploadToWork(handle.db, blobs, {
          ownerId: OWNER,
          workId: work.id,
          versionId: version.id,
          filename: "copy.pdf",
          mediaType: "application/pdf",
          data: pdf("remove"),
          maxBytes: 1_000_000,
        })
      ).asset;
      await deleteAsset(handle.db, blobs, OWNER, promoted.id);
      const after = (await getAsset(handle.db, OWNER, promoted.id))!;
      expect(after.status).toBe("linked_remote");
      expect(after.deletedAt).toBeNull();
      expect(await blobs.exists(promoted.storageKey!)).toBe(false);
    });

    it("soft-deleted row, same bytes uploaded → revived with the stated permissions, metadata and annotations", async () => {
      const bytes = pdf("revive");
      const first = await receiveUpload(handle.db, blobs, {
        ownerId: OWNER,
        filename: "notes.pdf",
        mediaType: "application/pdf",
        data: bytes,
        origin: "web_upload",
        maxBytes: 1_000_000,
      });
      await confirmMetadata(handle.db, OWNER, first.asset.id, { title: "Old title", authors: ["Old"], courseIds: ["MAT-230"] });
      await setPermission(handle.db, OWNER, first.asset.id, "external_ai", "allowed", "earlier decision");
      await setPermission(handle.db, OWNER, first.asset.id, "local_extract", "allowed", "earlier decision");
      const note = await createAnnotation(handle.db, OWNER, {
        assetId: first.asset.id,
        physicalIndex: 0,
        noteMarkdown: "a note on the old copy",
      });
      // An annotation detached by the earlier delete path (asset id nulled) is found by its locator.
      const [legacy] = await handle.db
        .insert(annotation)
        .values({
          ownerId: OWNER,
          assetId: null,
          locator: { kind: "pdf", sourceVersionId: `asset:${sha256(bytes).slice(0, 16)}`, physicalPageIndex: 1 },
          noteMarkdown: "detached long ago",
        })
        .returning();
      await saveReadingProgress(handle.db, OWNER, first.asset.id, 4);
      await setPermission(handle.db, OWNER, first.asset.id, "private_cloud_store", "denied", "withdrawn", blobs);
      expect(await getAsset(handle.db, OWNER, first.asset.id)).toBeNull();

      const again = await receiveUpload(handle.db, blobs, {
        ownerId: OWNER,
        filename: "notes-again.pdf",
        mediaType: "application/pdf",
        data: bytes,
        origin: "web_upload",
        maxBytes: 1_000_000,
      });
      expect(again.outcome).toBe("stored");
      expect(again.asset.id).toBe(first.asset.id);
      expect(again.asset.status).toBe("quarantined");
      expect(again.asset.deletedAt).toBeNull();
      expect(again.asset.filename).toBe("notes-again.pdf");
      expect(again.asset.confirmedTitle).toBeNull();
      expect(again.asset.courseIds).toEqual([]);
      const permissions = await getPermissions(handle.db, OWNER, again.asset.id);
      expect(permissions.private_cloud_store).toEqual({ status: "allowed", basis: REVIVE_BASIS });
      expect(permissions.external_ai.status).toBe("unknown");
      expect(permissions.local_extract.status).toBe("unknown");
      const reattached = await handle.db.select().from(annotation).where(eq(annotation.assetId, again.asset.id));
      expect(reattached.map((a) => a.id).sort()).toEqual([note.id, legacy!.id].sort());
      const [progress] = await handle.db.select().from(readingProgress).where(eq(readingProgress.assetId, again.asset.id));
      expect(progress?.physicalIndex).toBe(4);
      const audits = await handle.db
        .select()
        .from(auditEvent)
        .where(and(eq(auditEvent.entityId, again.asset.id), eq(auditEvent.action, "asset:revive")));
      expect(audits).toHaveLength(1);
      expect(await blobs.exists(again.asset.storageKey!)).toBe(true);
    });

    it("stored row, same bytes → duplicate (nothing stored twice)", async () => {
      const bytes = pdf("duplicate");
      const first = await receiveUpload(handle.db, blobs, {
        ownerId: OWNER,
        filename: "a.pdf",
        mediaType: "application/pdf",
        data: bytes,
        origin: "web_upload",
        maxBytes: 1_000_000,
      });
      const second = await receiveUpload(handle.db, blobs, {
        ownerId: OWNER,
        filename: "b.pdf",
        mediaType: "application/pdf",
        data: bytes,
        origin: "web_upload",
        maxBytes: 1_000_000,
      });
      expect(second.outcome).toBe("duplicate");
      expect(second.asset.id).toBe(first.asset.id);
    });

    it("a database failure after the blob is written deletes the blob again (no orphan)", async () => {
      const writes: string[] = [];
      // The store writes the blob, then a competing upload of the same bytes lands first, so the
      // routine's insert hits the unique index.
      const racing: BlobStore = {
        driver: blobs.driver,
        get: (k) => blobs.get(k),
        delete: (k) => blobs.delete(k),
        exists: (k) => blobs.exists(k),
        put: async (data, options) => {
          const stored = await blobs.put(data, options);
          writes.push(stored.key);
          await handle.db.insert(resourceAsset).values({
            ownerId: OWNER,
            filename: "competitor.pdf",
            mediaType: "application/pdf",
            sizeBytes: data.byteLength,
            sha256: sha256(data),
            status: "registered_local",
            origin: "companion",
          });
          return stored;
        },
      };
      await expect(
        receiveUpload(handle.db, racing, {
          ownerId: OWNER,
          filename: "racer.pdf",
          mediaType: "application/pdf",
          data: pdf("race"),
          origin: "web_upload",
          maxBytes: 1_000_000,
        }),
      ).rejects.toThrow();
      expect(writes).toHaveLength(1);
      expect(await blobs.exists(writes[0]!)).toBe(false);
    });

    it("a promotion whose row changed meanwhile fails and leaves no blob", async () => {
      const id = nextArxivId();
      const { work } = await arxivWork(OWNER, id, 1);
      const linked = await openArxivVersion(handle.db, OWNER, work.id, id, 1);
      const writes: string[] = [];
      const racing: BlobStore = {
        driver: blobs.driver,
        get: (k) => blobs.get(k),
        delete: (k) => blobs.delete(k),
        exists: (k) => blobs.exists(k),
        put: async (data, options) => {
          const stored = await blobs.put(data, options);
          writes.push(stored.key);
          // Another request promoted the row first.
          await handle.db
            .update(resourceAsset)
            .set({ status: "quarantined", sha256: sha256(Buffer.from(randomUUID())), storageKey: randomUUID() })
            .where(eq(resourceAsset.id, linked.id));
          return stored;
        },
      };
      await expect(
        placeDocumentBytes(handle.db, racing, {
          ownerId: OWNER,
          filename: "copy.pdf",
          mediaType: "application/pdf",
          data: pdf("promote race"),
          origin: "scholarly_import",
          maxBytes: 1_000_000,
          promoteAssetId: linked.id,
        }),
      ).rejects.toThrow(LibraryError);
      expect(await blobs.exists(writes[0]!)).toBe(false);
    });

    it("refusals are decided before any blob is written", async () => {
      const bytes = pdf("already other paper");
      const created = await createWorkFromUpload(handle.db, blobs, {
        ownerId: OWNER,
        filename: "mine.pdf",
        mediaType: "application/pdf",
        data: bytes,
        maxBytes: 1_000_000,
      });
      const id = nextArxivId();
      const { work } = await arxivWork(OWNER, id, 1);
      let puts = 0;
      const counting: BlobStore = {
        driver: blobs.driver,
        get: (k) => blobs.get(k),
        delete: (k) => blobs.delete(k),
        exists: (k) => blobs.exists(k),
        put: async (data, options) => {
          puts++;
          return blobs.put(data, options);
        },
      };
      const error = await attachUploadToWork(handle.db, counting, {
        ownerId: OWNER,
        workId: work.id,
        filename: "same.pdf",
        mediaType: "application/pdf",
        data: bytes,
        maxBytes: 1_000_000,
      }).catch((e: unknown) => e);
      expect((error as Error).message).toBe("This file is already attached to another paper in your library.");
      expect((error as { details?: { workId?: string } }).details?.workId).toBe(created.workId);
      expect(puts).toBe(0);
    });
  });
}

describe("attach rules and the companion", () => {
  const blobs = () => new FsBlobStore(join(dataRoot, "rules"));

  it("adopts an earlier upload with no version, reuses one already on this paper", async () => {
    const bytes = pdf("adopt");
    const upload = await receiveUpload(handle.db, blobs(), {
      ownerId: OWNER,
      filename: "book.pdf",
      mediaType: "application/pdf",
      data: bytes,
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    const note = await createAnnotation(handle.db, OWNER, { assetId: upload.asset.id, physicalIndex: 0, noteMarkdown: "carried over" });
    const { work } = await arxivWork(OWNER, nextArxivId(), 1);
    const adopted = await attachUploadToWork(handle.db, blobs(), {
      ownerId: OWNER,
      workId: work.id,
      filename: "book.pdf",
      mediaType: "application/pdf",
      data: bytes,
      maxBytes: 1_000_000,
    });
    expect(adopted.outcome).toBe("adopted");
    expect(adopted.asset.id).toBe(upload.asset.id);
    const [version] = await handle.db.select().from(scholarlyVersion).where(eq(scholarlyVersion.id, adopted.asset.scholarlyVersionId!));
    expect(version?.label).toBe("Your copy");
    expect(version?.workId).toBe(work.id);
    const [kept] = await handle.db.select().from(annotation).where(eq(annotation.id, note.id));
    expect(kept?.assetId).toBe(upload.asset.id);
    const reused = await attachUploadToWork(handle.db, blobs(), {
      ownerId: OWNER,
      workId: work.id,
      filename: "book.pdf",
      mediaType: "application/pdf",
      data: bytes,
      maxBytes: 1_000_000,
    });
    expect(reused.outcome).toBe("reused");
    expect(reused.asset.id).toBe(upload.asset.id);
    const versions = await handle.db.select().from(scholarlyVersion).where(eq(scholarlyVersion.workId, work.id));
    expect(versions.filter((v) => v.label === "Your copy")).toHaveLength(1);
  });

  it("registerLocalAsset that matches a paper's file only records an audit event", async () => {
    const id = nextArxivId();
    const { work, version } = await arxivWork(OWNER, id, 1);
    await openArxivVersion(handle.db, OWNER, work.id, id, 1);
    const bytes = pdf("companion sees it");
    const stored = (
      await attachUploadToWork(handle.db, blobs(), {
        ownerId: OWNER,
        workId: work.id,
        versionId: version.id,
        filename: "p.pdf",
        mediaType: "application/pdf",
        data: bytes,
        maxBytes: 1_000_000,
      })
    ).asset;
    const seen = await registerLocalAsset(handle.db, {
      ownerId: OWNER,
      devicePairingId: randomUUID(),
      filename: "renamed-on-desktop.pdf",
      mediaType: "application/pdf",
      sizeBytes: bytes.byteLength,
      sha256: sha256(bytes),
      candidateMetadata: {},
      localPathHint: "inbox/renamed-on-desktop.pdf",
    });
    expect(seen.outcome).toBe("known");
    const after = (await getAsset(handle.db, OWNER, stored.id))!;
    expect(after.localPathHint).toBeNull();
    expect(after.devicePairingId).toBeNull();
    expect(after.filename).toBe(stored.filename);
    const audits = await handle.db
      .select()
      .from(auditEvent)
      .where(and(eq(auditEvent.entityId, stored.id), eq(auditEvent.action, "asset:register-seen")));
    expect(audits).toHaveLength(1);
  });

  it("decides each placement from the rows alone", () => {
    const base: AssetRow = {
      id: randomUUID(),
      ownerId: OWNER,
      sourceVersionId: null,
      filename: "x.pdf",
      mediaType: "application/pdf",
      sizeBytes: 1,
      sha256: "a".repeat(64),
      storageKey: null,
      status: "quarantined",
      origin: "web_upload",
      candidateMetadata: {},
      confirmedTitle: null,
      confirmedAuthors: null,
      confirmedEdition: null,
      pageCount: null,
      printedLabelsPresent: null,
      courseIds: [],
      localOnly: false,
      devicePairingId: null,
      localPathHint: null,
      rejectionReason: null,
      scholarlyVersionId: null,
      observedSha256: null,
      observedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    expect(decideDocumentPlacement(null).action).toBe("store_new");
    expect(decideDocumentPlacement({ ...base, storageKey: randomUUID() }).action).toBe("duplicate");
    expect(decideDocumentPlacement({ ...base, deletedAt: new Date(), status: "deleted" }).action).toBe("revive");
    expect(decideDocumentPlacement({ ...base, status: "registered_local" }).action).toBe("fill_registered");
    const linked = { ...base, status: "linked_remote" as const, sha256: "arxiv:2501.00001v1", scholarlyVersionId: randomUUID() };
    expect(decideDocumentPlacement(null, linked).action).toBe("promote");
    expect(decideDocumentPlacement({ ...base, storageKey: randomUUID() }, linked)).toMatchObject({
      action: "refuse",
      message: FILE_IN_LIBRARY_AS_OTHER_ITEM,
    });
    expect(decideDocumentPlacement(null, { ...linked, status: "validated" }).action).toBe("refuse");
    // A soft-deleted row holding the bytes is folded into the linked Document.
    const deleted = { ...base, status: "deleted" as const, deletedAt: new Date() };
    expect(decideDocumentPlacement(deleted, linked)).toEqual({ action: "promote", asset: linked, fold: deleted });
  });
});

describe("linked Documents through the old item forms", () => {
  it("refuses delete, extraction, private storage and metadata edits with registered notices", async () => {
    const id = nextArxivId();
    const { work } = await arxivWork(OWNER, id, 1);
    const linked = await openArxivVersion(handle.db, OWNER, work.id, id, 1);
    const blobs = new FsBlobStore(join(dataRoot, "linked"));
    await expect(deleteAsset(handle.db, blobs, OWNER, linked.id)).rejects.toThrow(
      "A paper read from arxiv.org has no stored file to delete.",
    );
    expect(await requestIngestion(handle.db, OWNER, linked.id)).toEqual({
      queued: false,
      reason: "This paper is read from arxiv.org; nothing is stored here to extract.",
    });
    await expect(setPermission(handle.db, OWNER, linked.id, "private_cloud_store", "allowed", "x")).rejects.toThrow(
      "This paper is read from arxiv.org; keep a private copy from its paper page instead.",
    );
    await expect(confirmMetadata(handle.db, OWNER, linked.id, { title: "x", authors: [], courseIds: [] })).rejects.toThrow(
      "This file belongs to a paper in your library; its details are edited on the paper's page.",
    );
    // Another owner finds nothing.
    await expect(deleteAsset(handle.db, blobs, OTHER, linked.id)).resolves.toBeUndefined();
    expect(await getAsset(handle.db, OTHER, linked.id)).toBeNull();
  });
});

describe("confirmMetadata and requestIngestion fixes", () => {
  const blobs = () => new FsBlobStore(join(dataRoot, "fixes"));

  it("keeps the registry link when the form does not send one, and changes it only when given", async () => {
    const [registry] = (await handle.db.execute(sql`select id from source_version limit 1`)).rows as { id: string }[];
    const stored = await receiveUpload(handle.db, blobs(), {
      ownerId: OWNER,
      filename: "registry.pdf",
      mediaType: "application/pdf",
      data: pdf("registry"),
      origin: "open_import",
      maxBytes: 1_000_000,
    });
    if (registry) {
      await confirmMetadata(handle.db, OWNER, stored.asset.id, { title: "T", authors: [], courseIds: [], sourceVersionId: registry.id });
      const again = await confirmMetadata(handle.db, OWNER, stored.asset.id, { title: "T2", authors: [], courseIds: [] });
      expect(again.sourceVersionId).toBe(registry.id);
      const cleared = await confirmMetadata(handle.db, OWNER, stored.asset.id, {
        title: "T3",
        authors: [],
        courseIds: [],
        sourceVersionId: null,
      });
      expect(cleared.sourceVersionId).toBeNull();
    } else {
      const again = await confirmMetadata(handle.db, OWNER, stored.asset.id, { title: "T2", authors: [], courseIds: [] });
      expect(again.sourceVersionId).toBeNull();
    }
    await expect(confirmMetadata(handle.db, OTHER, stored.asset.id, { title: "x", authors: [], courseIds: [] })).rejects.toThrow(
      "Asset not found.",
    );
  });

  it("changes the status and enqueues in one transaction: a job that is not created leaves the item as it was", async () => {
    const stored = await receiveUpload(handle.db, blobs(), {
      ownerId: OWNER,
      filename: "tx.pdf",
      mediaType: "application/pdf",
      data: pdf("transaction"),
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    await confirmMetadata(handle.db, OWNER, stored.asset.id, { title: "Tx", authors: [], courseIds: [] });
    await setPermission(handle.db, OWNER, stored.asset.id, "local_extract", "allowed", "mine");
    // A record already holds the key the next request would use, so pg-boss gets no new job.
    await handle.db.insert(jobRecord).values({
      kind: "ingest-asset",
      queue: "ingest-asset",
      idempotencyKey: `ingest:${stored.asset.sha256}:${stored.asset.id}#r1`,
      payload: {},
      status: "failed",
    });
    const result = await requestIngestion(handle.db, OWNER, stored.asset.id);
    expect(result).toEqual({ queued: false, reason: "A job for this file already exists; see the jobs page." });
    expect((await getAsset(handle.db, OWNER, stored.asset.id))!.status).toBe("validated");
  });

  it("a soft delete keeps the annotation's asset id", async () => {
    const stored = await receiveUpload(handle.db, blobs(), {
      ownerId: OWNER,
      filename: "soft.pdf",
      mediaType: "application/pdf",
      data: pdf("soft delete"),
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    const note = await createAnnotation(handle.db, OWNER, { assetId: stored.asset.id, physicalIndex: 0, noteMarkdown: "stay" });
    await deleteAsset(handle.db, blobs(), OWNER, stored.asset.id);
    const [row] = await handle.db.select().from(annotation).where(eq(annotation.id, note.id));
    expect(row?.assetId).toBe(stored.asset.id);
    expect(row?.mappingStatus).toBe("needs_repair");
    const permissions = await handle.db.select().from(processingPermission).where(eq(processingPermission.assetId, stored.asset.id));
    expect(permissions).toEqual([]);
  });
});

// --- rect anchors across promotion and revert ------------------------------------------------------

const highlightAt = (pageIndex: number, pageView: [number, number] = [612, 792]) => ({
  v: 1 as const,
  coordSpace: "pdf_user_space" as const,
  pageIndex,
  pageView,
  rotate: 0 as const,
  rects: [[72, 700, 300, 712]],
  quote: "Lemma 1 holds",
});

/** What the ingest handler leaves behind after extracting the promoted file: pages and a page count. */
async function extracted(assetId: string, pages: number) {
  for (let i = 0; i < pages; i++)
    await handle.db.insert(extractedPage).values({
      assetId,
      physicalIndex: i,
      text: `Lemma 1 holds for every x. Page ${i + 1}.`,
      charCount: 30,
      quality: { scannedSuspected: false, lowText: true, invisibleText: 0, imageCoverage: 0 },
    });
  await handle.db.update(resourceAsset).set({ status: "processed", pageCount: pages }).where(eq(resourceAsset.id, assetId));
}

async function annotationRow(id: string) {
  return (await handle.db.select().from(annotation).where(eq(annotation.id, id)))[0]!;
}

describe("rect anchors when a Document's file changes", () => {
  const blobs = () => new FsBlobStore(join(dataRoot, "anchors"));

  async function annotatedLinked() {
    const id = nextArxivId();
    const { work, version } = await arxivWork(OWNER, id, 1);
    const linked = await openArxivVersion(handle.db, OWNER, work.id, id, 1);
    const h = await createAnnotation(handle.db, OWNER, { assetId: linked.id, physicalIndex: 0, kind: "highlight", anchor: highlightAt(0) });
    expect(h.mappingStatus).toBe("resolved");
    expect(h.anchor?.documentSha256).toBe(`arxiv:${id}v1`);
    return { id, work, version, linked, h };
  }

  it("the very bytes the reader received: anchors take the new key at promotion and stay drawable", async () => {
    const { work, version, linked, h } = await annotatedLinked();
    const bytes = pdf("same as observed");
    await recordObservedHash(handle.db, OWNER, linked.id, { sha256: sha256(bytes), pageCount: 1 });
    const result = await attachUploadToWork(handle.db, blobs(), {
      ownerId: OWNER,
      workId: work.id,
      versionId: version.id,
      filename: "copy.pdf",
      mediaType: "application/pdf",
      data: bytes,
      maxBytes: 1_000_000,
    });
    expect(result.outcome).toBe("promoted");
    expect((await annotationRow(h.id)).anchor?.documentSha256).toBe(sha256(bytes));
    await extracted(linked.id, 1);
    // Even without the extraction's geometry, the anchor is on this file.
    await reconcileAnnotations(handle.db, OWNER, linked.id);
    expect((await annotationRow(h.id)).mappingStatus).toBe("resolved");
    const [audit] = await handle.db
      .select()
      .from(auditEvent)
      .where(and(eq(auditEvent.entityId, linked.id), eq(auditEvent.action, "asset:promote")));
    expect(audit?.details).toMatchObject({ sameAsObserved: true, anchorsRekeyed: 1 });
  });

  it("other bytes (the reader saw another file, or none): the extraction's geometry decides", async () => {
    // Same page geometry: carried over and re-keyed.
    const same = await annotatedLinked();
    await recordObservedHash(handle.db, OWNER, same.linked.id, { sha256: "a".repeat(64), pageCount: 2 });
    await attachUploadToWork(handle.db, blobs(), {
      ownerId: OWNER,
      workId: same.work.id,
      versionId: same.version.id,
      filename: "copy.pdf",
      mediaType: "application/pdf",
      data: pdf("geometry same"),
      maxBytes: 1_000_000,
    });
    const promoted = (await getAsset(handle.db, OWNER, same.linked.id))!;
    expect((await annotationRow(same.h.id)).anchor?.documentSha256).toBe(`arxiv:${same.id}v1`);
    await extracted(same.linked.id, 2);
    // No geometry: not provably the same file.
    await reconcileAnnotations(handle.db, OWNER, same.linked.id);
    expect((await annotationRow(same.h.id)).mappingStatus).toBe("needs_repair");
    await reconcileAnnotations(handle.db, OWNER, same.linked.id, {
      pageViews: [
        [612, 792],
        [612, 792],
      ],
      previousPageCount: 2,
    });
    const carried = await annotationRow(same.h.id);
    expect(carried.mappingStatus).toBe("resolved");
    expect(carried.anchor?.documentSha256).toBe(promoted.sha256);

    // A different page size (the published PDF, say): needs repair; the anchor keeps arXiv's key.
    const other = await annotatedLinked();
    await attachUploadToWork(handle.db, blobs(), {
      ownerId: OWNER,
      workId: other.work.id,
      versionId: other.version.id,
      filename: "published.pdf",
      mediaType: "application/pdf",
      data: pdf("geometry differs"),
      maxBytes: 1_000_000,
    });
    await extracted(other.linked.id, 1);
    await reconcileAnnotations(handle.db, OWNER, other.linked.id, { pageViews: [[595, 842]], previousPageCount: null });
    const differs = await annotationRow(other.h.id);
    expect(differs.mappingStatus).toBe("needs_repair");
    expect(differs.anchor?.documentSha256).toBe(`arxiv:${other.id}v1`);
  });

  it("revert to linked: anchors made on the stored copy take arXiv's key only when the bytes are the ones the reader saw", async () => {
    for (const sameAsObserved of [true, false]) {
      const id = nextArxivId();
      const { work, version } = await arxivWork(OWNER, id, 1);
      const linked = await openArxivVersion(handle.db, OWNER, work.id, id, 1);
      const bytes = pdf(`revert ${sameAsObserved}`);
      await recordObservedHash(handle.db, OWNER, linked.id, { sha256: sameAsObserved ? sha256(bytes) : "b".repeat(64), pageCount: 1 });
      await attachUploadToWork(handle.db, blobs(), {
        ownerId: OWNER,
        workId: work.id,
        versionId: version.id,
        filename: "copy.pdf",
        mediaType: "application/pdf",
        data: bytes,
        maxBytes: 1_000_000,
      });
      await extracted(linked.id, 1);
      const h = await createAnnotation(handle.db, OWNER, {
        assetId: linked.id,
        physicalIndex: 0,
        kind: "highlight",
        anchor: highlightAt(0),
      });
      expect(h.anchor?.documentSha256).toBe(sha256(bytes));
      await deleteAsset(handle.db, blobs(), OWNER, linked.id);
      const reverted = (await getAsset(handle.db, OWNER, linked.id))!;
      expect(reverted.status).toBe("linked_remote");
      expect((await annotationRow(h.id)).anchor?.documentSha256).toBe(sameAsObserved ? `arxiv:${id}v1` : sha256(bytes));
      if (!sameAsObserved) {
        // The reader's drift check, accepted by the owner, carries the notes onto arXiv's file.
        const accepted = await acceptNewFile(handle.db, OWNER, linked.id, {
          observedSha256: "c".repeat(64),
          pageCount: 1,
          pageViews: [[612, 792]],
        });
        expect(accepted.accepted).toBe(true);
        expect((await annotationRow(h.id)).anchor?.documentSha256).toBe(`arxiv:${id}v1`);
      }
    }
  });
});

// --- one Document per arXiv version, and bytes the library already holds --------------------------

describe("bytes already in the library and one Document per version", () => {
  const blobs = () => new FsBlobStore(join(dataRoot, "bytes"));

  it("a second, different copy for a version whose file is stored is refused; the version keeps one Document", async () => {
    const id = nextArxivId();
    const { work, version } = await arxivWork(OWNER, id, 1);
    const linked = await openArxivVersion(handle.db, OWNER, work.id, id, 1);
    const input = { ownerId: OWNER, workId: work.id, versionId: version.id, mediaType: "application/pdf", maxBytes: 1_000_000 };
    const first = await attachUploadToWork(handle.db, blobs(), { ...input, filename: "a.pdf", data: pdf("first copy") });
    expect(first.outcome).toBe("promoted");
    const second = await attachUploadToWork(handle.db, blobs(), { ...input, filename: "b.pdf", data: pdf("second copy") }).catch(
      (e: unknown) => e as Error,
    );
    expect((second as Error).message).toBe(
      "This version already has a stored file in your library. Remove that copy first if this file should replace it.",
    );
    const documents = await handle.db
      .select({ id: resourceAsset.id })
      .from(resourceAsset)
      .where(and(eq(resourceAsset.ownerId, OWNER), eq(resourceAsset.scholarlyVersionId, version.id)));
    expect(documents).toEqual([{ id: linked.id }]);
    // Removing the copy works, and then a different copy is accepted.
    await deleteAsset(handle.db, blobs(), OWNER, linked.id);
    expect((await attachUploadToWork(handle.db, blobs(), { ...input, filename: "b.pdf", data: pdf("second copy") })).outcome).toBe(
      "promoted",
    );
  });

  it("a revert never collides with another row holding the version's key: a registered refusal instead", async () => {
    const id = nextArxivId();
    const { work, version } = await arxivWork(OWNER, id, 1);
    const linked = await openArxivVersion(handle.db, OWNER, work.id, id, 1);
    const promoted = (
      await attachUploadToWork(handle.db, blobs(), {
        ownerId: OWNER,
        workId: work.id,
        versionId: version.id,
        filename: "a.pdf",
        mediaType: "application/pdf",
        data: pdf("collision a"),
        maxBytes: 1_000_000,
      })
    ).asset;
    // A second Document for the version, as an earlier build could leave it, reverted first.
    const otherBytes = pdf("collision b");
    const [legacy] = await handle.db
      .insert(resourceAsset)
      .values({
        ownerId: OWNER,
        filename: "b.pdf",
        mediaType: "application/pdf",
        sizeBytes: otherBytes.byteLength,
        sha256: sha256(otherBytes),
        storageKey: (await blobs().put(otherBytes)).key,
        status: "validated",
        origin: "scholarly_upload",
        scholarlyVersionId: version.id,
      })
      .returning();
    await deleteAsset(handle.db, blobs(), OWNER, legacy!.id);
    expect((await getAsset(handle.db, OWNER, legacy!.id))?.status).toBe("linked_remote");
    await expect(deleteAsset(handle.db, blobs(), OWNER, promoted.id)).rejects.toThrow(
      "Another file in your library already stands for this arXiv version, so this copy was not removed.",
    );
    const kept = (await getAsset(handle.db, OWNER, linked.id))!;
    expect(kept.status).toBe("validated");
    expect(await blobs().exists(kept.storageKey!)).toBe(true);
  });

  it("a deleted plain upload of the same PDF is folded into the linked Document: notes and position come along", async () => {
    const bytes = pdf("deleted earlier");
    const earlier = await receiveUpload(handle.db, blobs(), {
      ownerId: OWNER,
      filename: "earlier.pdf",
      mediaType: "application/pdf",
      data: bytes,
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    const oldNote = await createAnnotation(handle.db, OWNER, { assetId: earlier.asset.id, physicalIndex: 0, noteMarkdown: "from Files" });
    await saveReadingProgress(handle.db, OWNER, earlier.asset.id, 5);
    await setPermission(handle.db, OWNER, earlier.asset.id, "external_ai", "allowed", "an old decision");
    await deleteAsset(handle.db, blobs(), OWNER, earlier.asset.id);
    const id = nextArxivId();
    const { work, version } = await arxivWork(OWNER, id, 1);
    const linked = await openArxivVersion(handle.db, OWNER, work.id, id, 1);
    const linkedNote = await createAnnotation(handle.db, OWNER, { assetId: linked.id, physicalIndex: 0, kind: "bookmark" });
    const attached = await attachUploadToWork(handle.db, blobs(), {
      ownerId: OWNER,
      workId: work.id,
      versionId: version.id,
      filename: "copy.pdf",
      mediaType: "application/pdf",
      data: bytes,
      maxBytes: 1_000_000,
    });
    expect(attached.outcome).toBe("promoted");
    expect(attached.asset.id).toBe(linked.id);
    expect(attached.asset.sha256).toBe(sha256(bytes));
    expect(attached.asset.status).toBe("validated");
    // Both notes are on the version's one Document; the deleted row is gone with its old decisions.
    expect((await annotationRow(oldNote.id)).assetId).toBe(linked.id);
    expect((await annotationRow(linkedNote.id)).assetId).toBe(linked.id);
    expect(await handle.db.select().from(resourceAsset).where(eq(resourceAsset.id, earlier.asset.id))).toEqual([]);
    expect((await getPermissions(handle.db, OWNER, linked.id)).external_ai.status).toBe("unknown");
    expect((await getReadingPosition(handle.db, OWNER, linked.id))?.physicalIndex).toBe(5);
    const [fold] = await handle.db
      .select()
      .from(auditEvent)
      .where(and(eq(auditEvent.entityId, linked.id), eq(auditEvent.action, "asset:fold")));
    expect(fold?.details).toMatchObject({ folded: earlier.asset.id, annotations: 1, position: "moved" });
  });

  it("a live plain upload is refused with an instruction; after deleting it the attach works and its notes come along", async () => {
    const bytes = pdf("live in files");
    const inFiles = await receiveUpload(handle.db, blobs(), {
      ownerId: OWNER,
      filename: "in-files.pdf",
      mediaType: "application/pdf",
      data: bytes,
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    const note = await createAnnotation(handle.db, OWNER, { assetId: inFiles.asset.id, physicalIndex: 0, noteMarkdown: "mine" });
    const id = nextArxivId();
    const { work, version } = await arxivWork(OWNER, id, 1);
    const linked = await openArxivVersion(handle.db, OWNER, work.id, id, 1);
    const attach = () =>
      attachUploadToWork(handle.db, blobs(), {
        ownerId: OWNER,
        workId: work.id,
        versionId: version.id,
        filename: "copy.pdf",
        mediaType: "application/pdf",
        data: bytes,
        maxBytes: 1_000_000,
      });
    await expect(attach()).rejects.toThrow(FILE_IN_LIBRARY_AS_OTHER_ITEM);
    await deleteAsset(handle.db, blobs(), OWNER, inFiles.asset.id);
    expect((await attach()).asset.id).toBe(linked.id);
    expect((await annotationRow(note.id)).assetId).toBe(linked.id);
  });

  it("a private copy folds a deleted copy in, and is refused before queueing when arXiv's file is a live item", async () => {
    // Scripted test double for arXiv's PDF bytes (no provider is called).
    const arxivBytes = (bytes: Buffer) => ({ arxivPdf: async () => new Uint8Array(bytes) }) as unknown as ScholarlyClient;

    const deletedBytes = pdf("private copy, deleted before");
    const before = await receiveUpload(handle.db, blobs(), {
      ownerId: OWNER,
      filename: "before.pdf",
      mediaType: "application/pdf",
      data: deletedBytes,
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    await deleteAsset(handle.db, blobs(), OWNER, before.asset.id);
    const a = nextArxivId();
    const first = await arxivWork(OWNER, a, 1);
    const linkedA = await openArxivVersion(handle.db, OWNER, first.work.id, a, 1);
    const done = await keepPrivateCopy(handle.db, blobs(), arxivBytes(deletedBytes), {
      ownerId: OWNER,
      assetId: linkedA.id,
      maxBytes: 1_000_000,
    });
    expect(done.outcome).toBe("promoted");
    expect((await getAsset(handle.db, OWNER, linkedA.id))?.sha256).toBe(sha256(deletedBytes));

    const liveBytes = pdf("private copy, live in files");
    await receiveUpload(handle.db, blobs(), {
      ownerId: OWNER,
      filename: "live.pdf",
      mediaType: "application/pdf",
      data: liveBytes,
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    const b = nextArxivId();
    const second = await arxivWork(OWNER, b, 1);
    const linkedB = await openArxivVersion(handle.db, OWNER, second.work.id, b, 1);
    const refusal =
      "arXiv's file for this version is already in your library as another item. Delete that item first, then keep the private copy; its notes come with it.";
    // The worker cannot store it; it says so in the private copy's words.
    await expect(
      keepPrivateCopy(handle.db, blobs(), arxivBytes(liveBytes), { ownerId: OWNER, assetId: linkedB.id, maxBytes: 1_000_000 }),
    ).rejects.toThrow(refusal);
    // Once the reader has seen arXiv's file, the request is refused before any job.
    await recordObservedHash(handle.db, OWNER, linkedB.id, { sha256: sha256(liveBytes) });
    expect(await requestPrivateCopy(handle.db, OWNER, linkedB.id)).toEqual({ queued: false, reason: refusal });
  });

  it("a file deleted from another paper is attached to this one: revived, bound here and validated", async () => {
    const bytes = pdf("deleted from paper B");
    const b = await createWorkFromUpload(handle.db, blobs(), {
      ownerId: OWNER,
      filename: "b.pdf",
      mediaType: "application/pdf",
      data: bytes,
      maxBytes: 1_000_000,
      title: "Paper B draft",
    });
    await deleteAsset(handle.db, blobs(), OWNER, b.asset.id);
    const [a] = await handle.db.insert(scholarlyWork).values({ ownerId: OWNER, title: "Paper A", savedAt: new Date() }).returning();
    const attached = await attachUploadToWork(handle.db, blobs(), {
      ownerId: OWNER,
      workId: a!.id,
      filename: "a.pdf",
      mediaType: "application/pdf",
      data: bytes,
      maxBytes: 1_000_000,
    });
    expect(attached.outcome).toBe("revived");
    expect(attached.asset.id).toBe(b.asset.id);
    expect(attached.asset.status).toBe("validated");
    expect(attached.asset.confirmedTitle).toBe("Paper A");
    const [version] = await handle.db.select().from(scholarlyVersion).where(eq(scholarlyVersion.id, attached.asset.scholarlyVersionId!));
    expect(version?.workId).toBe(a!.id);
    // A live file of another paper is still refused.
    const [c] = await handle.db.insert(scholarlyWork).values({ ownerId: OWNER, title: "Paper C", savedAt: new Date() }).returning();
    await expect(
      attachUploadToWork(handle.db, blobs(), {
        ownerId: OWNER,
        workId: c!.id,
        filename: "c.pdf",
        mediaType: "application/pdf",
        data: bytes,
        maxBytes: 1_000_000,
      }),
    ).rejects.toThrow("This file is already attached to another paper in your library.");
  });

  it("a paper's file revived through the plain upload is confirmed from its work, so extraction can be asked for", async () => {
    const bytes = pdf("revived paper file");
    const made = await createWorkFromUpload(handle.db, blobs(), {
      ownerId: OWNER,
      filename: "mine.pdf",
      mediaType: "application/pdf",
      data: bytes,
      maxBytes: 1_000_000,
      title: "My unidentified paper",
    });
    await deleteAsset(handle.db, blobs(), OWNER, made.asset.id);
    const revived = await receiveUpload(handle.db, blobs(), {
      ownerId: OWNER,
      filename: "mine.pdf",
      mediaType: "application/pdf",
      data: bytes,
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    expect(revived.asset.id).toBe(made.asset.id);
    expect(revived.asset.status).toBe("validated");
    expect(revived.asset.confirmedTitle).toBe("My unidentified paper");
    // Not refused for metadata: only the owner's extraction permission is missing.
    expect(await requestIngestion(handle.db, OWNER, made.asset.id)).toEqual({
      queued: false,
      reason: "Text extraction is not permitted for this item. Allow 'extraction and indexing' on the item page.",
    });
    expect(
      (
        await attachUploadToWork(handle.db, blobs(), {
          ownerId: OWNER,
          workId: made.workId,
          filename: "mine.pdf",
          mediaType: "application/pdf",
          data: bytes,
          maxBytes: 1_000_000,
        })
      ).outcome,
    ).toBe("reused");
  });
});
