import { type CacheEntry, type CacheKind, cacheKey, cacheTtlMs, isFresh, type ProviderCacheStore } from "./cache";
import { providerName, ScholarlyProviderError } from "./errors";
import type { ScholarlyProvider } from "./types";

/**
 * The one HTTP client for scholarly providers. https to a fixed set of hosts only; paths are built
 * by the adapters from validated, encoded identifiers and checked again here; redirects are never
 * followed; timeouts of 10 s (metadata), 20 s (arXiv API and OAI-PMH) and 90 s (PDF) cover the body
 * too; responses are read with a size cap; at most three retries, with jittered exponential
 * back-off, for 429, 5xx and network failures, honouring Retry-After (and arXiv's 3.1 s spacing);
 * no retry for other 4xx; an exhausted OpenAlex budget is reported with its reset time and never
 * retried. Credentials (the OpenAlex key, the Crossref mailto) are added at send time only, so they
 * never reach a cache key, a fixture or an error message.
 */

export const USER_AGENT = "corniversity-library/0.1 (private study)";

export const ALLOWED_HOSTS: Record<ScholarlyProvider, readonly string[]> = {
  openalex: ["api.openalex.org"],
  arxiv: ["export.arxiv.org", "oaipmh.arxiv.org"],
  crossref: ["api.crossref.org"],
};

export type RequestKind = "metadata" | "arxiv";
export const TIMEOUT_MS: Record<RequestKind | "pdf", number> = { metadata: 10_000, arxiv: 20_000, pdf: 90_000 };
export const MAX_RETRIES = 3;
export const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
/** arXiv: at most one request every three seconds, across all processes (the worker queue spaces jobs). */
export const ARXIV_MIN_SPACING_MS = 3100;
/** A Retry-After longer than this is not waited for: the request fails with it. */
export const MAX_RETRY_AFTER_SECONDS = 60;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30_000;

/** `use`: a fresh cached response, else fetch and store. `only`: cached (even stale) or `not_cached`; never fetch. `refresh`: always fetch and store. */
export type CacheMode = "use" | "only" | "refresh";

export interface RequestOptions {
  cache?: CacheMode;
}

export interface ProviderRequest {
  provider: ScholarlyProvider;
  host: string;
  /** Starts with "/"; identifiers already validated and encoded. */
  path: string;
  /** Ordered query pairs, never credentials. */
  query?: readonly (readonly [string, string])[];
  kind: RequestKind;
  cacheKind: CacheKind | null;
  accept: string;
}

export interface ProviderResponse {
  status: 200 | 404;
  contentType: string | null;
  body: string;
  retrievedAt: string;
  fixture: boolean;
  fromCache: boolean;
  stale: boolean;
}

export interface PdfRequest {
  provider: "arxiv";
  host: "export.arxiv.org";
  path: string;
  maxBytes: number;
}

export interface PdfResponse {
  bytes: Uint8Array;
  contentType: string;
  retrievedAt: string;
  fixture: boolean;
}

export interface ScholarlyTransport {
  readonly mode: "live" | "fixture";
  get(request: ProviderRequest, options?: RequestOptions): Promise<ProviderResponse>;
  getPdf(request: PdfRequest): Promise<PdfResponse>;
}

/** Builds and checks the request URL: allowed host, https, no path tricks. Throws on anything else. */
export function requestUrl(request: { provider: ScholarlyProvider; host: string; path: string; query?: ProviderRequest["query"] }): URL {
  const { provider, host, path } = request;
  if (!ALLOWED_HOSTS[provider].includes(host)) throw new Error(`Host not allowed for ${provider}.`);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: it matches control characters in order to refuse them
  if (!path.startsWith("/") || path.startsWith("//") || /[\s?#\\\u0000-\u001f\u007f]/.test(path) || /(^|\/)\.\.?(\/|$)/.test(path))
    throw new Error("Unsafe request path.");
  const url = new URL(`https://${host}${path}`);
  if (url.protocol !== "https:" || url.hostname !== host || url.pathname !== path) throw new Error("Unsafe request path.");
  for (const [key, value] of request.query ?? []) url.searchParams.append(key, value);
  return url;
}

export interface LiveTransportOptions {
  openalexApiKey?: string | null;
  crossrefMailto?: string | null;
  cache?: ProviderCacheStore | null;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => Date;
  maxRetries?: number;
}

interface RateLimit {
  remainingUsd: number | null;
  requiredUsd: number | null;
  resetSeconds: number | null;
}

function numberHeader(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function openAlexRateLimit(headers: Headers): RateLimit {
  return {
    remainingUsd: numberHeader(headers, "x-ratelimit-remaining-usd"),
    requiredUsd: numberHeader(headers, "x-ratelimit-cost-required-usd"),
    resetSeconds: numberHeader(headers, "x-ratelimit-reset"),
  };
}

/** Retry-After as seconds (delta or HTTP date), or null. */
export function parseRetryAfter(value: string | null, now: Date): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - now.getTime()) / 1000)) : null;
}

class Retryable {
  constructor(
    readonly error: ScholarlyProviderError,
    readonly retryAfterSeconds: number | null,
  ) {}
}

/**
 * The body as the provider cache keeps it: OpenAlex echoes the request (a search phrase, a
 * `cites:` list built from the owner's library) in `meta.x_query`, and no raw query is stored, so
 * that member is dropped. Nothing else is changed; a body that is not a JSON object is kept as is.
 */
export function cacheableBody(provider: ScholarlyProvider, body: string): string {
  if (provider !== "openalex" || !body.includes('"x_query"')) return body;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return body;
    const meta = (parsed as { meta?: unknown }).meta;
    if (!meta || typeof meta !== "object" || Array.isArray(meta) || !("x_query" in meta)) return body;
    const { x_query: _echoedQuery, ...kept } = meta as Record<string, unknown>;
    return JSON.stringify({ ...parsed, meta: kept });
  } catch {
    return body;
  }
}

export class LiveTransport implements ScholarlyTransport {
  readonly mode = "live" as const;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => Date;
  private readonly maxRetries: number;

  constructor(private readonly options: LiveTransportOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
    this.now = options.now ?? (() => new Date());
    this.maxRetries = options.maxRetries ?? MAX_RETRIES;
  }

  async get(request: ProviderRequest, options: RequestOptions = {}): Promise<ProviderResponse> {
    requestUrl(request);
    const mode = options.cache ?? "use";
    const cache = this.options.cache;
    const key = cache && request.cacheKind ? cacheKey(request) : null;
    if (mode !== "refresh") {
      const entry = key && cache ? await cache.get(key) : null;
      if (entry) {
        const fresh = isFresh(entry, this.now());
        if (fresh || mode === "only") return fromEntry(entry, !fresh);
      }
      if (mode === "only")
        throw new ScholarlyProviderError(request.provider, "not_cached", `Not fetched from ${providerName(request.provider)} yet.`);
    }
    const response = await this.withRetries(request.provider, request.kind, async (signal) => {
      const res = await this.send(request, signal);
      if (res.status === 200 || res.status === 404) {
        const bytes = await readCapped(res, MAX_RESPONSE_BYTES, request.provider);
        return { status: res.status as 200 | 404, contentType: res.headers.get("content-type"), body: new TextDecoder().decode(bytes) };
      }
      throw this.failure(request.provider, res);
    });
    const fetchedAt = this.now();
    if (key && cache && request.cacheKind) {
      const ttl = cacheTtlMs(request.cacheKind, response.status);
      if (ttl !== null) {
        await cache.put({
          key,
          provider: request.provider,
          status: response.status,
          payload: { contentType: response.contentType, body: cacheableBody(request.provider, response.body) },
          fetchedAt,
          expiresAt: new Date(fetchedAt.getTime() + ttl),
        });
      }
    }
    return { ...response, retrievedAt: fetchedAt.toISOString(), fixture: false, fromCache: false, stale: false };
  }

  async getPdf(request: PdfRequest): Promise<PdfResponse> {
    const url = requestUrl(request);
    const result = await this.withRetries("arxiv", "pdf", async (signal) => {
      const res = await this.fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": USER_AGENT, accept: "application/pdf" },
        signal,
      });
      if (res.status !== 200) throw this.failure("arxiv", res);
      const contentType = res.headers.get("content-type") ?? "";
      if (!/^application\/pdf\b/i.test(contentType)) {
        await res.body?.cancel();
        throw new ScholarlyProviderError("arxiv", "invalid_response", "arXiv did not return a PDF.", { status: res.status });
      }
      const bytes = await readCapped(res, request.maxBytes, "arxiv");
      if (bytes.length < 5 || new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-")
        throw new ScholarlyProviderError("arxiv", "invalid_response", "arXiv's response is not a PDF file.");
      return { bytes, contentType };
    });
    return { ...result, retrievedAt: this.now().toISOString(), fixture: false };
  }

  private async send(request: ProviderRequest, signal: AbortSignal): Promise<Response> {
    const url = requestUrl(request);
    const headers: Record<string, string> = { "user-agent": USER_AGENT, accept: request.accept };
    if (request.provider === "openalex" && this.options.openalexApiKey) headers.authorization = `Bearer ${this.options.openalexApiKey}`;
    if (request.provider === "crossref" && this.options.crossrefMailto) url.searchParams.append("mailto", this.options.crossrefMailto);
    return this.fetchImpl(url, { method: "GET", redirect: "manual", headers, signal });
  }

  /** Turns a non-success response into an error; Retryable when it may be retried. */
  private failure(provider: ScholarlyProvider, res: Response): ScholarlyProviderError | Retryable {
    void res.body?.cancel().catch(() => {});
    const name = providerName(provider);
    const status = res.status;
    if ((status >= 300 && status < 400) || res.type === "opaqueredirect")
      return new ScholarlyProviderError(provider, "redirect", `${name} answered with a redirect, which is not followed.`, { status });
    const retryAfter = parseRetryAfter(res.headers.get("retry-after"), this.now());
    if (status === 429 || status === 402 || status === 403) {
      if (provider === "openalex") {
        const limit = openAlexRateLimit(res.headers);
        const spent =
          limit.remainingUsd !== null &&
          (limit.remainingUsd <= 0 || (limit.requiredUsd !== null && limit.requiredUsd > limit.remainingUsd));
        if (spent) {
          const resetAt = limit.resetSeconds !== null ? new Date(this.now().getTime() + limit.resetSeconds * 1000) : null;
          const when = resetAt ? ` It resets at ${resetAt.toISOString().slice(0, 16).replace("T", " ")} UTC.` : "";
          return new ScholarlyProviderError(provider, "budget_exhausted", `OpenAlex's daily allowance for this server is used up.${when}`, {
            status,
            resetAt,
          });
        }
      }
    }
    if (status === 429) {
      const error = new ScholarlyProviderError(provider, "rate_limited", `${name} is limiting requests; try again later.`, {
        status,
        retryAfterSeconds: retryAfter,
      });
      return retryAfter !== null && retryAfter > MAX_RETRY_AFTER_SECONDS ? error : new Retryable(error, retryAfter);
    }
    if (status >= 500) {
      const error = new ScholarlyProviderError(provider, "unavailable", `${name} is unavailable (${status}).`, {
        status,
        retryAfterSeconds: retryAfter,
      });
      return retryAfter !== null && retryAfter > MAX_RETRY_AFTER_SECONDS ? error : new Retryable(error, retryAfter);
    }
    return new ScholarlyProviderError(provider, "refused", `${name} refused the request (${status}).`, { status });
  }

  private async withRetries<T>(
    provider: ScholarlyProvider,
    kind: RequestKind | "pdf",
    attempt: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const name = providerName(provider);
    const timeout = TIMEOUT_MS[kind];
    for (let retry = 0; ; retry++) {
      let outcome: ScholarlyProviderError | Retryable;
      try {
        return await attempt(AbortSignal.timeout(timeout));
      } catch (error) {
        if (error instanceof Retryable) outcome = error;
        else if (error instanceof ScholarlyProviderError) throw error;
        else if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
          outcome = new Retryable(
            new ScholarlyProviderError(provider, "unavailable", `${name} did not answer within ${timeout / 1000} seconds.`),
            null,
          );
        else outcome = new Retryable(new ScholarlyProviderError(provider, "unavailable", `${name} could not be reached.`), null);
      }
      if (retry >= this.maxRetries) throw outcome.error;
      const exponential = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** retry);
      const jittered = exponential / 2 + this.random() * (exponential / 2);
      const floor = provider === "arxiv" ? ARXIV_MIN_SPACING_MS : 0;
      await this.sleep(Math.max(jittered, (outcome.retryAfterSeconds ?? 0) * 1000, floor));
    }
  }
}

function fromEntry(entry: CacheEntry, stale: boolean): ProviderResponse {
  return {
    status: entry.status === 404 ? 404 : 200,
    contentType: entry.payload.contentType,
    body: entry.payload.body,
    retrievedAt: entry.fetchedAt.toISOString(),
    fixture: false,
    fromCache: true,
    stale,
  };
}

/** Reads a body up to `max` bytes; larger (declared or streamed) bodies are cancelled and refused. */
async function readCapped(res: Response, max: number, provider: ScholarlyProvider): Promise<Uint8Array> {
  const tooLarge = () =>
    new ScholarlyProviderError(provider, "too_large", `${providerName(provider)}'s response is larger than the limit.`);
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) {
    await res.body?.cancel();
    throw tooLarge();
  }
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
