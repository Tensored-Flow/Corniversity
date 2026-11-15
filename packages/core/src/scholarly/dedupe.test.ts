import { describe, expect, it } from "vitest";
import {
  identifierLockKeys,
  normaliseTitle,
  resolveIdentifiers,
  sharedIdentifier,
  titleSimilarity,
  titlesSuggestDuplicate,
} from "./dedupe";
import type { IdentifierRef } from "./identifiers";

const arxiv: IdentifierRef = { scheme: "arxiv", value: "2501.12948" };
const doi: IdentifierRef = { scheme: "doi", value: "10.1038/s41586-025-09422-z" };
const w: IdentifierRef = { scheme: "openalex", value: "W4414281281" };

describe("resolveIdentifiers (import rule)", () => {
  it("creates a work when nobody holds an incoming identifier, inserting each identifier once", () => {
    expect(resolveIdentifiers([arxiv, doi, arxiv], [])).toEqual({ action: "create", insert: [arxiv, doi] });
  });

  it("attaches to the one work holding an identifier and inserts the missing ones", () => {
    expect(resolveIdentifiers([arxiv, doi, w], [{ ...doi, workId: "A" }])).toEqual({
      action: "attach",
      workId: "A",
      insert: [arxiv, w],
      skipped: [],
      possibleDuplicates: [],
    });
  });

  it("with two or more works, attaches to the strongest identifier's work (arXiv > DOI > W) and records the others", () => {
    // DOI imported first as work A; an arXiv import made work B; now OpenAlex reports both together.
    expect(
      resolveIdentifiers(
        [w, doi, arxiv],
        [
          { ...doi, workId: "A" },
          { ...arxiv, workId: "B" },
        ],
      ),
    ).toEqual({
      action: "attach",
      workId: "B",
      insert: [w],
      skipped: [doi],
      possibleDuplicates: ["A"],
    });
    expect(
      resolveIdentifiers(
        [w, doi],
        [
          { ...w, workId: "C" },
          { ...doi, workId: "A" },
        ],
      ),
    ).toMatchObject({ workId: "A", skipped: [w] });
  });

  it("does not report a work as its own duplicate", () => {
    expect(
      resolveIdentifiers(
        [arxiv, doi],
        [
          { ...doi, workId: "A" },
          { ...arxiv, workId: "A" },
        ],
      ),
    ).toMatchObject({
      workId: "A",
      insert: [],
      possibleDuplicates: [],
    });
  });

  it("orders lock keys stably and without repeats", () => {
    expect(identifierLockKeys([w, arxiv, doi, arxiv])).toEqual([
      "arxiv:2501.12948",
      "doi:10.1038/s41586-025-09422-z",
      "openalex:W4414281281",
    ]);
  });

  it("finds the strongest shared identifier", () => {
    expect(sharedIdentifier([w, doi, arxiv], [doi, arxiv])).toEqual(arxiv);
    expect(sharedIdentifier([w], [doi])).toBeNull();
  });
});

describe("title similarity (suggestions only)", () => {
  it("normalises markup, accents, case and punctuation", () => {
    expect(normaliseTitle("<i>Schrödinger</i>’s  Équation: a Note!")).toBe("schrodinger s equation a note");
    expect(normaliseTitle("ﬁnite groups")).toBe("finite groups");
  });

  it("scores word overlap between 0 and 1", () => {
    expect(titleSimilarity("Attention Is All You Need", "attention is all you need.")).toBe(1);
    expect(titleSimilarity("Attention Is All You Need", "Deep residual learning")).toBe(0);
    expect(titleSimilarity("", "x")).toBe(0);
  });

  it("suggests a duplicate only for long enough, near-identical titles with close years", () => {
    const a = { title: "Direct Preference Optimization: Your Language Model is Secretly a Reward Model", year: 2023 };
    expect(
      titlesSuggestDuplicate(a, { title: "Direct preference optimization - your language model is secretly a reward model", year: 2024 }),
    ).toBe(true);
    expect(titlesSuggestDuplicate(a, { title: a.title, year: 2026 })).toBe(false);
    expect(titlesSuggestDuplicate({ title: "Introduction", year: null }, { title: "Introduction", year: null })).toBe(false);
    expect(titlesSuggestDuplicate(a, { title: null })).toBe(false);
    expect(titlesSuggestDuplicate(a, { title: "Direct Preference Optimization for Robots", year: 2023 })).toBe(false);
  });
});
