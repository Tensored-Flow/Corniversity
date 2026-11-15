import { describe, expect, it } from "vitest";
import {
  classifyLicence,
  crossrefLicence,
  licenceAttribution,
  normaliseLicenceUrl,
  storageDecision,
  type VersionLicenceFacts,
} from "./licence";

describe("classifyLicence: arXiv OAI-PMH licence URLs", () => {
  const cases: [string, string, string | null][] = [
    ["http://creativecommons.org/licenses/by/4.0/", "open", "CC BY 4.0"],
    ["https://creativecommons.org/licenses/by-sa/4.0/", "open", "CC BY-SA 4.0"],
    ["http://creativecommons.org/licenses/by-nc-sa/4.0/", "open_nc_nd", "CC BY-NC-SA 4.0"],
    ["http://creativecommons.org/licenses/by-nc-nd/4.0/", "open_nc_nd", "CC BY-NC-ND 4.0"],
    ["http://creativecommons.org/licenses/by-nd/4.0/", "open_nc_nd", "CC BY-ND 4.0"],
    ["http://creativecommons.org/publicdomain/zero/1.0/", "open", "CC0 1.0"],
    ["http://creativecommons.org/licenses/publicdomain/", "open", "Creative Commons public domain dedication"],
    ["http://arxiv.org/licenses/nonexclusive-distrib/1.0/", "arxiv_nonexclusive", "arXiv non-exclusive licence to distribute"],
    ["https://arxiv.org/licenses/nonexclusive-distrib/1.0", "arxiv_nonexclusive", "arXiv non-exclusive licence to distribute"],
    [
      "https://arxiv.org/licenses/assumed-1991-2003/",
      "arxiv_nonexclusive",
      "arXiv licence assumed for 1991–2003 submissions (no explicit licence)",
    ],
    ["http://creativecommons.org/licenses/by/3.0/", "open", "CC BY 3.0"],
    ["http://creativecommons.org/licenses/by-nc-sa/3.0/", "open_nc_nd", "CC BY-NC-SA 3.0"],
    ["https://www.creativecommons.org/licenses/by/4.0/legalcode", "open", "CC BY 4.0"],
    ["https://creativecommons.org/licenses/by/4.0/legalcode.de", "open", "CC BY 4.0"],
    ["https://creativecommons.org/licenses/by/4.0/deed.en", "open", "CC BY 4.0"],
    ["https://creativecommons.org/licenses/by-sa/4.0/deed.pt_BR", "open", "CC BY-SA 4.0"],
    ["HTTP://CREATIVECOMMONS.ORG/LICENSES/BY/4.0/", "open", "CC BY 4.0"],
    ["http://creativecommons.org/licenses/by/4.0/?ref=x#y", "open", "CC BY 4.0"],
    ["https://creativecommons.org/licenses/by/3.0/de/", "open", "CC BY 3.0 (DE)"],
    // CC 4.0 has no jurisdiction ports; unrecognised paths, versions or types are unknown.
    ["https://creativecommons.org/licenses/by/4.0/de/", "unknown", null],
    ["http://creativecommons.org/licenses/by/4.0/extra", "unknown", null],
    ["http://creativecommons.org/licenses/by/5.0/", "unknown", null],
    ["creativecommons.org/licenses/by", "unknown", null],
    ["http://creativecommons.org/licenses/by-nc-nd-x/4.0/", "unknown", null],
    ["https://example.org/licenses/by/4.0/", "unknown", null],
    ["https://arxiv.org/licenses/nonexclusive-distrib/2.0/", "unknown", null],
    // OpenAlex tokens are not arXiv licences.
    ["cc-by", "unknown", null],
  ];
  for (const [value, expected, name] of cases) {
    it(`${value} → ${expected}`, () => {
      expect(classifyLicence(value, "arxiv-oai")).toEqual({ class: expected, name });
    });
  }

  it("is unknown for a missing or blank value", () => {
    expect(classifyLicence(null, "arxiv-oai").class).toBe("unknown");
    expect(classifyLicence(undefined, "arxiv-oai").class).toBe("unknown");
    expect(classifyLicence("   ", "arxiv-oai").class).toBe("unknown");
  });

  it("normalises URL forms without matching prefixes", () => {
    expect(normaliseLicenceUrl("https://www.creativecommons.org/licenses/by/4.0/legalcode")).toBe("creativecommons.org/licenses/by/4.0");
    expect(normaliseLicenceUrl("cc-by")).toBeNull();
  });
});

describe("classifyLicence: OpenAlex tokens, exactly", () => {
  const tokens: [string, string][] = [
    ["cc-by", "open"],
    ["cc-by-sa", "open"],
    ["public-domain", "open"],
    ["cc-by-nc", "open_nc_nd"],
    ["cc-by-nd", "open_nc_nd"],
    ["cc-by-nc-sa", "open_nc_nd"],
    ["cc-by-nc-nd", "open_nc_nd"],
    ["publisher-specific-oa", "restricted"],
    ["mit", "restricted"],
    ["apache-2-0", "restricted"],
    ["gpl-v2", "restricted"],
    ["gpl-v3", "restricted"],
    ["isc", "restricted"],
    ["other-oa", "unknown"],
    ["CC-BY", "open"],
    ["https://openalex.org/licenses/cc-by", "open"],
  ];
  for (const [token, expected] of tokens) {
    it(`${token} → ${expected}`, () => expect(classifyLicence(token, "openalex").class).toBe(expected));
  }

  it("never treats a longer or decorated token as its prefix", () => {
    expect(classifyLicence("cc-by-nc-nd", "openalex").class).not.toBe("open");
    expect(classifyLicence("cc-by-foo", "openalex").class).toBe("unknown");
    expect(classifyLicence("xcc-by", "openalex").class).toBe("unknown");
    expect(classifyLicence("cc-by;cc-by-nc", "openalex").class).toBe("unknown");
  });
});

describe("classifyLicence and crossrefLicence: Crossref", () => {
  it("classifies a publisher URL as restricted and a CC URL by the table", () => {
    expect(classifyLicence("https://www.elsevier.com/tdm/userlicense/1.0/", "crossref").class).toBe("restricted");
    expect(classifyLicence("http://creativecommons.org/licenses/by/4.0/", "crossref").class).toBe("open");
    expect(classifyLicence("not a url", "crossref").class).toBe("unknown");
  });

  const now = new Date("2026-11-15T00:00:00Z");
  const start = { "date-time": "2018-02-13T00:00:00Z" };

  it("counts only vor and am entries whose embargo has passed", () => {
    // Recorded for 10.1016/s0140-6736(97)11096-0: only an Elsevier TDM entry.
    expect(
      crossrefLicence([{ URL: "https://www.elsevier.com/tdm/userlicense/1.0/", "content-version": "tdm", "delay-in-days": 0, start }], now)
        .class,
    ).toBe("unknown");
    // Recorded for 10.7717/peerj.4375: CC BY with content-version "unspecified" does not count.
    expect(
      crossrefLicence([{ URL: "http://creativecommons.org/licenses/by/4.0/", "content-version": "unspecified", start }], now).class,
    ).toBe("unknown");
    expect(
      crossrefLicence([{ URL: "http://creativecommons.org/licenses/by/4.0/", "content-version": "vor", "delay-in-days": 0, start }], now),
    ).toEqual({
      class: "open",
      name: "CC BY 4.0",
      url: "http://creativecommons.org/licenses/by/4.0/",
    });
    const embargoed = {
      URL: "http://creativecommons.org/licenses/by/4.0/",
      "content-version": "am",
      "delay-in-days": 365,
      start: { "date-time": "2026-06-01T00:00:00Z" },
    };
    expect(crossrefLicence([embargoed], now).class).toBe("unknown");
    expect(crossrefLicence([{ URL: "http://creativecommons.org/licenses/by/4.0/", "content-version": "vor" }], now).class).toBe("unknown");
  });

  it("is unknown when the counted entries disagree", () => {
    expect(
      crossrefLicence(
        [
          { URL: "http://creativecommons.org/licenses/by/4.0/", "content-version": "vor", start },
          { URL: "http://creativecommons.org/licenses/by-nc/4.0/", "content-version": "am", start },
        ],
        now,
      ).class,
    ).toBe("unknown");
    expect(
      crossrefLicence(
        [
          { URL: "http://creativecommons.org/licenses/by/4.0/", "content-version": "vor", start },
          { URL: "https://www.elsevier.com/tdm/userlicense/1.0/", "content-version": "tdm", start },
        ],
        now,
      ).class,
    ).toBe("open");
    expect(crossrefLicence(null, now).class).toBe("unknown");
  });

  it("is unknown when two counted licences of the same class differ, and agrees across URL spellings", () => {
    const counted = (urls: string[]) =>
      crossrefLicence(
        urls.map((URL, i) => ({ URL, "content-version": i === 0 ? "vor" : "am", start })),
        now,
      );
    // Both open, but not the same licence.
    expect(counted(["http://creativecommons.org/licenses/by/4.0/", "http://creativecommons.org/licenses/by-sa/4.0/"])).toEqual({
      class: "unknown",
      name: null,
      url: null,
    });
    // Both non-commercial or no-derivatives, but different terms.
    expect(counted(["http://creativecommons.org/licenses/by-nc/4.0/", "http://creativecommons.org/licenses/by-nd/4.0/"]).class).toBe(
      "unknown",
    );
    // Two different publisher licences.
    expect(counted(["https://www.elsevier.com/tdm/userlicense/1.0/", "https://www.springer.com/tdm"]).class).toBe("unknown");
    // The same licence written two ways agrees.
    expect(counted(["http://creativecommons.org/licenses/by/4.0/", "https://www.creativecommons.org/licenses/by/4.0/legalcode"])).toEqual({
      class: "open",
      name: "CC BY 4.0",
      url: "http://creativecommons.org/licenses/by/4.0/",
    });
  });
});

describe("storageDecision", () => {
  const open: VersionLicenceFacts = {
    arxivId: "2305.18290",
    arxivVersion: 3,
    licence: "http://creativecommons.org/licenses/by/4.0/",
    licenceSource: "arxiv-oai",
    licenceRetrievedAt: "2026-11-15T03:13:20.000Z",
  };

  it("allows a private copy only for an open licence reported by arXiv OAI-PMH for that exact version", () => {
    expect(storageDecision(open)).toEqual({ privateCopy: true, licenceClass: "open", licenceName: "CC BY 4.0", retrievedOn: "2026-11-15" });
    expect(storageDecision({ ...open, licence: "http://creativecommons.org/publicdomain/zero/1.0/" }).privateCopy).toBe(true);
  });

  it("refuses provider-reported licences, other classes, missing facts and withdrawn versions, with a reason", () => {
    const refusals: [Partial<VersionLicenceFacts>, RegExp][] = [
      [{ licenceSource: "openalex", licence: "cc-by" }, /as reported by OpenAlex/],
      [{ licenceSource: "crossref" }, /as reported by Crossref/],
      [{ licence: "http://arxiv.org/licenses/nonexclusive-distrib/1.0/" }, /does not permit Corniversity to store a copy/],
      [{ licence: "http://creativecommons.org/licenses/by-nc-nd/4.0/" }, /CC BY-NC-ND 4.0 carries non-commercial or no-derivatives terms/],
      [{ licence: "https://example.org/my-licence" }, /not one Corniversity recognises as open/],
      [{ licence: null }, /has not reported a licence/],
      [{ licenceSource: null }, /has not reported a licence/],
      [{ arxivVersion: null }, /exact arXiv version/],
      [{ arxivId: null }, /exact arXiv version/],
      [{ withdrawn: true }, /^This version was withdrawn on arXiv, so/],
      [{ licenceRetrievedAt: null }, /no retrieval date/],
      [{ licenceRetrievedAt: "not a date" }, /no retrieval date/],
    ];
    for (const [change, reason] of refusals) {
      const decision = storageDecision({ ...open, ...change });
      expect(decision.privateCopy, JSON.stringify(change)).toBe(false);
      if (!decision.privateCopy) expect(decision.reason).toMatch(reason);
    }
  });

  it("names where a displayed licence came from", () => {
    expect(licenceAttribution("openalex")).toBe("as reported by OpenAlex for this location");
    expect(licenceAttribution("arxiv-oai", "2026-11-13T00:21:59Z")).toBe("as reported by arXiv OAI-PMH on 2026-11-13");
    expect(licenceAttribution("crossref")).toBe("as reported by Crossref for the publisher's version");
  });
});
