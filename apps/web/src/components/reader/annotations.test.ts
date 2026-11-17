import { describe, expect, it } from "vitest";
import {
  annotationLabel,
  areaRect,
  type FileFacts,
  inReadingOrder,
  keptOnNewFile,
  mergeLineRects,
  normaliseRotation,
  pageViewOf,
  placeAnnotations,
  type ReaderAnnotation,
  rectOnPage,
  upsertAnnotation,
} from "./annotations";

const KEY = "arxiv:2305.18290v1";
const LOADED = "b".repeat(64);
const EARLIER = "a".repeat(64);
const VIEWS: [number, number][] = [
  [612, 792],
  [612, 792],
  [612, 792],
];

function note(
  id: string,
  overrides: Partial<ReaderAnnotation> = {},
  anchorOverrides: Partial<NonNullable<ReaderAnnotation["anchor"]>> = {},
): ReaderAnnotation {
  return {
    id,
    kind: "highlight",
    color: "brass",
    pageIndex: 1,
    anchor: { pageView: [612, 792], rotate: 0, rects: [[72, 700, 300, 712]], quote: "a quote", documentSha256: KEY, ...anchorOverrides },
    selectedText: "a quote",
    noteMarkdown: "",
    noteHtml: "",
    mappingStatus: "resolved",
    quoteMatched: null,
    updatedAt: "2026-11-15T10:00:00.000Z",
    createdAt: `2026-11-15T10:00:0${id.length % 10}.000Z`,
    ...overrides,
  };
}

function facts(overrides: Partial<FileFacts> = {}): FileFacts {
  return {
    documentKey: KEY,
    linked: true,
    loadedSha256: LOADED,
    observed: "same",
    pageCount: 3,
    pageViews: VIEWS,
    previousPageCount: 3,
    ...overrides,
  };
}

const ids = (list: ReaderAnnotation[]) => list.map((a) => a.id);

describe("which annotations are drawn (the drift rule)", () => {
  it("draws anchors on the Document key when the server confirmed the browser has the file it knew", () => {
    for (const observed of ["first", "same"] as const) {
      const placed = placeAnnotations([note("h")], facts({ observed }));
      expect(ids(placed.drawn)).toEqual(["h"]);
      expect(placed.drift).toEqual([]);
    }
  });

  it("draws anchors measured on exactly these bytes, whatever the server says", () => {
    const placed = placeAnnotations([note("new", {}, { documentSha256: LOADED })], facts({ observed: "changed" }));
    expect(ids(placed.drawn)).toEqual(["new"]);
    expect(placed.drift).toEqual([]);
  });

  it("waits for the server's answer before drawing a linked Document's anchors", () => {
    const placed = placeAnnotations([note("h")], facts({ observed: "pending" }));
    expect(placed.drawn).toEqual([]);
    expect(ids(placed.listed)).toEqual(["h"]);
  });

  it("arXiv's file changed and the pages are the same: drawn, and offered for keeping on the new file", () => {
    const placed = placeAnnotations([note("h"), note("p", { kind: "bookmark" }, { rects: [] })], facts({ observed: "changed" }));
    expect(ids(placed.drawn)).toEqual(["h"]);
    expect(ids(placed.listed)).toEqual(["p"]);
    expect(ids(placed.drift)).toEqual(["h", "p"]);
    expect(placed.repair).toEqual([]);
  });

  it("arXiv's file changed and a page changed size: listed as needing repair with the reason, not drawn", () => {
    const placed = placeAnnotations([note("h")], facts({ observed: "changed", pageViews: [VIEWS[0]!, [595, 842], VIEWS[2]!] }));
    expect(placed.drawn).toEqual([]);
    expect(ids(placed.repair)).toEqual(["h"]);
    expect(placed.problems).toEqual(["Page 2 changed size."]);
    expect(placed.drift).toEqual([]);
  });

  it("arXiv's file changed and the page count changed: every candidate needs repair", () => {
    const placed = placeAnnotations(
      [note("h", { pageIndex: 0 }, { pageView: [612, 792] })],
      facts({ observed: "changed", pageCount: 4, pageViews: [...VIEWS, [612, 792]] }),
    );
    expect(ids(placed.repair)).toEqual(["h"]);
    expect(placed.problems[0]).toBe("The page count changed from 3 to 4.");
  });

  it("anchors made on an earlier stored copy of a linked Document go through the same check", () => {
    const placed = placeAnnotations([note("old", {}, { documentSha256: EARLIER })], facts({ observed: "same" }));
    expect(ids(placed.drawn)).toEqual(["old"]);
    expect(ids(placed.drift)).toEqual(["old"]);
  });

  it("when the report failed, the anchors are drawn only if the pages match, without offering to keep them", () => {
    const placed = placeAnnotations([note("h")], facts({ observed: "unknown" }));
    expect(ids(placed.drawn)).toEqual(["h"]);
    // Nothing is known to have changed: no banner, no "Keep my notes on the new file".
    expect(placed.drift).toEqual([]);
    expect(ids(placed.unverified)).toEqual(["h"]);
    const differs = placeAnnotations([note("h")], facts({ observed: "unknown", pageCount: 1, pageViews: [VIEWS[0]!] }));
    expect(ids(differs.repair)).toEqual(["h"]);
    expect(differs.unverified).toEqual([]);
  });

  it("when the report failed, anchors that name another file are still known to be on another file", () => {
    const placed = placeAnnotations([note("h"), note("old", {}, { documentSha256: EARLIER })], facts({ observed: "unknown" }));
    expect(ids(placed.drawn)).toEqual(["h", "old"]);
    expect(ids(placed.drift)).toEqual(["old"]);
    expect(ids(placed.unverified)).toEqual(["h"]);
  });

  it("offers to keep the notes when the server's check, over the resolved notes measured on other bytes, would pass", () => {
    // acceptNewFile leaves notes already marked for repair out of its check: one on a page that changed size does not block.
    const placed = placeAnnotations(
      [note("h", { pageIndex: 0 }), note("broken", { pageIndex: 1, mappingStatus: "needs_repair" })],
      facts({ observed: "changed", pageViews: [VIEWS[0]!, [595, 842], VIEWS[2]!] }),
    );
    expect(ids(placed.drawn)).toEqual(["h"]);
    expect(ids(placed.drift)).toEqual(["h"]);
    expect(placed.keepProblems).toEqual([]);
    // A resolved note on another file whose page changed size: listed for repair with the reason, nothing offered.
    const blocked = placeAnnotations(
      [note("h", { pageIndex: 0 }), note("other", { pageIndex: 1 }, { documentSha256: EARLIER })],
      facts({ observed: "changed", pageViews: [VIEWS[0]!, [595, 842], VIEWS[2]!] }),
    );
    expect(blocked.problems).toEqual(["Page 2 changed size."]);
    expect(blocked.drift).toEqual([]);
  });

  it("on a stored Document draws its own anchors and leaves anchors from another file for the server's re-check", () => {
    const stored = facts({ documentKey: EARLIER, linked: false, loadedSha256: null, observed: "same" });
    const placed = placeAnnotations([note("own", {}, { documentSha256: EARLIER }), note("arxiv")], stored);
    expect(ids(placed.drawn)).toEqual(["own"]);
    expect(ids(placed.repair)).toEqual(["arxiv"]);
    expect(placed.drift).toEqual([]);
  });

  it("draws a bookmark's ribbon only when the bookmark stands on this file", () => {
    const bookmark = (id: string, overrides: Partial<ReaderAnnotation> = {}, sha = KEY) =>
      note(id, { kind: "bookmark", ...overrides }, { rects: [], documentSha256: sha });
    const list = [bookmark("here", {}, LOADED), bookmark("known"), bookmark("broken", { mappingStatus: "needs_repair" })];
    expect(ids(placeAnnotations(list, facts({ observed: "same" })).bookmarks)).toEqual(["here", "known"]);
    // Waiting for the server's answer: only the one measured on these bytes.
    expect(ids(placeAnnotations(list, facts({ observed: "pending" })).bookmarks)).toEqual(["here"]);
    // A file with other pages: the Document-key bookmark is listed under Needs repair, without its ribbon.
    const other = placeAnnotations(list, facts({ observed: "changed", pageCount: 4, pageViews: [...VIEWS, [612, 792]] }));
    expect(ids(other.bookmarks)).toEqual(["here"]);
    expect(ids(other.repair)).toEqual(["broken", "known"]);
  });

  it("never draws what the server marked for repair, and lists notes without anchors", () => {
    const placed = placeAnnotations(
      [note("broken", { mappingStatus: "needs_repair" }), note("text", { kind: "note", anchor: null, noteMarkdown: "from the Text view" })],
      facts(),
    );
    expect(ids(placed.repair)).toEqual(["broken"]);
    expect(ids(placed.listed)).toEqual(["text"]);
    expect(placed.drawn).toEqual([]);
  });
});

describe("selection rects", () => {
  it("joins the spans of one line and keeps lines apart", () => {
    const merged = mergeLineRects([
      [72, 700, 120, 712],
      [121, 700.5, 200, 711.5],
      [72, 686, 180, 698],
    ]);
    expect(merged).toEqual([
      [72, 700, 200, 712],
      [72, 686, 180, 698],
    ]);
  });

  it("orders corners, drops specks and keeps at most 200 lines", () => {
    expect(mergeLineRects([[200, 712, 72, 700]])).toEqual([[72, 700, 200, 712]]);
    expect(mergeLineRects([[72, 700, 72.2, 712]])).toEqual([]);
    const many = Array.from({ length: 250 }, (_, i) => [72, 10 + i * 3, 100, 12 + i * 3] as [number, number, number, number]);
    expect(mergeLineRects(many)).toHaveLength(200);
  });

  it("does not join words far apart on the same baseline (two columns)", () => {
    expect(
      mergeLineRects([
        [72, 700, 250, 712],
        [320, 700, 540, 712],
      ]),
    ).toHaveLength(2);
  });
});

describe("marked areas and page geometry", () => {
  it("makes a rect from two corners in any order and refuses a click that is not an area", () => {
    expect(areaRect([300, 500], [100, 600])).toEqual([100, 500, 300, 600]);
    expect(areaRect([100, 500], [101, 500.5])).toBeNull();
  });

  it("measures the page view unrotated, from pdf.js page.view, including a crop box origin", () => {
    expect(pageViewOf([0, 0, 612, 792])).toEqual([612, 792]);
    expect(pageViewOf([18, 36, 630, 828])).toEqual([612, 792]);
    expect(normaliseRotation(450)).toBe(90);
    expect(normaliseRotation(-90)).toBe(270);
  });

  it("places a rect on the rendered page as percentages", () => {
    expect(rectOnPage([306, 396, 153, 198], { width: 612, height: 792 })).toEqual({ left: 25, top: 25, width: 25, height: 25 });
  });
});

describe("lists", () => {
  it("names each kind plainly", () => {
    expect(annotationLabel(note("h"))).toBe("Highlight");
    expect(annotationLabel(note("b", { kind: "bookmark" }, { rects: [] }))).toBe("Bookmark");
    expect(annotationLabel(note("n", { kind: "note" }))).toBe("Note");
    expect(annotationLabel(note("a", { kind: "note" }, { quote: undefined }))).toBe("Area note");
    expect(annotationLabel(note("p", { kind: "note" }, { rects: [], quote: undefined }))).toBe("Page note");
    expect(annotationLabel({ kind: "note", anchor: null, selectedText: "from the Text view" })).toBe("Note");
  });

  it("orders by page, then by creation", () => {
    const list = [note("c", { pageIndex: 2 }), note("bb", { pageIndex: 0 }), note("a", { pageIndex: 0 })];
    expect(ids(inReadingOrder(list))).toEqual(["a", "bb", "c"]);
  });

  it("replaces an edited row and adds a new one", () => {
    const list = [note("a"), note("b")];
    expect(upsertAnnotation(list, note("a", { noteMarkdown: "edited" }))[0]!.noteMarkdown).toBe("edited");
    expect(ids(upsertAnnotation(list, note("c")))).toEqual(["a", "b", "c"]);
  });

  it("after keeping the notes on the new file, the checked and the loaded-bytes anchors take the Document key; refused, only the checked ones need repair", () => {
    const list = [
      note("loaded", {}, { documentSha256: LOADED }),
      note("earlier", {}, { documentSha256: EARLIER }),
      note("broken", { mappingStatus: "needs_repair" }, { documentSha256: EARLIER }),
      note("t", { anchor: null }),
    ];
    const kept = keptOnNewFile(list, KEY, true, LOADED);
    expect(kept.map((a) => a.anchor?.documentSha256 ?? null)).toEqual([KEY, KEY, EARLIER, null]);
    expect(kept[2]!.mappingStatus).toBe("needs_repair");
    expect(kept[3]).toEqual(list[3]);
    const refused = keptOnNewFile(list, KEY, false, LOADED);
    expect(refused.map((a) => a.mappingStatus)).toEqual(["resolved", "needs_repair", "needs_repair", list[3]!.mappingStatus]);
    expect(refused[0]!.anchor!.documentSha256).toBe(LOADED);
  });
});
