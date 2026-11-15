import { describe, expect, it } from "vitest";
import { findHref, hasFilters, parseFindParams } from "./find-params";
import {
  abstractLabel,
  authorLine,
  dateLabel,
  dateWithPrecision,
  identifierHref,
  listCountSentence,
  locationLabel,
  previewHref,
  reportedBy,
  resetSentence,
  showMoreLabel,
  typeLabel,
} from "./format";
import { commonStamp, namedSubjects, paperFromRecord, sameStamp } from "./model";

describe("paper wording", () => {
  it("states what OpenAlex counted and returned for a list longer than the fifty shown", () => {
    // hep-th/9711200: 77 references, a record for each, the first 50 listed.
    const long = { total: 77, returned: 77, listed: 50, missing: 0 };
    expect(listCountSentence("references", long)).toBe(
      "OpenAlex lists 77 references and returned records for 77; the first 50 are listed. OpenAlex's reference lists are incomplete for some fields.",
    );
    expect(showMoreLabel("references", long)).toBe("Show more (50 of 77)");
    const short = { total: 46, returned: 42, listed: 42, missing: 4 };
    expect(listCountSentence("references", short)).toBe(
      "OpenAlex lists 46 references and returned records for 42; 4 listed without a record OpenAlex could return. OpenAlex's reference lists are incomplete for some fields.",
    );
    expect(showMoreLabel("references", short)).toBe("Show more (all 42)");
    const cited = { total: 3146, returned: 50, listed: 50, missing: 0 };
    expect(listCountSentence("cited_by", cited)).toBe(
      "3,146 works cite this paper according to OpenAlex; the 50 most cited of them are listed, most cited first.",
    );
    expect(showMoreLabel("cited_by", cited)).toBe("Show more (50 of 3,146)");
    expect(listCountSentence("related", { total: 60, returned: 60, listed: 50, missing: 0 })).toBe(
      "Similar according to OpenAlex (similarity, not citation): 60 works, 60 with records; the first 50 are listed.",
    );
  });

  it("names the first authors, then et al.", () => {
    expect(authorLine([])).toBe("");
    expect(authorLine([{ name: "A" }, { name: "B" }])).toBe("A, B");
    expect(authorLine([{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }])).toBe("A, B, C et al.");
  });

  it("shows a date with what is known of it: a day, or the year only", () => {
    expect(dateLabel({ date: "2023-05-29", year: 2023, precision: "day" })).toBe("29 May 2023");
    expect(dateLabel({ date: null, year: 2023, precision: "year" })).toBe("2023");
    expect(dateWithPrecision({ date: null, year: 2023, precision: "year" })).toBe("2023 (year only)");
    expect(dateWithPrecision({ date: "2018-02-13", year: 2018, precision: "day" })).toBe("13 February 2018");
    expect(dateWithPrecision({ date: null, year: null, precision: null })).toBeNull();
  });

  it("says whose report a value is and when it was retrieved", () => {
    expect(reportedBy("openalex", "2026-11-15T03:13:20.000Z")).toBe("as reported by OpenAlex, retrieved 2026-11-15");
    expect(reportedBy("fixture", "2026-11-15T03:13:20.000Z")).toBe("fixture data recorded on 2026-11-15");
    expect(reportedBy("owner", "2026-11-16T10:00:00.000Z")).toBe("edited by you on 2026-11-16");
    expect(abstractLabel("openalex")).toBe("Abstract as indexed by OpenAlex");
    expect(abstractLabel("owner")).toBe("Abstract written by you");
    expect(typeLabel("conference-paper")).toBe("Conference paper");
  });

  it("links identifiers only through their validated value", () => {
    expect(identifierHref("doi", "10.1016/s0140-6736(97)11096-0")).toBe("https://doi.org/10.1016/s0140-6736(97)11096-0");
    expect(identifierHref("arxiv", "hep-th/9711200")).toBe("https://arxiv.org/abs/hep-th/9711200");
    expect(identifierHref("openalex", "W2741809807")).toBe("https://openalex.org/W2741809807");
    expect(identifierHref("pmcid", "PMC5815332")).toBe("https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5815332/");
    expect(identifierHref("doi", "javascript:alert(1)")).toBeNull();
    expect(previewHref("doi", "10.1234/a b")).toBe("/library/works/doi/10.1234/a%20b");
    expect(previewHref("arxiv", "hep-th/9711200")).toBe("/library/works/arxiv/hep-th/9711200");
  });

  it("names where an open copy is and which version OpenAlex says it is", () => {
    expect(
      locationLabel({
        sourceName: "PeerJ",
        landingPageUrl: "https://doi.org/10.7717/peerj.4375",
        pdfUrl: null,
        version: "publishedVersion",
      }),
    ).toBe("PeerJ, published version");
    expect(locationLabel({ sourceName: null, landingPageUrl: null, pdfUrl: "https://example.org/a.pdf", version: null })).toBe(
      "example.org, version not reported",
    );
    expect(resetSentence("2026-11-16T00:00:00.000Z")).toBe("It resets at 2026-11-16 00:00 UTC.");
    expect(resetSentence(null)).toBeNull();
  });
});

describe("Find's address", () => {
  it("keeps valid parameters, drops malformed ones and orders years", () => {
    expect(
      parseFindParams({ q: "  dpo ", scope: "mine", from: "2024", to: "2023", type: "preprint", free: "1", field: "physics", page: "3" }),
    ).toEqual({
      q: "dpo",
      scope: "mine",
      yearFrom: 2023,
      yearTo: 2024,
      type: "preprint",
      freeToRead: true,
      field: "physics",
      page: 3,
    });
    const odd = parseFindParams({ q: ["a", "b"], scope: "everything", from: "99", type: "a|b", field: "../x", page: "-1" });
    expect(odd).toMatchObject({ q: "", scope: "all", yearFrom: undefined, type: undefined, field: undefined, page: 1, freeToRead: false });
    expect(hasFilters(odd)).toBe(false);
    expect(findHref({ q: "direct preference", page: 2, freeToRead: true })).toBe("/library/find?q=direct+preference&free=1&page=2");
    expect(findHref({})).toBe("/library/find");
  });
});

describe("the preview's view of a provider record", () => {
  it("keeps each value's provenance and labels fixture data", () => {
    const paper = paperFromRecord({
      provenance: { provider: "openalex", source: "fixture", retrievedAt: "2026-11-15T03:13:20.000Z", stale: false },
      identifiers: [{ scheme: "openalex", value: "W1" }],
      title: "A title",
      authors: [{ name: "Ada" }],
      abstract: "Words.",
      abstractSource: "openalex",
      publicationYear: 2023,
      publicationDate: null,
      publicationDatePrecision: "year",
      venue: null,
      workType: "article",
      subjects: [
        { id: "3", name: "Physical Sciences", level: "domain", score: null },
        { id: "T1", name: "Topic one", level: "topic", score: 0.9 },
        { id: "17", name: "Computer Science", level: "field", score: null },
      ],
      referencedOpenAlexIds: [],
      referencesRetrieved: true,
      fieldProvenance: { title: { source: "fixture", retrievedAt: "2026-11-15T03:13:20.000Z" } },
      integrityNotices: [],
      versions: [],
    });
    expect(paper.fixture).toBe(true);
    expect(paper.stamps.title).toEqual({ source: "fixture", retrievedAt: "2026-11-15T03:13:20.000Z" });
    expect(paper.identifiers[0]).toMatchObject({ source: "fixture", superseded: false });
    expect(namedSubjects(paper.subjects).map((s) => s.name)).toEqual(["Computer Science", "Topic one"]);
  });
});

describe("provenance said once", () => {
  it("names the stamp most details share; a field the owner edited keeps its own", () => {
    const fixture = { source: "fixture", retrievedAt: "2026-11-15T03:13:20.000Z" };
    const later = { source: "fixture", retrievedAt: "2026-11-15T05:49:00.000Z" };
    const owner = { source: "owner", retrievedAt: "2026-11-16T09:00:00.000Z" };
    const common = commonStamp({ stamps: { title: fixture, authors: fixture, date: later, venue: owner }, abstract: null });
    expect(common).toEqual(fixture);
    // The same source on the same day is the same stamp; another source or day is not.
    expect(sameStamp(later, common)).toBe(true);
    expect(sameStamp(owner, common)).toBe(false);
    expect(commonStamp({ stamps: {}, abstract: null })).toBeNull();
  });
});
