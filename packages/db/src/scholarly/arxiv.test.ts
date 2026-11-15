import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { UNPDF_PINNED_OPTIONS } from "@corniversity/core/pdf/unpdf";
import { storageDecision } from "@corniversity/core/scholarly/index";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import { ARXIV_MIN_SPACING_MS, arxivCategoryQuery, getArxivEntries, getArxivPdf, parseArxivRaw } from "./arxiv";
import { createScholarlyClient } from "./client";
import { FixtureTransport } from "./fixture-transport";
import type { PdfRequest, ProviderRequest, ScholarlyTransport } from "./transport";

/**
 * Contract tests: the arXiv adapter against export API and OAI-PMH responses recorded live on
 * 2026-11-15 (packages/db/src/scholarly/fixtures). Recorded data, not live calls.
 */
const dir = fileURLToPath(new URL("./fixtures/", import.meta.url));
const client = createScholarlyClient(new FixtureTransport(dir));
const provenance = { provider: "arxiv" as const, source: "fixture" as const, retrievedAt: "2026-11-15T03:13:20.000Z", stale: false };

describe("arXiv export API (recorded)", () => {
  it("reads an entry's identity, latest version, authors and categories, but no licence", async () => {
    const result = await client.arxivEntries([{ id: "2305.18290", version: null }]);
    expect(result.missing).toEqual([]);
    expect(result.provenance).toMatchObject({ provider: "arxiv", source: "fixture" });
    const entry = result.entries[0]!;
    expect(entry).toMatchObject({
      id: "2305.18290",
      version: 3,
      title: "Direct Preference Optimization: Your Language Model is Secretly a Reward Model",
      published: "2023-05-29T17:57:46.000Z",
      primaryCategory: "cs.LG",
      withdrawalHint: false,
    });
    expect(entry.authors.map((a) => a.name)).toEqual([
      "Rafael Rafailov",
      "Archit Sharma",
      "Eric Mitchell",
      "Stefano Ermon",
      "Christopher D. Manning",
      "Chelsea Finn",
    ]);
    expect(entry.categories).toEqual(["cs.LG", "cs.AI", "cs.CL"]);
    expect("licence" in entry).toBe(false);
  });

  it("reads an old-style id with the DOI and journal reference the authors supplied", async () => {
    const entry = (await client.arxivEntries([{ id: "hep-th/9711200", version: null }])).entries[0]!;
    expect(entry).toMatchObject({
      id: "hep-th/9711200",
      version: 3,
      doi: "10.1023/A:1026654312961",
      journalRef: "Adv.Theor.Math.Phys.2:231-252,1998",
    });
    expect(entry.abstract).toMatch(/large \$N\$ limit/);
  });

  it("reads the non-exclusive example's latest version and flags a withdrawal comment as a hint", async () => {
    expect((await client.arxivEntries([{ id: "1706.03762", version: null }])).entries[0]).toMatchObject({
      version: 7,
      title: "Attention Is All You Need",
    });
    expect((await client.arxivEntries([{ id: "2607.20049", version: null }])).entries[0]).toMatchObject({
      version: 2,
      withdrawalHint: true,
    });
  });

  it("matches entries by id, not order, and reports the ids that did not come back (simulated feed)", async () => {
    const body = readFileSync(`${dir}arxiv/api_query_id_list_2305.18290_max_results_1-b953616650.xml`, "utf8");
    const seen: ProviderRequest[] = [];
    const transport: ScholarlyTransport = {
      mode: "fixture",
      async get(request) {
        seen.push(request);
        return {
          status: 200,
          contentType: "application/atom+xml",
          body,
          retrievedAt: provenance.retrievedAt,
          fixture: true,
          fromCache: false,
          stale: false,
        };
      },
      async getPdf() {
        throw new Error("not used");
      },
    };
    const result = await getArxivEntries(transport, [
      { id: "1706.03762", version: 2 },
      { id: "2305.18290", version: 3 },
      { id: "2305.18290", version: 1 },
    ]);
    expect(result.entries.map((e) => `${e.id}v${e.version}`)).toEqual(["2305.18290v3"]);
    expect(result.missing).toEqual(["1706.03762v2", "2305.18290v1"]);
    expect(seen[0]?.query).toEqual([
      ["id_list", "1706.03762v2,2305.18290v3,2305.18290v1"],
      ["max_results", "3"],
    ]);
  });

  it("validates ids and the batch size before any request", async () => {
    await expect(client.arxivEntries([{ id: "2305.1829", version: null }])).rejects.toMatchObject({ code: "invalid_identifier" });
    await expect(client.arxivEntries([])).rejects.toMatchObject({ code: "invalid_identifier" });
    await expect(client.arxivEntries(Array.from({ length: 21 }, () => ({ id: "2305.18290", version: null })))).rejects.toMatchObject({
      code: "invalid_identifier",
    });
  });

  it("lists the newest submissions in a category", async () => {
    const listing = await client.arxivNewest(["math.*"], 5);
    expect(listing.query).toBe("cat:math.*");
    expect(listing.entries).toHaveLength(5);
    expect(listing.totalResults).toBeGreaterThan(100_000);
    const dates = listing.entries.map((e) => e.published ?? "");
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(arxivCategoryQuery(["cs.AI", "cs.LG", "cs.AI"])).toBe("cat:cs.AI OR cat:cs.LG");
    for (const bad of [["math.* OR all:x"], ["cs.AI)"], [], ["a"]]) expect(() => arxivCategoryQuery(bad)).toThrow();
  });
});

describe("arXiv OAI-PMH arXivRaw (recorded)", () => {
  it("attaches the licence only to the last version listed in the record", async () => {
    const record = await client.arxivRaw("2305.18290");
    expect(record.versions.map((v) => [v.version, v.date, v.licence])).toEqual([
      [1, "2023-05-29T17:57:46.000Z", null],
      [2, "2023-12-13T18:48:48.000Z", null],
      [3, "2024-07-29T22:26:36.000Z", "http://creativecommons.org/licenses/by/4.0/"],
    ]);
    const v3 = record.versions[2]!;
    expect(v3).toMatchObject({
      licenceSource: "arxiv-oai",
      licenceRetrievedAt: record.provenance.retrievedAt,
      withdrawn: false,
      sizeKb: 999,
      sourceType: "D",
    });
    expect(record.latestVersion).toBe(3);
    expect(record.responseDate).toMatch(/^2026-11-/);
    // A private copy is possible for v3 only; v1 and v2 have no reported licence.
    const facts = (v: (typeof record.versions)[number]) => ({
      arxivId: v.arxivId,
      arxivVersion: v.version,
      licence: v.licence,
      licenceSource: v.licenceSource,
      licenceRetrievedAt: v.licenceRetrievedAt,
      withdrawn: v.withdrawn,
    });
    expect(storageDecision(facts(v3)).privateCopy).toBe(true);
    expect(storageDecision(facts(record.versions[0]!)).privateCopy).toBe(false);
  });

  it("reads the non-exclusive licence of 1706.03762v7, which permits no private copy", async () => {
    const record = await client.arxivRaw("1706.03762");
    expect(record.versions).toHaveLength(7);
    expect(record.versions.slice(0, 6).every((v) => v.licence === null)).toBe(true);
    expect(record.versions[6]).toMatchObject({ version: 7, licence: "http://arxiv.org/licenses/nonexclusive-distrib/1.0/" });
    expect(
      storageDecision({
        arxivId: "1706.03762",
        arxivVersion: 7,
        licence: record.licence,
        licenceSource: "arxiv-oai",
        licenceRetrievedAt: record.provenance.retrievedAt,
      }).privateCopy,
    ).toBe(false);
  });

  it("leaves an old-style record without a licence element unknown", async () => {
    const record = await client.arxivRaw("hep-th/9711200");
    expect(record.id).toBe("hep-th/9711200");
    expect(record.licence).toBeNull();
    expect(record.versions.map((v) => v.licence)).toEqual([null, null, null]);
  });

  it("detects a withdrawn version from the version history", async () => {
    const record = await client.arxivRaw("2607.20049");
    expect(record.versions.map((v) => [v.version, v.withdrawn, v.sizeKb, v.sourceType])).toEqual([
      [1, false, 4, null],
      [2, true, 0, "I"],
    ]);
    const v2 = record.versions[1]!;
    expect(v2.licence).toBe("http://creativecommons.org/licenses/by/4.0/");
    expect(storageDecision({ ...v2, arxivVersion: v2.version }).privateCopy).toBe(false);
  });

  it("turns OAI-PMH idDoesNotExist into not_found", async () => {
    await expect(client.arxivRaw("2611.99999")).rejects.toMatchObject({ code: "not_found", provider: "arxiv" });
  });

  it("refuses a record for another id, malformed XML and a missing version number (simulated)", () => {
    const body = readFileSync(
      `${dir}arxiv/oai_identifier_oai_3AarXiv.org_3A2305.18290_metadataPrefix_arXivRaw_verb_GetReco-b8a6d5d49b.xml`,
      "utf8",
    );
    expect(() => parseArxivRaw(body, "1706.03762", provenance)).toThrow(expect.objectContaining({ code: "invalid_response" }));
    expect(() => parseArxivRaw("<OAI-PMH><unclosed></OAI-PMH>", "2305.18290", provenance)).toThrow(
      expect.objectContaining({ code: "invalid_response" }),
    );
    expect(() => parseArxivRaw(body.replace('version="v2"', 'version="two"'), "2305.18290", provenance)).toThrow(
      expect.objectContaining({ code: "invalid_response" }),
    );
    expect(() => parseArxivRaw('<!DOCTYPE x [<!ENTITY a "b">]><OAI-PMH/>', "2305.18290", provenance)).toThrow(
      expect.objectContaining({ code: "invalid_response" }),
    );
  });
});

describe("arXiv PDFs and spacing", () => {
  it("builds the export.arxiv.org PDF path from a validated id, segment by segment", async () => {
    const seen: PdfRequest[] = [];
    const transport: ScholarlyTransport = {
      mode: "live",
      async get() {
        throw new Error("not used");
      },
      async getPdf(request) {
        seen.push(request);
        return { bytes: new Uint8Array([37, 80, 68, 70, 45]), contentType: "application/pdf", retrievedAt: "x", fixture: false };
      },
    };
    await getArxivPdf(transport, "hep-th/9711200", 3, 1000);
    await getArxivPdf(transport, "2305.18290", 3, 1000);
    expect(seen.map((r) => [r.host, r.path, r.maxBytes])).toEqual([
      ["export.arxiv.org", "/pdf/hep-th/9711200v3", 1000],
      ["export.arxiv.org", "/pdf/2305.18290v3", 1000],
    ]);
    await expect(getArxivPdf(transport, "2305.18290", 0, 1000)).rejects.toMatchObject({ code: "invalid_identifier" });
    await expect(getArxivPdf(transport, "../../etc", 1, 1000)).rejects.toMatchObject({ code: "invalid_identifier" });
  });

  it("answers an arXiv PDF in fixture mode with a generated stand-in whose own text says what it is", async () => {
    const bytes = await client.arxivPdf("2305.18290", 3, 1_000_000);
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
    // Byte for byte the same each time, and different for another version.
    expect(Buffer.from(await client.arxivPdf("2305.18290", 3, 1_000_000)).equals(Buffer.from(bytes))).toBe(true);
    expect(Buffer.from(await client.arxivPdf("2305.18290", 2, 1_000_000)).equals(Buffer.from(bytes))).toBe(false);
    // The text a reader or the extractor sees names the exact version and disowns being arXiv's file.
    const pdf = await getDocumentProxy(new Uint8Array(bytes), UNPDF_PINNED_OPTIONS);
    const { text } = await extractText(pdf, { mergePages: true });
    expect(text).toContain("Fixture stand-in for arXiv:2305.18290v3");
    expect(text).toContain("This is not arXiv's file.");
    expect(text).toContain("It contains no text of the paper.");
    const old = await getDocumentProxy(new Uint8Array(await client.arxivPdf("hep-th/9711200", 3, 1_000_000)), UNPDF_PINNED_OPTIONS);
    expect((await extractText(old, { mergePages: true })).text).toContain("Fixture stand-in for arXiv:hep-th/9711200v3");
    // The size cap still applies, and only a versioned arXiv id is answered.
    await expect(client.arxivPdf("2305.18290", 3, 100)).rejects.toMatchObject({ code: "too_large" });
    await expect(
      new FixtureTransport(dir).getPdf({ provider: "arxiv", host: "export.arxiv.org", path: "/pdf/2305.18290", maxBytes: 1e6 }),
    ).rejects.toMatchObject({
      code: "invalid_identifier",
    });
    expect(ARXIV_MIN_SPACING_MS).toBe(3100);
  });
});
