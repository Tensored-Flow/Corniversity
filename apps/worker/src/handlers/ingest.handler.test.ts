import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsBlobStore } from "@corniversity/db/blob";
import { createDb } from "@corniversity/db/client";
import { getEnv } from "@corniversity/db/env";
import { user } from "@corniversity/db/schema/auth";
import {
  annotation,
  extractedPage,
  jobRecord,
  passage,
  resourceAsset,
  scholarlyIdentifier,
  scholarlyVersion,
  scholarlyWork,
} from "@corniversity/db/schema/index";
import {
  confirmMetadata,
  createAnnotation,
  deleteAsset,
  getAsset,
  listPages,
  permittedPassagesForCourse,
  receiveUpload,
  searchAsset,
  setPermission,
} from "@corniversity/db/services/library";
import { attachUploadToWork, openArxivVersion } from "@corniversity/db/services/scholarly-works";
import { eq } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { extractText, getDocumentProxy } from "unpdf";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type HandlerContext, NonRetryableError } from "./index";
import { EXTRACTION_PDF_OPTIONS, ingestHandler } from "./ingest";
import { makePdf } from "./test-pdf";

export { makePdf };

/**
 * A generated one-page PDF whose text uses a non-embedded CID font with the predefined CMap
 * UniJIS-UCS2-H (U+65E5 U+672C U+8A9E, then "CMap" through the same CMap). Decoding it needs CMap
 * files, which unpdf uses only when it can resolve pdfjs-dist, so it tells the two option sets apart.
 */
function makeCMapPdf(): Buffer {
  const content = "BT /F1 24 Tf 72 700 Td <65E5672C8A9E> Tj 0 -40 Td <0043004D00610070> Tj ET";
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type0 /BaseFont /KozMinPro-Regular-Acro /Encoding /UniJIS-UCS2-H /DescendantFonts [5 0 R] >>\nendobj\n",
    "5 0 obj\n<< /Type /Font /Subtype /CIDFontType0 /BaseFont /KozMinPro-Regular-Acro /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 4 >> /FontDescriptor 6 0 R /DW 1000 >>\nendobj\n",
    "6 0 obj\n<< /Type /FontDescriptor /FontName /KozMinPro-Regular-Acro /Flags 4 /FontBBox [0 -120 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >>\nendobj\n",
    `7 0 obj\n<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];
  let body = "%PDF-1.7\n";
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

/** Whether unpdf can resolve pdfjs-dist, checked the way unpdf itself checks it. */
function pdfjsDistVisibleFromUnpdf(): boolean {
  try {
    const unpdfEntry = createRequire(import.meta.url).resolve("unpdf");
    createRequire(unpdfEntry).resolve("pdfjs-dist/package.json");
    return true;
  } catch {
    return false;
  }
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
    // A learner asks in sentences: the passage sharing the most words comes first, although no
    // passage contains every word of the question; a question sharing none retrieves nothing.
    const asked = await permittedPassagesForCourse(
      handle.db,
      OWNER,
      "MAT-230",
      "Why must every Cauchy sequence converge in a Banach space?",
    );
    expect(asked[0]?.physical_index).toBe(2);
    expect(await permittedPassagesForCourse(handle.db, OWNER, "MAT-230", "What did Lorentz transform?")).toEqual([]);
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

  it("extracts the same text whether or not the reader's pdfjs-dist is installed", async () => {
    const bytes = makeCMapPdf();
    const assetId = await storedAsset("cmap.pdf", bytes);
    await ingestHandler(ctx, payload(assetId));
    const pages = await listPages(handle.db, assetId);
    expect(pages).toHaveLength(1);
    // unpdf's own defaults (the production worker image installs without pdfjs-dist) cannot
    // decode a predefined CMap, so this page has no text there; it must have none here either.
    expect(pages[0]!.text).toBe("");

    // Control: where pdfjs-dist resolves (a full install), an unpinned call decodes the page, so
    // an ingest call without the pinned options would fail the assertion above.
    if (pdfjsDistVisibleFromUnpdf()) {
      const unpinned = await getDocumentProxy(new Uint8Array(bytes), { maxImageSize: 16_777_216 });
      const { text } = await extractText(unpinned, { mergePages: true });
      await unpinned.loadingTask.destroy();
      expect(text).toContain("日本語");
    }
  });

  it("never runs for an item whose permission was never granted", async () => {
    const assetId = await storedAsset("unpermitted.pdf", makePdf(["Text behind an unknown permission."], false), { permit: false });
    const result = await ingestHandler(ctx, payload(assetId));
    expect(result).toMatchObject({ skipped: true, reason: "extraction not permitted" });
    expect(await listPages(handle.db, assetId)).toEqual([]);
  });

  it("re-checks every annotation after each successful extraction", async () => {
    const assetId = await storedAsset(
      "reconcile.pdf",
      makePdf(["Every Cauchy sequence in a complete space converges to a limit.", "A second page of text."], false),
    );
    // Made on the page view before any text was extracted: not yet verifiable.
    const highlight = await createAnnotation(handle.db, OWNER, {
      assetId,
      physicalIndex: 0,
      kind: "highlight",
      anchor: {
        v: 1,
        coordSpace: "pdf_user_space",
        pageIndex: 0,
        pageView: [612, 792],
        rotate: 0,
        rects: [[72, 700, 300, 712]],
        quote: "Every Cauchy sequence",
      },
    });
    expect(highlight.mappingStatus).toBe("needs_repair");
    const stray = await createAnnotation(handle.db, OWNER, { assetId, physicalIndex: 7, noteMarkdown: "a page this file does not have" });
    const result = await ingestHandler(ctx, payload(assetId));
    expect(result).toMatchObject({ pages: 2, annotationsNeedingRepair: 1 });
    const [h] = await handle.db.select().from(annotation).where(eq(annotation.id, highlight.id));
    expect(h?.mappingStatus).toBe("resolved");
    expect(h?.quoteMatched).toBe(true);
    const [s] = await handle.db.select().from(annotation).where(eq(annotation.id, stray.id));
    expect(s?.mappingStatus).toBe("needs_repair");
    // A re-extraction runs the check again.
    await handle.db.update(resourceAsset).set({ status: "processing" }).where(eq(resourceAsset.id, assetId));
    expect(await ingestHandler(ctx, payload(assetId))).toMatchObject({ annotationsNeedingRepair: 1 });
  });

  it("carries rects made on arXiv's file over to the owner's promoted copy only when the page geometry matches", async () => {
    const outcomes: Record<string, { status: string; key: string | undefined; assetKey: string }> = {};
    for (const [label, pageView] of [
      ["same geometry", [612, 792]],
      ["other geometry", [595, 842]],
    ] as const) {
      const arxivId = label === "same geometry" ? "2509.50001" : "2509.50002";
      const [work] = await handle.db
        .insert(scholarlyWork)
        .values({ ownerId: OWNER, title: `Paper ${arxivId}` })
        .returning();
      await handle.db
        .insert(scholarlyIdentifier)
        .values({ ownerId: OWNER, workId: work!.id, scheme: "arxiv", value: arxivId, source: "fixture" });
      const [version] = await handle.db
        .insert(scholarlyVersion)
        .values({ ownerId: OWNER, workId: work!.id, kind: "preprint", label: "arXiv v1", arxivId, arxivVersion: 1, source: "fixture" })
        .returning();
      const linked = await openArxivVersion(handle.db, OWNER, work!.id, arxivId, 1);
      // Made in the reader on arXiv's file (a 612 × 792 page), before any copy was stored.
      const highlight = await createAnnotation(handle.db, OWNER, {
        assetId: linked.id,
        physicalIndex: 0,
        kind: "highlight",
        anchor: { v: 1, coordSpace: "pdf_user_space", pageIndex: 0, pageView, rotate: 0, rects: [[72, 700, 300, 712]] },
      });
      // The owner's own copy (bytes the reader never saw) is promoted in place, then extracted.
      await attachUploadToWork(handle.db, blobs, {
        ownerId: OWNER,
        workId: work!.id,
        versionId: version!.id,
        filename: `${arxivId}.pdf`,
        mediaType: "application/pdf",
        data: makePdf([`Every Cauchy sequence converges (${label}).`], false),
        maxBytes: 50_000_000,
      });
      await setPermission(handle.db, OWNER, linked.id, "local_extract", "allowed", "test");
      await handle.db.update(resourceAsset).set({ status: "processing" }).where(eq(resourceAsset.id, linked.id));
      await ingestHandler(ctx, payload(linked.id));
      const [h] = await handle.db.select().from(annotation).where(eq(annotation.id, highlight.id));
      outcomes[label] = {
        status: h!.mappingStatus,
        key: h!.anchor?.documentSha256,
        assetKey: (await getAsset(handle.db, OWNER, linked.id))!.sha256,
      };
    }
    expect(outcomes["same geometry"]!.status).toBe("resolved");
    expect(outcomes["same geometry"]!.key).toBe(outcomes["same geometry"]!.assetKey);
    expect(outcomes["other geometry"]!.status).toBe("needs_repair");
    expect(outcomes["other geometry"]!.key).toBe("arxiv:2509.50002v1");
  });

  it("a stored arXiv copy removed while its extraction runs keeps no text: the Document stays read from arxiv.org", async () => {
    const arxivId = "2509.50003";
    const [work] = await handle.db
      .insert(scholarlyWork)
      .values({ ownerId: OWNER, title: `Paper ${arxivId}` })
      .returning();
    await handle.db
      .insert(scholarlyIdentifier)
      .values({ ownerId: OWNER, workId: work!.id, scheme: "arxiv", value: arxivId, source: "fixture" });
    const [version] = await handle.db
      .insert(scholarlyVersion)
      .values({ ownerId: OWNER, workId: work!.id, kind: "preprint", label: "arXiv v1", arxivId, arxivVersion: 1, source: "fixture" })
      .returning();
    const linked = await openArxivVersion(handle.db, OWNER, work!.id, arxivId, 1);
    await attachUploadToWork(handle.db, blobs, {
      ownerId: OWNER,
      workId: work!.id,
      versionId: version!.id,
      filename: `${arxivId}.pdf`,
      mediaType: "application/pdf",
      data: makePdf(["A Banach space is a complete normed space; this copy is removed while it is read."], false),
      maxBytes: 50_000_000,
    });
    await setPermission(handle.db, OWNER, linked.id, "local_extract", "allowed", "test");
    await handle.db.update(resourceAsset).set({ status: "processing" }).where(eq(resourceAsset.id, linked.id));
    const [job] = await handle.db
      .insert(jobRecord)
      .values({ ownerId: OWNER, kind: "ingest-asset", queue: "ingest", idempotencyKey: `ingest:race:${linked.id}`, payload: {} })
      .returning();
    // A raw connection holds the job's record, so the handler (bytes already read) waits at its
    // first progress report; the owner removes the copy meanwhile.
    const c = await handle.pool.connect();
    let result: Record<string, unknown>;
    try {
      await c.query("begin");
      const holder = ((await c.query("select pg_backend_pid() as pid")).rows[0] as { pid: number }).pid;
      await c.query("select id from job_record where id = $1 for update", [job!.id]);
      const pending = ingestHandler(ctx, { ...payload(linked.id), jobRecordId: job!.id });
      let blocked = false;
      for (let i = 0; i < 200 && !blocked; i++) {
        const waiting = await handle.pool.query("select count(*)::int as n from pg_stat_activity where $1 = any(pg_blocking_pids(pid))", [
          holder,
        ]);
        blocked = (waiting.rows[0] as { n: number }).n > 0;
        if (!blocked) await new Promise((r) => setTimeout(r, 25));
      }
      expect(blocked).toBe(true);
      await deleteAsset(handle.db, blobs, OWNER, linked.id);
      await c.query("commit");
      result = await pending;
    } finally {
      c.release();
    }
    expect(result).toEqual({ skipped: true, reason: "file changed or removed during processing" });
    const after = (await getAsset(handle.db, OWNER, linked.id))!;
    expect(after).toMatchObject({ status: "linked_remote", storageKey: null, sha256: `arxiv:${arxivId}v1` });
    expect(await handle.db.select().from(extractedPage).where(eq(extractedPage.assetId, linked.id))).toEqual([]);
    expect(await handle.db.select().from(passage).where(eq(passage.assetId, linked.id))).toEqual([]);
  });

  it("pins unpdf's engine options so installing pdfjs-dist does not change extracted text", () => {
    expect(EXTRACTION_PDF_OPTIONS).toEqual({
      maxImageSize: 16_777_216,
      useSystemFonts: true,
      standardFontDataUrl: undefined,
      cMapUrl: undefined,
      wasmUrl: undefined,
    });
    expect(Object.keys(EXTRACTION_PDF_OPTIONS).sort()).toEqual([
      "cMapUrl",
      "maxImageSize",
      "standardFontDataUrl",
      "useSystemFonts",
      "wasmUrl",
    ]);
  });
});
