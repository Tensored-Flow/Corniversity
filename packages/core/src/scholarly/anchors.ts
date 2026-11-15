import { z } from "zod";
import { parseLinkedDocumentKey } from "./identifiers";

/**
 * Annotation anchors on PDF pages. Rects are in PDF user space as pdf.js `convertToPdfPoint`
 * returns it (unscaled, unrotated, including the crop box origin), so they do not depend on zoom,
 * rotation or rendering engine. An anchor with rects stays drawable whenever its document and page
 * exist; the quote is the owner's copy of the selected text and only ever sets `quote_matched`.
 * `documentSha256` names the file the rects were measured on (a real hash, or `arxiv:{id}v{n}` for
 * arXiv's file); when a Document's file changes (a promotion, a revert, arXiv regenerating its PDF)
 * the rects carry over only after the drift check below, or when the bytes are known to be the same.
 * `pageView` is the page's [width, height] in PDF user space, unrotated, from pdf.js `page.view`
 * (`view[2] − view[0]`, `view[3] − view[1]`); the server measures extracted pages the same way.
 */

export const MAX_ANCHOR_RECTS = 200;
export const MAX_ANCHOR_QUOTE_CHARS = 2000;
export const MAX_PAGE_INDEX = 99_999;
/** Coordinates beyond this are rejected (PDF pages are at most 14,400 units a side). */
const COORD_LIMIT = 1_000_000;
const ROUND = 100;

const Coord = z.number().min(-COORD_LIMIT).max(COORD_LIMIT);
const Dimension = z.number().positive().max(COORD_LIMIT);
export const AnchorRect = z.tuple([Coord, Coord, Coord, Coord]);
export type AnchorRect = z.infer<typeof AnchorRect>;

/** What the reader sends; the server adds `engine` and `documentSha256` from the Document row. */
export const AnchorInputSchema = z.strictObject({
  v: z.literal(1),
  coordSpace: z.literal("pdf_user_space"),
  pageIndex: z.number().int().min(0).max(MAX_PAGE_INDEX),
  pageView: z.tuple([Dimension, Dimension]),
  rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  rects: z.array(AnchorRect).max(MAX_ANCHOR_RECTS),
  quote: z.string().max(MAX_ANCHOR_QUOTE_CHARS).optional(),
});
export type AnchorInput = z.infer<typeof AnchorInputSchema>;

/** A real SHA-256 (stored Documents) or the linked Document key `arxiv:{id}v{n}`. */
export const DocumentKey = z
  .string()
  .refine((v) => /^[0-9a-f]{64}$/.test(v) || parseLinkedDocumentKey(v) !== null, "not a document hash or arXiv version key");

export const AnchorSchema = z.strictObject({
  ...AnchorInputSchema.shape,
  engine: z.string().regex(/^[A-Za-z0-9.@+_-]{1,64}$/),
  documentSha256: DocumentKey,
});
export type Anchor = z.infer<typeof AnchorSchema>;

function round(n: number): number {
  return Math.round(n * ROUND) / ROUND;
}

/**
 * Orders a rect's corners (x1 < x2, y1 < y2) and rounds to 0.01 pt. Returns null for a rect that is
 * degenerate (narrower or lower than 0.01 pt) or larger than the page (`pageView`, with 1 pt slack).
 * It does not clamp to [0, w] because the user-space origin of a page can be non-zero.
 */
export function normaliseRect(rect: readonly number[], pageView: readonly [number, number]): AnchorRect | null {
  if (rect.length !== 4 || rect.some((n) => !Number.isFinite(n) || Math.abs(n) > COORD_LIMIT)) return null;
  const [a, b, c, d] = rect as [number, number, number, number];
  const x1 = round(Math.min(a, c));
  const x2 = round(Math.max(a, c));
  const y1 = round(Math.min(b, d));
  const y2 = round(Math.max(b, d));
  if (x2 - x1 < 0.01 || y2 - y1 < 0.01) return null;
  if (x2 - x1 > pageView[0] + 1 || y2 - y1 > pageView[1] + 1) return null;
  return [x1, y1, x2, y2];
}

export function normaliseRects(rects: readonly (readonly number[])[], pageView: readonly [number, number]): AnchorRect[] {
  const out: AnchorRect[] = [];
  const seen = new Set<string>();
  for (const rect of rects) {
    const normal = normaliseRect(rect, pageView);
    if (!normal || seen.has(normal.join(","))) continue;
    seen.add(normal.join(","));
    out.push(normal);
    if (out.length === MAX_ANCHOR_RECTS) break;
  }
  return out;
}

/** The stored anchor: validated input, normalised rects, trimmed quote, server-filled fields. */
export function buildAnchor(input: unknown, server: { engine: string; documentSha256: string }): Anchor {
  const { quote: rawQuote, ...parsed } = AnchorInputSchema.parse(input);
  const quote = rawQuote?.trim();
  return AnchorSchema.parse({
    ...parsed,
    rects: normaliseRects(parsed.rects, parsed.pageView),
    ...(quote ? { quote } : {}),
    engine: server.engine,
    documentSha256: server.documentSha256,
  });
}

/** Text for matching quotes: NFKC, every whitespace character removed. */
export function compactForMatch(text: string): string {
  return text.normalize("NFKC").replace(/\s+/gu, "");
}

/** Whether two quotes are the same text after NFKC and whitespace removal (both non-empty). */
export function quotesMatch(a: string, b: string): boolean {
  const left = compactForMatch(a);
  return left.length > 0 && left === compactForMatch(b);
}

/** Whether a quote appears on a page's text after NFKC and whitespace removal. */
export function quoteFoundIn(quote: string, pageText: string): boolean {
  const needle = compactForMatch(quote);
  return needle.length > 0 && compactForMatch(pageText).includes(needle);
}

export { checkDrift, type DriftInput } from "./drift";
