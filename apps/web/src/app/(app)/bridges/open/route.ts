import { getVisit, openBridge } from "@corniversity/db/services/bridges";
import { getUnitDetail } from "@corniversity/db/services/catalogue";
import { getSession } from "@corniversity/db/services/learning";
import { db } from "@/lib/db";
import { redirectTo } from "@/lib/redirect";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Opens a concept bridge: records the visit once, with the exact place to return to (the session
 * and exercise it came from, or the bridge one level up), then shows the bridge. A cycle, the
 * depth cap or an unprepared bridge is explained on the bridge page instead of followed.
 */
export async function GET(request: Request): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return redirectTo("/sign-in");
  const ownerId = authed.session.user.id;
  const url = new URL(request.url);
  const conceptId = url.searchParams.get("concept") ?? "";
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(conceptId)) return redirectTo("/campus");
  const parentId = url.searchParams.get("parent");
  const parent = parentId ? await getVisit(db(), ownerId, parentId) : null;

  let returnTo: { path: string; label: string; exerciseId?: string };
  let trail: string[] = [];
  let sessionId: string | null = null;
  if (parent) {
    returnTo = { path: `/bridges/${parent.conceptId}?visit=${parent.id}`, label: "the bridge you came from" };
    trail = parent.trail;
    sessionId = parent.learningSessionId;
  } else {
    const session = await getSession(db(), ownerId, url.searchParams.get("from") ?? "");
    if (!session) return redirectTo("/campus");
    const unit = await getUnitDetail(db(), session.unitId);
    const activity = unit?.unit.activities.find((a) => a.id === session.activityId);
    const exercise = url.searchParams.get("exercise");
    const exerciseOk = exercise && /^[\w-]{1,120}$/.test(exercise) ? exercise : null;
    returnTo = {
      path: `/sessions/${session.id}${exerciseOk ? `?exercise=${exerciseOk}#attempt` : ""}`,
      label: activity?.title ?? "your session",
      ...(exerciseOk ? { exerciseId: exerciseOk } : {}),
    };
    sessionId = session.id;
  }
  const opened = await openBridge(db(), { ownerId, conceptId, trail, sessionId, parentVisitId: parent?.id ?? null, returnTo });
  if (!opened.ok) {
    const back = encodeURIComponent(returnTo.path);
    return redirectTo(`/bridges/${conceptId}?refused=${opened.reason}&back=${back}`);
  }
  return redirectTo(`/bridges/${conceptId}?visit=${opened.visitId}`);
}
