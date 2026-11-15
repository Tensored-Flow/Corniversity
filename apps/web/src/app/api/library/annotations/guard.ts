import { NextResponse } from "next/server";

/**
 * The reader's JSON routes (annotations, reading position) accept a request only when it is JSON
 * and comes from this site's own pages: `Sec-Fetch-Site: same-origin`, or an `Origin` header equal to
 * this server's origin. A form posted from another site (which cannot send JSON without a CORS
 * preflight this server never answers) or any cross-site fetch is refused before anything is read.
 */
export type GuardOutcome = { ok: true } | { ok: false; status: 403 | 415; error: "cross_origin" | "json_only" };

export function checkReaderRequest(
  headers: { contentType: string | null; secFetchSite: string | null; origin: string | null },
  allowedOrigins: readonly string[],
): GuardOutcome {
  const mediaType = (headers.contentType ?? "").split(";")[0]!.trim().toLowerCase();
  if (mediaType !== "application/json") return { ok: false, status: 415, error: "json_only" };
  if (headers.secFetchSite === "same-origin") return { ok: true };
  if (headers.origin !== null && allowedOrigins.includes(headers.origin)) return { ok: true };
  return { ok: false, status: 403, error: "cross_origin" };
}

/** This server's origins: the one the request was addressed to, and the configured public URL. */
export function serverOrigins(request: Request, publicUrl: string | undefined): string[] {
  const origins = [new URL(request.url).origin];
  if (publicUrl) {
    try {
      origins.push(new URL(publicUrl).origin);
    } catch {
      // An unparsable setting adds nothing.
    }
  }
  return origins;
}

/** The refusal response, or null when the request may proceed. */
export function refuseUnlessReaderRequest(request: Request): NextResponse | null {
  const outcome = checkReaderRequest(
    {
      contentType: request.headers.get("content-type"),
      secFetchSite: request.headers.get("sec-fetch-site"),
      origin: request.headers.get("origin"),
    },
    serverOrigins(request, process.env.BETTER_AUTH_URL),
  );
  return outcome.ok ? null : NextResponse.json({ error: outcome.error }, { status: outcome.status });
}
