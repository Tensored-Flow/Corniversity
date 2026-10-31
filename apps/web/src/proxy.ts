import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic redirect for the private areas when no session cookie is present at all.
 * This is a convenience, not the security boundary: every page and route handler verifies
 * the session server-side (see lib/session.ts), so a forged cookie buys nothing.
 */
export function proxy(request: NextRequest) {
  // Rate limits key on the client address. A proxy appends the address it saw to the end of
  // X-Forwarded-For; everything before it is the client's own claim, so only the last entry is
  // passed on to the handlers (sign-in and pairing among them).
  const headers = new Headers(request.headers);
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1);
    if (last) headers.set("x-forwarded-for", last);
  }
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next({ request: { headers } });
  const cookie = getSessionCookie(request, { cookiePrefix: "corniversity" });
  if (!cookie) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/campus/:path*",
    "/studies/:path*",
    "/onboarding/:path*",
    "/welcome/:path*",
    "/departments/:path*",
    "/catalogue/:path*",
    "/courses/:path*",
    "/sessions/:path*",
    "/library/:path*",
    "/timetable/:path*",
    "/notebook/:path*",
    "/common-room/:path*",
    "/records/:path*",
    "/settings/:path*",
    "/labs/:path*",
    "/director/:path*",
    "/api/auth/:path*",
    "/api/companion/:path*",
  ],
};
