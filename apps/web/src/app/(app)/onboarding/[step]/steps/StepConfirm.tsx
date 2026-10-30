import { and, desc, eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { planVersion } from "@corniversity/db/schema/index";
import { listEnrolments } from "@corniversity/db/services/enrolment";
import { getActiveTerm } from "@corniversity/db/services/timetable";
import { Badge, Card, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { confirmPlanAction } from "../actions";
import { StepFooter, type StepProps } from "./shared";

export async function StepConfirm({ userId, profile }: StepProps) {
  const termRow = await getActiveTerm(db(), userId);
  if (!termRow) return <Notice tone="rust">No term exists yet; go back to step 9.</Notice>;
  const [plan] = await db()
    .select()
    .from(planVersion)
    .where(and(eq(planVersion.ownerId, userId), eq(planVersion.termId, termRow.id), eq(planVersion.status, "proposed")))
    .orderBy(desc(planVersion.version))
    .limit(1);
  if (!plan) return <Notice tone="rust">No proposed plan found; go back to step 10.</Notice>;
  const enrolments = (await listEnrolments(db(), userId)).filter((e) => e.enrolment.status === "active");
  const start = DateTime.fromISO(termRow.startDate, { zone: profile.timezone });
  const end = DateTime.fromISO(termRow.endDate, { zone: profile.timezone });

  return (
    <form action={confirmPlanAction} className="flex max-w-3xl flex-col gap-6">
      <input type="hidden" name="planId" value={plan.id} />
      <Card>
        <h2 className="text-lg text-ink">{termRow.title}</h2>
        <p className="mt-1 text-sm text-ink-2">
          {start.toFormat("d LLLL yyyy")} to {end.toFormat("d LLLL yyyy")} · {termRow.teachingWeeks} teaching weeks{termRow.readingWeek ? " + reading week" : ""}{termRow.synthesisWeek ? " + synthesis week" : ""} · {profile.timezone}
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {enrolments.map((e) => (
            <li key={e.enrolment.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono text-xs text-ink-3">{e.course.id}</span>
              <span className="text-ink">{e.course.title}</span>
              <Badge tone="brass">{e.enrolment.mode.replace("_", " ")}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ink-2">
          {(plan.summary.plannedMinutes / 60).toFixed(0)} hours scheduled across the term, within your weekly ceiling of {profile.weeklyHoursCeiling ?? "–"} hours.
          {plan.summary.feasible ? "" : ` ${plan.summary.unplaced.length} activities remain unscheduled; they stay visible as work to place.`}
        </p>
      </Card>
      <Notice tone="neutral" title="What confirming does">
        Your timetable becomes live and appears on the campus page and in the calendar export. Enrolments stay as shown. Nothing is sent to any external calendar or service. You can pause, withdraw or re-plan at any time, and completed work is never rewritten.
      </Notice>
      <StepFooter step={11} continueLabel="Confirm and receive your welcome letter" />
    </form>
  );
}
