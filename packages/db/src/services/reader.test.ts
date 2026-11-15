import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FsBlobStore } from "../blob";
import { createDb } from "../client";
import { stopBoss } from "../queue";
import { user } from "../schema/auth";
import { annotation, resourceAsset } from "../schema/library";
import { scholarlyWork } from "../schema/scholarly";
import { createFixtureScholarlyClient, type ScholarlyClient } from "../scholarly/client";
import { createAnnotation, deleteAnnotation, markDocumentOpened, receiveUpload, saveReadingPosition } from "./library";
import { readerDocument } from "./reader";
import { acceptNewFile, applyArxivRecord, importByIdentifier, mergeWorks, openArxivVersion, recordObservedHash } from "./scholarly-works";

/**
 * The reading room's loader and the annotation rules the reader relies on, against the embedded
 * PostgreSQL. Provider data comes from the recorded fixtures (source `fixture`), never a live call.
 */
const FIXTURES = join(__dirname, "../scholarly/fixtures");
let handle: ReturnType<typeof createDb>;
let dataRoot: string;
let blobs: FsBlobStore;
let fixture: ScholarlyClient;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 3 });
  dataRoot = mkdtempSync(join(tmpdir(), "corniversity-reader-"));
  blobs = new FsBlobStore(dataRoot);
  fixture = createFixtureScholarlyClient({ dir: FIXTURES });
});

afterAll(async () => {
  await stopBoss();
  await handle.close();
  rmSync(dataRoot, { recursive: true, force: true });
});

async function freshOwner(label: string): Promise<string> {
  const id = `${label}-${randomUUID().slice(0, 8)}`;
  await handle.db.insert(user).values({ id, name: label, email: `${id}@example.test` });
  return id;
}

/** What the journeys and the paper page do: import by arXiv id, apply the worker's arXiv job from the fixtures, open a version. */
async function linkedDpo(owner: string, version = 1) {
  const imported = await importByIdentifier(handle.db, owner, fixture, { scheme: "arxiv", value: "2305.18290" });
  const entries = await fixture.arxivEntries([{ id: "2305.18290", version: null }]);
  const raw = await fixture.arxivRaw("2305.18290");
  await applyArxivRecord(handle.db, owner, { workId: imported.workId, arxivId: "2305.18290", entry: entries.entries[0]!, raw });
  const asset = await openArxivVersion(handle.db, owner, imported.workId, "2305.18290", version);
  return { workId: imported.workId, asset };
}

const pageAnchor = (pageIndex: number, rects: number[][] = [[72, 700, 300, 712]]) => ({
  v: 1 as const,
  coordSpace: "pdf_user_space" as const,
  pageIndex,
  pageView: [612, 792] as [number, number],
  rotate: 0 as const,
  rects,
});

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

describe("readerDocument", () => {
  it("joins a linked arXiv Document with its paper, version, identifiers, sibling versions, position and annotations", async () => {
    const owner = await freshOwner("reader-linked");
    const { workId, asset } = await linkedDpo(owner, 1);
    await markDocumentOpened(handle.db, owner, asset.id);
    await saveReadingPosition(handle.db, owner, asset.id, { position: { pageIndex: 2, top: 400, left: 0, zoom: 1.5 }, changedAgoMs: 0 });
    const highlight = await createAnnotation(handle.db, owner, {
      assetId: asset.id,
      physicalIndex: 2,
      kind: "highlight",
      color: "moss",
      anchor: { ...pageAnchor(2), quote: "preference" },
    });

    const doc = (await readerDocument(handle.db, owner, asset.id))!;
    expect(doc.asset.status).toBe("linked_remote");
    expect(doc.work?.id).toBe(workId);
    expect(doc.version?.label).toBe("arXiv v1");
    expect(doc.arxiv).toEqual({ id: "2305.18290", version: 1 });
    expect(doc.arxivVersions.map((v) => [v.version, v.label, v.withdrawn])).toEqual([
      [1, "arXiv v1", false],
      [2, "arXiv v2", false],
      [3, "arXiv v3", false],
    ]);
    expect(doc.identifiers.some((i) => i.scheme === "arxiv" && i.value === "2305.18290")).toBe(true);
    expect(doc.position?.position).toEqual({ pageIndex: 2, top: 400, left: 0, zoom: 1.5 });
    expect(doc.position?.lastOpenedAt).not.toBeNull();
    expect(doc.annotations.map((a) => a.id)).toEqual([highlight.id]);
  });

  it("names a withdrawn sibling version as withdrawn", async () => {
    const owner = await freshOwner("reader-withdrawn");
    const imported = await importByIdentifier(handle.db, owner, fixture, { scheme: "arxiv", value: "2607.20049" });
    const entries = await fixture.arxivEntries([{ id: "2607.20049", version: null }]);
    const raw = await fixture.arxivRaw("2607.20049");
    await applyArxivRecord(handle.db, owner, { workId: imported.workId, arxivId: "2607.20049", entry: entries.entries[0]!, raw });
    const asset = await openArxivVersion(handle.db, owner, imported.workId, "2607.20049", 1);
    const doc = (await readerDocument(handle.db, owner, asset.id))!;
    expect(doc.arxiv).toEqual({ id: "2607.20049", version: 1 });
    expect(doc.arxivVersions.map((v) => [v.version, v.withdrawn])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it("follows a merge to the paper that stands now", async () => {
    const owner = await freshOwner("reader-merge");
    const { workId, asset } = await linkedDpo(owner, 2);
    const [other] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Kept paper", savedAt: new Date() }).returning();
    await mergeWorks(handle.db, owner, other!.id, workId);
    const doc = (await readerDocument(handle.db, owner, asset.id))!;
    expect(doc.work?.id).toBe(other!.id);
    expect(doc.work?.title).toBe("Kept paper");
  });

  it("reads a stored Document of no paper without paper fields", async () => {
    const owner = await freshOwner("reader-stored");
    const { asset } = await receiveUpload(handle.db, blobs, {
      ownerId: owner,
      filename: "notes.pdf",
      mediaType: "application/pdf",
      data: Buffer.from(`%PDF-1.4\n% reader ${randomUUID()}\n%%EOF\n`, "latin1"),
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    const doc = (await readerDocument(handle.db, owner, asset.id))!;
    expect(doc.work).toBeNull();
    expect(doc.version).toBeNull();
    expect(doc.arxiv).toBeNull();
    expect(doc.arxivVersions).toEqual([]);
    expect(doc.identifiers).toEqual([]);
    expect(doc.position).toBeNull();
  });

  it("finds nothing for another owner's Document, a deleted one or an id that is not a UUID", async () => {
    const owner = await freshOwner("reader-owner");
    const other = await freshOwner("reader-other");
    const { asset } = await linkedDpo(owner, 1);
    expect(await readerDocument(handle.db, other, asset.id)).toBeNull();
    expect(await readerDocument(handle.db, owner, "not-a-uuid")).toBeNull();
    expect(await readerDocument(handle.db, owner, randomUUID())).toBeNull();
    await handle.db.update(resourceAsset).set({ deletedAt: new Date() }).where(eq(resourceAsset.id, asset.id));
    expect(await readerDocument(handle.db, owner, asset.id)).toBeNull();
  });
});

describe("anchors on a linked Document whose arXiv file changed", () => {
  it("name the bytes they were measured on until the owner keeps the notes on the new file", async () => {
    const owner = await freshOwner("reader-drift");
    const { asset } = await linkedDpo(owner, 1);
    // Before any file is recorded (the report failed or has not landed), the anchor names the bytes it
    // was measured on, so a later file is checked against them rather than taken for the same one.
    const early = await createAnnotation(handle.db, owner, {
      assetId: asset.id,
      physicalIndex: 0,
      kind: "highlight",
      anchor: pageAnchor(0),
      loadedSha256: HASH_A,
    });
    expect(early.anchor?.documentSha256).toBe(HASH_A);
    expect((await recordObservedHash(handle.db, owner, asset.id, { sha256: HASH_A, pageCount: 12 })).status).toBe("first");
    // Made on the observed file: the Document key.
    const same = await createAnnotation(handle.db, owner, {
      assetId: asset.id,
      physicalIndex: 1,
      kind: "highlight",
      anchor: pageAnchor(1),
      loadedSha256: HASH_A,
    });
    expect(same.anchor?.documentSha256).toBe("arxiv:2305.18290v1");
    // arXiv now serves other bytes; a highlight made on them names them, so the drift check decides about it later.
    expect((await recordObservedHash(handle.db, owner, asset.id, { sha256: HASH_B, pageCount: 12 })).status).toBe("changed");
    const onNew = await createAnnotation(handle.db, owner, {
      assetId: asset.id,
      physicalIndex: 1,
      kind: "highlight",
      anchor: pageAnchor(1),
      loadedSha256: HASH_B,
    });
    expect(onNew.anchor?.documentSha256).toBe(HASH_B);
    expect(onNew.mappingStatus).toBe("resolved");
    // Anything that is not a hash is ignored.
    const junk = await createAnnotation(handle.db, owner, {
      assetId: asset.id,
      physicalIndex: 1,
      kind: "highlight",
      anchor: pageAnchor(1),
      loadedSha256: "B".repeat(64),
    });
    expect(junk.anchor?.documentSha256).toBe("arxiv:2305.18290v1");
    // Keeping the notes on the new file re-keys every anchor to the Document key.
    const kept = await acceptNewFile(handle.db, owner, asset.id, {
      observedSha256: HASH_B,
      pageCount: 12,
      pageViews: Array(12).fill([612, 792]),
    });
    expect(kept.accepted).toBe(true);
    const rows = await handle.db.select().from(annotation).where(eq(annotation.assetId, asset.id));
    expect(new Set(rows.map((r) => r.anchor?.documentSha256))).toEqual(new Set(["arxiv:2305.18290v1"]));
  });

  it("a note on a page only arXiv's changed file has is resolved and names the new bytes", async () => {
    const owner = await freshOwner("reader-drift-pages");
    const { asset } = await linkedDpo(owner, 1);
    expect((await recordObservedHash(handle.db, owner, asset.id, { sha256: HASH_A, pageCount: 6 })).status).toBe("first");
    expect((await recordObservedHash(handle.db, owner, asset.id, { sha256: HASH_B, pageCount: 7 })).status).toBe("changed");
    // The recorded page count (6) is the earlier file's; the reader's drift check decides about this one.
    const onNew = await createAnnotation(handle.db, owner, {
      assetId: asset.id,
      physicalIndex: 6,
      kind: "highlight",
      anchor: pageAnchor(6),
      loadedSha256: HASH_B,
    });
    expect(onNew.anchor?.documentSha256).toBe(HASH_B);
    expect(onNew.mappingStatus).toBe("resolved");
    // On the Document key the recorded page count still decides.
    const onKnown = await createAnnotation(handle.db, owner, {
      assetId: asset.id,
      physicalIndex: 6,
      kind: "highlight",
      anchor: pageAnchor(6),
      loadedSha256: HASH_A,
    });
    expect(onKnown.anchor?.documentSha256).toBe("arxiv:2305.18290v1");
    expect(onKnown.mappingStatus).toBe("needs_repair");
  });

  it("a stored Document's anchors always name its own hash", async () => {
    const owner = await freshOwner("reader-stored-anchor");
    const { asset } = await receiveUpload(handle.db, blobs, {
      ownerId: owner,
      filename: "own.pdf",
      mediaType: "application/pdf",
      data: Buffer.from(`%PDF-1.4\n% stored ${randomUUID()}\n%%EOF\n`, "latin1"),
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    await handle.db.update(resourceAsset).set({ pageCount: 3, observedSha256: HASH_A }).where(eq(resourceAsset.id, asset.id));
    const row = await createAnnotation(handle.db, owner, {
      assetId: asset.id,
      physicalIndex: 0,
      kind: "highlight",
      anchor: pageAnchor(0),
      loadedSha256: HASH_B,
    });
    expect(row.anchor?.documentSha256).toBe(asset.sha256);
  });
});

describe("deleteAnnotation", () => {
  it("reports whether it deleted, and never deletes another owner's annotation", async () => {
    const owner = await freshOwner("reader-delete");
    const other = await freshOwner("reader-delete-other");
    const { asset } = await linkedDpo(owner, 1);
    const bookmark = await createAnnotation(handle.db, owner, {
      assetId: asset.id,
      physicalIndex: 3,
      kind: "bookmark",
      anchor: pageAnchor(3, []),
    });
    expect(await deleteAnnotation(handle.db, other, bookmark.id)).toBe(false);
    expect(await handle.db.select().from(annotation).where(eq(annotation.id, bookmark.id))).toHaveLength(1);
    expect(await deleteAnnotation(handle.db, owner, "not-a-uuid")).toBe(false);
    expect(await deleteAnnotation(handle.db, owner, bookmark.id)).toBe(true);
    expect(await deleteAnnotation(handle.db, owner, bookmark.id)).toBe(false);
  });
});
