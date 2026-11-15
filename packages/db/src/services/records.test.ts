import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FsBlobStore } from "../blob";
import { createDb } from "../client";
import { user } from "../schema/auth";
import { readingProgress } from "../schema/library";
import { scholarlyIdentifier, scholarlyVersion, scholarlyWork } from "../schema/scholarly";
import { createAnnotation, markDocumentOpened, receiveUpload, saveReadingPosition } from "./library";
import { addToCollection, createCollection } from "./library-collections";
import { createEntry } from "./notebook";
import { buildRecordsBundle, renderMarkdownExport } from "./records";

/**
 * The records export carries the research library (contract §6 records.ts): works with their
 * identifiers, shelves and trails with reasons, reading positions, and annotations with kind,
 * colour, quote and the version they were made on. Another owner's export holds none of it.
 */
const OTHER = "records-test-other";
let handle: ReturnType<typeof createDb>;
let dataRoot: string;
let blobs: FsBlobStore;
let owner = "";

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  dataRoot = mkdtempSync(join(tmpdir(), "corniversity-records-"));
  blobs = new FsBlobStore(dataRoot);
  owner = `records-owner-${randomUUID().slice(0, 8)}`;
  await handle.db
    .insert(user)
    .values([
      { id: owner, name: "Records", email: `${owner}@example.test` },
      { id: OTHER, name: "Records Other", email: "records-other@example.test" },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await handle.db.delete(readingProgress).where(eq(readingProgress.ownerId, owner));
  await handle.close();
  rmSync(dataRoot, { recursive: true, force: true });
});

describe("records export: the research library", () => {
  it("includes works with identifiers, collections with reasons, reading positions and annotations with their version", async () => {
    const [work] = await handle.db
      .insert(scholarlyWork)
      .values({
        ownerId: owner,
        title: "The Large-N Limit",
        authors: [{ name: "Juan Maldacena" }],
        publicationYear: 1999,
        favourite: true,
        savedAt: new Date(),
      })
      .returning();
    await handle.db.insert(scholarlyIdentifier).values([
      { ownerId: owner, workId: work!.id, scheme: "arxiv", value: "hep-th/9711200", source: "fixture" },
      { ownerId: owner, workId: work!.id, scheme: "doi", value: "10.1023/a:1026654312961", source: "fixture" },
    ]);
    const [version] = await handle.db
      .insert(scholarlyVersion)
      .values({ ownerId: owner, workId: work!.id, label: "arXiv v3", arxivId: "hep-th/9711200", arxivVersion: 3, source: "fixture" })
      .returning();
    const { asset } = await receiveUpload(handle.db, blobs, {
      ownerId: owner,
      filename: "maldacena.pdf",
      mediaType: "application/pdf",
      data: Buffer.from(`%PDF-1.4\n% records ${randomUUID()}\n%%EOF\n`, "latin1"),
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    await handle.db.execute(sql`update resource_asset set scholarly_version_id = ${version!.id}, page_count = 10 where id = ${asset.id}`);
    await createAnnotation(handle.db, owner, {
      assetId: asset.id,
      physicalIndex: 2,
      kind: "highlight",
      color: "moss",
      anchor: {
        v: 1,
        coordSpace: "pdf_user_space",
        pageIndex: 2,
        pageView: [612, 792],
        rotate: 0,
        rects: [[72, 700, 300, 712]],
        quote: "the large N limit",
      },
    });
    await markDocumentOpened(handle.db, owner, asset.id);
    await saveReadingPosition(handle.db, owner, asset.id, { position: { pageIndex: 4, top: 200, left: 0, zoom: 1 }, changedAgoMs: 0 });
    const trail = await createCollection(handle.db, owner, { kind: "trail", name: "Holography", description: "From strings to fields." });
    await addToCollection(handle.db, owner, trail.id, work!.id, "Where the duality is stated.");
    await createEntry(handle.db, owner, { title: "Coupling", bodyMarkdown: "$\\lambda = g^2 N$", kind: "note", scholarlyWorkId: work!.id });

    const bundle = await buildRecordsBundle(handle.db, owner);
    expect(bundle.format).toBe("corniversity-records/1");
    expect(bundle.library.works).toEqual([
      expect.objectContaining({
        id: work!.id,
        title: "The Large-N Limit",
        authors: ["Juan Maldacena"],
        favourite: true,
        identifiers: [
          expect.objectContaining({ scheme: "arxiv", value: "hep-th/9711200", source: "fixture" }),
          expect.objectContaining({ scheme: "doi", value: "10.1023/a:1026654312961" }),
        ],
      }),
    ]);
    expect(bundle.library.collections).toEqual([
      expect.objectContaining({
        kind: "trail",
        name: "Holography",
        description: "From strings to fields.",
        items: [expect.objectContaining({ step: 1, workId: work!.id, title: "The Large-N Limit", reason: "Where the duality is stated." })],
      }),
    ]);
    expect(bundle.library.readingPositions).toEqual([
      expect.objectContaining({ assetId: asset.id, item: "The Large-N Limit", version: "arXiv v3", page: 5 }),
    ]);
    expect(bundle.annotations).toEqual([
      expect.objectContaining({
        kind: "highlight",
        colour: "moss",
        quote: "the large N limit",
        page: 3,
        item: "The Large-N Limit",
        work: { id: work!.id, title: "The Large-N Limit" },
        version: { label: "arXiv v3", arxivId: "hep-th/9711200", arxivVersion: 3 },
      }),
    ]);
    expect(bundle.notebook.map((n) => n.scholarlyWorkId)).toEqual([work!.id]);

    const markdown = renderMarkdownExport(bundle);
    expect(markdown).toContain("## Research library");
    expect(markdown).toContain("- **The Large-N Limit** (1999) · Juan Maldacena · arXiv:hep-th/9711200, doi:10.1023/a:1026654312961");
    expect(markdown).toContain("### Trail: Holography");
    expect(markdown).toContain("1. The Large-N Limit — Where the duality is stated.");
    expect(markdown).toContain("- The Large-N Limit (arXiv v3) · page 5");
    expect(markdown).toContain('The Large-N Limit (arXiv v3) · highlight, moss · page 3 — on: "the large N limit"');
    expect(markdown).toContain("*note · paper: The Large-N Limit");

    // Another owner's export holds nothing of it.
    const other = await buildRecordsBundle(handle.db, OTHER);
    expect(other.library).toEqual({ works: [], collections: [], readingPositions: [] });
    expect(other.annotations).toEqual([]);
    expect(renderMarkdownExport(other)).not.toContain("Research library");
  });
});
