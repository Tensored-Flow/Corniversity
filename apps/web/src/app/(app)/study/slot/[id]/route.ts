import { scheduledSession } from "@corniversity/db/schema/index";
import { LearningError, startOrResumeSession } from "@corniversity/db/services/learning";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * A timetable slot opens its own study session: the activity it was planned for, resumed where it
 * was left. If the unit cannot be studied yet (not prepared, or the course is not being taken) the
 * slot falls back to the unit's page, which says why.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return NextResponse.redirect(new URL("/sign-in", request.url));
  const ownerId = authed.session.user.id;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.redirect(new URL("/timetable", request.url));
  const [slot] = await db()
    .select()
    .from(scheduledSession)
    .where(and(eq(scheduledSession.id, id), eq(scheduledSession.ownerId, ownerId)))
    .limit(1);
  if (!slot?.unitId) return NextResponse.redirect(new URL("/timetable", request.url));
  if (slot.learningSessionId) return NextResponse.redirect(new URL(`/sessions/${slot.learningSessionId}`, request.url));
  try {
    const { session } = await startOrResumeSession(db(), {
      ownerId,
      unitId: slot.unitId,
      activityId: slot.activityId,
      scheduledSessionId: slot.id,
    });
    return NextResponse.redirect(new URL(`/sessions/${session.id}`, request.url));
  } catch (error) {
    if (!(error instanceof LearningError)) throw error;
    return NextResponse.redirect(new URL(`/timetable?slot=${id}&reason=${error.code}`, request.url));
  }
}
