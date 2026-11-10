import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";
import { TutorRequest, tutorAttachments } from "@/lib/tutor-context";

export const dynamic = "force-dynamic";

/**
 * What a tutor turn would carry, before it is sent: the help contract's decision and a readable
 * list of what is attached and what is not. Computed by the same function the turn uses.
 */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const parsed = TutorRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await tutorAttachments(db(), authed.session.user.id, parsed.data);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  return NextResponse.json(
    { decision: ctx.decision, attached: ctx.attached, notAttached: ctx.notAttached },
    { headers: { "cache-control": "no-store" } },
  );
}
