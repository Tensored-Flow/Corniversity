import { describe, expect, it } from "vitest";
import { annotateTurn, citedHistory, formatEvidenceBlocks, foundOnPage } from "./citations";

const allowed = [
  { tag: "E1", label: "Melrose notes, §1.1, p. 7", locatorId: "loc-1" },
  { tag: "E2", label: "Melrose notes, §1.2, p. 9", locatorId: "loc-2" },
];

describe("history replayed to a later turn", () => {
  it("names the sources earlier tags resolved to, so no tag can be reused for another source", () => {
    const stored = "Norms on a finite-dimensional space are equivalent [E1, E7]. Completeness follows [E9].";
    const citations = [
      { tag: "E1", label: "Melrose notes, §1.1, p. 7" },
      { tag: "E7", label: "Your library: Kreyszig, p. 75 (PDF page 88)" },
    ];
    expect(citedHistory(stored, citations)).toBe(
      "Norms on a finite-dimensional space are equivalent (cited then: Melrose notes, §1.1, p. 7; Your library: Kreyszig, p. 75 (PDF page 88)). Completeness follows.",
    );
    expect(citedHistory(stored, citations)).not.toMatch(/\[E\d/);
  });
});

describe("a selection checked against its page", () => {
  it("is found despite line breaks, spacing, case and soft hyphens, and not when it is elsewhere", () => {
    const page = "Definition 1.1\nA Banach space is a com\u00adplete normed\n  space.";
    expect(foundOnPage("a banach space is a complete normed space", page)).toBe(true);
    expect(foundOnPage("A Hilbert space is an inner product space", page)).toBe(false);
    expect(foundOnPage("   ", page)).toBe(false);
  });
});

describe("annotateTurn", () => {
  it("keeps known citations, maps them to locators and orders them", () => {
    const turn = annotateTurn("A norm induces a metric [E2]. {source-backed} Completeness is separate [E1].", allowed);
    expect(turn.citations.map((c) => c.tag)).toEqual(["E1", "E2"]);
    expect(turn.citations[0]?.locatorId).toBe("loc-1");
    expect(turn.markdown).toContain("[E2]");
    expect(turn.markdown).not.toContain("{source-backed}");
    expect(turn.labels).toContain("source_backed");
  });

  it("removes unknown tags and records the sentence as an uncited claim", () => {
    const turn = annotateTurn("The book proves this on page 300 [E7].", allowed);
    expect(turn.unknownTags).toEqual(["E7"]);
    expect(turn.markdown).toBe("The book proves this on page 300.");
    expect(turn.uncitedClaims).toHaveLength(1);
    expect(turn.labels).toContain("needs_checking");
  });

  it("handles grouped tags with a mix of known and unknown", () => {
    const turn = annotateTurn("See [E1, E9].", allowed);
    expect(turn.markdown).toBe("See [E1].");
    expect(turn.unknownTags).toEqual(["E9"]);
    expect(turn.uncitedClaims).toHaveLength(0); // the paragraph still carries a real citation
  });

  it("collects labels per paragraph", () => {
    const turn = annotateTurn("{derived} I suspect the converse fails.\n\n{conjecture} Maybe for all n.", allowed);
    expect(turn.paragraphs[0]?.labels).toEqual(["derived"]);
    expect(turn.paragraphs[1]?.labels).toEqual(["conjecture"]);
  });
});

describe("formatEvidenceBlocks", () => {
  it("numbers blocks deterministically and returns matching refs", () => {
    const { prompt, refs } = formatEvidenceBlocks([
      { label: "A", text: "first", locatorId: "a" },
      { label: "B", text: "second", passageId: "p" },
    ]);
    expect(refs.map((r) => r.tag)).toEqual(["E1", "E2"]);
    expect(prompt.startsWith("[E1] A\nfirst")).toBe(true);
    expect(refs[1]?.passageId).toBe("p");
  });
});

describe("location-only evidence", () => {
  const refs = [
    { tag: "E1", label: "Lecture 1, Definition 7", locatorId: "loc-1", kind: "location" as const },
    { tag: "E2", label: "Your library: Notes, p. 3", passageId: "p-1", kind: "passage" as const },
  ];
  it("never lets a location pointer pass as source-backed text", () => {
    const pointer = annotateTurn("{source-backed} A norm is positive-definite [E1].", refs);
    expect(pointer.paragraphs[0]?.labels).toEqual(["location_only"]);
    expect(pointer.labels).toEqual(["location_only"]);
    const text = annotateTurn("{source-backed} The passage defines the norm this way [E2].", refs);
    expect(text.paragraphs[0]?.labels).toEqual(["source_backed"]);
    const bare = annotateTurn("{source-backed} Trust me.", refs);
    expect(bare.paragraphs[0]?.labels).toEqual(["needs_checking"]);
  });
});
