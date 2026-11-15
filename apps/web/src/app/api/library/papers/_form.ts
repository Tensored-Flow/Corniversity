import "server-only";
import { getEnv } from "@corniversity/db/env";
import { NextResponse } from "next/server";
import { auth, type Session } from "@/lib/auth";

/**
 * Shared by the paper upload routes, which plain HTML forms post to (multipart, no JavaScript
 * needed): they live under /api so the request body is not buffered by the proxy, and they answer
 * with 303 redirects to pages of this app (built on the configured public address).
 */

export function seeOther(path: string): NextResponse {
  return NextResponse.redirect(new URL(path, getEnv().BETTER_AUTH_URL), 303);
}

/** A post from this site's own pages: `Sec-Fetch-Site: same-origin`, or (older browsers) an Origin naming this site. */
export function fromThisSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(getEnv().BETTER_AUTH_URL).origin;
}

export async function formSession(request: Request): Promise<Session | null> {
  return auth.api.getSession({ headers: request.headers });
}

export function refusedCrossSite(): NextResponse {
  return NextResponse.json({ error: "cross_site_refused" }, { status: 403 });
}

/** The uploaded file of a multipart form, or null when none was chosen. */
export function uploadedFile(form: FormData | null): File | null {
  const file = form?.get("file");
  return file instanceof File && file.size > 0 ? file : null;
}
