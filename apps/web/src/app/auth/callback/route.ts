import { getEnv } from "@corniversity/db/env";
import { completePlanSignIn, PlanSignInError, planUnavailableReason } from "@corniversity/db/services/chatgpt-plan";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorCode } from "@/lib/notices";

/**
 * OpenAI's loopback callback for the owner's ChatGPT sign-in (http://127.0.0.1:<port>/auth/callback,
 * local installation only; the hosted site answers 404). The attempt is identified by its state,
 * not by a session cookie, because the browser may hold the session under another host name; the
 * owner is then sent back to Settings at the installation's own address.
 */
export async function GET(request: Request): Promise<Response> {
  const env = getEnv();
  if (planUnavailableReason(env)) return new NextResponse("Not found", { status: 404 });
  const back = (query: string) => NextResponse.redirect(new URL(`/settings?${query}#chatgpt-plan`, env.BETTER_AUTH_URL), 303);
  try {
    await completePlanSignIn(db(), env, new URL(request.url).searchParams);
    return back("plan=connected");
  } catch (error) {
    if (error instanceof PlanSignInError) return back(`planError=${errorCode(error.message)}`);
    throw error;
  }
}
