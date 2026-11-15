import { createHash } from "node:crypto";
import type { ScholarlyProvider } from "./types";

/**
 * The provider cache contract. Keys are the sha256 of the canonical request (method, host, path
 * and sorted query) WITHOUT credentials: the OpenAlex key travels only in a header and the Crossref
 * mailto is added at send time, so neither ever reaches a key. No owner id or raw query is stored
 * as a key. Only 200 and 404 responses are cached (404 for 24 hours); 429, 5xx and other 4xx never.
 */

export type CacheKind =
  | "taxonomy"
  | "work"
  | "references"
  | "cited_by"
  | "related"
  | "search"
  | "subject_list"
  | "arxiv_record"
  | "arxiv_listing"
  | "crossref";

const DAY = 86_400_000;

/** Lifetimes per kind (contract §5). arXiv records are refreshed daily, like listings. */
export const CACHE_TTL_MS: Record<CacheKind, number> = {
  taxonomy: 30 * DAY,
  work: 7 * DAY,
  references: 7 * DAY,
  cited_by: 7 * DAY,
  related: 7 * DAY,
  search: DAY,
  subject_list: DAY,
  arxiv_record: DAY,
  arxiv_listing: DAY,
  crossref: 7 * DAY,
};
export const NOT_FOUND_TTL_MS = DAY;

/** How long a response with this status may be cached, or null when it must not be cached. */
export function cacheTtlMs(kind: CacheKind, status: number): number | null {
  if (status === 200) return CACHE_TTL_MS[kind];
  if (status === 404) return NOT_FOUND_TTL_MS;
  return null;
}

export interface CacheEntry {
  key: string;
  provider: ScholarlyProvider;
  status: number;
  /** The response as received: content type and body text. */
  payload: { contentType: string | null; body: string };
  fetchedAt: Date;
  expiresAt: Date;
}

export interface ProviderCacheStore {
  /** The entry for a key, fresh or expired (callers compare `expiresAt`), or null. */
  get(key: string): Promise<CacheEntry | null>;
  put(entry: CacheEntry): Promise<void>;
}

export interface CanonicalRequest {
  host: string;
  path: string;
  query?: readonly (readonly [string, string])[];
}

/** `GET https://host/path?sorted-query`, the one string both the cache key and fixtures are keyed by. */
export function canonicalRequest(request: CanonicalRequest): string {
  const pairs = [...(request.query ?? [])].sort((a, b) => (a[0] === b[0] ? cmp(a[1], b[1]) : cmp(a[0], b[0])));
  const query = new URLSearchParams(pairs.map(([k, v]): [string, string] => [k, v])).toString();
  return `GET https://${request.host}${request.path}${query ? `?${query}` : ""}`;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function cacheKey(request: CanonicalRequest): string {
  return createHash("sha256").update(canonicalRequest(request)).digest("hex");
}

export function isFresh(entry: CacheEntry, now: Date): boolean {
  return entry.expiresAt.getTime() > now.getTime();
}

/** In-memory cache for tests and scripts. */
export class MemoryProviderCache implements ProviderCacheStore {
  readonly entries = new Map<string, CacheEntry>();
  async get(key: string): Promise<CacheEntry | null> {
    return this.entries.get(key) ?? null;
  }
  async put(entry: CacheEntry): Promise<void> {
    this.entries.set(entry.key, entry);
  }
}
