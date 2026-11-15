import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashNotices } from "../shared";
import { addListEmptyText, collectionSavedText, KIND_TEXT, savedPageNumber } from "./text";

describe("collection page confirmations", () => {
  it("shows the page's own text for a listed key and nothing for an inherited key", () => {
    expect(collectionSavedText("shelf", "added")).toBe("Added.");
    expect(collectionSavedText("trail", "reason")).toBe("Reason saved.");
    expect(collectionSavedText("shelf", "removed-note")).toBe(KIND_TEXT.shelf.removedWithReason);
    expect(collectionSavedText("trail", "removed-note")).toBe(KIND_TEXT.trail.removedWithReason);
    for (const key of ["__proto__", "constructor", "toString", "hasOwnProperty", "", "unknown"]) {
      expect(collectionSavedText("shelf", key)).toBeNull();
    }
  });

  it("FlashNotices renders the generic confirmation for an inherited key instead of failing", () => {
    for (const saved of ["__proto__", "constructor"]) {
      const html = renderToStaticMarkup(createElement(FlashNotices, { saved }));
      expect(html).toContain("Saved.");
    }
    expect(renderToStaticMarkup(createElement(FlashNotices, { saved: "metadata" }))).toContain("Metadata saved.");
  });
});

describe("Add from your library, when nothing is offered", () => {
  it("says the matching papers are already here rather than that nothing matches", () => {
    expect(addListEmptyText("shelf", "attention", 1)).toBe(
      "Every paper in your library that matches these words is already on this shelf.",
    );
    expect(addListEmptyText("trail", "attention", 3)).toBe(
      "Every paper in your library that matches these words is already on this trail.",
    );
  });

  it("says nothing matches only when the search found nothing", () => {
    expect(addListEmptyText("shelf", "attention", 0)).toBe("No paper in your library matches these words.");
    expect(addListEmptyText("trail", "", 4)).toBe("Every paper you saved recently is already here. Search your papers for older ones.");
    expect(addListEmptyText("shelf", "", 0)).toBe("You have no saved papers yet.");
  });
});

describe("the home's saved-papers page number", () => {
  it("keeps any whole number from 1, so a page past the last can say so", () => {
    expect(savedPageNumber("1")).toBe(1);
    expect(savedPageNumber("40")).toBe(40);
    expect(savedPageNumber("1000")).toBe(1000);
    expect(savedPageNumber("9999")).toBe(9999);
    // Huge values are capped (still past the last page), never wrapped or turned into page 1.
    expect(savedPageNumber("123456789")).toBe(100_000);
    expect(savedPageNumber("9".repeat(400))).toBe(100_000);
  });

  it("reads anything else as page 1", () => {
    for (const value of ["", "0", "-2", "2.5", "1e3", "abc", " 3", "0x10"]) expect(savedPageNumber(value)).toBe(1);
  });
});
