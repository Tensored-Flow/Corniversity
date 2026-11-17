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
  pages,
  previewHref,
  readElsewhereNote,
  rejectionText,
  reportedBy,
  resetSentence,
  resultsSummary,
  showMoreLabel,
  typeLabel,
} from "./format";
import { commonStamp, namedSubjects, paperFromRecord, sameStamp } from "./model";

describe("paper wording", () => {
  it("counts pages in the singular for one page", () => {
    expect(pages(1)).toBe("1 page");
    expect(pages(2)).toBe("2 pages");
    expect(pages(1204)).toBe("1,204 pages");
  });

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

  it("carries an author as words only: separators become spaces, each word starts with a letter, at most 100 characters", () => {
    const author = (text: string | string[]) => parseFindParams({ author: text }).author;
    expect(author("  Claude   Shannon ")).toBe("Claude Shannon");
    expect(author("Jean-Pierre O’Brien")).toBe("Jean-Pierre O’Brien");
    expect(author("C. E. Shannon")).toBe("C. E. Shannon");
    // Nothing that could end, extend or negate the OpenAlex filter survives.
    expect(author("Shannon, Claude|x:y+z")).toBe("Shannon Claude x y z");
    expect(author('!Shannon -Jones "Finn" (Levine)*')).toBe("Shannon Jones Finn Levine");
    expect(author(",|:!-")).toBeUndefined();
    expect(author(["Shannon", "Finn"])).toBeUndefined();
    expect(author("a".repeat(150))).toBe("a".repeat(100));
    const params = parseFindParams({ author: "Claude Shannon", page: "2" });
    expect(hasFilters(params)).toBe(true);
    expect(findHref(params)).toBe("/library/find?author=Claude+Shannon&page=2");
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

/**
 * Find's line above OpenAlex's results. Past the last page, and no papers at all, are tested here
 * with page data written for the test (no fixture recording holds a page past OpenAlex's last; none
 * is invented), and the service's page arithmetic in paper-lists.test.ts.
 */
describe("Find's results line (test-only page data)", () => {
  const base = { perPage: 25, lastPage: 400, count: 12_345 as number | null };
  it("states the results shown and OpenAlex's count", () => {
    expect(resultsSummary({ ...base, page: 2, shown: 25 })).toEqual({ line: "Results 26–50 of 12,345 according to OpenAlex", goTo: null });
    expect(resultsSummary({ ...base, count: null, page: 1, shown: 3 })).toEqual({ line: "Results 1–3 according to OpenAlex", goTo: null });
  });

  it("past the last page says the page is empty while OpenAlex still counts results, and offers the last page", () => {
    expect(resultsSummary({ ...base, count: 30, lastPage: 2, page: 5, shown: 0 })).toEqual({
      line: "No results on page 5; OpenAlex counts 30 for these words and filters.",
      goTo: 2,
    });
    // A count that changed between cached pages: the page before this one.
    expect(resultsSummary({ ...base, count: 60, lastPage: 3, page: 3, shown: 0 })).toEqual({
      line: "No results on page 3; OpenAlex counts 60 for these words and filters.",
      goTo: 2,
    });
    // No count: the first page.
    expect(resultsSummary({ ...base, count: null, lastPage: 4, page: 4, shown: 0 })).toEqual({ line: "No results on page 4.", goTo: 1 });
  });

  it("says OpenAlex found no papers only when it counts none", () => {
    expect(resultsSummary({ ...base, count: 0, lastPage: 1, page: 1, shown: 0 })).toEqual({
      line: "OpenAlex found no papers for these words and filters.",
      goTo: null,
    });
    expect(resultsSummary({ ...base, count: null, lastPage: 1, page: 1, shown: 0 }).line).toBe(
      "OpenAlex found no papers for these words and filters.",
    );
  });
});

describe("states the paper page names", () => {
  it("a rejected file says why in the page's own words, never the parser's message", () => {
    expect(rejectionText("The PDF could not be parsed: Invalid PDF structure.")).toEqual({
      text: "This file could not be read as a PDF, so its text was not extracted.",
      next: "Remove this file under Permissions and removal, then attach a copy that opens.",
    });
    expect(rejectionText("stored bytes missing").text).toBe("This file's stored bytes are missing, so its text could not be extracted.");
    expect(rejectionText(null).text).toBe("This file could not be processed; the Jobs page has the details.");
    expect(JSON.stringify(rejectionText("<script>"))).not.toContain("<script>");
  });

  it("a readable PDF that is too long or has a password is not called unreadable, nor told to be replaced by one that opens", () => {
    // The worker's reasons (apps/worker/src/handlers/ingest.ts; pdf.js's PasswordException message).
    const long = rejectionText("The PDF could not be parsed: 2500 pages exceeds the 2000-page limit");
    expect(long.text).toBe("This PDF has 2,500 pages, more than the 2,000 whose text is extracted here, so its text was not extracted.");
    expect(long.next).not.toContain("a copy that opens");
    const locked = rejectionText("The PDF could not be parsed: No password given");
    expect(locked.text).toBe("This PDF is protected by a password, so its text was not extracted.");
    expect(locked.next).toBe("Remove this file under Permissions and removal, then attach a copy without a password.");
  });

  it("where a paper with no file here can be read: never an empty block", () => {
    expect(readElsewhereNote({ record: true, openCopy: false, publisher: true, failed: false })).toBe(
      "OpenAlex reports no free-to-read copy.",
    );
    expect(readElsewhereNote({ record: true, openCopy: true, publisher: true, failed: false })).toBeNull();
    // An unidentified paper whose file was removed: no record, no failure, no publisher link.
    expect(readElsewhereNote({ record: false, openCopy: false, publisher: false, failed: false })).toBe(
      "No file of this paper can be read here, and it has no identifier a provider can look up, so where it can be read is not known.",
    );
    // A failure says itself; a publisher link is something to follow.
    expect(readElsewhereNote({ record: false, openCopy: false, publisher: false, failed: true })).toBeNull();
    expect(readElsewhereNote({ record: false, openCopy: false, publisher: true, failed: false })).toBeNull();
  });
});
