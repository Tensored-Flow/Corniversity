import { count, desc, lt, sql } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { providerCache } from "../schema/scholarly";
import type { CacheEntry, ProviderCacheStore } from "./cache";
import { type ScholarlyClient, type ScholarlyEnv, scholarlyClientFromEnv } from "./client";

/**
 * The provider cache in PostgreSQL (`scholarly_cache.provider_cache`, a schema backups never read).
 * Keys are the sha256 of the canonical request without credentials; no owner id or raw query is
 * stored. The transport writes only 200 and 404 responses (the table refuses anything else).
 */
export class PgProviderCache implements ProviderCacheStore {
  constructor(private readonly db: DbOrTx) {}

  async get(key: string): Promise<CacheEntry | null> {
    const [row] = await this.db.select().from(providerCache).where(sql`${providerCache.key} = ${key}`).limit(1);
    if (!row) return null;
    return {
      key: row.key,
      provider: row.provider,
      status: row.status,
      payload: row.payload,
      fetchedAt: row.fetchedAt,
      expiresAt: row.expiresAt,
    };
  }

  async put(entry: CacheEntry): Promise<void> {
    if (entry.status !== 200 && entry.status !== 404) return;
    await this.db
      .insert(providerCache)
      .values({
        key: entry.key,
        provider: entry.provider,
        status: entry.status,
        payload: entry.payload,
        fetchedAt: entry.fetchedAt,
        expiresAt: entry.expiresAt,
      })
      .onConflictDoUpdate({
        target: providerCache.key,
        set: {
          provider: entry.provider,
          status: entry.status,
          payload: entry.payload,
          fetchedAt: entry.fetchedAt,
          expiresAt: entry.expiresAt,
        },
      });
  }
}

/** Expired rows are kept this long, so pages can still show a dated list while a refresh is pending. */
export const CACHE_PURGE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
/** The table never holds more rows than this after a purge (the oldest fetches go first). */
export const CACHE_MAX_ROWS = 20_000;

/**
 * The daily purge: deletes rows that expired longer than the grace period ago, then, if the table
 * still holds more than `maxRows`, the oldest fetched rows beyond that cap.
 */
export async function purgeProviderCache(
  db: DbOrTx,
  options: { now?: Date; graceMs?: number; maxRows?: number } = {},
): Promise<{ expired: number; capped: number }> {
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - (options.graceMs ?? CACHE_PURGE_GRACE_MS));
  const maxRows = options.maxRows ?? CACHE_MAX_ROWS;
  const expired = await db.delete(providerCache).where(lt(providerCache.expiresAt, cutoff)).returning({ key: providerCache.key });
  const [total] = await db.select({ n: count() }).from(providerCache);
  let capped = 0;
  if (total && total.n > maxRows) {
    const keep = db.select({ key: providerCache.key }).from(providerCache).orderBy(desc(providerCache.fetchedAt)).limit(maxRows);
    const removed = await db.delete(providerCache).where(sql`${providerCache.key} not in (${keep})`).returning({ key: providerCache.key });
    capped = removed.length;
  }
  return { expired: expired.length, capped };
}

/** The scholarly client the environment selects, caching live responses in PostgreSQL. */
export function scholarlyClientWithCache(env: ScholarlyEnv, db: DbOrTx): ScholarlyClient {
  return scholarlyClientFromEnv(env, { cache: new PgProviderCache(db) });
}
