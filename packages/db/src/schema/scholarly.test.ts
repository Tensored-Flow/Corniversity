import { eq, sql } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listTables } from "../backup";
import { createDb } from "../client";
import { user } from "./auth";
import { notebookEntry } from "./learning";
import { annotation, readingProgress, resourceAsset } from "./library";
import { libraryCollection, libraryCollectionItem, providerCache, scholarlyIdentifier, scholarlyVersion, scholarlyWork } from "./scholarly";

/**
 * Database-level guarantees of migration 0016: composite keys make cross-owner links impossible,
 * deleting an owner still removes everything (RESTRICT keys included), a paper note loses its link
 * when the work is deleted, a linked Document cannot hold bytes, and the provider cache lives in
 * its own schema that backups never read.
 */
const A = "schema-owner-a";
const B = "schema-owner-b";
let handle: ReturnType<typeof createDb>;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  await handle.db
    .insert(user)
    .values([
      { id: A, name: "Schema A", email: "schema-a@example.test" },
      { id: B, name: "Schema B", email: "schema-b@example.test" },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await handle.close();
});

async function work(ownerId: string, title = "A work") {
  const [row] = await handle.db.insert(scholarlyWork).values({ ownerId, title }).returning();
  return row!;
}

function pgCode(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}

describe("research library schema", () => {
  it("refuses links between two owners' rows (composite foreign keys)", async () => {
    const mine = await work(A);
    const theirs = await work(B);
    const [shelf] = await handle.db.insert(libraryCollection).values({ ownerId: A, kind: "shelf", name: "Mine" }).returning();
    const error = await handle.db
      .insert(libraryCollectionItem)
      .values({ collectionId: shelf!.id, ownerId: A, workId: theirs.id, position: 1 })
      .catch((e: unknown) => e);
    expect(pgCode(error)).toBe("23503");
    const versionError = await handle.db
      .insert(scholarlyVersion)
      .values({ ownerId: A, workId: theirs.id, label: "Your copy", source: "owner" })
      .catch((e: unknown) => e);
    expect(pgCode(versionError)).toBe("23503");
    const identifierError = await handle.db
      .insert(scholarlyIdentifier)
      .values({ ownerId: B, workId: mine.id, scheme: "doi", value: "10.1234/x", source: "owner" })
      .catch((e: unknown) => e);
    expect(pgCode(identifierError)).toBe("23503");
  });

  it("keeps an arXiv id and version together and unique per owner", async () => {
    const w = await work(A);
    const half = await handle.db
      .insert(scholarlyVersion)
      .values({ ownerId: A, workId: w.id, label: "arXiv", arxivId: "2305.18290", source: "arxiv" })
      .catch((e: unknown) => e);
    expect(pgCode(half)).toBe("23514");
    await handle.db
      .insert(scholarlyVersion)
      .values({ ownerId: A, workId: w.id, label: "arXiv v1", arxivId: "2305.18290", arxivVersion: 1, source: "arxiv" });
    const twice = await handle.db
      .insert(scholarlyVersion)
      .values({ ownerId: A, workId: w.id, label: "arXiv v1", arxivId: "2305.18290", arxivVersion: 1, source: "arxiv" })
      .catch((e: unknown) => e);
    expect(pgCode(twice)).toBe("23505");
    // Versions without an arXiv id are not constrained by that index.
    await handle.db.insert(scholarlyVersion).values([
      { ownerId: A, workId: w.id, label: "Your copy", source: "owner" },
      { ownerId: A, workId: w.id, label: "Your copy", source: "owner" },
    ]);
  });

  it("a linked Document holds no bytes and carries the arXiv version key", async () => {
    const w = await work(A);
    const [v] = await handle.db
      .insert(scholarlyVersion)
      .values({ ownerId: A, workId: w.id, label: "arXiv v2", arxivId: "1706.03762", arxivVersion: 2, source: "arxiv" })
      .returning();
    const base = {
      ownerId: A,
      filename: "1706.03762v2.pdf",
      mediaType: "application/pdf",
      sizeBytes: 0,
      status: "linked_remote" as const,
      origin: "arxiv_link" as const,
      localOnly: false,
      scholarlyVersionId: v!.id,
    };
    const withBytes = await handle.db
      .insert(resourceAsset)
      .values({ ...base, sha256: "arxiv:1706.03762v2", storageKey: "00000000-0000-4000-8000-000000000000" })
      .catch((e: unknown) => e);
    expect(pgCode(withBytes)).toBe("23514");
    const realHash = await handle.db
      .insert(resourceAsset)
      .values({ ...base, sha256: "a".repeat(64) })
      .catch((e: unknown) => e);
    expect(pgCode(realHash)).toBe("23514");
    const [linked] = await handle.db
      .insert(resourceAsset)
      .values({ ...base, sha256: "arxiv:1706.03762v2" })
      .returning();
    expect(linked!.status).toBe("linked_remote");
    // A version with a Document cannot be deleted from under it.
    const restrict = await handle.db
      .delete(scholarlyVersion)
      .where(eq(scholarlyVersion.id, v!.id))
      .catch((e: unknown) => e);
    expect(pgCode(restrict)).toBe("23503");
  });

  it("a paper note loses its link when its work is deleted, and cannot point at another owner's work", async () => {
    const w = await work(A, "Deleted work");
    const [entry] = await handle.db
      .insert(notebookEntry)
      .values({ ownerId: A, title: "Paper note", bodyMarkdown: "notes", scholarlyWorkId: w.id })
      .returning();
    await handle.db.delete(scholarlyWork).where(eq(scholarlyWork.id, w.id));
    const [after] = await handle.db.select().from(notebookEntry).where(eq(notebookEntry.id, entry!.id));
    expect(after!.scholarlyWorkId).toBeNull();
    const theirs = await work(B);
    const cross = await handle.db
      .insert(notebookEntry)
      .values({ ownerId: A, title: "Cross", scholarlyWorkId: theirs.id })
      .catch((e: unknown) => e);
    expect(pgCode(cross)).toBe("23503");
  });

  it("deleting an owner removes their works, versions, Documents, shelves and notes", async () => {
    const owner = "schema-owner-deleted";
    await handle.db.insert(user).values({ id: owner, name: "Deleted", email: "schema-deleted@example.test" });
    const w = await work(owner);
    const tomb = await work(owner, "Tombstone");
    await handle.db.update(scholarlyWork).set({ mergedIntoId: w.id }).where(eq(scholarlyWork.id, tomb.id));
    const [v] = await handle.db
      .insert(scholarlyVersion)
      .values({ ownerId: owner, workId: w.id, label: "arXiv v1", arxivId: "2305.18290", arxivVersion: 1, source: "arxiv" })
      .returning();
    const [doc] = await handle.db
      .insert(resourceAsset)
      .values({
        ownerId: owner,
        filename: "2305.18290v1.pdf",
        mediaType: "application/pdf",
        sizeBytes: 0,
        sha256: "arxiv:2305.18290v1",
        status: "linked_remote",
        origin: "arxiv_link",
        localOnly: false,
        scholarlyVersionId: v!.id,
      })
      .returning();
    const [shelf] = await handle.db.insert(libraryCollection).values({ ownerId: owner, kind: "trail", name: "Trail" }).returning();
    await handle.db
      .insert(libraryCollectionItem)
      .values({ collectionId: shelf!.id, ownerId: owner, workId: w.id, position: 1, reason: "why" });
    await handle.db.insert(notebookEntry).values({ ownerId: owner, title: "Note", scholarlyWorkId: w.id });
    await handle.db.insert(readingProgress).values({ ownerId: owner, assetId: doc!.id, physicalIndex: 2 });
    await handle.db.insert(annotation).values({
      ownerId: owner,
      assetId: doc!.id,
      locator: { kind: "pdf", sourceVersionId: "asset:x", physicalPageIndex: 0 },
      kind: "bookmark",
    });
    await handle.db.delete(user).where(eq(user.id, owner));
    const left = await handle.db.execute(sql`
      select (select count(*) from scholarly_work where owner_id = ${owner})::int as works,
             (select count(*) from scholarly_version where owner_id = ${owner})::int as versions,
             (select count(*) from resource_asset where owner_id = ${owner})::int as documents,
             (select count(*) from library_collection_item where owner_id = ${owner})::int as items`);
    expect(left.rows[0]).toEqual({ works: 0, versions: 0, documents: 0, items: 0 });
  });

  it("keeps the provider cache outside the schema backups read", async () => {
    await handle.db
      .insert(providerCache)
      .values({
        key: "f".repeat(64),
        provider: "openalex",
        status: 200,
        payload: { contentType: "application/json", body: "{}" },
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
      })
      .onConflictDoNothing();
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const tables = await listTables(client);
      expect(tables).toContain("scholarly_work");
      expect(tables).toContain("library_collection_item");
      expect(tables).not.toContain("provider_cache");
    } finally {
      await client.end();
    }
    const refused = await handle.db
      .insert(providerCache)
      .values({
        key: "e".repeat(64),
        provider: "openalex",
        status: 429,
        payload: { contentType: null, body: "" },
        fetchedAt: new Date(),
        expiresAt: new Date(),
      })
      .catch((e: unknown) => e);
    expect(pgCode(refused)).toBe("23514");
  });
});
