import { eq } from "drizzle-orm";
import { extractText, getDocumentProxy, getMeta, inspectPages } from "unpdf";
import { createBlobStore } from "@corniversity/db/blob";
import { IngestAssetPayload } from "@corniversity/db/jobs";
import { extractedPage, passage, resourceAsset } from "@corniversity/db/schema/index";
import { MAX_PDF_PAGES, getAsset, isAllowed } from "@corniversity/db/services/library";
import { type HandlerContext, NonRetryableError } from "./index";
import { reportProgress } from "./job-record";

/**
 * Ingestion: original bytes → validated document → per-page native text with physical index and
 * printed label → structural passages → full-text index. Permission is re-checked at the start
 * and before writing extracted text, so a revocation while the job was queued stops it. OCR is
 * never run automatically; pages with little native text are flagged for the reader to show the
 * source view instead of pretending garbled text is reliable.
 */
export async function ingestHandler(ctx: HandlerContext, raw: unknown): Promise<Record<string, unknown>> {
  const payload = IngestAssetPayload.parse(raw);
  const db = ctx.db;
  const asset = await getAsset(db, payload.ownerId, payload.assetId);
  if (!asset) return { skipped: true, reason: "asset missing or deleted" };
  if (!asset.storageKey) return { skipped: true, reason: "no stored bytes" };
  if (!(await isAllowed(db, payload.ownerId, asset.id, "local_extract"))) {
    await db.update(resourceAsset).set({ status: "validated" }).where(eq(resourceAsset.id, asset.id));
    return { skipped: true, reason: "extraction not permitted" };
  }
  const blobs = createBlobStore(ctx.env.BLOB_STORE, db, ctx.env.CORNIVERSITY_DATA_ROOT);
  const data = await blobs.get(asset.storageKey);
  if (!data) {
    await db.update(resourceAsset).set({ status: "rejected", rejectionReason: "stored bytes missing" }).where(eq(resourceAsset.id, asset.id));
    return { failed: true, reason: "stored bytes missing" };
  }

  await reportProgress(db, raw, { stage: "parsing", percent: 5 });
  let pagesText: string[] = [];
  let labels: string[] | null = null;
  let quality: { textLength: number; invisibleTextLength: number; imageCoverage: number }[] = [];
  let title: string | undefined;
  let author: string | undefined;

  if (asset.mediaType === "application/pdf") {
    let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
    try {
      pdf = await getDocumentProxy(new Uint8Array(data), { maxImageSize: 16_777_216 });
      if (pdf.numPages > MAX_PDF_PAGES) throw new Error(`${pdf.numPages} pages exceeds the ${MAX_PDF_PAGES}-page limit`);
      labels = (await pdf.getPageLabels()) ?? null;
      const meta = await getMeta(pdf).catch(() => ({ info: {} as Record<string, unknown> }));
      title = typeof meta.info?.Title === "string" ? meta.info.Title : undefined;
      author = typeof meta.info?.Author === "string" ? meta.info.Author : undefined;
      const extracted = await extractText(pdf);
      pagesText = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
      const inspection = await inspectPages(pdf);
      quality = inspection.pages.map((p) => ({ textLength: p.textLength, invisibleTextLength: p.invisibleTextLength, imageCoverage: p.imageCoverage }));
    } catch (error) {
      // A file that cannot be parsed will not parse better on retry: record why, keep the
      // original bytes (the owner may still read them in the source view) and stop.
      const reason = `The PDF could not be parsed: ${error instanceof Error ? error.message : String(error)}`;
      await db.update(resourceAsset).set({ status: "rejected", rejectionReason: reason }).where(eq(resourceAsset.id, asset.id));
      throw new NonRetryableError(reason);
    }
  } else {
    // Text and Markdown: one logical page per ~3,000 characters so locators still mean something.
    const text = data.toString("utf8");
    for (let i = 0; i < text.length; i += 3000) pagesText.push(text.slice(i, i + 3000));
    if (pagesText.length === 0) pagesText.push("");
    quality = pagesText.map((t) => ({ textLength: t.length, invisibleTextLength: 0, imageCoverage: 0 }));
  }

  // Permission may have been revoked while parsing.
  if (!(await isAllowed(db, payload.ownerId, asset.id, "local_extract"))) {
    await db.update(resourceAsset).set({ status: "validated" }).where(eq(resourceAsset.id, asset.id));
    return { skipped: true, reason: "extraction permission revoked during processing" };
  }

  await reportProgress(db, raw, { stage: "indexing", percent: 60 });
  await db.transaction(async (tx) => {
    await tx.delete(passage).where(eq(passage.assetId, asset.id));
    await tx.delete(extractedPage).where(eq(extractedPage.assetId, asset.id));
    let scanned = 0;
    for (let i = 0; i < pagesText.length; i++) {
      const text = pagesText[i] ?? "";
      const q = quality[i] ?? { textLength: text.length, invisibleTextLength: 0, imageCoverage: 0 };
      const visible = q.textLength - q.invisibleTextLength;
      const scannedSuspected = visible < 20 && q.imageCoverage > 0.8;
      if (scannedSuspected) scanned++;
      const [page] = await tx
        .insert(extractedPage)
        .values({
          assetId: asset.id,
          physicalIndex: i,
          printedLabel: labels?.[i] ?? null,
          text,
          charCount: text.length,
          quality: { scannedSuspected, lowText: visible < 200, invisibleText: q.invisibleTextLength, imageCoverage: q.imageCoverage },
        })
        .returning({ id: extractedPage.id });
      const segments = segmentPage(text);
      if (segments.length) {
        await tx.insert(passage).values(segments.map((seg, ordinal) => ({ assetId: asset.id, pageId: page!.id, ordinal, heading: seg.heading, kind: seg.kind, text: seg.text })));
      }
    }
    const candidate = { ...asset.candidateMetadata, title: asset.candidateMetadata.title ?? title, author: asset.candidateMetadata.author ?? author, pageCount: pagesText.length };
    await tx
      .update(resourceAsset)
      .set({ status: "processed", pageCount: pagesText.length, printedLabelsPresent: Boolean(labels), candidateMetadata: candidate, rejectionReason: scanned > 0 ? `${scanned} page(s) look scanned; their text is unreliable and OCR was not run` : null })
      .where(eq(resourceAsset.id, asset.id));
  });
  await reportProgress(db, raw, { stage: "done", percent: 100 });
  return { pages: pagesText.length, printedLabels: Boolean(labels) };
}

const HEADING = /^(definition|theorem|proposition|lemma|corollary|example|remark|exercise|proof|chapter|section|§)\b.{0,80}$/i;

/** Splits a page into passages at blank lines and mathematical headings; keeps theorem labels with their statements. */
export function segmentPage(text: string): { heading: string | null; kind: "paragraph" | "theorem" | "definition" | "exercise" | "proof" | "other"; text: string }[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}|\n(?=(?:Definition|Theorem|Proposition|Lemma|Corollary|Example|Remark|Exercise|Proof)\b)/)
    .map((b) => b.trim())
    .filter((b) => b.length >= 40);
  const out: ReturnType<typeof segmentPage> = [];
  for (const block of blocks) {
    const firstLine = block.split("\n")[0] ?? "";
    const heading = HEADING.test(firstLine) ? firstLine.slice(0, 120) : null;
    const lower = firstLine.toLowerCase();
    const kind = lower.startsWith("definition") ? "definition" : lower.startsWith("exercise") ? "exercise" : lower.startsWith("proof") ? "proof" : /^(theorem|proposition|lemma|corollary)/.test(lower) ? "theorem" : "paragraph";
    // Merge very long blocks into ~1,200-character passages so evidence windows stay bounded.
    for (let i = 0; i < block.length; i += 1200) out.push({ heading: i === 0 ? heading : null, kind: i === 0 ? kind : "paragraph", text: block.slice(i, i + 1200) });
  }
  return out;
}
