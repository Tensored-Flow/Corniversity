import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FsBlobStore } from "../blob";
import { createDb } from "../client";
import { user } from "../schema/auth";
import { annotation, extractedPage, readingProgress, resourceAsset } from "../schema/library";
import { libraryCollection, libraryCollectionItem, scholarlyIdentifier, scholarlyVersion, scholarlyWork } from "../schema/scholarly";
import {
  ANNOTATION_ENGINE,
  AnnotationConflictError,
  createAnnotation,
  getReadingPosition,
  getReadingProgress,
  LibraryError,
  listReadingNotes,
  markDocumentOpened,
  readingNotesPage,
  receiveUpload,
  reconcileAnnotations,
  saveReadingPosition,
  saveReadingProgress,
  updateAnnotation,
} from "./library";
import { openArxivVersion } from "./scholarly-works";

/**
 * Reading positions ordered on the server's clock, annotations with anchors and conflict-checked
 * edits, reconciliation after extraction, and the notes listing searched and filtered in SQL.
 */
const OWNER = "reading-test-owner";
const OTHER = "reading-test-other";
let handle: ReturnType<typeof createDb>;
let dataRoot: string;
let blobs: FsBlobStore;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 3 });
  dataRoot = mkdtempSync(join(tmpdir(), "corniversity-reading-"));
  blobs = new FsBlobStore(dataRoot);
  await handle.db
    .insert(user)
    .values([
      { id: OWNER, name: "Reading Test", email: "reading-test@example.test" },
      { id: OTHER, name: "Reading Other", email: "reading-other@example.test" },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await handle.close();
  rmSync(dataRoot, { recursive: true, force: true });
});

async function storedDocument(label: string, pages = 3) {
  const { asset } = await receiveUpload(handle.db, blobs, {
    ownerId: OWNER,
    filename: `${label}.pdf`,
    mediaType: "application/pdf",
    data: Buffer.from(`%PDF-1.4\n% ${label} ${randomUUID()}\n%%EOF\n`, "latin1"),
    origin: "web_upload",
    maxBytes: 1_000_000,
  });
  for (let i = 0; i < pages; i++) {
    await handle.db.insert(extractedPage).values({
      assetId: asset.id,
      physicalIndex: i,
      text: `Page ${i + 1}. Every Cauchy sequence converges in a Banach space; theorem ${i + 1} holds.`,
      charCount: 60,
      quality: { scannedSuspected: false, lowText: true, invisibleText: 0, imageCoverage: 0 },
    });
  }
  await handle.db.update(resourceAsset).set({ pageCount: pages }).where(eq(resourceAsset.id, asset.id));
  return { ...asset, pageCount: pages };
}

const anchor = (pageIndex: number, quote?: string) => ({
  v: 1 as const,
  coordSpace: "pdf_user_space" as const,
  pageIndex,
  pageView: [612, 792] as [number, number],
  rotate: 0 as const,
  rects: [[72, 700, 300, 712]],
  ...(quote ? { quote } : {}),
});

describe("the reading-position rule (server clock)", () => {
  it("keeps only a save whose server-clock time is later, whatever the devices' clocks say", async () => {
    const asset = await storedDocument("positions", 20);
    // Phone: moved just now (its own clock may be hours off; only the age it reports counts).
    const phone = await saveReadingPosition(handle.db, OWNER, asset.id, {
      position: { pageIndex: 11, top: 300, left: 0, zoom: 1.25 },
      changedAgoMs: 0,
    });
    expect(phone.accepted).toBe(true);
    // Laptop: a save of a move made five minutes ago arrives later; it is older on the server clock.
    const stale = await saveReadingPosition(handle.db, OWNER, asset.id, {
      position: { pageIndex: 3, top: 0, left: 0, zoom: 1 },
      changedAgoMs: 5 * 60 * 1000,
    });
    expect(stale.accepted).toBe(false);
    expect((await getReadingPosition(handle.db, OWNER, asset.id))?.position).toEqual({ pageIndex: 11, top: 300, left: 0, zoom: 1.25 });
    // The laptop moves again: a fresh save wins.
    await new Promise((r) => setTimeout(r, 15));
    const fresh = await saveReadingPosition(handle.db, OWNER, asset.id, {
      position: { pageIndex: 14, top: 120, left: 8, zoom: 1 },
      changedAgoMs: 0,
    });
    expect(fresh.accepted).toBe(true);
    const state = await getReadingPosition(handle.db, OWNER, asset.id);
    expect(state?.physicalIndex).toBe(14);
    expect(state?.position?.pageIndex).toBe(14);
    expect(await getReadingProgress(handle.db, OWNER, asset.id)).toBe(14);
  });

  it("clamps an absurd age to ten minutes and the page to the Document", async () => {
    const asset = await storedDocument("clamp", 5);
    await saveReadingPosition(handle.db, OWNER, asset.id, { position: { pageIndex: 2, top: 0, left: 0, zoom: 1 }, changedAgoMs: 0 });
    const ancient = await saveReadingPosition(handle.db, OWNER, asset.id, {
      position: { pageIndex: 400, top: 0, left: 0, zoom: 50 },
      changedAgoMs: 23 * 60 * 60 * 1000,
    });
    expect(ancient.accepted).toBe(false);
    await new Promise((r) => setTimeout(r, 15));
    const clamped = await saveReadingPosition(handle.db, OWNER, asset.id, {
      position: { pageIndex: 400, top: 0, left: 0, zoom: 50 },
      changedAgoMs: 0,
    });
    expect(clamped.position).toEqual({ pageIndex: 4, top: 0, left: 0, zoom: 10 });
    await expect(saveReadingPosition(handle.db, OWNER, asset.id, { position: { pageIndex: -1 }, changedAgoMs: 0 })).rejects.toThrow(
      "The reading position is not valid.",
    );
  });

  it("accepts a reader's raw ages: fractional performance.now() differences and ages above a day (clamped)", async () => {
    const asset = await storedDocument("raw ages", 5);
    const fractional = await saveReadingPosition(handle.db, OWNER, asset.id, {
      position: { pageIndex: 2, top: 10.5, left: 0, zoom: 1.25 },
      changedAgoMs: 1534.7000000476837,
    });
    expect(fractional.accepted).toBe(true);
    // A tab left open for two days saves on page hide: dated ten minutes back, so the newer save stays.
    const tabLeftOpen = await saveReadingPosition(handle.db, OWNER, asset.id, {
      position: { pageIndex: 1, top: 0, left: 0, zoom: 1 },
      changedAgoMs: 2 * 24 * 60 * 60 * 1000,
    });
    expect(tabLeftOpen.accepted).toBe(false);
    expect(tabLeftOpen.position.pageIndex).toBe(2);
    const fresh = await storedDocument("raw ages, first save", 5);
    const first = await saveReadingPosition(handle.db, OWNER, fresh.id, {
      position: { pageIndex: 3, top: 0, left: 0, zoom: 1 },
      changedAgoMs: 2 * 24 * 60 * 60 * 1000,
    });
    expect(first.accepted).toBe(true);
    expect(Date.now() - first.effectiveAt!.getTime()).toBeGreaterThanOrEqual(10 * 60 * 1000 - 5_000);
    expect(Date.now() - first.effectiveAt!.getTime()).toBeLessThan(11 * 60 * 1000);
  });

  it("the Text view's page save goes through the same rule and clears the position inside the page", async () => {
    const asset = await storedDocument("text view", 10);
    await saveReadingPosition(handle.db, OWNER, asset.id, { position: { pageIndex: 1, top: 500, left: 20, zoom: 1.5 }, changedAgoMs: 0 });
    await new Promise((r) => setTimeout(r, 15));
    await saveReadingProgress(handle.db, OWNER, asset.id, 6);
    const state = await getReadingPosition(handle.db, OWNER, asset.id);
    expect(state?.physicalIndex).toBe(6);
    expect(state?.position).toEqual({ pageIndex: 6, top: 0, left: 0, zoom: 1.5 });
  });

  it("opening records last_opened_at without touching the position; another owner finds nothing", async () => {
    const asset = await storedDocument("opened", 4);
    await saveReadingPosition(handle.db, OWNER, asset.id, { position: { pageIndex: 3, top: 0, left: 0, zoom: 1 }, changedAgoMs: 0 });
    const before = await getReadingPosition(handle.db, OWNER, asset.id);
    await markDocumentOpened(handle.db, OWNER, asset.id);
    const after = await getReadingPosition(handle.db, OWNER, asset.id);
    expect(after?.lastOpenedAt).toBeInstanceOf(Date);
    expect(after?.position).toEqual(before?.position);
    expect(after?.effectiveAt?.getTime()).toBe(before?.effectiveAt?.getTime());
    await expect(markDocumentOpened(handle.db, OTHER, asset.id)).rejects.toThrow("Asset not found.");
    await expect(
      saveReadingPosition(handle.db, OTHER, asset.id, { position: { pageIndex: 0, top: 0, left: 0, zoom: 1 }, changedAgoMs: 0 }),
    ).rejects.toThrow("Asset not found.");
    expect(await getReadingPosition(handle.db, OTHER, asset.id)).toBeNull();
  });
});

describe("annotations with anchors", () => {
  it("fills the engine and the Document key on the server and compares the quote with the page", async () => {
    const asset = await storedDocument("anchors");
    const matched = await createAnnotation(handle.db, OWNER, {
      assetId: asset.id,
      physicalIndex: 1,
      kind: "highlight",
      color: "brass",
      anchor: anchor(1, "Every  Cauchy sequence\nconverges"),
    });
    expect(matched.anchor?.engine).toBe(ANNOTATION_ENGINE);
    expect(matched.anchor?.documentSha256).toBe(asset.sha256);
    expect(matched.quoteMatched).toBe(true);
    expect(matched.mappingStatus).toBe("resolved");
    expect(matched.selectedText).toBe("Every  Cauchy sequence\nconverges");
    // A quote the text layer garbled still draws: only quote_matched records the disagreement.
    const garbled = await createAnnotation(handle.db, OWNER, {
      assetId: asset.id,
      physicalIndex: 0,
      kind: "highlight",
      anchor: anchor(0, "∀ε>0 ∃N"),
    });
    expect(garbled.quoteMatched).toBe(false);
    expect(garbled.mappingStatus).toBe("resolved");
    // The client cannot choose the engine or the Document key.
    await expect(
      createAnnotation(handle.db, OWNER, {
        assetId: asset.id,
        physicalIndex: 0,
        kind: "highlight",
        anchor: { ...anchor(0), engine: "evil", documentSha256: "0".repeat(64) },
      }),
    ).rejects.toThrow("The annotation's place on the page is not valid.");
    await expect(
      createAnnotation(handle.db, OWNER, { assetId: asset.id, physicalIndex: 2, kind: "highlight", anchor: anchor(1) }),
    ).rejects.toThrow("The annotation's place on the page is not valid.");
    await expect(createAnnotation(handle.db, OWNER, { assetId: asset.id, physicalIndex: 0, kind: "highlight" })).rejects.toThrow(
      "A highlight needs the marked area of the page.",
    );
    await expect(
      createAnnotation(handle.db, OWNER, { assetId: asset.id, physicalIndex: 0, kind: "note", noteMarkdown: "  " }),
    ).rejects.toThrow("Write a note before saving.");
    await expect(
      createAnnotation(handle.db, OWNER, { assetId: asset.id, physicalIndex: 0, kind: "highlight", color: "#ff0000", anchor: anchor(0) }),
    ).rejects.toThrow("Unknown highlight colour.");
    await expect(createAnnotation(handle.db, OTHER, { assetId: asset.id, physicalIndex: 0, kind: "bookmark" })).rejects.toThrow(
      "Asset not found.",
    );
  });

  it("an edit with a stale updatedAt is refused with the current row, and nothing is overwritten", async () => {
    const asset = await storedDocument("conflict");
    const note = await createAnnotation(handle.db, OWNER, { assetId: asset.id, physicalIndex: 0, noteMarkdown: "first" });
    const laptop = await updateAnnotation(handle.db, OWNER, note.id, { noteMarkdown: "laptop text", expectedUpdatedAt: note.updatedAt });
    expect(laptop.noteMarkdown).toBe("laptop text");
    const error = await updateAnnotation(handle.db, OWNER, note.id, {
      noteMarkdown: "phone draft",
      expectedUpdatedAt: note.updatedAt,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AnnotationConflictError);
    expect((error as AnnotationConflictError).current.noteMarkdown).toBe("laptop text");
    const [row] = await handle.db.select().from(annotation).where(eq(annotation.id, note.id));
    expect(row?.noteMarkdown).toBe("laptop text");
    // The edit made against the current version goes through (an ISO string works too).
    const next = await updateAnnotation(handle.db, OWNER, note.id, { color: "moss", expectedUpdatedAt: laptop.updatedAt.toISOString() });
    expect(next.color).toBe("moss");
    await expect(updateAnnotation(handle.db, OTHER, note.id, { noteMarkdown: "x", expectedUpdatedAt: next.updatedAt })).rejects.toThrow(
      "Annotation not found.",
    );
    await expect(
      updateAnnotation(handle.db, OWNER, "not-a-uuid", { noteMarkdown: "x", expectedUpdatedAt: next.updatedAt }),
    ).rejects.toThrow(LibraryError);
  });

  it("reconciling after a re-extraction keeps rect annotations drawable and re-checks quotes and older notes", async () => {
    const asset = await storedDocument("reconcile");
    const highlight = await createAnnotation(handle.db, OWNER, {
      assetId: asset.id,
      physicalIndex: 1,
      kind: "highlight",
      anchor: anchor(1, "theorem 2 holds"),
    });
    const old = await createAnnotation(handle.db, OWNER, {
      assetId: asset.id,
      physicalIndex: 2,
      noteMarkdown: "older note",
      selectedText: "theorem 3 holds",
    });
    // A re-extraction produces different text on page 2 and drops page 3.
    await handle.db.delete(extractedPage).where(eq(extractedPage.assetId, asset.id));
    for (const [i, text] of ["Page 1.", "Page 2. Something else entirely."].entries()) {
      await handle.db.insert(extractedPage).values({
        assetId: asset.id,
        physicalIndex: i,
        text,
        charCount: text.length,
        quality: { scannedSuspected: false, lowText: true, invisibleText: 0, imageCoverage: 0 },
      });
    }
    const result = await reconcileAnnotations(handle.db, OWNER, asset.id);
    expect(result).toEqual({ resolved: 1, needsRepair: 1 });
    const [h] = await handle.db.select().from(annotation).where(eq(annotation.id, highlight.id));
    expect(h?.mappingStatus).toBe("resolved");
    expect(h?.quoteMatched).toBe(false);
    // System updates keep updated_at, so an open edit does not see a conflict.
    expect(h?.updatedAt.getTime()).toBe(highlight.updatedAt.getTime());
    const [o] = await handle.db.select().from(annotation).where(eq(annotation.id, old.id));
    expect(o?.mappingStatus).toBe("needs_repair");
  });

  it("annotations on a linked Document anchor to its arXiv version key", async () => {
    const [work] = await handle.db.insert(scholarlyWork).values({ ownerId: OWNER, title: "Linked paper" }).returning();
    await handle.db
      .insert(scholarlyIdentifier)
      .values({ ownerId: OWNER, workId: work!.id, scheme: "arxiv", value: "2502.00001", source: "fixture" });
    await handle.db.insert(scholarlyVersion).values({
      ownerId: OWNER,
      workId: work!.id,
      label: "arXiv v1",
      arxivId: "2502.00001",
      arxivVersion: 1,
      kind: "preprint",
      source: "fixture",
    });
    const linked = await openArxivVersion(handle.db, OWNER, work!.id, "2502.00001", 1);
    const bookmark = await createAnnotation(handle.db, OWNER, { assetId: linked.id, physicalIndex: 4, kind: "bookmark" });
    expect(bookmark.mappingStatus).toBe("resolved");
    const area = await createAnnotation(handle.db, OWNER, {
      assetId: linked.id,
      physicalIndex: 0,
      noteMarkdown: "figure 1",
      anchor: anchor(0),
    });
    expect(area.anchor?.documentSha256).toBe("arxiv:2502.00001v1");
    expect(area.quoteMatched).toBeNull();
  });
});

describe("listReadingNotes (SQL search, kinds, papers, shelves, paging)", () => {
  it("lists highlights and bookmarks too, filters by kind, paper and collection, and pages", async () => {
    const owner = `notes-owner-${randomUUID().slice(0, 8)}`;
    await handle.db.insert(user).values({ id: owner, name: "Notes", email: `${owner}@example.test` });
    const { asset } = await receiveUpload(handle.db, blobs, {
      ownerId: owner,
      filename: "notes.pdf",
      mediaType: "application/pdf",
      data: Buffer.from(`%PDF-1.4\n% notes ${randomUUID()}\n`, "latin1"),
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    const [work] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Banach spaces paper" }).returning();
    const [version] = await handle.db
      .insert(scholarlyVersion)
      .values({ ownerId: owner, workId: work!.id, label: "Your copy", source: "owner" })
      .returning();
    await handle.db.execute(sql`update resource_asset set scholarly_version_id = ${version!.id} where id = ${asset.id}`);
    const [shelf] = await handle.db.insert(libraryCollection).values({ ownerId: owner, kind: "shelf", name: "Analysis" }).returning();
    await handle.db.insert(libraryCollectionItem).values({ collectionId: shelf!.id, ownerId: owner, workId: work!.id, position: 1 });
    await createAnnotation(handle.db, owner, { assetId: asset.id, physicalIndex: 0, noteMarkdown: "completeness matters here" });
    await createAnnotation(handle.db, owner, {
      assetId: asset.id,
      physicalIndex: 1,
      kind: "highlight",
      anchor: { ...anchor(1, "Cauchy sequences converge") },
    });
    await createAnnotation(handle.db, owner, { assetId: asset.id, physicalIndex: 2, kind: "bookmark" });

    const all = await listReadingNotes(handle.db, owner);
    expect(all.map((n) => n.kind).sort()).toEqual(["bookmark", "highlight", "note"]);
    expect(all.every((n) => n.workId === work!.id && n.item === "Banach spaces paper" && n.versionLabel === "Your copy")).toBe(true);
    expect((await listReadingNotes(handle.db, owner, "Cauchy")).map((n) => n.kind)).toEqual(["highlight"]);
    expect((await listReadingNotes(handle.db, owner, "completeness")).map((n) => n.kind)).toEqual(["note"]);
    expect((await listReadingNotes(handle.db, owner, { kind: "bookmark" })).map((n) => n.page)).toEqual([3]);
    expect(await listReadingNotes(handle.db, owner, { workId: work!.id })).toHaveLength(3);
    expect(await listReadingNotes(handle.db, owner, { workId: randomUUID() })).toHaveLength(0);
    expect(await listReadingNotes(handle.db, owner, { collectionId: shelf!.id })).toHaveLength(3);
    expect(await listReadingNotes(handle.db, owner, { collectionId: "not-a-uuid" })).toHaveLength(0);
    const first = await readingNotesPage(handle.db, owner, { limit: 2 });
    expect(first.notes).toHaveLength(2);
    expect(first.nextOffset).toBe(2);
    const second = await readingNotesPage(handle.db, owner, { limit: 2, offset: first.nextOffset! });
    expect(second.notes).toHaveLength(1);
    expect(second.nextOffset).toBeNull();
    expect(new Set([...first.notes, ...second.notes].map((n) => n.id)).size).toBe(3);
    // Another owner sees none of them, whatever filter they pass.
    expect(await listReadingNotes(handle.db, OTHER, { workId: work!.id })).toHaveLength(0);
    expect(await listReadingNotes(handle.db, OTHER, { collectionId: shelf!.id })).toHaveLength(0);
    await handle.db.delete(readingProgress).where(eq(readingProgress.ownerId, owner));
    await handle.db.delete(user).where(eq(user.id, owner));
  });
});
