import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { stopBoss } from "../queue";
import { user } from "../schema/auth";
import { createFixtureScholarlyClient, type ScholarlyClient } from "../scholarly/client";
import { ScholarlyProviderError } from "../scholarly/errors";
import {
  FIND_MAX_PAGE,
  FIND_PAGE_SIZE,
  OPENALEX_BROWSING_NEEDS_KEY,
  openAlexBrowsingRefusal,
  openAlexFiltersFor,
  openAlexLookupFor,
  openAlexRecordForWork,
  PAPER_LIST_MAX,
  paperList,
  previewIdentifier,
  previewPaper,
  searchPapers,
} from "./paper-lists";
import { importByIdentifier, ScholarlyError, unsaveWork } from "./scholarly-works";

/**
 * Integration tests for what Find papers, the preview and the paper page read, against the
 * embedded PostgreSQL and the fixture provider (responses recorded from the live providers on
 * 2026-11-15, labelled `fixture`; the find group's recordings among them). Where no recording shows
 * a situation (OpenAlex unreachable for an arXiv id), a scripted client says so in its name. None of
 * this is a live call.
 */
const OWNER = "paper-lists-owner";
const OTHER = "paper-lists-other";
const FIXTURES = join(__dirname, "../scholarly/fixtures");
let handle: ReturnType<typeof createDb>;
let fixture: ScholarlyClient;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 4 });
  fixture = createFixtureScholarlyClient({ dir: FIXTURES });
  await handle.db
    .insert(user)
    .values([
      { id: OWNER, name: "Lists Test", email: "paper-lists@example.test" },
      { id: OTHER, name: "Lists Other", email: "paper-lists-other@example.test" },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await stopBoss();
  await handle.close();
});

describe("Find papers: OpenAlex word search (recorded)", () => {
  it("returns a page of results with OpenAlex's count and marks the papers the owner has, for that owner only", async () => {
    const page = await searchPapers(handle.db, OWNER, fixture, { query: "direct preference optimization" });
    expect(page.perPage).toBe(FIND_PAGE_SIZE);
    expect(page.items).toHaveLength(FIND_PAGE_SIZE);
    expect(page.count).toBeGreaterThan(10_000);
    // OpenAlex pages stop at 10,000 results.
    expect(page.lastPage).toBe(FIND_MAX_PAGE);
    expect(page.provenance.source).toBe("fixture");
    const dpo = page.items.find((i) => i.record.openalexId === "W7133208539");
    expect(dpo?.workId).toBeNull();
    // Saving the paper by its arXiv id marks the row, which OpenAlex lists by W: markers use every identifier.
    const saved = await importByIdentifier(handle.db, OWNER, fixture, { scheme: "arxiv", value: "2305.18290" });
    const again = await searchPapers(handle.db, OWNER, fixture, { query: "direct preference optimization" });
    expect(again.items.find((i) => i.record.openalexId === "W7133208539")?.workId).toBe(saved.workId);
    expect(again.items.filter((i) => i.workId !== null)).toHaveLength(1);
    const theirs = await searchPapers(handle.db, OTHER, fixture, { query: "direct preference optimization" });
    expect(theirs.items.every((i) => i.workId === null)).toBe(true);
  });

  it("pages and filters exactly as recorded, and refuses what OpenAlex would not answer before any request", async () => {
    const second = await searchPapers(handle.db, OWNER, fixture, { query: "direct preference optimization", page: 2 });
    expect(second.page).toBe(2);
    expect(second.items).toHaveLength(FIND_PAGE_SIZE);
    const filtered = await searchPapers(handle.db, OWNER, fixture, {
      query: "direct preference optimization",
      filters: { subject: "computer-science", yearFrom: 2023, yearTo: 2024, freeToRead: true },
    });
    expect(filtered.count).toBeLessThan(second.count ?? 0);
    for (const item of filtered.items) {
      expect(item.record.publicationYear).toBeGreaterThanOrEqual(2023);
      expect(item.record.publicationYear).toBeLessThanOrEqual(2024);
    }
    await expect(searchPapers(handle.db, OWNER, fixture, { query: "  " })).rejects.toThrow("Type words to search for.");
    await expect(searchPapers(handle.db, OWNER, fixture, { query: "x", page: FIND_MAX_PAGE + 1 })).rejects.toThrow(
      "OpenAlex pages stop at 10,000 results.",
    );
    // A combination nobody recorded is unavailable in fixture mode, never "no results".
    const missing = await searchPapers(handle.db, OWNER, fixture, { query: "an unrecorded search" }).catch((e: unknown) => e);
    expect(missing).toBeInstanceOf(ScholarlyError);
    expect((missing as Error).message).toBe("No recorded provider response exists for this request (fixture mode), so it is unavailable.");
  });

  it("a page past OpenAlex's last has no items while OpenAlex still counts results (test-only client, not a recording)", async () => {
    // TEST-ONLY TRANSPORT: no fixture recording holds a page past OpenAlex's last, and none is written.
    // This double answers every search with an empty page and the count it is given.
    const testOnlyPastTheEnd = (count: number | null): ScholarlyClient => ({
      ...fixture,
      openalexSearch: async (params) => ({
        provenance: { provider: "openalex", source: "fixture", retrievedAt: "2026-11-15T00:00:00.000Z", stale: false },
        count,
        page: params.page ?? 1,
        perPage: params.perPage ?? FIND_PAGE_SIZE,
        items: [],
      }),
    });
    const past = await searchPapers(handle.db, OWNER, testOnlyPastTheEnd(30), { query: "test-only words", page: 5 });
    expect(past).toMatchObject({ page: 5, count: 30, lastPage: 2, items: [] });
    // With no count OpenAlex's pages cannot be known: an empty page is the last one there is.
    const uncounted = await searchPapers(handle.db, OWNER, testOnlyPastTheEnd(null), { query: "test-only words", page: 4 });
    expect(uncounted).toMatchObject({ page: 4, count: null, lastPage: 4, items: [] });
    // Nothing found at all: a count of zero, one page.
    expect(await searchPapers(handle.db, OWNER, testOnlyPastTheEnd(0), { query: "test-only words" })).toMatchObject({
      count: 0,
      lastPage: 1,
      items: [],
    });
  });

  it("builds OpenAlex filters only from the lists, and refuses browsing on a production server without a key", () => {
    expect(openAlexFiltersFor({})).toEqual({});
    expect(openAlexFiltersFor({ subject: "artificial-intelligence", type: "review", yearFrom: 1990, freeToRead: true })).toEqual({
      subfieldId: "1702",
      types: ["review"],
      publicationYear: { from: 1990 },
      isOa: true,
    });
    expect(openAlexFiltersFor({ subject: "mathematics", yearTo: 1989, freeToRead: false })).toEqual({
      fieldId: "26",
      publicationYear: { to: 1989 },
    });
    expect(() => openAlexFiltersFor({ yearFrom: 2024, yearTo: 2023 })).toThrow(
      "Give the years as whole numbers between 1000 and 2100, the first no later than the second.",
    );
    expect(() => openAlexFiltersFor({ yearFrom: 99 })).toThrow(ScholarlyError);
    expect(() => openAlexFiltersFor({ type: "article|book" })).toThrow("Choose a type from the list.");
    expect(() => openAlexFiltersFor({ subject: "astrology" })).toThrow("Choose a field from the list.");
    const live = { mode: "live" as const };
    expect(openAlexBrowsingRefusal({ DEPLOYMENT_MODE: "production", OPENALEX_API_KEY: undefined }, live)).toBe(OPENALEX_BROWSING_NEEDS_KEY);
    expect(openAlexBrowsingRefusal({ DEPLOYMENT_MODE: "production", OPENALEX_API_KEY: "a-real-key-1234" }, live)).toBeNull();
    expect(openAlexBrowsingRefusal({ DEPLOYMENT_MODE: "local", OPENALEX_API_KEY: undefined }, live)).toBeNull();
    expect(openAlexBrowsingRefusal({ DEPLOYMENT_MODE: "local", OPENALEX_API_KEY: undefined }, { mode: "fixture" })).toBeNull();
  });
});

describe("the preview of a paper not in the library", () => {
  it("names the owner's paper when they have it by this or another identifier, and OpenAlex's record otherwise", async () => {
    const owner = `${OWNER}-preview`;
    await handle.db.insert(user).values({ id: owner, name: "Preview", email: "paper-lists-preview@example.test" }).onConflictDoNothing();
    const preview = await previewPaper(handle.db, owner, fixture, "doi", "10.7717/PEERJ.4375");
    expect(preview.kind).toBe("openalex");
    expect(preview.kind === "openalex" && preview.record.title).toMatch(/^The state of OA/);
    const saved = await importByIdentifier(handle.db, owner, fixture, { scheme: "arxiv", value: "2305.18290" });
    expect(await previewPaper(handle.db, owner, fixture, "arxiv", "2305.18290v2")).toEqual({ kind: "owned", workId: saved.workId });
    // Saved by arXiv id, previewed by OpenAlex's W: the record's identifiers find the owner's paper.
    expect(await previewPaper(handle.db, owner, fixture, "openalex", "W7133208539")).toEqual({ kind: "owned", workId: saved.workId });
    // Another owner's paper is never "owned" by this one.
    expect((await previewPaper(handle.db, OTHER, fixture, "openalex", "W7133208539")).kind).toBe("openalex");
  });

  it("says honestly when OpenAlex does not know an arXiv id or a DOI, and why it could not answer", async () => {
    expect(await previewPaper(handle.db, OWNER, fixture, "arxiv", "2611.99999")).toEqual({
      kind: "arxiv_only",
      arxivId: "2611.99999",
      reason: "OpenAlex has no record of this identifier.",
      resetAt: null,
    });
    const unreachable: ScholarlyClient = {
      ...fixture,
      openalexWork: async () => {
        throw new ScholarlyProviderError("openalex", "unavailable", "scripted: OpenAlex unreachable");
      },
    };
    expect(await previewPaper(handle.db, OWNER, unreachable, "arxiv", "1706.03762")).toEqual({
      kind: "arxiv_only",
      arxivId: "1706.03762",
      reason: "The provider could not be reached just now. Nothing was changed; try again later.",
      resetAt: null,
    });
    // An exhausted allowance keeps its reset time, so the preview can say when lookups work again.
    const resetAt = new Date("2026-11-16T00:00:00Z");
    const exhausted: ScholarlyClient = {
      ...fixture,
      openalexWork: async () => {
        throw new ScholarlyProviderError("openalex", "budget_exhausted", "scripted: allowance used up", { resetAt });
      },
    };
    expect(await previewPaper(handle.db, OWNER, exhausted, "arxiv", "1706.03762")).toEqual({
      kind: "arxiv_only",
      arxivId: "1706.03762",
      reason: "OpenAlex's daily allowance for this server is used up. Nothing was changed; lookups work again after it resets.",
      resetAt,
    });
    await expect(previewPaper(handle.db, OWNER, fixture, "doi", "10.7717/corniversity-no-such-work")).rejects.toThrow(
      "Neither OpenAlex nor Crossref has a record of this DOI.",
    );
    await expect(previewPaper(handle.db, OWNER, unreachable, "doi", "10.7717/peerj.4375")).rejects.toThrow(
      "The provider could not be reached just now. Nothing was changed; try again later.",
    );
    await expect(previewPaper(handle.db, OWNER, fixture, "openalex", "W1")).rejects.toThrow(
      "No recorded provider response exists for this request (fixture mode), so it is unavailable.",
    );
    for (const [scheme, value] of [
      ["isbn", "123"],
      ["doi", "not a doi"],
      ["openalex", "X123"],
      ["arxiv", "../etc"],
    ] as const)
      await expect(previewPaper(handle.db, OWNER, fixture, scheme, value)).rejects.toThrow("That identifier is not valid.");
    expect(previewIdentifier("doi", "https://doi.org/10.48550/arXiv.2305.18290")).toEqual({ scheme: "arxiv", value: "2305.18290" });
  });
});

describe("a saved paper's OpenAlex record and its lists (recorded)", () => {
  it("reads the record by the work's W; another owner's work is not found", async () => {
    const owner = `${OWNER}-record`;
    await handle.db.insert(user).values({ id: owner, name: "Record", email: "paper-lists-record@example.test" }).onConflictDoNothing();
    const peerj = await importByIdentifier(handle.db, owner, fixture, { scheme: "doi", value: "10.7717/peerj.4375" });
    const found = await openAlexRecordForWork(handle.db, owner, fixture, peerj.workId);
    expect(found.record?.openalexId).toBe("W2741809807");
    expect(found.record?.bestOaLocation?.sourceName).toBe("PeerJ");
    await expect(openAlexRecordForWork(handle.db, OTHER, fixture, peerj.workId)).rejects.toThrow("Paper not found.");
    await expect(openAlexRecordForWork(handle.db, owner, fixture, "not-a-uuid")).rejects.toThrow("Paper not found.");
    expect(
      openAlexLookupFor([
        { scheme: "doi", value: "10.48550/arxiv.2305.18290", status: "current" },
        { scheme: "arxiv", value: "2305.18290", status: "current" },
        { scheme: "openalex", value: "W1", status: "superseded" },
      ]),
    ).toEqual({ scheme: "arxiv", value: "2305.18290" });
  });

  it("lists references in OpenAlex's order, cited by most cited first, and related works, each with markers and counts", async () => {
    const owner = `${OWNER}-lists`;
    await handle.db.insert(user).values({ id: owner, name: "Lists", email: "paper-lists-lists@example.test" }).onConflictDoNothing();
    const dpo = await importByIdentifier(handle.db, owner, fixture, { scheme: "arxiv", value: "2305.18290" });
    const record = (await openAlexRecordForWork(handle.db, owner, fixture, dpo.workId)).record!;
    const references = await paperList(handle.db, owner, fixture, record, "references");
    expect(references.total).toBe(20);
    expect(references.items.length + references.missing).toBe(20);
    const order = references.items.map((i) => record.referencedOpenAlexIds.indexOf(i.record.openalexId));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const cited = await paperList(handle.db, owner, fixture, record, "cited_by");
    expect(cited.items).toHaveLength(PAPER_LIST_MAX);
    expect(cited.total).toBeGreaterThan(PAPER_LIST_MAX);
    const counts = cited.items.map((i) => i.record.citedByCount ?? 0);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(cited.returned).toBe(PAPER_LIST_MAX);
    const related = await paperList(handle.db, owner, fixture, record, "related");
    expect(related.total).toBe(record.relatedOpenAlexIds.length);
    expect(related.provenance.source).toBe("fixture");
    // A cited-by row the owner saves is marked on the next read, for that owner only.
    const first = cited.items[0]!.record;
    const doi = first.identifiers.find((r) => r.scheme === "doi");
    if (doi) {
      const fake: ScholarlyClient = {
        ...fixture,
        openalexWork: async () => ({ requestedId: first.openalexId, returnedId: first.openalexId, merged: false, record: first }),
      };
      const saved = await importByIdentifier(handle.db, owner, fake, doi);
      expect((await paperList(handle.db, owner, fixture, record, "cited_by")).items[0]!.workId).toBe(saved.workId);
      expect((await paperList(handle.db, OTHER, fixture, record, "cited_by")).items[0]!.workId).toBeNull();
    }
  });

  it("counts every record OpenAlex returned for a list longer than the fifty it shows", async () => {
    // hep-th/9711200 (W2166248051): OpenAlex lists 77 references and returns a record for each.
    const { record } = await fixture.openalexWork({ scheme: "openalex", value: "W2166248051" });
    const references = await paperList(handle.db, OWNER, fixture, record, "references");
    expect(references.total).toBe(77);
    expect(references.returned).toBe(77);
    expect(references.missing).toBe(0);
    expect(references.items).toHaveLength(PAPER_LIST_MAX);
  });

  it("marks a paper the owner removed from their saved papers as not saved, still naming their work", async () => {
    const owner = `${OWNER}-unsaved`;
    await handle.db.insert(user).values({ id: owner, name: "Unsaved", email: "paper-lists-unsaved@example.test" }).onConflictDoNothing();
    const dpo = await importByIdentifier(handle.db, owner, fixture, { scheme: "arxiv", value: "2305.18290" });
    const row = async () =>
      (await searchPapers(handle.db, owner, fixture, { query: "direct preference optimization" })).items.find(
        (i) => i.record.openalexId === "W7133208539",
      );
    expect(await row()).toMatchObject({ workId: dpo.workId, saved: true });
    await unsaveWork(handle.db, owner, dpo.workId);
    expect(await row()).toMatchObject({ workId: dpo.workId, saved: false });
    // Rows the owner does not have carry no saved state.
    const page = await searchPapers(handle.db, owner, fixture, { query: "direct preference optimization" });
    expect(page.items.filter((i) => i.workId === null).every((i) => i.saved === false)).toBe(true);
  });
});
