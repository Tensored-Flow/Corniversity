import { scheduledSession } from "@corniversity/db/schema/index";
import { LearningError, startOrResumeSession } from "@corniversity/db/services/learning";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { redirectTo } from "@/lib/redirect";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * A timetable slot opens its own study session: the activity it was planned for, resumed where it
 * was left. If the unit cannot be studied yet (not prepared, or the course is not being taken) the
 * slot falls back to the unit's page, which says why.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return redirectTo("/sign-in");
  const ownerId = authed.session.user.id;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return redirectTo("/timetable");
  const [slot] = await db()
    .select()
    .from(scheduledSession)
    .where(and(eq(scheduledSession.id, id), eq(scheduledSession.ownerId, ownerId)))
    .limit(1);
  if (!slot?.unitId) return redirectTo("/timetable");
  if (slot.learningSessionId) return redirectTo(`/sessions/${slot.learningSessionId}`);
  try {
    const { session } = await startOrResumeSession(db(), {
      ownerId,
      unitId: slot.unitId,
      activityId: slot.activityId,
      scheduledSessionId: slot.id,
    });
    return redirectTo(`/sessions/${session.id}`);
  } catch (error) {
    if (!(error instanceof LearningError)) throw error;
    return redirectTo(`/timetable?slot=${id}&reason=${error.code}`);
  }
}
