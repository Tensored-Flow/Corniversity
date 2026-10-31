import { planVersion } from "@corniversity/db/schema/index";
import { listEnrolments } from "@corniversity/db/services/enrolment";
import { getActiveTerm, listSessions } from "@corniversity/db/services/timetable";
import { and, desc, eq } from "drizzle-orm";
import { DateTime } from "luxon";
import Link from "next/link";
import { Badge, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { acceptTimetableAction } from "../actions";
import { StepFooter, type StepProps } from "./shared";

export async function StepTimetable({ userId, profile }: StepProps) {
  const termRow = await getActiveTerm(db(), userId);
  if (!termRow) return <Notice tone="rust">No term exists yet; go back to step 9.</Notice>;
  const [plan] = await db()
    .select()
    .from(planVersion)
    .where(and(eq(planVersion.ownerId, userId), eq(planVersion.termId, termRow.id), eq(planVersion.status, "proposed")))
    .orderBy(desc(planVersion.version))
    .limit(1);
  if (!plan) return <Notice tone="rust">No proposed plan found; go back to step 9 and rebuild.</Notice>;
  const sessions = await listSessions(db(), userId, plan.id);
  const enrolments = await listEnrolments(db(), userId);
  const zone = profile.timezone;
  const firstTwoWeeks = sessions.filter((s) => {
    const start = DateTime.fromJSDate(s.startsAt).setZone(zone);
    const termStart = DateTime.fromISO(termRow.startDate, { zone });
    return start < termStart.plus({ weeks: 2 });
  });
  const unprepared = enrolments.filter((e) => e.enrolment.status === "active" && e.version.readiness !== "teaching_ready");

  return (
    <form action={acceptTimetableAction} className="flex max-w-3xl flex-col gap-6">
      <input type="hidden" name="planId" value={plan.id} />
      <Notice
        tone={plan.summary.feasible ? "moss" : "rust"}
        title={plan.summary.feasible ? "The timetable fits" : "The timetable does not fully fit"}
      >
        <ul className="list-disc pl-5">
          {plan.summary.explanations.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        {!plan.summary.feasible ? (
          <p className="mt-2">
            {plan.summary.unplaced.length} activities are unplaced. You can continue with this shortfall (they appear as unscheduled work),
            or{" "}
            <Link href="/onboarding/5" className="underline underline-offset-4">
              adjust your hours
            </Link>{" "}
            or{" "}
            <Link href="/onboarding/8" className="underline underline-offset-4">
              choose a lighter plan
            </Link>
            .
          </p>
        ) : null}
      </Notice>

      <section aria-labelledby="weekly">
        <h2 id="weekly" className="text-lg text-ink">
          Week by week
        </h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-3">
              <th className="py-1 pr-3 font-medium">Week starting</th>
              <th className="py-1 pr-3 font-medium">Planned</th>
              <th className="py-1 font-medium">Cap</th>
            </tr>
          </thead>
          <tbody>
            {plan.summary.weekly.map((w) => (
              <tr key={w.weekStart} className="border-t border-stone">
                <td className="py-1 pr-3 text-ink">{DateTime.fromISO(w.weekStart).toFormat("d LLL")}</td>
                <td className="py-1 pr-3 text-ink-2">{(w.plannedMinutes / 60).toFixed(1)} h</td>
                <td className="py-1 text-ink-3">{(w.capMinutes / 60).toFixed(0)} h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="first-weeks">
        <h2 id="first-weeks" className="text-lg text-ink">
          Your first two weeks
        </h2>
        {firstTwoWeeks.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">Nothing could be placed in the first two weeks; check your availability.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {firstTwoWeeks.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-stone bg-paper-2 px-3 py-2"
              >
                <span className="w-40 text-ink-3">{DateTime.fromJSDate(s.startsAt).setZone(zone).toFormat("ccc d LLL HH:mm")}</span>
                <Badge>{s.sessionKind.replace("_", " ")}</Badge>
                <span className="text-ink">{s.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="resources">
        <h2 id="resources" className="text-lg text-ink">
          Resources and access
        </h2>
        {unprepared.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">
            Every enrolled course has prepared units and verified open sources; nothing needs to be obtained before you begin.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {unprepared.map((e) => (
              <li key={e.enrolment.id} className="rounded-[var(--radius-control)] border border-stone bg-paper-2 px-3 py-2 text-ink-2">
                <span className="font-mono text-xs text-ink-3">{e.course.id}</span> {e.course.title}: no prepared units yet, so only its
                verified reading list is available until the content pipeline prepares it. No sessions are scheduled for it.
              </li>
            ))}
          </ul>
        )}
      </section>

      <StepFooter step={10} continueLabel="This looks right" />
    </form>
  );
}
