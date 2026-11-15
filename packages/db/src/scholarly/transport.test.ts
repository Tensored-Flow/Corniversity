import { describe, expect, it } from "vitest";
import { cacheKey, cacheTtlMs, canonicalRequest, MemoryProviderCache } from "./cache";
import { redact, ScholarlyProviderError } from "./errors";
import { ARXIV_MIN_SPACING_MS, LiveTransport, type ProviderRequest, parseRetryAfter, requestUrl, USER_AGENT } from "./transport";

/**
 * Behaviour of the HTTP client against a scripted fetch (no network). These are mocked tests of
 * the client's rules, not live checks.
 */

type Scripted = Response | Error | ((url: URL, init: RequestInit) => Response | Promise<Response>);

function fakeFetch(script: Scripted[]) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, init: init ?? {} });
    const next = script.shift();
    if (!next) throw new Error("unexpected request");
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next(url, init ?? {}) : next;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const openalexWork: ProviderRequest = {
  provider: "openalex",
  host: "api.openalex.org",
  path: "/works/W2741809807",
  kind: "metadata",
  cacheKind: "work",
  accept: "application/json",
};

function transport(script: Scripted[], options: ConstructorParameters<typeof LiveTransport>[0] = {}) {
  const { fetchImpl, calls } = fakeFetch(script);
  const sleeps: number[] = [];
  const now = new Date("2026-11-15T12:00:00Z");
  const live = new LiveTransport({
    fetch: fetchImpl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0.5,
    now: () => now,
    ...options,
  });
  return { live, calls, sleeps, now };
}

describe("request URLs", () => {
  it("allows only the fixed https hosts of each provider and refuses path tricks", () => {
    expect(requestUrl(openalexWork).href).toBe("https://api.openalex.org/works/W2741809807");
    expect(requestUrl({ ...openalexWork, path: "/works/doi:10.1016%2Fs0140-6736(97)11096-0" }).pathname).toBe(
      "/works/doi:10.1016%2Fs0140-6736(97)11096-0",
    );
    expect(() => requestUrl({ ...openalexWork, host: "evil.example" })).toThrow(/Host not allowed/);
    expect(() => requestUrl({ ...openalexWork, host: "export.arxiv.org" })).toThrow(/Host not allowed/);
    for (const path of [
      "works/W1",
      "//evil.example/x",
      "/works/../admin",
      "/works/./x",
      "/works/W1?x=1",
      "/works/W1#f",
      "/works/a b",
      "/works\\x",
      "/a/%2e%2e/b",
    ]) {
      expect(() => requestUrl({ ...openalexWork, path }), path).toThrow();
    }
  });
});

describe("LiveTransport", () => {
  it("sends the user agent, never follows redirects, and sends the OpenAlex key only as a Bearer header", async () => {
    const { live, calls } = transport([json({ id: "x" })], { openalexApiKey: "secret-openalex-key" });
    const response = await live.get(openalexWork);
    expect(response).toMatchObject({
      status: 200,
      fixture: false,
      fromCache: false,
      stale: false,
      retrievedAt: "2026-11-15T12:00:00.000Z",
    });
    const { url, init } = calls[0]!;
    const headers = init.headers as Record<string, string>;
    expect(headers["user-agent"]).toBe(USER_AGENT);
    expect(USER_AGENT).toBe("corniversity-library/0.1 (private study)");
    expect(headers.authorization).toBe("Bearer secret-openalex-key");
    expect(init.redirect).toBe("manual");
    expect(url.href).not.toContain("secret");
  });

  it("adds the Crossref mailto only when configured and only for Crossref", async () => {
    const crossref: ProviderRequest = {
      ...openalexWork,
      provider: "crossref",
      host: "api.crossref.org",
      path: "/works/10.7717%2Fpeerj.4375",
      cacheKind: "crossref",
    };
    const withMailto = transport([json({}), json({})], { crossrefMailto: "owner@example.org" });
    await withMailto.live.get(crossref);
    expect(withMailto.calls[0]!.url.searchParams.get("mailto")).toBe("owner@example.org");
    await withMailto.live.get(openalexWork);
    expect(withMailto.calls[1]!.url.searchParams.has("mailto")).toBe(false);
    expect((withMailto.calls[1]!.init.headers as Record<string, string>).authorization).toBeUndefined();
    const without = transport([json({})]);
    await without.live.get(crossref);
    expect(without.calls[0]!.url.search).toBe("");
  });

  it("retries 5xx with jittered back-off and returns the success", async () => {
    const { live, calls, sleeps } = transport([new Response("", { status: 503 }), new Response("", { status: 502 }), json({ ok: 1 })]);
    expect((await live.get(openalexWork)).body).toBe('{"ok":1}');
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([750, 1500]);
  });

  it("gives up after three retries", async () => {
    const { live, calls } = transport(Array.from({ length: 4 }, () => new Response("", { status: 500 })));
    await expect(live.get(openalexWork)).rejects.toMatchObject({ code: "unavailable", status: 500 });
    expect(calls).toHaveLength(4);
  });

  it("honours Retry-After on 429, and fails at once when it is too long to wait", async () => {
    const short = transport([new Response("", { status: 429, headers: { "retry-after": "5" } }), json({})]);
    await short.live.get(openalexWork);
    expect(short.sleeps).toEqual([5000]);
    const long = transport([new Response("", { status: 429, headers: { "retry-after": "3600" } })]);
    await expect(long.live.get(openalexWork)).rejects.toMatchObject({ code: "rate_limited", retryAfterSeconds: 3600 });
    expect(long.calls).toHaveLength(1);
    expect(parseRetryAfter("Sun, 15 Nov 2026 12:00:30 GMT", new Date("2026-11-15T12:00:00Z"))).toBe(30);
    expect(parseRetryAfter("soon", new Date())).toBeNull();
  });

  it("does not retry other 4xx, returns 404 as a response, and refuses redirects", async () => {
    const bad = transport([new Response("bad", { status: 400 })]);
    await expect(bad.live.get(openalexWork)).rejects.toMatchObject({ code: "refused", status: 400 });
    expect(bad.calls).toHaveLength(1);
    const missing = transport([new Response("Not found", { status: 404 })]);
    expect((await missing.live.get(openalexWork)).status).toBe(404);
    const moved = transport([new Response(null, { status: 301, headers: { location: "https://evil.example/" } })]);
    await expect(moved.live.get(openalexWork)).rejects.toMatchObject({ code: "redirect" });
    expect(moved.calls).toHaveLength(1);
  });

  it("reports an exhausted OpenAlex budget with its reset time and never retries it", async () => {
    const spent = transport([
      new Response("", { status: 429, headers: { "x-ratelimit-remaining-usd": "0", "x-ratelimit-reset": "3600", "retry-after": "1" } }),
    ]);
    const error = (await spent.live.get(openalexWork).catch((e) => e)) as ScholarlyProviderError;
    expect(error).toBeInstanceOf(ScholarlyProviderError);
    expect(error.code).toBe("budget_exhausted");
    expect(error.resetAt?.toISOString()).toBe("2026-11-15T13:00:00.000Z");
    expect(error.message).toBe("OpenAlex's daily allowance for this server is used up. It resets at 2026-11-15 13:00 UTC.");
    expect(spent.calls).toHaveLength(1);
    const tooCostly = transport([
      new Response("", { status: 429, headers: { "x-ratelimit-remaining-usd": "0.0005", "x-ratelimit-cost-required-usd": "0.001" } }),
    ]);
    await expect(tooCostly.live.get(openalexWork)).rejects.toMatchObject({ code: "budget_exhausted", resetAt: null });
    expect(tooCostly.calls).toHaveLength(1);
  });

  it("retries network failures and timeouts, with messages that carry no URL or key", async () => {
    const leaky = new TypeError("fetch failed for https://api.openalex.org/works/W1?api_key=secret-openalex-key");
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    const { live, calls } = transport([leaky, timeout, leaky, timeout], { openalexApiKey: "secret-openalex-key" });
    const error = (await live.get(openalexWork).catch((e) => e)) as ScholarlyProviderError;
    expect(calls).toHaveLength(4);
    expect(error.code).toBe("unavailable");
    expect(error.message).toBe("OpenAlex did not answer within 10 seconds.");
    expect(error.message).not.toMatch(/secret|https?:/);
  });

  it("spaces arXiv retries by at least 3.1 seconds", async () => {
    const arxiv: ProviderRequest = {
      ...openalexWork,
      provider: "arxiv",
      host: "export.arxiv.org",
      path: "/api/query",
      kind: "arxiv",
      cacheKind: "arxiv_record",
    };
    const { live, sleeps } = transport([new Response("", { status: 503 }), new Response("<feed/>", { status: 200 })]);
    await live.get(arxiv);
    expect(ARXIV_MIN_SPACING_MS).toBe(3100);
    expect(sleeps).toEqual([3100]);
  });

  it("refuses bodies over the size limit, declared or streamed", async () => {
    const declared = transport([new Response("x", { status: 200, headers: { "content-length": String(64 * 1024 * 1024) } })]);
    await expect(declared.live.get(openalexWork)).rejects.toMatchObject({ code: "too_large" });
    const pdf = { provider: "arxiv" as const, host: "export.arxiv.org" as const, path: "/pdf/2305.18290v3", maxBytes: 10 };
    const streamed = transport([new Response(`%PDF-${"x".repeat(100)}`, { status: 200, headers: { "content-type": "application/pdf" } })]);
    await expect(streamed.live.getPdf(pdf)).rejects.toMatchObject({ code: "too_large" });
  });

  it("downloads a PDF only when it is one, from export.arxiv.org, without following redirects", async () => {
    const pdf = { provider: "arxiv" as const, host: "export.arxiv.org" as const, path: "/pdf/2305.18290v3", maxBytes: 1000 };
    const ok = transport([new Response("%PDF-1.5 body", { status: 200, headers: { "content-type": "application/pdf" } })]);
    const result = await ok.live.getPdf(pdf);
    expect(new TextDecoder().decode(result.bytes)).toBe("%PDF-1.5 body");
    expect(ok.calls[0]!.url.href).toBe("https://export.arxiv.org/pdf/2305.18290v3");
    expect(ok.calls[0]!.init.redirect).toBe("manual");
    const html = transport([new Response("<html>", { status: 200, headers: { "content-type": "text/html" } })]);
    await expect(html.live.getPdf(pdf)).rejects.toMatchObject({ code: "invalid_response" });
    const fake = transport([new Response("<html>", { status: 200, headers: { "content-type": "application/pdf" } })]);
    await expect(fake.live.getPdf(pdf)).rejects.toMatchObject({ code: "invalid_response" });
    const moved = transport([new Response(null, { status: 302, headers: { location: "https://arxiv.org/pdf/x" } })]);
    await expect(moved.live.getPdf(pdf)).rejects.toMatchObject({ code: "redirect" });
    expect(() => requestUrl({ ...pdf, host: "arxiv.org" as "export.arxiv.org" })).toThrow();
  });
});

describe("provider cache", () => {
  it("keys requests by their canonical form without credentials", () => {
    const a = {
      host: "api.openalex.org",
      path: "/works",
      query: [
        ["search", "x y"],
        ["filter", "a:b"],
      ] as [string, string][],
    };
    const b = {
      ...a,
      query: [
        ["filter", "a:b"],
        ["search", "x y"],
      ] as [string, string][],
    };
    expect(canonicalRequest(a)).toBe("GET https://api.openalex.org/works?filter=a%3Ab&search=x+y");
    expect(cacheKey(a)).toBe(cacheKey(b));
    expect(cacheKey(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("caches 200 by kind and 404 for a day, never 429, 5xx or other 4xx", () => {
    const day = 86_400_000;
    expect(cacheTtlMs("taxonomy", 200)).toBe(30 * day);
    expect(cacheTtlMs("work", 200)).toBe(7 * day);
    expect(cacheTtlMs("cited_by", 200)).toBe(7 * day);
    expect(cacheTtlMs("related", 200)).toBe(7 * day);
    expect(cacheTtlMs("references", 200)).toBe(7 * day);
    expect(cacheTtlMs("search", 200)).toBe(day);
    expect(cacheTtlMs("subject_list", 200)).toBe(day);
    expect(cacheTtlMs("crossref", 200)).toBe(7 * day);
    expect(cacheTtlMs("work", 404)).toBe(day);
    for (const status of [429, 500, 503, 400, 403]) expect(cacheTtlMs("work", status)).toBeNull();
  });

  it("serves fresh entries, refetches expired ones, stores no credentials, and answers cache-only reads", async () => {
    const cache = new MemoryProviderCache();
    let clock = new Date("2026-11-15T12:00:00Z");
    const { fetchImpl, calls } = fakeFetch([
      json({ n: 1 }),
      json({ n: 2 }),
      new Response("", { status: 503 }),
      new Response("missing", { status: 404 }),
    ]);
    const live = new LiveTransport({
      fetch: fetchImpl,
      cache,
      now: () => clock,
      sleep: async () => {},
      maxRetries: 0,
      openalexApiKey: "secret-openalex-key",
    });
    expect((await live.get(openalexWork)).body).toBe('{"n":1}');
    expect(await live.get(openalexWork)).toMatchObject({ body: '{"n":1}', fromCache: true, retrievedAt: "2026-11-15T12:00:00.000Z" });
    expect(calls).toHaveLength(1);
    expect(JSON.stringify([...cache.entries.values()])).not.toContain("secret");

    clock = new Date("2026-11-23T12:00:00Z");
    expect(await live.get(openalexWork, { cache: "only" })).toMatchObject({ body: '{"n":1}', stale: true });
    expect((await live.get(openalexWork)).body).toBe('{"n":2}');
    expect(calls).toHaveLength(2);

    // A 503 is not cached: the stored entry stays.
    await expect(live.get(openalexWork, { cache: "refresh" })).rejects.toMatchObject({ code: "unavailable" });
    expect((await live.get(openalexWork)).body).toBe('{"n":2}');

    const other = { ...openalexWork, path: "/works/W1" };
    await expect(live.get(other, { cache: "only" })).rejects.toMatchObject({ code: "not_cached" });
    expect((await live.get(other)).status).toBe(404);
    expect(await live.get(other)).toMatchObject({ status: 404, fromCache: true });
    expect(calls).toHaveLength(4);
  });

  it("never stores the query OpenAlex echoes in meta.x_query (a search phrase)", async () => {
    const cache = new MemoryProviderCache();
    const echoed = {
      meta: { count: 1, page: 1, per_page: 5, x_query: { oql: "get works with (direct preference optimization) in the title" } },
      results: [{ id: "https://openalex.org/W1", display_name: "A title that stays" }],
    };
    const { live } = transport([json(echoed)], { cache });
    const search: ProviderRequest = {
      ...openalexWork,
      path: "/works",
      query: [["search", "direct preference optimization"]],
      cacheKind: "search",
    };
    // The caller gets the provider's answer; the cache keeps it without the echoed query.
    expect(JSON.parse((await live.get(search)).body).results).toEqual(echoed.results);
    const stored = JSON.stringify([...cache.entries.values()]);
    expect(stored).not.toContain("direct preference optimization");
    expect(stored).toContain("A title that stays");
    const served = JSON.parse((await live.get(search)).body);
    expect(served.meta).toEqual({ count: 1, page: 1, per_page: 5 });
    expect(served.results).toEqual(echoed.results);
  });
});

describe("redact", () => {
  it("removes secrets, credential parameters, bearer tokens and URLs", () => {
    expect(
      redact("failed: https://api.openalex.org/works?api_key=abc123 Bearer tok.en-1 secret-openalex-key", ["secret-openalex-key"]),
    ).toBe("failed: [url] Bearer [redacted] [redacted]");
    expect(redact("mailto=owner@example.org&x=1")).toBe("mailto=[redacted]&x=1");
  });
});
