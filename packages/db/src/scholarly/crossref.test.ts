import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createScholarlyClient } from "./client";
import { integrityNoticesFromCrossref } from "./crossref";
import { FixtureTransport } from "./fixture-transport";

/**
 * Contract tests: the Crossref adapter against responses recorded live on 2026-11-15
 * (packages/db/src/scholarly/fixtures). Recorded data, not live calls.
 */
const client = createScholarlyClient(new FixtureTransport(fileURLToPath(new URL("./fixtures/", import.meta.url))));

describe("Crossref (recorded)", () => {
  it("reads the corrections and retractions recorded against a DOI, with their source and date", async () => {
    const work = await client.crossrefWork("10.1016/S0140-6736(97)11096-0");
    expect(work.provenance).toMatchObject({ provider: "crossref", source: "fixture" });
    expect(work.title).toMatch(/^RETRACTED: Ileal-lymphoid-nodular hyperplasia/);
    expect(work.integrityNotices).toEqual([
      {
        type: "correction",
        source: "retraction-watch",
        concerns: "10.1016/s0140-6736(97)11096-0",
        noticeDoi: "10.1016/s0140-6736(04)15715-2",
        date: "2004-03-06",
        label: "Correction",
        retrievedAt: work.provenance.retrievedAt,
      },
      {
        type: "retraction",
        source: "retraction-watch",
        concerns: "10.1016/s0140-6736(97)11096-0",
        noticeDoi: "10.1016/s0140-6736(10)60175-4",
        date: "2010-02-06",
        label: "Retraction",
        retrievedAt: work.provenance.retrievedAt,
      },
    ]);
    // Its only licence entry is Elsevier's text-and-data-mining licence: not an article licence.
    expect(work.licences).toEqual([
      { url: "https://www.elsevier.com/tdm/userlicense/1.0/", contentVersion: "tdm", start: "1998-02-01T00:00:00Z", delayInDays: 0 },
    ]);
    expect(work.licence).toEqual({ class: "unknown", name: null, url: null });
    expect(work.issued).toEqual({ year: 1998, month: 2, day: null });
  });

  it("reads an ordinary DOI with no notices; a CC BY entry marked 'unspecified' does not count", async () => {
    const work = await client.crossrefWork("10.7717/peerj.4375");
    expect(work.integrityNotices).toEqual([]);
    expect(work.title).toBe("The state of OA: a large-scale analysis of the prevalence and impact of Open Access articles");
    expect(work.containerTitle).toBe("PeerJ");
    expect(work.authors.length).toBeGreaterThan(5);
    expect(work.licences[0]).toMatchObject({ url: "http://creativecommons.org/licenses/by/4.0/", contentVersion: "unspecified" });
    expect(work.licence.class).toBe("unknown");
  });

  it("has no record of arXiv's DataCite DOIs, and validates DOIs before any request", async () => {
    await expect(client.crossrefWork("10.48550/arXiv.2305.18290")).rejects.toMatchObject({ code: "not_found", provider: "crossref" });
    await expect(client.crossrefWork("10.1/x")).rejects.toMatchObject({ code: "invalid_identifier" });
    await expect(client.crossrefWork("https://evil.example/")).rejects.toMatchObject({ code: "invalid_identifier" });
  });
});

describe("integrityNoticesFromCrossref", () => {
  it("maps integrity update types, keeps the publisher as source crossref, and ignores other updates", () => {
    const notices = integrityNoticesFromCrossref(
      "10.1/x",
      [
        { type: "erratum", DOI: "10.1000/e", source: "publisher", label: null, updated: { "date-parts": [[2020, 1, 2]] } },
        { type: "expression_of_concern", DOI: "10.1000/c", source: "publisher", label: "Expression of concern" },
        { type: "partial_retraction", DOI: "not a doi", source: "retraction-watch", label: "<b>Partial Retraction</b>" },
        { type: "withdrawal", DOI: "10.1000/w", source: "publisher", label: "Withdrawal" },
        { type: "new_version", DOI: "10.1000/v", source: "publisher", label: "New version" },
        { type: "addendum", DOI: "10.1000/a", source: "publisher", label: "Addendum" },
      ],
      "2026-11-15T00:00:00.000Z",
    );
    expect(notices).toEqual([
      {
        type: "correction",
        source: "crossref",
        concerns: "10.1/x",
        noticeDoi: "10.1000/e",
        date: "2020-01-02",
        label: "erratum",
        retrievedAt: "2026-11-15T00:00:00.000Z",
      },
      {
        type: "expression_of_concern",
        source: "crossref",
        concerns: "10.1/x",
        noticeDoi: "10.1000/c",
        label: "Expression of concern",
        retrievedAt: "2026-11-15T00:00:00.000Z",
      },
      {
        type: "retraction",
        source: "retraction-watch",
        concerns: "10.1/x",
        label: "Partial Retraction",
        retrievedAt: "2026-11-15T00:00:00.000Z",
      },
      {
        type: "withdrawal",
        source: "crossref",
        concerns: "10.1/x",
        noticeDoi: "10.1000/w",
        label: "Withdrawal",
        retrievedAt: "2026-11-15T00:00:00.000Z",
      },
    ]);
    expect(integrityNoticesFromCrossref("10.1/x", null, "x")).toEqual([]);
  });
});
