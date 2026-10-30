import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth, type Session } from "./auth";

/** Server components and actions: redirect to sign-in when there is no valid session. */
export async function requireSession(nextPath?: string): Promise<Session> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    const target = nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : "/sign-in";
    redirect(target);
  }
  return session;
}

export async function getOptionalSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}

/** Route handlers: 401 JSON instead of a redirect. */
export async function requireApiSession(
  request: Request,
): Promise<{ session: Session } | { response: NextResponse }> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return {
      response: NextResponse.json({ error: "authentication_required" }, { status: 401 }),
    };
  }
  return { session };
}

/** Safe post-sign-in destination: same-origin relative paths only. */
export function safeNextPath(candidate: string | null | undefined, fallback = "/campus"): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }
  return candidate;
}
