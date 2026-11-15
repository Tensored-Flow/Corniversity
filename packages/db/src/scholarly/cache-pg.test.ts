import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { providerCache } from "../schema/scholarly";
import { cacheKey } from "./cache";
import { PgProviderCache, purgeProviderCache } from "./cache-pg";
import { getOpenAlexWork } from "./openalex";
import { LiveTransport } from "./transport";

/**
 * The PostgreSQL provider cache: what the transport writes (200 and 404 only), what pages read in
 * cache-only mode, and the daily purge. Responses here come from a stub fetch, never the network.
 */
let handle: ReturnType<typeof createDb>;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  await handle.db.delete(providerCache);
});

afterAll(async () => {
  await handle.close();
});

const WORK = JSON.stringify({ id: "https://openalex.org/W1", display_name: "A stub work", ids: { openalex: "https://openalex.org/W1" } });

function stubFetch(status: number, body: string) {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return new Response(body, { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fetchImpl, calls: () => calls };
}

describe("PgProviderCache", () => {
  it("stores a 200 response under the request's key and serves it without fetching again", async () => {
    const cache = new PgProviderCache(handle.db);
    const stub = stubFetch(200, WORK);
    const transport = new LiveTransport({ cache, fetch: stub.fetchImpl, sleep: async () => {}, maxRetries: 0 });
    const first = await getOpenAlexWork(transport, { scheme: "openalex", value: "W1" });
    expect(first.record.openalexId).toBe("W1");
    const again = await getOpenAlexWork(transport, { scheme: "openalex", value: "W1" }, { cache: "only" });
    expect(again.record.title).toBe("A stub work");
    expect(stub.calls()).toBe(1);
    const rows = await handle.db.select().from(providerCache);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe(200);
    expect(rows[0]!.provider).toBe("openalex");
    // No raw query or owner is kept: the key is a sha256.
    expect(rows[0]!.key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("caches a 404 and never a 429 or 5xx", async () => {
    const cache = new PgProviderCache(handle.db);
    const missing = new LiveTransport({ cache, fetch: stubFetch(404, "").fetchImpl, sleep: async () => {}, maxRetries: 0 });
    await expect(getOpenAlexWork(missing, { scheme: "openalex", value: "W404" })).rejects.toThrow();
    const busy = new LiveTransport({ cache, fetch: stubFetch(503, "").fetchImpl, sleep: async () => {}, maxRetries: 0 });
    await expect(getOpenAlexWork(busy, { scheme: "openalex", value: "W503" })).rejects.toThrow();
    const statuses = (await handle.db.select({ status: providerCache.status }).from(providerCache)).map((r) => r.status).sort();
    expect(statuses).toEqual([200, 404]);
    await cache.put({
      key: "a".repeat(64),
      provider: "openalex",
      status: 429,
      payload: { contentType: null, body: "" },
      fetchedAt: new Date(),
      expiresAt: new Date(),
    });
    expect(await cache.get("a".repeat(64))).toBeNull();
  });

  it("the purge deletes rows expired beyond the grace period, then caps the table by age", async () => {
    await handle.db.delete(providerCache);
    const cache = new PgProviderCache(handle.db);
    const now = new Date("2026-11-15T12:00:00Z");
    const day = 86_400_000;
    const put = (key: string, fetchedDaysAgo: number, expiresDaysAgo: number) =>
      cache.put({
        key: key.repeat(64).slice(0, 64),
        provider: "openalex",
        status: 200,
        payload: { contentType: "application/json", body: "{}" },
        fetchedAt: new Date(now.getTime() - fetchedDaysAgo * day),
        expiresAt: new Date(now.getTime() - expiresDaysAgo * day),
      });
    await put("1", 20, 13); // expired 13 days ago: beyond a 7-day grace
    await put("2", 9, 2); // expired 2 days ago: kept during the grace period
    await put("3", 3, -4);
    await put("4", 1, -6);
    await put("5", 0, -7);
    const first = await purgeProviderCache(handle.db, { now, graceMs: 7 * day, maxRows: 3 });
    expect(first).toEqual({ expired: 1, capped: 1 });
    const left = (await handle.db.select({ key: providerCache.key }).from(providerCache)).map((r) => r.key[0]).sort();
    expect(left).toEqual(["3", "4", "5"]);
    expect(await purgeProviderCache(handle.db, { now, graceMs: 7 * day, maxRows: 3 })).toEqual({ expired: 0, capped: 0 });
    // The key the transport uses is the same function the cache contract names.
    expect(cacheKey({ host: "api.openalex.org", path: "/works/W1" })).toMatch(/^[0-9a-f]{64}$/);
    const count = await handle.db.execute(sql`select count(*)::int as n from scholarly_cache.provider_cache`);
    expect((count.rows[0] as { n: number }).n).toBe(3);
    await handle.db.delete(providerCache).where(eq(providerCache.provider, "openalex"));
  });
});
