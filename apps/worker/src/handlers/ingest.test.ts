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
  it("drops fragments too short to cite and bounds passage length", () => {
    const long = "x".repeat(3000);
    const segments = segmentPage(`short\n\n${long}`);
    expect(segments.every((s) => s.text.length <= 1200)).toBe(true);
    expect(segments.length).toBe(3);
  });
});
