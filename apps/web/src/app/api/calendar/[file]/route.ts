import { buildIcs } from "@corniversity/core/scheduling/ics";
import { getEnv } from "@corniversity/db/env";
import { listEnrolments } from "@corniversity/db/services/enrolment";
import { getTimetable, resolveCalendarToken } from "@corniversity/db/services/timetable";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Two forms: `export.ics` for the signed-in owner (a one-off snapshot), and `<token>.ics` for a
 * calendar subscription with a private revocable token. Detail level follows the token.
 */
export async function GET(request: Request, context: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await context.params;
  const match = /^(.+)\.ics$/.exec(file);
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const name = match[1]!;
  let ownerId: string;
  let detail: "minimal" | "full" = "full";

  if (name === "export") {
    const authed = await requireApiSession(request);
    if ("response" in authed) return authed.response;
    ownerId = authed.session.user.id;
  } else {
    if (name.length < 20) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const token = await resolveCalendarToken(db(), name);
    if (!token) return NextResponse.json({ error: "not_found" }, { status: 404 });
    ownerId = token.ownerId;
    detail = token.detailLevel;
  }

  const tt = await getTimetable(db(), ownerId);
  const sessions = tt?.plan ? tt.sessions.filter((s) => s.status !== "cancelled") : [];
  const enrolments = await listEnrolments(db(), ownerId);
  const courseOf = new Map(enrolments.map((e) => [e.enrolment.id, e.course.id]));
  const ics = buildIcs(
    sessions.map((s) => ({
      uid: s.uid,
      key: `${s.unitId}:${s.activityId}`,
      enrolmentId: s.enrolmentId,
      courseId: courseOf.get(s.enrolmentId) ?? "",
      unitId: s.unitId ?? "",
      activityId: s.activityId,
      title: s.title,
      sessionKind: s.sessionKind as never,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      weekIndex: 0,
      part: 1,
      parts: 1,
      minutes: Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000),
    })),
    { calendarName: `${getEnv().INSTITUTION_NAME} timetable`, detail, baseUrl: getEnv().BETTER_AUTH_URL },
  );
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="corniversity-${name === "export" ? "timetable" : "subscription"}.ics"`,
      "cache-control": "no-store",
    },
  });
}
