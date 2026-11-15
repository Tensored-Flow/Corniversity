/**
 * The reader's work on PDF.js's page elements: drawing annotations into a layer of each page,
 * reading a text selection as an anchor, and turning a click into a point in PDF user space.
 * Browser-only (DOM); the decisions themselves are the pure rules in annotations.ts.
 */
import type { PageViewport } from "pdfjs-dist/types/src/display/page_viewport";
import {
  type AnchorInput,
  mergeLineRects,
  normaliseRotation,
  type PendingAnchor,
  pageViewOf,
  type ReaderAnnotation,
  type Rect,
  rectOnPage,
} from "./annotations";

/**
 * The parts of a PDF.js PDFPageView the reader uses (PDF.js types `getPageView` as any). The viewport
 * is picked from PDF.js's own type, so a method PDF.js drops fails to compile here.
 */
export interface PageViewLike {
  id: number;
  div: HTMLDivElement;
  viewport: Pick<PageViewport, "width" | "height" | "convertToViewportPoint" | "convertToPdfPoint">;
  pdfPage: { view: number[]; rotate: number } | null;
}

const LAYER = "reader-annotation-layer";

/**
 * Draws a page's annotations into the reader's own layer of that page: above the canvas and under
 * the text layer, so text stays selectable and the marks never take a click. PDF.js removes foreign
 * children when it re-renders a page, so this runs again on `pagerendered` and `textlayerrendered`.
 */
export function drawPageAnnotations(
  pageView: PageViewLike,
  annotations: readonly ReaderAnnotation[],
  options: { bookmarked: boolean; focusedId: string | null },
): void {
  const div = pageView.div;
  let layer = div.querySelector<HTMLDivElement>(`:scope > .${LAYER}`);
  if (!layer) {
    layer = document.createElement("div");
    layer.className = LAYER;
    layer.setAttribute("aria-hidden", "true");
  }
  const text = div.querySelector(":scope > .textLayer");
  const canvas = div.querySelector(":scope > .canvasWrapper");
  if (text) text.before(layer);
  else if (canvas) canvas.after(layer);
  else div.append(layer);
  layer.replaceChildren();
  const viewport = pageView.viewport;
  for (const a of annotations) {
    if (!a.anchor) continue;
    for (const rect of a.anchor.rects) {
      // PDF.js 6 converts points only: both corners, then ordered.
      const [x1, y1] = viewport.convertToViewportPoint(rect[0], rect[1]);
      const [x2, y2] = viewport.convertToViewportPoint(rect[2], rect[3]);
      const place = rectOnPage([x1!, y1!, x2!, y2!], viewport);
      const mark = document.createElement("div");
      mark.className = "reader-mark";
      mark.dataset.kind = a.kind;
      mark.dataset.color = a.color ?? (a.kind === "highlight" ? "brass" : "slate");
      mark.dataset.annotationId = a.id;
      if (a.id === options.focusedId) mark.dataset.focused = "true";
      mark.style.left = `${place.left}%`;
      mark.style.top = `${place.top}%`;
      mark.style.width = `${place.width}%`;
      mark.style.height = `${place.height}%`;
      layer.append(mark);
    }
  }
  if (options.bookmarked) {
    const ribbon = document.createElement("div");
    ribbon.className = "reader-bookmark";
    layer.append(ribbon);
  }
}

function elementOf(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

/** Client rects of the text inside a range (glyph runs only, never whole element boxes). */
function textRects(range: Range, root: Element): DOMRect[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const rects: DOMRect[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!range.intersectsNode(node)) continue;
    const part = document.createRange();
    part.selectNodeContents(node);
    if (node === range.startContainer) part.setStart(node, range.startOffset);
    if (node === range.endContainer) part.setEnd(node, range.endOffset);
    for (const rect of Array.from(part.getClientRects())) if (rect.width > 0 && rect.height > 0) rects.push(rect);
  }
  return rects;
}

/** A client point on a page, in PDF user space (the page's text or canvas box is the reference). */
function toPdfPoint(pageView: PageViewLike, box: DOMRect, clientX: number, clientY: number): [number, number] {
  const vp = pageView.viewport;
  const x = ((clientX - box.left) * vp.width) / box.width;
  const y = ((clientY - box.top) * vp.height) / box.height;
  const [px, py] = vp.convertToPdfPoint(x, y);
  return [px!, py!];
}

function pageBox(pageView: PageViewLike): DOMRect {
  const reference =
    pageView.div.querySelector(":scope > .textLayer") ?? pageView.div.querySelector(":scope > .canvasWrapper") ?? pageView.div;
  return reference.getBoundingClientRect();
}

/** A page-level anchor (no rects): bookmarks and page notes. */
export function pageAnchor(pageView: PageViewLike): AnchorInput | null {
  if (!pageView.pdfPage) return null;
  return {
    v: 1,
    coordSpace: "pdf_user_space",
    pageIndex: pageView.id - 1,
    pageView: pageViewOf(pageView.pdfPage.view),
    rotate: normaliseRotation(pageView.pdfPage.rotate),
    rects: [],
  };
}

/**
 * The owner's text selection inside the pages as an anchor: the page where it starts (a selection
 * running onto later pages is cut at the end of that page), one rect per line in PDF user space, and
 * the selected text as the quote. Null when nothing usable is selected in the pages.
 */
export function readSelection(container: HTMLElement, pageViewFor: (pageNumber: number) => PageViewLike | null): PendingAnchor | null {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  let range = selection.getRangeAt(0);
  const start = elementOf(range.startContainer);
  const textLayer = start?.closest(".textLayer");
  const page = start?.closest<HTMLElement>(".page");
  if (!textLayer || !page || !container.contains(page)) return null;
  const pageView = pageViewFor(Number(page.dataset.pageNumber));
  if (!pageView?.pdfPage) return null;
  if (!textLayer.contains(range.endContainer)) {
    range = range.cloneRange();
    range.setEnd(textLayer, textLayer.childNodes.length);
  }
  const quote = range.toString().replace(/\s+/g, " ").trim().slice(0, 2000);
  if (!quote) return null;
  const box = pageBox(pageView);
  const rects: Rect[] = textRects(range, textLayer).map((r) => {
    const [x1, y1] = toPdfPoint(pageView, box, r.left, r.top);
    const [x2, y2] = toPdfPoint(pageView, box, r.right, r.bottom);
    return [x1, y1, x2, y2];
  });
  const merged = mergeLineRects(rects);
  if (merged.length === 0) return null;
  const pageIndex = pageView.id - 1;
  return {
    pageIndex,
    quote,
    source: "selection",
    anchor: {
      v: 1,
      coordSpace: "pdf_user_space",
      pageIndex,
      pageView: pageViewOf(pageView.pdfPage.view),
      rotate: normaliseRotation(pageView.pdfPage.rotate),
      rects: merged,
      quote,
    },
  };
}

/** Where a click landed: the page and the point in PDF user space, or null outside the pages. */
export function pointOnPage(
  target: EventTarget | null,
  clientX: number,
  clientY: number,
  pageViewFor: (pageNumber: number) => PageViewLike | null,
): { pageNumber: number; point: [number, number]; pageView: PageViewLike } | null {
  const page = target instanceof Element ? target.closest<HTMLElement>(".page") : null;
  if (!page) return null;
  const pageView = pageViewFor(Number(page.dataset.pageNumber));
  if (!pageView?.pdfPage) return null;
  return { pageNumber: pageView.id, point: toPdfPoint(pageView, pageBox(pageView), clientX, clientY), pageView };
}
