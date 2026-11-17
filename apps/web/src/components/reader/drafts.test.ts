import { describe, expect, it } from "vitest";
import type { PendingAnchor } from "./annotations";
import { draftKey, hasDrafts, NO_DRAFTS, parseDrafts, serializeDrafts, unsavedDrafts } from "./drafts";

const pending: PendingAnchor = {
  pageIndex: 2,
  anchor: { v: 1, coordSpace: "pdf_user_space", pageIndex: 2, pageView: [612, 792], rotate: 0, rects: [] },
  quote: null,
  source: "page",
};
const saved = new Map([
  ["a1", "Saved text"],
  ["a2", "Other"],
]);

describe("reader drafts", () => {
  it("keys drafts by Document", () => {
    expect(draftKey("doc-1")).toBe("corniversity-reader-drafts:doc-1");
  });

  it("keeps only what would be lost: a started note with text and edits that differ from the saved note", () => {
    const drafts = unsavedDrafts(
      { composer: { pending, measuredOn: "abc", text: "Half a derivation" }, edits: { a1: "Saved text", a2: "Changed", gone: "x" } },
      (id) => saved.get(id),
    );
    expect(drafts).toEqual({ composer: { pending, measuredOn: "abc", text: "Half a derivation" }, edits: { a2: "Changed" } });
    expect(hasDrafts(drafts)).toBe(true);
    expect(unsavedDrafts({ composer: { pending, measuredOn: null, text: "  \n" }, edits: {} }, (id) => saved.get(id))).toEqual(NO_DRAFTS);
    expect(hasDrafts(NO_DRAFTS)).toBe(false);
  });

  it("round-trips through storage, and removes the entry when nothing is unsaved", () => {
    const drafts = { composer: { pending, measuredOn: "abc", text: "Half a derivation" }, edits: { a2: "Changed" } };
    expect(parseDrafts(serializeDrafts(drafts), new Set(saved.keys()))).toEqual(drafts);
    expect(serializeDrafts(NO_DRAFTS)).toBeNull();
  });

  it("drops malformed entries and edits of annotations that no longer exist", () => {
    const ids = new Set(["a1"]);
    expect(parseDrafts(null, ids)).toEqual(NO_DRAFTS);
    expect(parseDrafts("not json", ids)).toEqual(NO_DRAFTS);
    expect(parseDrafts("42", ids)).toEqual(NO_DRAFTS);
    expect(parseDrafts(JSON.stringify({ composer: { pending: { pageIndex: -1 }, text: "x" }, edits: { a1: 3, a9: "y" } }), ids)).toEqual(
      NO_DRAFTS,
    );
    expect(parseDrafts(JSON.stringify({ composer: { pending: { ...pending, source: "other" }, text: "x" } }), ids).composer).toBeNull();
    expect(parseDrafts(JSON.stringify({ composer: { pending, text: "x", measuredOn: 5 } }), ids).composer).toEqual({
      pending,
      measuredOn: null,
      text: "x",
    });
  });
});
