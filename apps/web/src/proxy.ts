import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic redirect for the private areas when no session cookie is present at all.
 * This is a convenience, not the security boundary: every page and route handler verifies
 * the session server-side (see lib/session.ts), so a forged cookie buys nothing.
 */
export function proxy(request: NextRequest) {
  const cookie = getSessionCookie(request, { cookiePrefix: "corniversity" });
  if (!cookie) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
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
  ],
};
