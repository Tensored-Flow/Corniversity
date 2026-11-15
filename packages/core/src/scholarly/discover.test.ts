import { describe, expect, it } from "vitest";
import {
  boundedList,
  citedByLibrary,
  citedByLibraryReason,
  discoverSeed,
  earlierWorkReason,
  mostCitedReason,
  newOnArxivReason,
  similarReason,
  surpriseReason,
} from "./discover";

describe("Discover explanations", () => {
  it("states counts and sources as facts", () => {
    expect(citedByLibraryReason(1).text).toBe("Cited by 1 paper in your library");
    expect(citedByLibraryReason(3).text).toBe("Cited by 3 papers in your library");
    expect(mostCitedReason().text).toBe("Most cited in OpenAlex (a count, not a judgement of importance)");
    expect(earlierWorkReason().text).toMatch(/before 1990 \(a count, not a judgement of importance\)$/);
    expect(newOnArxivReason(["math.*"]).text).toBe("Newest submissions to arXiv in math.*");
    expect(surpriseReason("Neuroscience").text).toMatch(/free to read according to OpenAlex; chosen by OpenAlex sampling$/);
  });

  it("never presents similarity as a citation", () => {
    const reason = similarReason("Attention Is All You Need");
    expect(reason).toEqual({
      kind: "similar",
      text: "Similar to Attention Is All You Need in OpenAlex (similarity, not a citation)",
      emphasis: "Attention Is All You Need",
    });
    expect(reason.text).not.toMatch(/\bcited\b/i);
  });

  it("derives a stable 31-bit seed per owner and day", () => {
    const a = discoverSeed("owner-1", "2026-11-15");
    expect(a).toBe(discoverSeed("owner-1", "2026-11-15"));
    expect(a).not.toBe(discoverSeed("owner-1", "2026-11-16"));
    expect(a).not.toBe(discoverSeed("owner-2", "2026-11-15"));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0x7fffffff);
  });
});

describe("citedByLibrary", () => {
  const works = [
    { workId: "a", referencedOpenAlexIds: ["W1", "W2", "W3", "W3"] },
    { workId: "b", referencedOpenAlexIds: ["W2", "W3", "W9"] },
    { workId: "c", referencedOpenAlexIds: ["W2", "W4"] },
  ];

  it("counts each citing paper once, skips papers already in the library, and orders by count then id", () => {
    expect(citedByLibrary(works, new Set(["W9"]))).toEqual([
      { openalexId: "W2", count: 3, citingWorkIds: ["a", "b", "c"] },
      { openalexId: "W3", count: 2, citingWorkIds: ["a", "b"] },
    ]);
    expect(citedByLibrary(works, new Set(["W2"]), 2)).toEqual([{ openalexId: "W3", count: 2, citingWorkIds: ["a", "b"] }]);
    expect(citedByLibrary(works, new Set(), 1, 1)).toHaveLength(1);
  });

  it("bounds lists and removes repeats and library papers", () => {
    expect(boundedList(["W1", "W2", "W1", "W3", "W4"], (x) => x, new Set(["W3"]), 3)).toEqual(["W1", "W2", "W4"]);
  });
});
