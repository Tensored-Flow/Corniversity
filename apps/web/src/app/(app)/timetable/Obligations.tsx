import { deadlineOutcome, rollingHorizon } from "@corniversity/core";
import { contentSequence, deadlineTargets, getStudyPreferences, listDeadlines } from "@corniversity/db/services/study";
import { DateTime } from "luxon";
import Link from "next/link";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { db } from "@/lib/db";
import { createDeadlineAction, extendRollingAction, withdrawDeadlineAction } from "./actions";

const OUTCOME_LABEL: Record<ReturnType<typeof deadlineOutcome>, string> = {
  open: "open",
  met: "met",
  met_after_due: "met after the due time",
  passed: "passed unmet",
  withdrawn: "withdrawn",
};

/**
 * The parts of the timetable that are not appointments: where each course's sequence stands, the
 * rolling horizon, and academic deadlines. Deadlines appear only as the learner sets them, and
 * assessment or examination deadlines only when those modes are switched on in Settings.
 */
export async function Obligations({
  ownerId,
  zone,
  term,
}: {
  ownerId: string;
  zone: string;
  term: { mode: string; startDate: string; teachingWeeks: number };
}) {
  const [{ preferences }, deadlines, targets, sequence] = await Promise.all([
    getStudyPreferences(db(), ownerId),
    listDeadlines(db(), ownerId),
    deadlineTargets(db(), ownerId),
    contentSequence(db(), ownerId),
  ]);
  const now = new Date().toISOString();
  const horizon = term.mode === "rolling" ? rollingHorizon(term.startDate, now, term.teachingWeeks) : null;
  const visible = deadlines.filter((d) => d.status !== "withdrawn");
  const bindingAllowed = preferences.hardDeadlines || preferences.examinations;

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-2">
      <Card as="section" aria-labelledby="sequence-heading">
        <h2 id="sequence-heading" className="text-lg text-ink">
          Content sequence
        </h2>
        <p className="mt-1 text-xs text-ink-3">
          What comes next in each course, whatever the date. Appointments above say when; this says what.
        </p>
        {sequence.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">No active courses.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {sequence.map((s) => (
              <li key={s.enrolmentId} className="rounded-[var(--radius-panel)] border border-stone bg-paper p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-ink-3">{s.courseId}</span>
                  <span className="text-ink">{s.courseTitle}</span>
                  <Badge>{s.mode.replace("_", " ")}</Badge>
                </div>
                <p className="mt-1 text-xs text-ink-2">
                  {s.nextUnit ? (
                    <>
                      Next: unit {s.nextUnit.sequence},{" "}
                      <Link href={`/courses/${s.courseId}/units/${s.nextUnit.id}`} className="text-brass underline underline-offset-4">
                        {s.nextUnit.title}
                      </Link>
                    </>
                  ) : s.preparedUnits === 0 ? (
                    "No unit is prepared yet."
                  ) : (
                    "Every prepared unit has a completed session."
                  )}{" "}
                  · {s.preparedUnits} of {s.totalUnits} units prepared
                </p>
              </li>
            ))}
          </ul>
        )}
        {horizon ? (
          <div className="mt-4 border-t border-stone pt-3 text-sm text-ink-2">
            <p>
              Rolling study has no completion date. The plan currently reaches{" "}
              {DateTime.fromISO(horizon.horizonEnd, { zone }).toFormat("d LLLL yyyy")}
              {horizon.weeksRemaining > 0 ? `, about ${horizon.weeksRemaining} week${horizon.weeksRemaining === 1 ? "" : "s"} ahead` : ""}.
            </p>
            <form action={extendRollingAction} className="mt-2">
              <Button type="submit" variant={horizon.shouldExtend ? "primary" : "secondary"}>
                Draft the next ten weeks
              </Button>
            </form>
            <p className="mt-1 text-xs text-ink-3">
              You see the draft as a proposal and confirm or reject it; nothing already planned moves.
            </p>
          </div>
        ) : null}
      </Card>

      <Card as="section" aria-labelledby="deadlines-heading">
        <h2 id="deadlines-heading" className="text-lg text-ink">
          Academic deadlines
        </h2>
        <p className="mt-1 text-xs text-ink-3">
          Separate from appointments: missing a study appointment never makes anything late. Hard deadlines are{" "}
          {preferences.hardDeadlines ? "on" : "off"} and examinations are {preferences.examinations ? "on" : "off"}; change either in{" "}
          <Link href="/settings#study" className="text-brass underline underline-offset-4">
            Settings
          </Link>
          . Milestones are optional targets and never binding.
        </p>
        {visible.length ? (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {visible.map((d) => {
              const outcome = deadlineOutcome(
                {
                  id: d.id,
                  kind: d.kind,
                  dueAt: d.dueAt.toISOString(),
                  binding: d.binding,
                  status: d.status,
                  metAt: d.metAt?.toISOString() ?? null,
                },
                now,
              );
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-panel)] border border-stone bg-paper p-2"
                >
                  <span className="min-w-0">
                    <span className="text-ink">{d.title}</span>{" "}
                    <span className="text-xs text-ink-3">
                      {d.kind}
                      {d.binding ? " (binding)" : " (not binding)"} · due{" "}
                      {DateTime.fromJSDate(d.dueAt).setZone(zone).toFormat("ccc d LLL yyyy, HH:mm")}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={outcome === "passed" ? "rust" : outcome === "met" ? "moss" : "neutral"}>{OUTCOME_LABEL[outcome]}</Badge>
                    {d.status === "open" ? (
                      <form action={withdrawDeadlineAction}>
                        <input type="hidden" name="deadlineId" value={d.id} />
                        <Button type="submit" variant="quiet">
                          Withdraw
                        </Button>
                      </form>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-2">None. Nothing in Corniversity sets a deadline for you.</p>
        )}
        <form action={createDeadlineAction} className="mt-4 grid gap-3 border-t border-stone pt-3 sm:grid-cols-2">
          <Field label="Kind" htmlFor="dl-kind">
            <Select id="dl-kind" name="kind" defaultValue="milestone">
              <option value="milestone">Milestone (not binding)</option>
              <option value="assessment" disabled={!preferences.hardDeadlines}>
                Assessment deadline{preferences.hardDeadlines ? "" : " (switched off)"}
              </option>
              <option value="examination" disabled={!preferences.examinations}>
                Examination{preferences.examinations ? "" : " (switched off)"}
              </option>
            </Select>
          </Field>
          <Field label="Due" htmlFor="dl-due">
            <Input id="dl-due" name="dueAt" type="datetime-local" required />
          </Field>
          <Field label="Title" htmlFor="dl-title">
            <Input id="dl-title" name="title" required maxLength={200} />
          </Field>
          <Field
            label="Attached to (optional)"
            htmlFor="dl-target"
            hint={bindingAllowed ? "A submission for the exercise meets the deadline." : undefined}
          >
            <Select id="dl-target" name="target" defaultValue="">
              <option value="">Nothing in particular</option>
              {targets.flatMap((t) => [
                <option key={t.enrolmentId} value={`enrolment:${t.enrolmentId}`}>
                  {t.courseId} (the course)
                </option>,
                ...t.exercises.map((x) => (
                  <option key={x.id} value={`exercise:${t.enrolmentId}:${x.id}`}>
                    {t.courseId}: {x.title}
                  </option>
                )),
              ])}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
