import { projectReport } from "@corniversity/db/services/research";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The project's report as a Markdown download, assembled from its own records, for its owner only. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const { id } = await context.params;
  const markdown = await projectReport(db(), authed.session.user.id, id);
  if (markdown === null) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="research-report-${id.slice(0, 8)}.md"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
