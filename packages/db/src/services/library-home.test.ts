import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FsBlobStore } from "../blob";
import { createDb } from "../client";
import { user } from "../schema/auth";
import { readingProgress, resourceAsset } from "../schema/library";
import { scholarlyVersion, scholarlyWork } from "../schema/scholarly";
import { listStoredAssets, markDocumentOpened, readingNotesPage, receiveUpload, saveReadingPosition } from "./library";
import { listCollections } from "./library-collections";
import { continueReading, documentsForWorks } from "./library-home";
import { listWorks, searchMyLibrary } from "./scholarly-works";

/** The Library home's reads: Continue reading (at most three, newest first, with the page) and the Documents of listed papers. */
const OTHER = "home-test-other";
let handle: ReturnType<typeof createDb>;
let dataRoot: string;
let blobs: FsBlobStore;
let owner = "";

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  dataRoot = mkdtempSync(join(tmpdir(), "corniversity-home-"));
  blobs = new FsBlobStore(dataRoot);
  owner = `home-owner-${randomUUID().slice(0, 8)}`;
  await handle.db
    .insert(user)
    .values([
      { id: owner, name: "Home", email: `${owner}@example.test` },
      { id: OTHER, name: "Home Other", email: "home-other@example.test" },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await handle.db.delete(readingProgress).where(eq(readingProgress.ownerId, owner));
  await handle.close();
  rmSync(dataRoot, { recursive: true, force: true });
});

async function file(label: string, title?: string) {
  const { asset } = await receiveUpload(handle.db, blobs, {
    ownerId: owner,
    filename: `${label}.pdf`,
    mediaType: "application/pdf",
    data: Buffer.from(`%PDF-1.4\n% ${label} ${randomUUID()}\n%%EOF\n`, "latin1"),
    origin: "web_upload",
    maxBytes: 1_000_000,
  });
  await handle.db
    .update(resourceAsset)
    .set({ pageCount: 12, ...(title ? { confirmedTitle: title } : {}) })
    .where(eq(resourceAsset.id, asset.id));
  return asset;
}

async function paperFile(label: string, workTitle: string) {
  const asset = await file(label);
  const [work] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: workTitle, savedAt: new Date() }).returning();
  const [version] = await handle.db
    .insert(scholarlyVersion)
    .values({ ownerId: owner, workId: work!.id, label: "Your copy", source: "owner" })
    .returning();
  await handle.db.execute(sql`update resource_asset set scholarly_version_id = ${version!.id} where id = ${asset.id}`);
  return { asset, work: work! };
}

const pause = () => new Promise((r) => setTimeout(r, 15));

describe("continue reading", () => {
  it("lists the three Documents opened most recently, newest first, with the paper's title and the saved page", async () => {
    const plain = await file("plain", "Lecture notes on measure");
    const unnamed = await file("unnamed-file");
    const { asset: paper, work } = await paperFile("paper", "A paper on operators");
    const deleted = await file("deleted", "Deleted notes");
    const oldest = await file("oldest", "Opened first");
    expect(await continueReading(handle.db, owner)).toEqual([]);

    for (const a of [oldest, plain, unnamed, deleted, paper]) {
      await markDocumentOpened(handle.db, owner, a.id);
      await pause();
    }
    await saveReadingPosition(handle.db, owner, paper.id, { position: { pageIndex: 6, top: 120, left: 0, zoom: 1 }, changedAgoMs: 0 });
    // A deleted item is never offered.
    await handle.db.update(resourceAsset).set({ deletedAt: new Date(), status: "deleted" }).where(eq(resourceAsset.id, deleted.id));

    const items = await continueReading(handle.db, owner);
    expect(items.map((i) => [i.assetId, i.title, i.page])).toEqual([
      [paper.id, "A paper on operators", 7],
      [unnamed.id, "unnamed-file.pdf", 1],
      [plain.id, "Lecture notes on measure", 1],
    ]);
    expect(items[0]).toMatchObject({ workId: work.id, versionLabel: "Your copy", pageCount: 12 });
    expect(items[1]).toMatchObject({ workId: null, versionLabel: null });
    // Opening an older one again brings it to the front.
    await pause();
    await markDocumentOpened(handle.db, owner, oldest.id);
    expect((await continueReading(handle.db, owner))[0]!.assetId).toBe(oldest.id);
    expect(await continueReading(handle.db, owner, 1)).toHaveLength(1);
  });

  it("lists a paper's live Documents, the most recently opened first, and nothing of another owner's", async () => {
    const { asset: first, work } = await paperFile("first-copy", "Two copies");
    const second = await file("second-copy");
    const [version] = await handle.db
      .insert(scholarlyVersion)
      .values({ ownerId: owner, workId: work.id, label: "Published version", source: "owner" })
      .returning();
    await handle.db.execute(sql`update resource_asset set scholarly_version_id = ${version!.id} where id = ${second.id}`);
    // Newest first while neither has been opened, then the one opened.
    expect((await documentsForWorks(handle.db, owner, [work.id])).map((d) => d.asset.id)).toEqual([second.id, first.id]);
    await markDocumentOpened(handle.db, owner, first.id);
    const docs = await documentsForWorks(handle.db, owner, [work.id, "not-a-uuid"]);
    expect(docs.map((d) => [d.asset.id, d.versionLabel, d.workId])).toEqual([
      [first.id, "Your copy", work.id],
      [second.id, "Published version", work.id],
    ]);
    expect(docs[0]!.lastOpenedAt).toBeInstanceOf(Date);
    await handle.db.update(resourceAsset).set({ deletedAt: new Date() }).where(eq(resourceAsset.id, second.id));
    expect((await documentsForWorks(handle.db, owner, [work.id])).map((d) => d.asset.id)).toEqual([first.id]);

    expect(await documentsForWorks(handle.db, OTHER, [work.id])).toEqual([]);
    expect(await continueReading(handle.db, OTHER)).toEqual([]);
    expect(await documentsForWorks(handle.db, owner, [])).toEqual([]);
  });
});

describe("a new owner's empty library", () => {
  it("every list the home reads is empty, nothing is invented, and another owner's papers never appear", async () => {
    const fresh = `home-empty-${randomUUID().slice(0, 8)}`;
    await handle.db.insert(user).values({ id: fresh, name: "Empty", email: `${fresh}@example.test` });
    // The other owner of this file has papers and opened files; none of them reach the new owner.
    expect(await continueReading(handle.db, fresh)).toEqual([]);
    for (const view of ["saved", "read_later", "favourites", "read", "recent"] as const)
      expect(await listWorks(handle.db, fresh, view, { limit: 21 }), view).toEqual([]);
    expect(await listCollections(handle.db, fresh)).toEqual([]);
    expect(await listStoredAssets(handle.db, fresh)).toEqual([]);
    expect(await documentsForWorks(handle.db, fresh, [])).toEqual([]);
    expect(await searchMyLibrary(handle.db, fresh, "anything")).toEqual([]);
    expect(await readingNotesPage(handle.db, fresh)).toEqual({ notes: [], nextOffset: null });
  });
});
