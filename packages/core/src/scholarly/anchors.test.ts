import { describe, expect, it } from "vitest";
import {
  AnchorInputSchema,
  AnchorSchema,
  buildAnchor,
  checkDrift,
  compactForMatch,
  MAX_ANCHOR_RECTS,
  normaliseRect,
  quoteFoundIn,
  quotesMatch,
} from "./anchors";

const input = {
  v: 1,
  coordSpace: "pdf_user_space",
  pageIndex: 3,
  pageView: [612, 792],
  rotate: 0,
  rects: [[72.004, 700.123, 300, 712.5]],
  quote: "  a finite sum ",
};
const server = { engine: "pdf.js@6.4.299", documentSha256: "arxiv:2305.18290v3" };

describe("anchor schema", () => {
  it("accepts a well-formed anchor and lets the server fill engine and document", () => {
    const anchor = buildAnchor(input, server);
    expect(anchor).toEqual({
      v: 1,
      coordSpace: "pdf_user_space",
      pageIndex: 3,
      pageView: [612, 792],
      rotate: 0,
      rects: [[72, 700.12, 300, 712.5]],
      quote: "a finite sum",
      engine: "pdf.js@6.4.299",
      documentSha256: "arxiv:2305.18290v3",
    });
    expect(AnchorSchema.safeParse(anchor).success).toBe(true);
  });

  it("refuses client-supplied server fields, unknown keys and bad values", () => {
    expect(AnchorInputSchema.safeParse({ ...input, documentSha256: "a".repeat(64) }).success).toBe(false);
    expect(AnchorInputSchema.safeParse({ ...input, engine: "x" }).success).toBe(false);
    expect(AnchorInputSchema.safeParse({ ...input, v: 2 }).success).toBe(false);
    expect(AnchorInputSchema.safeParse({ ...input, rotate: 45 }).success).toBe(false);
    expect(AnchorInputSchema.safeParse({ ...input, pageIndex: -1 }).success).toBe(false);
    expect(AnchorInputSchema.safeParse({ ...input, pageIndex: 1.5 }).success).toBe(false);
    expect(AnchorInputSchema.safeParse({ ...input, pageView: [0, 792] }).success).toBe(false);
    expect(AnchorInputSchema.safeParse({ ...input, rects: [[0, 0, Number.NaN, 1]] }).success).toBe(false);
    expect(AnchorInputSchema.safeParse({ ...input, rects: [[0, 0, Number.POSITIVE_INFINITY, 1]] }).success).toBe(false);
    expect(AnchorInputSchema.safeParse({ ...input, rects: [[0, 0, 1]] }).success).toBe(false);
    expect(AnchorInputSchema.safeParse({ ...input, rects: Array(MAX_ANCHOR_RECTS + 1).fill([0, 0, 1, 1]) }).success).toBe(false);
    expect(AnchorInputSchema.safeParse({ ...input, quote: "x".repeat(2001) }).success).toBe(false);
  });

  it("accepts a real sha256 or an arXiv version key as the document, nothing else", () => {
    expect(() =>
      buildAnchor(input, { ...server, documentSha256: "92cb3a2b71362acda98a789b03d88688fd33cf5fcf13f81d2b1de30ee7d3b67a" }),
    ).not.toThrow();
    expect(() => buildAnchor(input, { ...server, documentSha256: "arxiv:2305.18290" })).toThrow();
    expect(() => buildAnchor(input, { ...server, documentSha256: "abc" })).toThrow();
    expect(() => buildAnchor(input, { ...server, engine: "<script>" })).toThrow();
  });

  it("keeps geometry-only anchors (page notes, bookmarks, no quote)", () => {
    const anchor = buildAnchor({ ...input, rects: [], quote: "   " }, server);
    expect(anchor.rects).toEqual([]);
    expect("quote" in anchor).toBe(false);
  });
});

describe("rect normalisation", () => {
  it("orders corners, rounds to 0.01 pt and keeps a non-zero crop box origin", () => {
    expect(normaliseRect([300, 712.555, 72, 700], [612, 792])).toEqual([72, 700, 300, 712.56]);
    expect(normaliseRect([-10, -20, 50, 20], [612, 792])).toEqual([-10, -20, 50, 20]);
  });

  it("drops degenerate, oversized and non-finite rects, and duplicates", () => {
    expect(normaliseRect([10, 10, 10, 50], [612, 792])).toBeNull();
    expect(normaliseRect([0, 0, 700, 10], [612, 792])).toBeNull();
    expect(normaliseRect([0, 0, Number.NaN, 10], [612, 792])).toBeNull();
    const anchor = buildAnchor(
      {
        ...input,
        rects: [
          [1, 1, 5, 5],
          [5, 5, 1, 1],
          [2, 2, 2, 9],
        ],
      },
      server,
    );
    expect(anchor.rects).toEqual([[1, 1, 5, 5]]);
  });
});

describe("quote comparison", () => {
  it("compares after NFKC and removing every whitespace character", () => {
    expect(compactForMatch("ﬁnite  sum\n of\u00a0terms")).toBe("finitesumofterms");
    expect(quotesMatch("a finite\nsum", "a ﬁnite sum")).toBe(true);
    expect(quotesMatch("x ≤ y", "x 6 y")).toBe(false);
    expect(quotesMatch("", "  ")).toBe(false);
  });

  it("finds a quote on a page's text", () => {
    expect(quoteFoundIn("finite sum", "We take a ﬁnite\nsum of terms.")).toBe(true);
    expect(quoteFoundIn("infinite product", "We take a finite sum.")).toBe(false);
    expect(quoteFoundIn(" ", "anything")).toBe(false);
  });
});

describe("drift check", () => {
  const anchors = [
    { pageIndex: 0, pageView: [612, 792] as [number, number] },
    { pageIndex: 4, pageView: [612, 792] as [number, number] },
  ];
  const views = Array.from({ length: 10 }, () => [612, 792] as [number, number]);

  it("matches when the page count is unchanged and every annotated page keeps its view", () => {
    expect(checkDrift({ anchors, pageCount: 10, pageViews: views, previousPageCount: 10 })).toEqual({
      geometryMatches: true,
      problems: [],
    });
    expect(
      checkDrift({ anchors, pageCount: 10, pageViews: views.map(([w, h]) => [w + 0.005, h] as [number, number]) }).geometryMatches,
    ).toBe(true);
  });

  it("reports a changed page count, a missing page and a changed page size", () => {
    expect(checkDrift({ anchors, pageCount: 10, pageViews: views, previousPageCount: 11 }).problems).toEqual([
      "The page count changed from 11 to 10.",
    ]);
    expect(checkDrift({ anchors, pageCount: 3, pageViews: views.slice(0, 3) }).problems).toEqual(["Page 5 no longer exists."]);
    const resized = views.map((v, i) => (i === 4 ? ([595, 842] as [number, number]) : v));
    expect(checkDrift({ anchors, pageCount: 10, pageViews: resized })).toEqual({
      geometryMatches: false,
      problems: ["Page 5 changed size."],
    });
  });
});
