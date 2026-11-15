import { describe, expect, it } from "vitest";
import { type EditFormValues, editFormValues, workEditFromForm } from "./edit-form";

const shown: EditFormValues = {
  title: "",
  authors: "",
  abstract: "",
  year: "",
  venue: "",
  workType: "",
};

describe("Edit details: what becomes an edit", () => {
  it("sends only the fields the owner changed in this form, with what the form showed for each", () => {
    // A form opened while the paper was still untitled (its arXiv record not yet arrived); the owner fills in the venue only.
    expect(workEditFromForm({ ...shown, venue: " NeurIPS 2023 " }, shown)).toEqual({
      edit: { venue: "NeurIPS 2023" },
      expected: { venue: null },
    });
  });

  it("never sends a field left alone, so a stale form cannot blank details that arrived meanwhile", () => {
    const opened: EditFormValues = { ...shown, title: "Attention Is All You Need", authors: "Ashish Vaswani\nNoam Shazeer", year: "2017" };
    expect(workEditFromForm(opened, opened)).toEqual({ edit: {}, expected: {} });
    // Whitespace and blank author lines are not changes.
    expect(
      workEditFromForm({ ...opened, authors: "  Ashish Vaswani\n\n Noam Shazeer \n", title: " Attention Is All You Need" }, opened).edit,
    ).toEqual({});
  });

  it("parses what changed: authors one per line, the year as a number (or not a year), empties as none", () => {
    const opened: EditFormValues = {
      ...shown,
      title: "T",
      authors: "A",
      abstract: "An abstract.",
      year: "2017",
      venue: "V",
      workType: "article",
    };
    const { edit, expected } = workEditFromForm(
      { title: "T", authors: "A\nB", abstract: "", year: "20x7", venue: "", workType: "preprint" },
      opened,
    );
    expect(edit).toEqual({ authors: ["A", "B"], abstract: null, publicationYear: Number.NaN, venue: null, workType: "preprint" });
    expect(expected).toEqual({ authors: ["A"], abstract: "An abstract.", publicationYear: 2017, venue: "V", workType: "article" });
    expect(workEditFromForm({ ...opened, year: "" }, opened).edit).toEqual({ publicationYear: null });
  });

  it("reads the submitted and the shown values from one form", () => {
    const form = new FormData();
    form.set("title", "New");
    form.set("shown_title", "Old");
    form.set("shown_venue", "V");
    expect(editFormValues(form).title).toBe("New");
    expect(editFormValues(form, "shown_")).toEqual({ ...shown, title: "Old", venue: "V" });
  });
});
