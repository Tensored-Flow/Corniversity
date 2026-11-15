import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createScholarlyClient } from "./client";
import { FixtureTransport } from "./fixture-transport";
import { scholarlyRecordFromArxiv, scholarlyRecordFromCrossref, scholarlyRecordFromOpenAlex } from "./records";
import type { OpenAlexWorkRecord } from "./types";

/** The record mappers on responses recorded live on 2026-11-15 (fixtures). Recorded data, not live calls. */
const client = createScholarlyClient(new FixtureTransport(fileURLToPath(new URL("./fixtures/", import.meta.url))));

describe("scholarly records", () => {
  it("maps an OpenAlex work with per-field provenance and no invented fields", async () => {
    const work = (await client.openalexWork({ scheme: "openalex", value: "W7133208539" })).record;
    const record = scholarlyRecordFromOpenAlex(work);
    expect(record).toMatchObject({
      title: "Direct Preference Optimization: Your Language Model is Secretly a Reward Model",
      abstractSource: "openalex",
      publicationYear: 2023,
      publicationDate: null,
      publicationDatePrecision: "year",
      workType: "conference-paper",
      referencesRetrieved: true,
      integrityNotices: [],
      versions: [],
    });
    expect(record.referencedOpenAlexIds).toHaveLength(20);
    const stamp = { source: "fixture", retrievedAt: work.provenance.retrievedAt };
    expect(record.fieldProvenance).toEqual({
      title: stamp,
      authors: stamp,
      abstract: stamp,
      publicationYear: stamp,
      venue: stamp,
      workType: stamp,
      subjects: stamp,
      referencedOpenAlexIds: stamp,
    });
    expect(record.fieldProvenance.publicationDate).toBeUndefined();
  });

  it("records OpenAlex's retraction flag as an OpenAlex notice on the reported DOI (simulated flag)", async () => {
    const work = (await client.openalexWork({ scheme: "doi", value: "10.7717/peerj.4375" })).record;
    const flagged: OpenAlexWorkRecord = { ...work, isRetracted: true };
    expect(scholarlyRecordFromOpenAlex(flagged).integrityNotices).toEqual([
      {
        type: "retraction",
        source: "openalex",
        concerns: "10.7717/peerj.4375",
        label: "OpenAlex marks this work as retracted",
        retrievedAt: work.provenance.retrievedAt,
      },
    ]);
  });

  it("does not claim list items have reference lists", async () => {
    const list = await client.openalexSearch({ search: "direct preference optimization", filters: { fieldId: "17" }, perPage: 5 });
    const record = scholarlyRecordFromOpenAlex(list.items[0]!);
    expect(record.referencesRetrieved).toBe(false);
    expect(record.fieldProvenance.referencedOpenAlexIds).toBeUndefined();
  });

  it("maps an arXiv entry and its arXivRaw versions, with the v1 date and withdrawals as notices", async () => {
    const entry = (await client.arxivEntries([{ id: "2607.20049", version: null }])).entries[0]!;
    const raw = await client.arxivRaw("2607.20049");
    const record = scholarlyRecordFromArxiv(entry, raw);
    expect(record).toMatchObject({
      identifiers: [{ scheme: "arxiv", value: "2607.20049" }],
      abstractSource: "arxiv",
      publicationYear: 2026,
      publicationDate: "2026-07-22",
      publicationDatePrecision: "day",
      venue: null,
      workType: null,
      subjects: [],
    });
    expect(record.versions.map((v) => [v.version, v.withdrawn])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(record.integrityNotices).toEqual([
      {
        type: "withdrawal",
        source: "arxiv",
        concerns: "arXiv:2607.20049v2",
        date: "2026-07-23",
        label: "Withdrawn on arXiv",
        retrievedAt: raw.provenance.retrievedAt,
      },
    ]);
    const other = await client.arxivRaw("2305.18290");
    expect(() => scholarlyRecordFromArxiv(entry, other)).toThrow();
  });

  it("keeps the DOI the authors supplied to arXiv as an identifier", async () => {
    const entry = (await client.arxivEntries([{ id: "hep-th/9711200", version: null }])).entries[0]!;
    expect(scholarlyRecordFromArxiv(entry).identifiers).toEqual([
      { scheme: "doi", value: "10.1023/a:1026654312961" },
      { scheme: "arxiv", value: "hep-th/9711200" },
    ]);
  });

  it("maps a Crossref work: a year-and-month issue date is kept as the year only", async () => {
    const work = await client.crossrefWork("10.1016/s0140-6736(97)11096-0");
    const record = scholarlyRecordFromCrossref(work);
    expect(record).toMatchObject({
      publicationYear: 1998,
      publicationDate: null,
      publicationDatePrecision: "year",
      venue: "The Lancet",
      workType: "journal-article",
    });
    expect(record.integrityNotices.map((n) => n.type)).toEqual(["correction", "retraction"]);
    const peerj = scholarlyRecordFromCrossref(await client.crossrefWork("10.7717/peerj.4375"));
    expect(peerj).toMatchObject({
      publicationDate: "2018-02-13",
      publicationDatePrecision: "day",
      identifiers: [{ scheme: "doi", value: "10.7717/peerj.4375" }],
    });
  });
});
