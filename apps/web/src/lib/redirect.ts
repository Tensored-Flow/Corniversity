import "server-only";
import { getEnv } from "@corniversity/db/env";
import { NextResponse } from "next/server";

/**
 * A redirect from a route handler to a page of this app, built on the configured public address
 * (BETTER_AUTH_URL). A route handler's `request.url` names the server's own address, which behind
 * Railway's proxy is https://0.0.0.0:3000 and which the browser cannot reach.
 */
export function redirectTo(path: string): NextResponse {
  return NextResponse.redirect(new URL(path, getEnv().BETTER_AUTH_URL));
}
