/**
 * Annotations in the Page view: what the reader receives and sends, and the pure rules that decide
 * which annotations are drawn. No PDF.js or DOM imports, so the server page, the routes and the unit
 * tests share them.
 *
 * Anchors follow core anchors.ts: rects in PDF user space (pdf.js `convertToPdfPoint`), `pageView` the
 * unrotated `page.view` width and height, the owner's selected text kept as the quote. The server
 * fills `engine` and `documentSha256`, which names the file the rects were measured on.
 */
import { checkDrift } from "@corniversity/core/scholarly/anchors";

export const ANNOTATION_COLORS = ["brass", "moss", "rust", "slate", "neutral"] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];
export const COLOR_LABELS: Record<AnnotationColor, string> = {
  brass: "Brass",
  moss: "Moss",
  rust: "Rust",
  slate: "Slate",
  neutral: "Neutral",
};
export const DEFAULT_HIGHLIGHT_COLOR: AnnotationColor = "brass";

export type AnnotationKind = "note" | "highlight" | "bookmark";
export type Rect = [number, number, number, number];

/** An annotation as the reader holds it (the route and the page serialise rows to this). */
export interface ReaderAnnotation {
  id: string;
  kind: AnnotationKind;
  color: AnnotationColor | null;
  /** 0-based physical page. */
  pageIndex: number;
  anchor: { pageView: [number, number]; rotate: number; rects: Rect[]; quote?: string; documentSha256: string } | null;
  selectedText: string | null;
  noteMarkdown: string;
  /** The note rendered by the server's Markdown and KaTeX sanitiser. */
  noteHtml: string;
  mappingStatus: "resolved" | "needs_repair";
  quoteMatched: boolean | null;
  /** ISO time with milliseconds: the `expectedUpdatedAt` of the next edit. */
  updatedAt: string;
  createdAt: string;
}

/** What the reader posts to create one (core `AnchorInputSchema` for the anchor). */
export interface AnchorInput {
  v: 1;
  coordSpace: "pdf_user_space";
  pageIndex: number;
  pageView: [number, number];
  rotate: 0 | 90 | 180 | 270;
  rects: Rect[];
  quote?: string;
}

/** A selection (or a marked area, or a whole page) the owner is about to annotate. */
export interface PendingAnchor {
  pageIndex: number;
  anchor: AnchorInput;
  /** The selected text, when the anchor came from a selection. */
  quote: string | null;
  /** What made it: a text selection, an area marked with two clicks, or the whole page. */
  source: "selection" | "area" | "page";
}

/** What the reader knows about the file it has just shown. */
export interface FileFacts {
  /** The Document's key: its real hash (stored) or `arxiv:{id}v{n}` (linked). */
  documentKey: string;
  linked: boolean;
  /** SHA-256 of the bytes the browser received (linked Documents only). */
  loadedSha256: string | null;
  /**
   * What the server said about that hash: the first one seen, the same as before, a change not yet
   * accepted, or unknown (the report failed). `pending` until it answers.
   */
  observed: "pending" | "first" | "same" | "changed" | "unknown";
  pageCount: number;
  /** [width, height] of every page in PDF user space, unrotated, by index. */
  pageViews: [number, number][];
  /** The page count the server recorded for the file the notes were made on, when known. */
  previousPageCount: number | null;
}

export interface Placement {
  /** Drawn on the pages (and listed). */
  drawn: ReaderAnnotation[];
  /** Listed only: notes without rects (page notes, bookmarks, notes from the Text view) and those waiting for the file check. */
  listed: ReaderAnnotation[];
  /** Listed under "Needs repair": not drawn. */
  repair: ReaderAnnotation[];
  /**
   * Known to be measured on another file of a linked Document (arXiv's file changed since, or the
   * anchor names other bytes) whose pages are the same here: drawn, with the banner and, when the
   * server would accept it, "Keep my notes on the new file".
   */
  drift: ReaderAnnotation[];
  /** Why the pages differ, when the drift check failed. */
  problems: string[];
  /**
   * Why "Keep my notes on the new file" is not offered although `drift` is not empty: the server's
   * check (`acceptNewFile`) covers every anchored annotation, those already marked for repair included.
   */
  keepProblems: string[];
  /**
   * Anchors on the Document key drawn while the hash report failed: the pages have the same sizes,
   * but whether arXiv's file changed is not known, so nothing is offered for them.
   */
  unverified: ReaderAnnotation[];
  /** Bookmarks that stand on this file (their ribbons are drawn): not pending, not needing repair. */
  bookmarks: ReaderAnnotation[];
}

function hasRects(a: ReaderAnnotation): boolean {
  return Boolean(a.anchor && a.anchor.rects.length > 0);
}

const pageViewsOf = (list: readonly ReaderAnnotation[]) => list.map((a) => ({ pageIndex: a.pageIndex, pageView: a.anchor!.pageView }));

/**
 * Decides which annotations are drawn on the file just shown (contract §7, Drift):
 * - an annotation the server marked for repair is listed under Needs repair;
 * - an anchor measured on exactly these bytes is drawn;
 * - an anchor on the Document key is drawn on a stored Document, and on a linked one when the server
 *   confirmed the browser received the file it already knew (first or same);
 * - every other anchor (arXiv's file changed, the report failed, or it was measured on another file of
 *   a linked Document) goes through the drift check together: page count unchanged when known, every
 *   annotated page the same size. Equal: drawn. Those known to be on another file are offered for
 *   "Keep my notes on the new file" when the server's check over every anchored annotation passes
 *   too; anchors on the Document key while the report failed are drawn without an offer (the file may
 *   well be unchanged). Otherwise they are listed as needing repair (in the reader only; nothing is
 *   stored until the owner acts, so a file arXiv later serves again is not left marked). On a stored
 *   Document an anchor measured on another file waits for the server's re-check after extraction
 *   (Needs repair).
 * Annotations without anchors, and page-level anchors (no rects), are listed and never drawn.
 */
export function placeAnnotations(annotations: readonly ReaderAnnotation[], facts: FileFacts): Placement {
  const placement: Placement = {
    drawn: [],
    listed: [],
    repair: [],
    drift: [],
    problems: [],
    keepProblems: [],
    unverified: [],
    bookmarks: [],
  };
  const candidates: ReaderAnnotation[] = [];
  for (const a of annotations) {
    if (a.mappingStatus === "needs_repair") placement.repair.push(a);
    else if (!a.anchor) place(placement, a);
    else if (facts.loadedSha256 !== null && a.anchor.documentSha256 === facts.loadedSha256) place(placement, a);
    else if (a.anchor.documentSha256 === facts.documentKey && !facts.linked) place(placement, a);
    else if (a.anchor.documentSha256 === facts.documentKey && (facts.observed === "first" || facts.observed === "same"))
      place(placement, a);
    else if (facts.observed === "pending") placement.listed.push(a);
    else if (!facts.linked) placement.repair.push(a);
    else candidates.push(a);
  }
  if (candidates.length === 0) return placement;
  const drift = checkDrift({
    anchors: pageViewsOf(candidates),
    pageCount: facts.pageCount,
    pageViews: facts.pageViews,
    previousPageCount: facts.previousPageCount,
  });
  if (!drift.geometryMatches) {
    placement.repair.push(...candidates);
    placement.problems = drift.problems;
    return placement;
  }
  for (const a of candidates) place(placement, a);
  // Only linked Documents reach here. A failed report says nothing about the file, so an anchor on the
  // Document key is not known to be on another one.
  const unknown = (a: ReaderAnnotation) => facts.observed === "unknown" && a.anchor!.documentSha256 === facts.documentKey;
  placement.unverified = candidates.filter(unknown);
  placement.drift = candidates.filter((a) => !unknown(a));
  if (placement.drift.length > 0) {
    // Keeping the notes on this file re-keys them (acceptNewFile), which checks every anchored annotation.
    placement.keepProblems = checkDrift({
      anchors: pageViewsOf(annotations.filter((a) => a.anchor)),
      pageCount: facts.pageCount,
      pageViews: facts.pageViews,
      previousPageCount: facts.previousPageCount,
    }).problems;
  }
  return placement;
}

/** Stands on this file: drawn when it has rects, listed otherwise; a bookmark's ribbon is drawn. */
function place(placement: Placement, a: ReaderAnnotation): void {
  if (hasRects(a)) placement.drawn.push(a);
  else placement.listed.push(a);
  if (a.kind === "bookmark") placement.bookmarks.push(a);
}

/** The page views the drift check and "Keep my notes on the new file" need: [w, h] from pdf.js `page.view`. */
export function pageViewOf(view: readonly number[]): [number, number] {
  return [round(view[2]! - view[0]!), round(view[3]! - view[1]!)];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A page's intrinsic rotation as the anchor records it. */
export function normaliseRotation(rotate: number): 0 | 90 | 180 | 270 {
  const r = (((Math.round(rotate / 90) * 90) % 360) + 360) % 360;
  return r as 0 | 90 | 180 | 270;
}

/** Orders a rect's corners. */
export function orderRect(rect: readonly number[]): Rect {
  const [a, b, c, d] = rect as [number, number, number, number];
  return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
}

const MAX_RECTS = 200;

/**
 * The rects of a text selection, one per line: the text layer gives a rect per span, so rects on the
 * same line (overlapping vertically by more than half the smaller height) that touch or overlap
 * horizontally are joined. Tiny rects (under half a point) are dropped. At most 200 (the anchor limit).
 */
export function mergeLineRects(rects: readonly Rect[]): Rect[] {
  const sorted = rects
    .map(orderRect)
    .filter(([x1, y1, x2, y2]) => x2 - x1 >= 0.5 && y2 - y1 >= 0.5)
    .sort((a, b) => b[3] - a[3] || a[0] - b[0]);
  const lines: Rect[] = [];
  for (const rect of sorted) {
    const line = lines.find((l) => sameLine(l, rect));
    if (line) {
      line[0] = Math.min(line[0], rect[0]);
      line[1] = Math.min(line[1], rect[1]);
      line[2] = Math.max(line[2], rect[2]);
      line[3] = Math.max(line[3], rect[3]);
    } else lines.push([...rect]);
  }
  return lines.slice(0, MAX_RECTS).map((r) => r.map(round) as Rect);
}

function sameLine(a: Rect, b: Rect): boolean {
  const overlap = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  const smaller = Math.min(a[3] - a[1], b[3] - b[1]);
  if (overlap <= smaller / 2) return false;
  const gap = Math.max(a[0], b[0]) - Math.min(a[2], b[2]);
  return gap <= smaller;
}

/** The anchor of a rect marked with two clicks (two corners in PDF user space). */
export function areaRect(first: readonly [number, number], second: readonly [number, number]): Rect | null {
  const rect = orderRect([first[0], first[1], second[0], second[1]]);
  if (rect[2] - rect[0] < 2 || rect[3] - rect[1] < 2) return null;
  return rect.map(round) as Rect;
}

/** Where a rect in PDF user space falls on the rendered page, as percentages of its width and height. */
export function rectOnPage(viewportRect: readonly number[], viewport: { width: number; height: number }) {
  const [x1, y1, x2, y2] = orderRect(viewportRect);
  return {
    left: (x1 / viewport.width) * 100,
    top: (y1 / viewport.height) * 100,
    width: ((x2 - x1) / viewport.width) * 100,
    height: ((y2 - y1) / viewport.height) * 100,
  };
}

const KIND_LABELS = { highlight: "Highlight", bookmark: "Bookmark" } as const;

/** The plain name of an annotation in lists: Highlight, Note, Area note, Page note, Bookmark. */
export function annotationLabel(a: Pick<ReaderAnnotation, "kind" | "anchor" | "selectedText">): string {
  if (a.kind !== "note") return KIND_LABELS[a.kind];
  if (!a.anchor) return a.selectedText ? "Note" : "Page note";
  if (a.anchor.rects.length === 0) return "Page note";
  return a.anchor.quote ? "Note" : "Area note";
}

/** Notes in reading order: by page, then by when they were made. */
export function inReadingOrder(annotations: readonly ReaderAnnotation[]): ReaderAnnotation[] {
  return [...annotations].sort((a, b) => a.pageIndex - b.pageIndex || a.createdAt.localeCompare(b.createdAt));
}

/** The annotations after an edit or creation: the row replaced by id, or added. */
export function upsertAnnotation(list: readonly ReaderAnnotation[], row: ReaderAnnotation): ReaderAnnotation[] {
  return list.some((a) => a.id === row.id) ? list.map((a) => (a.id === row.id ? row : a)) : [...list, row];
}

/** After "Keep my notes on the new file": every anchor takes the Document key and is drawable again. */
export function keptOnNewFile(list: readonly ReaderAnnotation[], documentKey: string, accepted: boolean): ReaderAnnotation[] {
  return list.map((a) => {
    if (!a.anchor) return a;
    if (!accepted) return { ...a, mappingStatus: "needs_repair" };
    return { ...a, mappingStatus: "resolved", anchor: { ...a.anchor, documentSha256: documentKey } };
  });
}
