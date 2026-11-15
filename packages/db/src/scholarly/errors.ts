import type { ScholarlyProvider } from "./types";

export type ScholarlyErrorCode =
  /** The provider has no such record (404), or the identifier resolves to nothing. */
  | "not_found"
  /** The identifier failed validation before any request. */
  | "invalid_identifier"
  /** 429 after the retries, or a Retry-After too long to wait for. */
  | "rate_limited"
  /** OpenAlex's daily budget is spent; `resetAt` says when it resets. Never retried. */
  | "budget_exhausted"
  /** 5xx, network failure or timeout after the retries. */
  | "unavailable"
  /** The provider answered with a redirect, which is never followed. */
  | "redirect"
  /** Any other 4xx (bad request, unauthorised, forbidden). */
  | "refused"
  /** The response was larger than allowed. */
  | "too_large"
  /** The response did not have the expected shape. */
  | "invalid_response"
  /** Fixture mode has no recorded response for this request. */
  | "fixture_missing"
  /** Cache mode "only" and nothing is cached for this request. */
  | "not_cached";

const PROVIDER_NAMES: Record<ScholarlyProvider, string> = { openalex: "OpenAlex", arxiv: "arXiv", crossref: "Crossref" };

export function providerName(provider: ScholarlyProvider): string {
  return PROVIDER_NAMES[provider];
}

/**
 * A provider failure. Messages are written here, never copied from the network layer, so they carry
 * no URL, query, key or mailto.
 */
export class ScholarlyProviderError extends Error {
  readonly code: ScholarlyErrorCode;
  readonly provider: ScholarlyProvider;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;
  readonly resetAt: Date | null;

  constructor(
    provider: ScholarlyProvider,
    code: ScholarlyErrorCode,
    message: string,
    extra: { status?: number | null; retryAfterSeconds?: number | null; resetAt?: Date | null } = {},
  ) {
    super(message);
    this.name = "ScholarlyProviderError";
    this.code = code;
    this.provider = provider;
    this.status = extra.status ?? null;
    this.retryAfterSeconds = extra.retryAfterSeconds ?? null;
    this.resetAt = extra.resetAt ?? null;
  }
}

/**
 * Removes secrets and URLs from text before it is stored or shown (job records, notices): each given
 * secret, `api_key=`/`mailto=` parameters, bearer tokens and any http(s) URL.
 */
export function redact(text: string, secrets: readonly (string | null | undefined)[] = []): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 4) out = out.split(secret).join("[redacted]");
  }
  out = out.replace(/\b(api_key|mailto|key|token)=[^&\s]+/gi, "$1=[redacted]");
  out = out.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]");
  return out.replace(/\bhttps?:\/\/[^\s"'<>]+/gi, "[url]");
}
