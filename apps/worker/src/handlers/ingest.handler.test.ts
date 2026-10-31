import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsBlobStore } from "@corniversity/db/blob";
import { createDb } from "@corniversity/db/client";
import { getEnv } from "@corniversity/db/env";
import { user } from "@corniversity/db/schema/auth";
import { resourceAsset } from "@corniversity/db/schema/index";
import {
  confirmMetadata,
  getAsset,
  listPages,
  permittedPassagesForCourse,
  receiveUpload,
  searchAsset,
  setPermission,
} from "@corniversity/db/services/library";
import { eq } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type HandlerContext, NonRetryableError } from "./index";
import { ingestHandler } from "./ingest";

/**
 * Builds a small but structurally valid PDF (correct xref offsets) with one text page per
 * entry and, optionally, a /PageLabels tree giving roman numerals to the first two pages. This
 * lets the tests check physical index and printed label separately without a binary fixture.
 */
export function makePdf(pages: string[], withLabels: boolean): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const pageIds: number[] = [];
  const pageObjects: string[] = [];
  let nextId = 4;
  for (const text of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    // pdf.js drops glyphs placed beyond the page edge, as a real viewer would, so wrap at ~75 characters.
    const lines = text.split("\n").flatMap((line) => line.match(/.{1,75}(?:\s|$)|\S+/g) ?? [""]);
    const stream = `BT /F1 12 Tf 72 720 Td 14 TL ${lines.map((l) => `(${esc(l.trimEnd())}) Tj T*`).join(" ")} ET`;
    pageObjects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    );
    pageObjects.push(`${contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream\nendobj\n`);
  }
  const labels = withLabels ? " /PageLabels << /Nums [0 << /S /r >> 2 << /S /D >>] >>" : "";
  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R${labels} >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`,
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    ...pageObjects,
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += object;
  }
  const xrefOffset = Buffer.byteLength(body, "latin1");
  const count = objects.length + 1;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `${xref}trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

const OWNER = "ingest-test-owner";
let handle: ReturnType<typeof createDb>;
let ctx: HandlerContext;
let blobs: FsBlobStore;
let dataRoot: string;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 3 });
  dataRoot = mkdtempSync(join(tmpdir(), "corniversity-ingest-"));
  blobs = new FsBlobStore(dataRoot);
  ctx = { db: handle.db, env: { ...getEnv(), BLOB_STORE: "fs", CORNIVERSITY_DATA_ROOT: dataRoot }, boss: {} as PgBoss };
  await handle.db.insert(user).values({ id: OWNER, name: "Ingest Test", email: "ingest-test@example.test" }).onConflictDoNothing();
});

afterAll(async () => {
  await handle.close();
  rmSync(dataRoot, { recursive: true, force: true });
});

async function storedAsset(filename: string, bytes: Buffer, options: { permit?: boolean } = {}): Promise<string> {
  const { asset } = await receiveUpload(handle.db, blobs, {
    ownerId: OWNER,
    filename,
    mediaType: "application/pdf",
    data: bytes,
    origin: "web_upload",
    maxBytes: 50_000_000,
  });
  await confirmMetadata(handle.db, OWNER, asset.id, { title: filename, authors: [], courseIds: ["MAT-230"] });
  if (options.permit ?? true) await setPermission(handle.db, OWNER, asset.id, "local_extract", "allowed", "test");
  // requestIngestion would do this before enqueueing; the test calls the handler directly.
  await handle.db.update(resourceAsset).set({ status: "processing" }).where(eq(resourceAsset.id, asset.id));
  return asset.id;
}

const payload = (assetId: string) => ({ idempotencyKey: `ingest:test:${assetId}`, ownerId: OWNER, assetId });

describe("ingestHandler", () => {
  it("extracts every page with physical index and printed label, segments it and indexes it", async () => {
    const pdf = makePdf(
      [
        "Preface\n\nThis book treats normed spaces and their completions.",
        "Contents\n\nChapter 1. Banach spaces",
        "Definition 1.1\nA Banach space is a complete normed space over the real or complex numbers, in which every Cauchy sequence converges to a limit in the space.",
      ],
      true,
    );
    const assetId = await storedAsset("banach.pdf", pdf);
    const result = await ingestHandler(ctx, payload(assetId));
    expect(result).toMatchObject({ pages: 3, printedLabels: true });

    const asset = (await getAsset(handle.db, OWNER, assetId))!;
    expect(asset.status).toBe("processed");
    expect(asset.pageCount).toBe(3);
    expect(asset.printedLabelsPresent).toBe(true);

    const pages = await listPages(handle.db, assetId);
    expect(pages.map((p) => p.physicalIndex)).toEqual([0, 1, 2]);
    expect(pages.map((p) => p.printedLabel)).toEqual(["i", "ii", "1"]);
    expect(pages[2]!.text).toContain("Banach space");

    const hits = await searchAsset(handle.db, assetId, "Cauchy sequence");
    expect(hits[0]?.physical_index).toBe(2);
    expect(hits[0]?.printed_label).toBe("1");

    // Tutoring evidence: nothing until external AI processing is allowed, then only this course.
    expect(await permittedPassagesForCourse(handle.db, OWNER, "MAT-230", "Banach")).toEqual([]);
    await setPermission(handle.db, OWNER, assetId, "external_ai", "allowed", "CC BY");
    const passages = await permittedPassagesForCourse(handle.db, OWNER, "MAT-230", "Banach");
    expect(passages.length).toBeGreaterThan(0);
    expect(passages[0]!.physical_index).toBe(2);
    expect(passages[0]!.printed_label).toBe("1");
    expect(await permittedPassagesForCourse(handle.db, OWNER, "PHY-210", "Banach")).toEqual([]);
  });

  it("a corrupt PDF fails cleanly: the asset is rejected with a reason and the job is not retried", async () => {
    const assetId = await storedAsset("broken.pdf", Buffer.from(`%PDF-1.7\n${"garbage ".repeat(200)}`, "latin1"));
    await expect(ingestHandler(ctx, payload(assetId))).rejects.toBeInstanceOf(NonRetryableError);
    const asset = (await getAsset(handle.db, OWNER, assetId))!;
    expect(asset.status).toBe("rejected");
    expect(asset.rejectionReason).toMatch(/could not be parsed/i);
    expect(await listPages(handle.db, assetId)).toEqual([]);
  });

  it("a permission revoked after queueing stops the job before any text is written", async () => {
    const assetId = await storedAsset("revoked.pdf", makePdf(["Some text that must never be extracted into the index."], false));
    await setPermission(handle.db, OWNER, assetId, "local_extract", "denied", "licence unclear");
    const result = await ingestHandler(ctx, payload(assetId));
    expect(result).toMatchObject({ skipped: true });
    expect((await getAsset(handle.db, OWNER, assetId))!.status).toBe("validated");
    expect(await listPages(handle.db, assetId)).toEqual([]);
  });

  it("never runs for an item whose permission was never granted", async () => {
    const assetId = await storedAsset("unpermitted.pdf", makePdf(["Text behind an unknown permission."], false), { permit: false });
    const result = await ingestHandler(ctx, payload(assetId));
    expect(result).toMatchObject({ skipped: true, reason: "extraction not permitted" });
    expect(await listPages(handle.db, assetId)).toEqual([]);
  });
});
