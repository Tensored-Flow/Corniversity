import { describe, expect, it } from "vitest";
import {
  arxivAbsUrl,
  arxivIdFromDoi,
  arxivPdfUrl,
  identifiersFromArxiv,
  identifiersFromOpenAlex,
  isArxivDoi,
  linkedDocumentKey,
  MAX_SEARCH_QUERY_LENGTH,
  normaliseDoi,
  normaliseIdentifier,
  normalisePmcid,
  normalisePmid,
  parseArxivId,
  parseLinkedDocumentKey,
  parseOpenAlexId,
  recogniseInput,
} from "./identifiers";

describe("normaliseDoi", () => {
  it("accepts bare, prefixed and resolver forms and lower-cases them", () => {
    expect(normaliseDoi("10.7717/peerj.4375")).toBe("10.7717/peerj.4375");
    expect(normaliseDoi("  10.1103/PhysRevLett.116.061102 ")).toBe("10.1103/physrevlett.116.061102");
    expect(normaliseDoi("doi:10.7717/PeerJ.4375")).toBe("10.7717/peerj.4375");
    expect(normaliseDoi("DOI: 10.7717/peerj.4375")).toBe("10.7717/peerj.4375");
    expect(normaliseDoi("https://doi.org/10.1016/S0140-6736(97)11096-0")).toBe("10.1016/s0140-6736(97)11096-0");
    expect(normaliseDoi("http://dx.doi.org/10.7717/peerj.4375")).toBe("10.7717/peerj.4375");
    expect(normaliseDoi("doi.org/10.7717/peerj.4375")).toBe("10.7717/peerj.4375");
  });

  it("refuses anything that is not ^10.NNNN/suffix, and hostile or oversized strings", () => {
    for (const bad of [
      "10.123/abc",
      "11.1234/abc",
      "10.1234/",
      "10.1234",
      "10.1234/a b",
      "10.1234/abc\u0000",
      "10.1234/abc\u202e",
      "10.1234/\u200babc",
      "doi:",
      "",
      "javascript:alert(1)",
      `10.1234/${"x".repeat(400)}`,
    ]) {
      expect(normaliseDoi(bad), bad).toBeNull();
    }
    expect(normaliseDoi(42)).toBeNull();
    expect(normaliseDoi(null)).toBeNull();
  });

  it("knows arXiv's own DOIs are DataCite DOIs", () => {
    expect(isArxivDoi("10.48550/arxiv.2305.18290")).toBe(true);
    expect(isArxivDoi("10.7717/peerj.4375")).toBe(false);
    expect(arxivIdFromDoi("10.48550/arxiv.2305.18290")).toBe("2305.18290");
    expect(arxivIdFromDoi("10.48550/arxiv.hep-th/9711200")).toBe("hep-th/9711200");
    expect(arxivIdFromDoi("10.48550/arxiv.not-an-id")).toBeNull();
  });
});

describe("parseArxivId", () => {
  it("parses new-style ids with the digit count of their period", () => {
    expect(parseArxivId("2305.18290")).toEqual({ id: "2305.18290", version: null });
    expect(parseArxivId("2305.18290v3")).toEqual({ id: "2305.18290", version: 3 });
    expect(parseArxivId("arXiv:2305.18290v2")).toEqual({ id: "2305.18290", version: 2 });
    expect(parseArxivId("ARXIV: 1706.03762")).toEqual({ id: "1706.03762", version: null });
    expect(parseArxivId("0704.0001")).toEqual({ id: "0704.0001", version: null });
    expect(parseArxivId("1412.9999v12")).toEqual({ id: "1412.9999", version: 12 });
    expect(parseArxivId("1501.00001")).toEqual({ id: "1501.00001", version: null });
  });

  it("refuses wrong digit counts, impossible months, the pre-2007 range and bad versions", () => {
    for (const bad of [
      "1501.0001",
      "1412.12345",
      "0703.0001",
      "2313.12345",
      "2300.12345",
      "2305.18290v0",
      "2305.18290v",
      "2305.18290v01",
      "2305.1829",
      "x2305.18290",
    ]) {
      expect(parseArxivId(bad), bad).toBeNull();
    }
  });

  it("parses old-style ids, dropping the optional subject class and lower-casing the archive", () => {
    expect(parseArxivId("hep-th/9711200")).toEqual({ id: "hep-th/9711200", version: null });
    expect(parseArxivId("hep-th/9711200v3")).toEqual({ id: "hep-th/9711200", version: 3 });
    expect(parseArxivId("math.GT/0309136")).toEqual({ id: "math/0309136", version: null });
    expect(parseArxivId("math.gt/0309136v2")).toEqual({ id: "math/0309136", version: 2 });
    expect(parseArxivId("HEP-TH/9711200")).toEqual({ id: "hep-th/9711200", version: null });
    expect(parseArxivId("arXiv:cond-mat/0207270")).toEqual({ id: "cond-mat/0207270", version: null });
  });

  it("refuses old-style ids outside August 1991 to March 2007 and malformed ones", () => {
    for (const bad of [
      "hep-th/9107001",
      "hep-th/0704001",
      "hep-th/9713001",
      "hep-th/971120",
      "hep-th/97112000",
      "../etc/passwd",
      "hep th/9711200",
      "-th/9711200",
    ]) {
      expect(parseArxivId(bad), bad).toBeNull();
    }
    expect(parseArxivId(undefined)).toBeNull();
  });

  it("builds arXiv links and linked-Document keys only from valid ids", () => {
    expect(arxivAbsUrl("2305.18290", 3)).toBe("https://arxiv.org/abs/2305.18290v3");
    expect(arxivAbsUrl("hep-th/9711200")).toBe("https://arxiv.org/abs/hep-th/9711200");
    expect(arxivPdfUrl("hep-th/9711200", 3)).toBe("https://arxiv.org/pdf/hep-th/9711200v3");
    expect(linkedDocumentKey("2305.18290", 3)).toBe("arxiv:2305.18290v3");
    expect(parseLinkedDocumentKey("arxiv:hep-th/9711200v3")).toEqual({ id: "hep-th/9711200", version: 3 });
    expect(parseLinkedDocumentKey("arxiv:2305.18290")).toBeNull();
    expect(parseLinkedDocumentKey("92cb3a2b71362acda98a789b03d88688fd33cf5fcf13f81d2b1de30ee7d3b67a")).toBeNull();
    expect(() => linkedDocumentKey("2305.1829", 1)).toThrow();
    expect(() => linkedDocumentKey("2305.18290", 0)).toThrow();
  });
});

describe("OpenAlex, PubMed and PMC ids", () => {
  it("normalises W ids and refuses everything else", () => {
    expect(parseOpenAlexId("W2741809807")).toBe("W2741809807");
    expect(parseOpenAlexId("w2741809807")).toBe("W2741809807");
    expect(parseOpenAlexId("https://openalex.org/W2741809807")).toBe("W2741809807");
    for (const bad of ["W0", "W", "A123", "W123abc", "W1234567890123456", "https://openalex.org/A1", "W12 3"]) {
      expect(parseOpenAlexId(bad), bad).toBeNull();
    }
  });

  it("normalises PubMed and PMC ids from their OpenAlex URL forms", () => {
    expect(normalisePmid("https://pubmed.ncbi.nlm.nih.gov/29456894")).toBe("29456894");
    expect(normalisePmid("pmid:29456894")).toBe("29456894");
    expect(normalisePmid("29456894x")).toBeNull();
    expect(normalisePmcid("https://www.ncbi.nlm.nih.gov/pmc/articles/5815332")).toBe("PMC5815332");
    expect(normalisePmcid("PMC5815332")).toBe("PMC5815332");
    expect(normalisePmcid("pmc5815332/")).toBe("PMC5815332");
    expect(normalisePmcid("PMC")).toBeNull();
  });

  it("normaliseIdentifier validates by scheme", () => {
    expect(normaliseIdentifier("arxiv", "2305.18290v3")).toEqual({ scheme: "arxiv", value: "2305.18290" });
    expect(normaliseIdentifier("doi", "10.1234/X")).toEqual({ scheme: "doi", value: "10.1234/x" });
    expect(normaliseIdentifier("openalex", "W1")).toEqual({ scheme: "openalex", value: "W1" });
    expect(normaliseIdentifier("doi", "W1")).toBeNull();
  });
});

describe("recogniseInput", () => {
  it("is empty for blank or non-string input", () => {
    expect(recogniseInput("")).toEqual({ kind: "empty" });
    expect(recogniseInput("   \n")).toEqual({ kind: "empty" });
    expect(recogniseInput(undefined)).toEqual({ kind: "empty" });
  });

  it("recognises bare identifiers", () => {
    expect(recogniseInput("10.7717/peerj.4375")).toEqual({ kind: "doi", doi: "10.7717/peerj.4375", host: null });
    expect(recogniseInput("doi:10.7717/PeerJ.4375")).toEqual({ kind: "doi", doi: "10.7717/peerj.4375", host: null });
    expect(recogniseInput("2305.18290v3")).toEqual({ kind: "arxiv", id: "2305.18290", version: 3, host: null });
    expect(recogniseInput("arXiv:hep-th/9711200")).toEqual({ kind: "arxiv", id: "hep-th/9711200", version: null, host: null });
    // Looks like a host and a path, but is an old-style arXiv id.
    expect(recogniseInput("math.GT/0309136")).toEqual({ kind: "arxiv", id: "math/0309136", version: null, host: null });
    expect(recogniseInput("W2741809807")).toEqual({ kind: "openalex", id: "W2741809807", host: null });
  });

  it("finds DOIs in doi.org links and in any link whose path contains one", () => {
    expect(recogniseInput("https://doi.org/10.1016/s0140-6736%2897%2911096-0")).toEqual({
      kind: "doi",
      doi: "10.1016/s0140-6736(97)11096-0",
      host: "doi.org",
    });
    expect(recogniseInput("doi.org/10.7717/peerj.4375")).toEqual({ kind: "doi", doi: "10.7717/peerj.4375", host: "doi.org" });
    expect(recogniseInput("https://www.biorxiv.org/content/10.1101/2020.03.30.016287v2.full.pdf")).toEqual({
      kind: "doi",
      doi: "10.1101/2020.03.30.016287",
      host: "biorxiv.org",
    });
    expect(recogniseInput("https://link.springer.com/article/10.1007/s00222-020-00978-1?error=cookies#sec1")).toEqual({
      kind: "doi",
      doi: "10.1007/s00222-020-00978-1",
      host: "link.springer.com",
    });
    expect(recogniseInput("https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.116.061102/")).toMatchObject({
      doi: "10.1103/physrevlett.116.061102",
    });
    // ".v2" is part of a figshare DOI: only a vN directly after a digit is a version suffix.
    expect(recogniseInput("https://figshare.com/articles/10.6084/m9.figshare.123.v2")).toMatchObject({ doi: "10.6084/m9.figshare.123.v2" });
    // A number that merely contains "10." is not a DOI start.
    expect(recogniseInput("https://example.org/210.12345/abc")).toEqual({ kind: "search", query: "", host: "example.org" });
  });

  it("recognises arXiv and OpenAlex links", () => {
    expect(recogniseInput("https://arxiv.org/abs/2305.18290v3")).toEqual({
      kind: "arxiv",
      id: "2305.18290",
      version: 3,
      host: "arxiv.org",
    });
    expect(recogniseInput("https://arxiv.org/pdf/2305.18290v3.pdf")).toMatchObject({ kind: "arxiv", version: 3 });
    expect(recogniseInput("http://www.arxiv.org/pdf/2305.18290")).toMatchObject({ kind: "arxiv", version: null, host: "arxiv.org" });
    expect(recogniseInput("https://export.arxiv.org/abs/hep-th/9711200v2")).toMatchObject({ id: "hep-th/9711200", version: 2 });
    expect(recogniseInput("arxiv.org/abs/2305.18290")).toMatchObject({ kind: "arxiv", host: "arxiv.org" });
    expect(recogniseInput("https://arxiv.org/list/math.AG/new")).toEqual({ kind: "search", query: "", host: "arxiv.org" });
    expect(recogniseInput("https://openalex.org/W2741809807")).toEqual({ kind: "openalex", id: "W2741809807", host: "openalex.org" });
    expect(recogniseInput("https://api.openalex.org/works/w2741809807")).toMatchObject({ kind: "openalex", id: "W2741809807" });
  });

  it("turns other links into a title search that names the host, and never fetches", () => {
    expect(recogniseInput("https://www.nature.com/articles/s41586-021-03819-2")).toEqual({ kind: "search", query: "", host: "nature.com" });
    expect(recogniseInput("https://example.org/blog/attention-is-all-you-need")).toEqual({
      kind: "search",
      query: "attention is all you need",
      host: "example.org",
    });
    expect(recogniseInput("https://doi.org/not-a-doi")).toEqual({ kind: "search", query: "", host: "doi.org" });
  });

  it("treats words, other schemes and hostile text as a plain search", () => {
    expect(recogniseInput("Attention is   all you need")).toEqual({ kind: "search", query: "Attention is all you need", host: null });
    expect(recogniseInput("javascript:alert(1)")).toEqual({ kind: "search", query: "javascript:alert(1)", host: null });
    expect(recogniseInput("ftp://example.org/10.1234/abc")).toMatchObject({ kind: "search", host: null });
    expect(recogniseInput("10.1234/abc\u202edef")).toEqual({ kind: "search", query: "10.1234/abc def", host: null });
    const long = recogniseInput(`${"word ".repeat(1000)}`);
    expect(long.kind).toBe("search");
    if (long.kind === "search") expect(long.query.length).toBeLessThanOrEqual(MAX_SEARCH_QUERY_LENGTH);
  });
});

describe("identifiersFromOpenAlex", () => {
  it("collects the W, every DOI, arXiv ids from arXiv DOIs and arXiv locations, PubMed and PMC ids", () => {
    // Shape as recorded for W7133208539 (DPO, merged into the NeurIPS record) on 2026-11-15.
    const dpo = {
      id: "https://openalex.org/W7133208539",
      doi: "https://doi.org/10.52202/075280-2338",
      ids: { openalex: "https://openalex.org/W7133208539", doi: "https://doi.org/10.52202/075280-2338" },
      primary_location: { id: "doi:10.52202/075280-2338", doi: "https://doi.org/10.52202/075280-2338" },
      best_oa_location: { id: "pmh:oai:arXiv.org:2305.18290", doi: null },
      locations: [
        { id: "doi:10.52202/075280-2338", doi: "https://doi.org/10.52202/075280-2338" },
        { id: "pmh:oai:arXiv.org:2305.18290", doi: null },
        { id: "doi:10.48550/arxiv.2305.18290", doi: "https://doi.org/10.48550/arxiv.2305.18290" },
        null,
      ],
    };
    expect(identifiersFromOpenAlex(dpo)).toEqual([
      { scheme: "openalex", value: "W7133208539" },
      { scheme: "doi", value: "10.48550/arxiv.2305.18290" },
      { scheme: "doi", value: "10.52202/075280-2338" },
      { scheme: "arxiv", value: "2305.18290" },
    ]);
    const peerj = {
      id: "https://openalex.org/W2741809807",
      doi: "https://doi.org/10.7717/peerj.4375",
      ids: {
        pmid: "https://pubmed.ncbi.nlm.nih.gov/29456894",
        pmcid: "https://www.ncbi.nlm.nih.gov/pmc/articles/5815332",
      },
      locations: [{ id: "pmh:oai:pubmedcentral.nih.gov:5815332", doi: null }],
    };
    expect(identifiersFromOpenAlex(peerj)).toEqual([
      { scheme: "openalex", value: "W2741809807" },
      { scheme: "doi", value: "10.7717/peerj.4375" },
      { scheme: "pmid", value: "29456894" },
      { scheme: "pmcid", value: "PMC5815332" },
    ]);
  });

  it("ignores malformed values instead of storing them", () => {
    expect(
      identifiersFromOpenAlex({ id: "https://openalex.org/X1", doi: "not a doi", locations: [{ id: "pmh:oai:arXiv.org:bogus" }] }),
    ).toEqual([]);
  });

  it("identifiersFromArxiv keeps the id without version and the DOIs the authors supplied", () => {
    expect(identifiersFromArxiv({ id: "hep-th/9711200v3", doi: "10.1023/A:1026654312961" })).toEqual([
      { scheme: "doi", value: "10.1023/a:1026654312961" },
      { scheme: "arxiv", value: "hep-th/9711200" },
    ]);
    expect(identifiersFromArxiv({ id: "2305.18290", doi: "10.1/x 10.2345/y; junk" })).toEqual([
      { scheme: "doi", value: "10.2345/y" },
      { scheme: "arxiv", value: "2305.18290" },
    ]);
  });
});
