import { captionsVtt } from "@corniversity/core/visuals/visual";
import { getVisualForLearner } from "@corniversity/db/services/visuals";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** WebVTT captions derived from the storyboard's scenes, for an open visual only, aligned to its film when one is stored. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const { slug } = await params;
  const found = await getVisualForLearner(db(), authed.session.user.id, slug);
  if (!found?.gate.open) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const offset = found.row.filmBlobKey ? (found.spec.render?.leadInSeconds ?? 0) : 0;
  return new Response(captionsVtt(found.spec, offset), {
    headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}
