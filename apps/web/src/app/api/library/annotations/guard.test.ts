import { describe, expect, it } from "vitest";
import { TabSequences } from "../position/sequence";
import { checkReaderRequest, serverOrigins } from "./guard";

const ORIGINS = ["http://127.0.0.1:3720", "https://corniversity.example"];
const json = "application/json";

describe("the reader's JSON routes accept only JSON from this site's own pages", () => {
  it("accepts Sec-Fetch-Site: same-origin, or an Origin equal to this server's", () => {
    expect(checkReaderRequest({ contentType: json, secFetchSite: "same-origin", origin: null }, ORIGINS)).toEqual({ ok: true });
    expect(
      checkReaderRequest(
        { contentType: "Application/JSON; charset=utf-8", secFetchSite: null, origin: "https://corniversity.example" },
        ORIGINS,
      ),
    ).toEqual({
      ok: true,
    });
  });

  it("refuses another site, a missing Origin, the null origin and same-site subdomains", () => {
    for (const headers of [
      { secFetchSite: "cross-site", origin: "https://evil.example" },
      { secFetchSite: "same-site", origin: "https://other.corniversity.example" },
      { secFetchSite: null, origin: null },
      { secFetchSite: "none", origin: null },
      { secFetchSite: null, origin: "null" },
      { secFetchSite: null, origin: "https://corniversity.example.evil.test" },
    ])
      expect(checkReaderRequest({ contentType: json, ...headers }, ORIGINS)).toEqual({ ok: false, status: 403, error: "cross_origin" });
  });

  it("refuses anything that is not JSON before looking at where it came from", () => {
    for (const contentType of [null, "", "text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"])
      expect(checkReaderRequest({ contentType, secFetchSite: "same-origin", origin: null }, ORIGINS)).toEqual({
        ok: false,
        status: 415,
        error: "json_only",
      });
  });

  it("knows the server's origins from the request and the configured public URL", () => {
    expect(serverOrigins(new Request("http://127.0.0.1:3720/api/library/annotations"), "https://corniversity.example/")).toEqual(ORIGINS);
    expect(serverOrigins(new Request("http://127.0.0.1:3720/api/library/position"), "not a url")).toEqual([ORIGINS[0]]);
  });
});

describe("the per-tab sequence of position saves", () => {
  it("drops a save that arrives after a later one from the same tab, never another tab's", () => {
    const sequences = new TabSequences();
    expect(sequences.accept("owner:doc:tab-a", 2)).toBe(true);
    expect(sequences.accept("owner:doc:tab-a", 1)).toBe(false);
    expect(sequences.accept("owner:doc:tab-a", 2)).toBe(false);
    expect(sequences.accept("owner:doc:tab-b", 1)).toBe(true);
    expect(sequences.accept("owner:doc:tab-a", 3)).toBe(true);
  });

  it("stays bounded, forgetting the oldest tabs first", () => {
    const sequences = new TabSequences(2);
    sequences.accept("a", 5);
    sequences.accept("b", 5);
    sequences.accept("c", 5);
    expect(sequences.accept("a", 1)).toBe(true);
    expect(sequences.accept("c", 1)).toBe(false);
  });
});
