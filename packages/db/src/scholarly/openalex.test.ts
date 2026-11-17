import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalRequest } from "./cache";
import { createScholarlyClient } from "./client";
import { FixtureTransport } from "./fixture-transport";
import { abstractFromInvertedIndex, filterParam, searchQuery, workLookup } from "./openalex";
import type { ProviderRequest, ProviderResponse, ScholarlyTransport } from "./transport";

/**
 * Contract tests: the OpenAlex adapter against responses recorded from the live API on 2026-11-15
 * (packages/db/src/scholarly/fixtures). Recorded data, not live calls.
 */
const dir = fileURLToPath(new URL("./fixtures/", import.meta.url));
const fixtures = new FixtureTransport(dir);
const client = createScholarlyClient(fixtures);

/** Serves one recorded body for any request, to simulate cases no recording covers (labelled per test). */
function serving(file: string, seen: ProviderRequest[] = []): ScholarlyTransport {
  const body = readFileSync(`${dir}${file}`, "utf8");
  return {
    mode: "fixture",
    async get(request): Promise<ProviderResponse> {
      seen.push(request);
      return {
        status: 200,
        contentType: "application/json",
        body,
        retrievedAt: "2026-11-15T03:13:07.000Z",
        fixture: true,
        fromCache: false,
        stale: false,
      };
    },
    async getPdf() {
      throw new Error("not used");
    },
  };
}

describe("OpenAlex single works (recorded)", () => {
  it("looks a work up by DOI and normalises its identifiers, provenance and locations", async () => {
    const result = await client.openalexWork({ scheme: "doi", value: "10.7717/PeerJ.4375" });
    expect(result).toMatchObject({ requestedId: "doi:10.7717/peerj.4375", returnedId: "W2741809807", merged: false });
    const work = result.record;
    expect(work.provenance).toMatchObject({ provider: "openalex", source: "fixture", stale: false });
    expect(work.provenance.retrievedAt).toMatch(/^2026-11-15T/);
    expect(work.identifiers).toEqual([
      { scheme: "openalex", value: "W2741809807" },
      { scheme: "doi", value: "10.5281/zenodo.18201069" },
      { scheme: "doi", value: "10.5281/zenodo.18201070" },
      { scheme: "doi", value: "10.7717/peerj.4375" },
      { scheme: "pmid", value: "29456894" },
      { scheme: "pmcid", value: "PMC5815332" },
    ]);
    expect(work.title).toBe("The state of OA: a large-scale analysis of the prevalence and impact of Open Access articles");
    expect(work.publicationDate).toBe("2018-02-13");
    expect(work.publicationDatePrecision).toBe("day");
    expect(work.abstract).toMatch(/^Despite growing interest in Open Access/);
    const pmc = work.locations.find((l) => l.id === "pmh:oai:pubmedcentral.nih.gov:5815332");
    expect(pmc).toMatchObject({
      licence: "cc-by",
      licenceClass: "open",
      version: "publishedVersion",
      versionKind: "published",
      arxivId: null,
    });
    const doaj = work.locations.find((l) => l.licence === "cc-by-sa");
    expect(doaj).toMatchObject({ licenceClass: "open", versionKind: "preprint" });
    expect(work.locations.find((l) => l.id === "doi:10.5281/zenodo.18201069")).toMatchObject({
      licence: null,
      licenceClass: "unknown",
      versionKind: "unknown",
    });
  });

  it("keeps a merged preprint's arXiv identity and stores OpenAlex's 01-01 placeholder date as a year", async () => {
    const result = await client.openalexWork({ scheme: "openalex", value: "W7133208539" });
    const work = result.record;
    expect(result.merged).toBe(false);
    expect(work.workType).toBe("conference-paper");
    expect(work.publicationYear).toBe(2023);
    expect(work.publicationDate).toBeNull();
    expect(work.publicationDatePrecision).toBe("year");
    expect(work.identifiers).toEqual([
      { scheme: "openalex", value: "W7133208539" },
      { scheme: "doi", value: "10.48550/arxiv.2305.18290" },
      { scheme: "doi", value: "10.52202/075280-2338" },
      { scheme: "arxiv", value: "2305.18290" },
    ]);
    expect(work.referencedOpenAlexIds).toHaveLength(20);
    expect(work.relatedOpenAlexIds).toHaveLength(10);
    expect(work.subjects).toEqual(
      expect.arrayContaining([
        { id: "3", name: "Physical Sciences", level: "domain", score: expect.any(Number) },
        { id: "17", name: "Computer Science", level: "field", score: expect.any(Number) },
        { id: "1702", name: "Artificial Intelligence", level: "subfield", score: expect.any(Number) },
        { id: "T10028", name: "Topic Modeling", level: "topic", score: expect.any(Number) },
      ]),
    );
    const arxiv = work.locations.find((l) => l.arxivId === "2305.18290");
    // OpenAlex reports cc-by for its arXiv location: shown for information only (never a storage basis).
    expect(arxiv).toMatchObject({ id: "pmh:oai:arXiv.org:2305.18290", licence: "cc-by", licenceClass: "open", versionKind: "preprint" });
    expect(work.primaryLocation).toMatchObject({ id: "doi:10.52202/075280-2338", isOa: false, licence: null, versionKind: "published" });
    expect(work.venue).toBe("neural information processing systems");
    expect(work.abstract).toMatch(/large-scale unsupervised language models/);
  });

  it("reports the requested and returned ids for arXiv lookups, including old-style ids", async () => {
    const dpo = await client.openalexWork({ scheme: "arxiv", value: "2305.18290v3" });
    expect(dpo).toMatchObject({ requestedId: "arxiv:2305.18290", returnedId: "W7133208539", merged: false });
    const maldacena = await client.openalexWork({ scheme: "arxiv", value: "hep-th/9711200" });
    expect(maldacena).toMatchObject({ requestedId: "arxiv:hep-th/9711200", returnedId: "W2166248051" });
    expect(maldacena.record.identifiers).toEqual(
      expect.arrayContaining([
        { scheme: "arxiv", value: "hep-th/9711200" },
        { scheme: "doi", value: "10.1023/a:1026654312961" },
        { scheme: "doi", value: "10.48550/arxiv.hep-th/9711200" },
      ]),
    );
  });

  it("marks a different returned W as a merge (simulated: the recorded DPO record served for another W)", async () => {
    const seen: ProviderRequest[] = [];
    const merged = await createScholarlyClient(serving("openalex/works_W7133208539-3a8f8651b5.json", seen)).openalexWork({
      scheme: "openalex",
      value: "W4378770815",
    });
    expect(merged).toMatchObject({ requestedId: "W4378770815", returnedId: "W7133208539", merged: true });
    expect(seen[0]?.path).toBe("/works/W4378770815");
  });

  it("turns a recorded 404 into not_found, and an unrecorded request into fixture_missing", async () => {
    await expect(client.openalexWork({ scheme: "doi", value: "10.7717/corniversity-no-such-work" })).rejects.toMatchObject({
      code: "not_found",
      provider: "openalex",
    });
    await expect(client.openalexWork({ scheme: "doi", value: "10.7717/peerj.9999" })).rejects.toMatchObject({ code: "fixture_missing" });
  });

  it("validates identifiers before any request and encodes them into the path", () => {
    expect(workLookup({ scheme: "doi", value: "10.1016/S0140-6736(97)11096-0" })).toEqual({
      path: "/works/doi:10.1016%2Fs0140-6736(97)11096-0",
      requestedId: "doi:10.1016/s0140-6736(97)11096-0",
    });
    expect(workLookup({ scheme: "arxiv", value: "hep-th/9711200v3" }).path).toBe("/works/arxiv:hep-th%2F9711200");
    expect(workLookup({ scheme: "pmcid", value: "5815332" }).path).toBe("/works/pmcid:PMC5815332");
    expect(() => workLookup({ scheme: "doi", value: "10.1/../../admin" })).toThrow(expect.objectContaining({ code: "invalid_identifier" }));
    expect(() => workLookup({ scheme: "openalex", value: "W1?x=1" })).toThrow(expect.objectContaining({ code: "invalid_identifier" }));
  });
});

describe("OpenAlex lists and batches (recorded)", () => {
  it("returns a filtered search page with its count", async () => {
    const list = await client.openalexSearch({ search: "direct preference optimization", filters: { fieldId: "17" }, perPage: 5 });
    expect(list.items).toHaveLength(5);
    expect(list.count).toBeGreaterThan(0);
    expect(list).toMatchObject({ page: 1, perPage: 5 });
    expect(list.items.every((w) => w.provenance.source === "fixture")).toBe(true);
    expect(list.items[0]!.abstract).toBeNull();
  });

  it("lists works citing a work (OpenAlex's cites: filter), most cited first", async () => {
    const list = await client.openalexCitedBy("W7133208539", { perPage: 5 });
    expect(list.items).toHaveLength(5);
    expect(list.count).toBe(2993);
    const counts = list.items.map((w) => w.citedByCount ?? 0);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it("resolves a work's references and related works in batches, reporting ids that did not come back", async () => {
    const work = (await client.openalexWork({ scheme: "openalex", value: "W7133208539" })).record;
    const references = await client.openalexReferences(work);
    expect(references.items).toHaveLength(19);
    // W6969036009 (a Zenodo software record) exists but is outside OpenAlex's default corpus.
    expect(references.missing).toEqual(["W6969036009"]);
    const related = await client.openalexRelated(work);
    expect(related.items).toHaveLength(10);
    expect(related.missing).toEqual([]);
  });

  it("reads the taxonomy: 26 fields and the subfields of the primary fields", async () => {
    const fields = await client.openalexFields();
    expect(fields).toHaveLength(26);
    expect(fields.find((f) => f.id === "26")).toMatchObject({
      level: "field",
      name: "Mathematics",
      domainId: "3",
      domainName: "Physical Sciences",
    });
    const subfields = await client.openalexSubfields(["31", "17", "26"]);
    expect(subfields).toHaveLength(29);
    expect(subfields.find((s) => s.id === "1702")).toMatchObject({ level: "subfield", name: "Artificial Intelligence", fieldId: "17" });
    expect(() => client.openalexSubfields(["17,26"])).toThrow(expect.objectContaining({ code: "invalid_identifier" }));
  });

  it("reads a subject list (most cited in Mathematics)", async () => {
    const list = await client.openalexSearch(
      { filters: { fieldId: "26" }, sort: "cited_by_count:desc", perPage: 5 },
      { cacheKind: "subject_list" },
    );
    expect(list.items).toHaveLength(5);
  });

  it("searches by author (OpenAlex's byline search), alone and with words and years", async () => {
    // Recorded 2026-11-17 by the find-author group: the requests Find sends, pages of 25.
    const shannon = await client.openalexSearch({ filters: { author: "Claude Shannon" }, page: 1, perPage: 25 });
    expect(shannon.count).toBe(268);
    expect(shannon.items).toHaveLength(25);
    expect(shannon.items.every((w) => w.authors.some((a) => /Shannon/.test(a.name)))).toBe(true);
    expect(shannon.items.map((w) => w.title)).toContain("A Mathematical Theory of Communications");
    const dpo = await client.openalexSearch({
      search: "direct preference optimization",
      filters: { publicationYear: { from: 2023, to: 2024 }, author: "Rafailov" },
      page: 1,
      perPage: 25,
    });
    expect(dpo.count).toBe(15);
    expect(dpo.items.map((w) => w.openalexId)).toContain("W7133208539");
    expect(dpo.items.every((w) => w.publicationYear === 2023 || w.publicationYear === 2024)).toBe(true);
  });
});

describe("OpenAlex request building", () => {
  it("builds filters only from validated values, so nothing can be injected", () => {
    expect(
      filterParam({
        fieldId: "17",
        types: ["review", "article", "review"],
        publicationYear: { from: 2020, to: 2025 },
        isOa: true,
        hasAbstract: true,
        isRetracted: false,
        cites: "w7133208539",
        language: "en",
      }),
    ).toBe(
      "primary_topic.field.id:17,type:review|article,publication_year:2020-2025,open_access.is_oa:true,has_abstract:true,is_retracted:false,cites:W7133208539,language:en",
    );
    expect(filterParam({ publicationYear: { to: 1989 } })).toBe("publication_year:<1990");
    expect(filterParam({ publicationYear: { from: 2024 } })).toBe("publication_year:>2023");
    expect(filterParam({})).toBeNull();
    const injections = [
      { fieldId: "17,is_oa:false" },
      { subfieldId: "1702|1703" },
      { types: ["article,cites:W1"] as never },
      { cites: "W1|W2" },
      { relatedTo: "W1,x:y" },
      { language: "en,x" },
      { publicationYear: { from: 1.5 } },
    ];
    for (const filters of injections)
      expect(() => filterParam(filters), JSON.stringify(filters)).toThrow(expect.objectContaining({ code: "invalid_identifier" }));
  });

  it("sends an author as OpenAlex's byline search, last, and refuses anything that could change the filter", () => {
    expect(filterParam({ author: "Claude Shannon" })).toBe("raw_author_name.search:Claude Shannon");
    expect(filterParam({ author: "Rafailov", publicationYear: { from: 2023, to: 2024 } })).toBe(
      "publication_year:2023-2024,raw_author_name.search:Rafailov",
    );
    expect(filterParam({ author: "Jean-Pierre O’Brien" })).toBe("raw_author_name.search:Jean-Pierre O’Brien");
    expect(filterParam({ author: "C. E. Shannon" })).toBe("raw_author_name.search:C. E. Shannon");
    expect(filterParam({ author: "Paul Erdős" })).toBe("raw_author_name.search:Paul Erdős");
    expect(filterParam({ author: "a".repeat(100) })).toBe(`raw_author_name.search:${"a".repeat(100)}`);
    const injections = [
      "Shannon,is_oa:false",
      "Shannon|Finn",
      "Shannon+Finn",
      "Shannon:x",
      "!Shannon",
      "Smith -Jones",
      '"Claude Shannon"',
      "Shannon*",
      " Shannon",
      "Claude  Shannon",
      "",
      "a".repeat(101),
    ];
    for (const author of injections)
      expect(() => filterParam({ author }), author).toThrow(expect.objectContaining({ code: "invalid_identifier" }));
    // With no words, the author is the whole request: no `search` parameter.
    expect(searchQuery({ filters: { author: "Claude Shannon" } }).slice(0, 2)).toEqual([
      ["filter", "raw_author_name.search:Claude Shannon"],
      ["page", "1"],
    ]);
  });

  it("pages within OpenAlex's limits and cleans search text", () => {
    const query = searchQuery({ search: "<b>graph</b>  minors\u0000", page: 2, perPage: 50, sort: "publication_date:desc" });
    expect(query.slice(0, 3)).toEqual([
      ["search", "graph minors"],
      ["sort", "publication_date:desc"],
      ["page", "2"],
    ]);
    expect(() => searchQuery({ page: 101, perPage: 100 })).toThrow();
    expect(() => searchQuery({ perPage: 101 })).toThrow();
    expect(() => searchQuery({ sort: "random" as never })).toThrow();
    expect(searchQuery({ sample: 1, seed: 42 })).toEqual(
      expect.arrayContaining([
        ["sample", "1"],
        ["seed", "42"],
      ]),
    );
  });

  it("canonical requests match the recordings exactly", () => {
    const recorded = fixtures.recordedRequests();
    expect(recorded).toContain(canonicalRequest({ host: "api.openalex.org", path: "/works/W7133208539" }));
    expect(recorded.every((r) => r.startsWith("GET https://") && !/api_key|mailto/.test(r))).toBe(true);
  });
});

describe("OpenAlex text and abstracts", () => {
  it("rebuilds abstracts from the inverted index, skipping holes and absurd positions", () => {
    expect(abstractFromInvertedIndex({ world: [1], Hello: [0], again: [3] })).toBe("Hello world again");
    expect(abstractFromInvertedIndex({ x: [10_000_000] })).toBeNull();
    expect(abstractFromInvertedIndex(null)).toBeNull();
    expect(abstractFromInvertedIndex({ "<jats:p>Results": [0], "&amp;": [1], more: [2] })).toBe("Results & more");
  });

  it("turns hostile provider strings into plain text and drops unsafe links (simulated record)", async () => {
    const hostile = {
      id: "https://openalex.org/W1",
      display_name: '<img src=x onerror=alert(1)>Graph <i>minors</i> &amp; "<script>alert(2)</script>"',
      authorships: [
        { author: { display_name: "<b>A. Author</b>", orcid: "https://orcid.org/0000-0002-1825-0097", id: "https://openalex.org/A5" } },
      ],
      primary_location: {
        id: "doi:10.1/x",
        landing_page_url: "javascript:alert(1)",
        pdf_url: "http://example.org/x.pdf",
        license: "cc-by-nc-nd",
      },
      locations: [],
    };
    const transport: ScholarlyTransport = {
      mode: "fixture",
      async get() {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(hostile),
          retrievedAt: "2026-11-15T00:00:00.000Z",
          fixture: true,
          fromCache: false,
          stale: false,
        };
      },
      async getPdf() {
        throw new Error("not used");
      },
    };
    const work = (await createScholarlyClient(transport).openalexWork({ scheme: "openalex", value: "W1" })).record;
    expect(work.title).toBe('Graph minors & " "');
    expect(work.authors).toEqual([{ name: "A. Author", orcid: "0000-0002-1825-0097", openalexId: "A5" }]);
    expect(work.primaryLocation).toMatchObject({ landingPageUrl: null, pdfUrl: null, licenceClass: "open_nc_nd" });
  });

  it("rejects a response that does not have the expected shape", async () => {
    const transport: ScholarlyTransport = {
      mode: "fixture",
      async get() {
        return {
          status: 200,
          contentType: "application/json",
          body: '{"id": 5}',
          retrievedAt: "2026-11-15T00:00:00.000Z",
          fixture: true,
          fromCache: false,
          stale: false,
        };
      },
      async getPdf() {
        throw new Error("not used");
      },
    };
    await expect(createScholarlyClient(transport).openalexWork({ scheme: "openalex", value: "W1" })).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
});
