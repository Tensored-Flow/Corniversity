import { getEnv } from "@corniversity/db/env";
import { listResourceRequests, renderRequestsMarkdown, requestsToJson, suggestedRequests } from "@corniversity/db/services/library";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Downloads the "books to obtain" list as `requests.md` or `requests.json`. */
export async function GET(request: Request): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "md";
  const database = db();
  const [requests, suggestions] = await Promise.all([
    listResourceRequests(database, authed.session.user.id),
    suggestedRequests(database, authed.session.user.id),
  ]);
  const institution = getEnv().INSTITUTION_NAME;
  if (format === "json") {
    return NextResponse.json(requestsToJson(requests, suggestions, institution), {
      headers: { "content-disposition": 'attachment; filename="requests.json"', "cache-control": "private, no-store" },
    });
  }
  return new Response(renderRequestsMarkdown(requests, institution, suggestions), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": 'attachment; filename="requests.md"',
      "cache-control": "private, no-store",
    },
  });
}
