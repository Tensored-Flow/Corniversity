import "server-only";
import type { AnnotationRow } from "@corniversity/db/services/library";
import { renderMarkdown } from "@/lib/markdown";
import { ANNOTATION_COLORS, type AnnotationColor, type ReaderAnnotation, type Rect } from "./annotations";

/**
 * Annotation rows as the reader receives them, from the page and from the annotation routes alike.
 * The owner's note is rendered here by the server's Markdown and KaTeX sanitiser; the selected text
 * travels as plain text and is shown as escaped React text.
 */
export async function toReaderAnnotation(row: AnnotationRow): Promise<ReaderAnnotation> {
  const color = (ANNOTATION_COLORS as readonly string[]).includes(row.color ?? "") ? (row.color as AnnotationColor) : null;
  return {
    id: row.id,
    kind: row.kind,
    color,
    pageIndex: row.anchor ? row.anchor.pageIndex : row.locator.kind === "pdf" ? row.locator.physicalPageIndex : 0,
    anchor: row.anchor
      ? {
          pageView: [row.anchor.pageView[0], row.anchor.pageView[1]],
          rotate: row.anchor.rotate,
          rects: row.anchor.rects.map((r) => [r[0], r[1], r[2], r[3]] as Rect),
          ...(row.anchor.quote ? { quote: row.anchor.quote } : {}),
          documentSha256: row.anchor.documentSha256,
        }
      : null,
    selectedText: row.selectedText,
    noteMarkdown: row.noteMarkdown,
    noteHtml: row.noteMarkdown.trim() ? await renderMarkdown(row.noteMarkdown) : "",
    mappingStatus: row.mappingStatus,
    quoteMatched: row.quoteMatched,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toReaderAnnotations(rows: readonly AnnotationRow[]): Promise<ReaderAnnotation[]> {
  return Promise.all(rows.map(toReaderAnnotation));
}
