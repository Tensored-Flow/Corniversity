import { describe, expect, it } from "vitest";
import { segmentPage } from "./ingest";

describe("segmentPage", () => {
  it("keeps theorem labels with their statements and classifies kinds", () => {
    const text = [
      "Definition 7",
      "A norm on a vector space V is a function satisfying three properties: definiteness, homogeneity and the triangle inequality.",
      "",
      "Proposition 8",
      "Let ||·|| be a norm on V. Then d(v,w) = ||v − w|| defines a metric on V, called the metric induced by the norm.",
      "",
      "Some ordinary prose that runs on for long enough to count as a passage in its own right, with no heading at all.",
    ].join("\n");
    const segments = segmentPage(text);
    expect(segments.length).toBe(3);
    expect(segments[0]?.kind).toBe("definition");
    expect(segments[0]?.heading).toBe("Definition 7");
    expect(segments[1]?.kind).toBe("theorem");
    expect(segments[2]?.kind).toBe("paragraph");
  });
  it("keeps a proof as a proof passage without listing it as a heading", () => {
    const text = [
      "Theorem 3.1",
      "For every bounded operator on the space the spectrum is a non-empty compact set.",
      "Proof. Write and note",
      "the resolvent as a power series; it converges outside a disc of finite radius.",
      "",
      "Section 4 Eigenfunctions",
      "The eigenfunctions on the disc satisfy the boundary conditions stated earlier.",
    ].join("\n");
    const segments = segmentPage(text);
    expect(segments.map((s) => s.kind)).toEqual(["theorem", "proof", "paragraph"]);
    expect(segments.map((s) => s.heading)).toEqual(["Theorem 3.1", null, "Section 4 Eigenfunctions"]);
  });
  it("drops fragments too short to cite and bounds passage length", () => {
    const long = "x".repeat(3000);
    const segments = segmentPage(`short\n\n${long}`);
    expect(segments.every((s) => s.text.length <= 1200)).toBe(true);
    expect(segments.length).toBe(3);
  });
});
