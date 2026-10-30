import { describe, expect, it } from "vitest";
import { annotateTurn, formatEvidenceBlocks } from "./citations";

const allowed = [
  { tag: "E1", label: "Melrose notes, §1.1, p. 7", locatorId: "loc-1" },
  { tag: "E2", label: "Melrose notes, §1.2, p. 9", locatorId: "loc-2" },
];

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
