import { describe, expect, it } from "vitest";
import { Locator, describeLocator } from "./locator";

describe("Locator", () => {
  it("describes a pdf locator with file, section and physical page when no printed label exists", () => {
    const loc = Locator.parse({
      kind: "pdf",
      sourceVersionId: "mit-fa-2021-s21",
      url: "https://ocw.mit.edu/x/lec1.pdf",
      fileLabel: "Lecture 1 notes",
      physicalPageIndex: 3,
      sectionLabel: "Definition 14",
    });
    expect(describeLocator(loc, "18.102")).toBe("18.102, Lecture 1 notes, Definition 14, PDF page 4");
  });
  it("prefers the printed page label when present", () => {
    const loc = Locator.parse({ kind: "pdf", sourceVersionId: "v", physicalPageIndex: 12, printedPageLabel: "xi" });
    expect(describeLocator(loc, "Book")).toBe("Book, p. xi");
  });
  it("rejects a book reference without an edition", () => {
    expect(() => Locator.parse({ kind: "book_reference", sourceVersionId: "v", edition: "", sectionLabel: "§2.1" })).toThrow();
  });
});
