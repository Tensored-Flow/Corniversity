import { z } from "zod";

/**
 * A locator points at an exact place in an immutable source version. A citation must be able
 * to reopen the place that was used, so PDF locators carry both the physical page index and
 * the printed page label (front matter is often roman-numbered and editions differ).
 */
export const PdfLocator = z.object({
  kind: z.literal("pdf"),
  sourceVersionId: z.string().min(1),
  physicalPageIndex: z.number().int().min(0),
  printedPageLabel: z.string().optional(),
  sectionLabel: z.string().optional(),
  passageId: z.string().optional(),
});

export const WebLocator = z.object({
  kind: z.literal("web"),
  sourceVersionId: z.string().min(1),
  url: z.string().url(),
  heading: z.string().optional(),
  fragment: z.string().optional(),
  passageId: z.string().optional(),
});

export const VideoLocator = z.object({
  kind: z.literal("video"),
  sourceVersionId: z.string().min(1),
  url: z.string().url(),
  startSeconds: z.number().min(0),
  endSeconds: z.number().min(0).optional(),
});

export const BookReferenceLocator = z.object({
  kind: z.literal("book_reference"),
  sourceVersionId: z.string().min(1),
  edition: z.string().min(1),
  sectionLabel: z.string().min(1),
  exerciseLabel: z.string().optional(),
});

export const Locator = z.discriminatedUnion("kind", [
  PdfLocator,
  WebLocator,
  VideoLocator,
  BookReferenceLocator,
]);
export type Locator = z.infer<typeof Locator>;

/** Human-readable short form used in citations and the notebook. */
export function describeLocator(locator: Locator, sourceTitle: string): string {
  switch (locator.kind) {
    case "pdf": {
      const page = locator.printedPageLabel
        ? `p. ${locator.printedPageLabel}`
        : `PDF page ${locator.physicalPageIndex + 1}`;
      return locator.sectionLabel
        ? `${sourceTitle}, ${locator.sectionLabel}, ${page}`
        : `${sourceTitle}, ${page}`;
    }
    case "web":
      return locator.heading ? `${sourceTitle}, ${locator.heading}` : sourceTitle;
    case "video": {
      const mm = Math.floor(locator.startSeconds / 60);
      const ss = String(Math.floor(locator.startSeconds % 60)).padStart(2, "0");
      return `${sourceTitle}, video ${mm}:${ss}`;
    }
    case "book_reference":
      return locator.exerciseLabel
        ? `${sourceTitle} (${locator.edition}), ${locator.sectionLabel}, ${locator.exerciseLabel}`
        : `${sourceTitle} (${locator.edition}), ${locator.sectionLabel}`;
  }
}
