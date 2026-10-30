import Link from "next/link";
import { DateTime } from "luxon";
import { listEnrolments } from "@corniversity/db/services/enrolment";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { getTimetable, listCalendarTokens, listOpenProposals } from "@corniversity/db/services/timetable";
import { Badge, Card, EmptyState, LinkButton, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { SessionActions } from "./SessionActions";
import { catchUpAction, createCalendarLinkAction, decideProposalAction, revokeCalendarLinksAction } from "./actions";

export const metadata = { title: "Timetable" };

const KIND_TONE: Record<string, "neutral" | "brass" | "moss" | "rust" | "slate"> = {
  lecture: "slate",
  tutorial: "brass",
  problem_class: "brass",
  oral: "moss",
  revision: "neutral",
  lab: "slate",
  seminar: "neutral",
  project: "moss",
};

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string; course?: string; error?: string; token?: string }>;
}) {
  const session = await requireSession("/timetable");
  const params = await searchParams;
  const profile = await ensureProfile(db(), session.user.id);
  const tt = await getTimetable(db(), session.user.id);
  const zone = profile.timezone;
  if (!tt?.plan) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-3xl text-ink">Timetable</h1>
        <div className="mt-6">
          <EmptyState
            title="No confirmed plan yet"
            body="Finish orientation to confirm a first term; the timetable is built by a deterministic scheduler from your availability and courses."
            action={<LinkButton href="/onboarding/1">Continue orientation</LinkButton>}
          />
        </div>
      </div>
    );
  }
  const [enrolments, proposals, tokens] = await Promise.all([
    listEnrolments(db(), session.user.id),
    listOpenProposals(db(), session.user.id),
    listCalendarTokens(db(), session.user.id),
  ]);
  const courseOf = new Map(enrolments.map((e) => [e.enrolment.id, e.course]));
  const view = params.view === "agenda" || params.view === "term" ? params.view : "week";
  const now = DateTime.now().setZone(zone);
  const termStart = DateTime.fromISO(tt.term.startDate, { zone });
  const weekCount = tt.term.teachingWeeks + (tt.term.readingWeek ? 1 : 0) + (tt.term.synthesisWeek ? 1 : 0);
  const defaultWeek = Math.min(Math.max(0, Math.floor(now.diff(termStart, "weeks").weeks)), weekCount - 1);
  const weekIndex = params.week !== undefined ? Math.min(Math.max(0, Number(params.week) || 0), weekCount - 1) : defaultWeek;
  const weekStart = termStart.plus({ weeks: weekIndex });
  const weekEnd = weekStart.plus({ weeks: 1 });
  const filtered = tt.sessions.filter((s) => !params.course || courseOf.get(s.enrolmentId)?.id === params.course);
  const inWeek = filtered.filter((s) => {
    const d = DateTime.fromJSDate(s.startsAt).setZone(zone);
    return d >= weekStart && d < weekEnd;
  });
  const missed = filtered.filter((s) => s.status === "planned" && DateTime.fromJSDate(s.endsAt) < DateTime.now());
  const activeTokens = tokens.filter((t) => !t.revokedAt);
  const fmtStart = (d: Date) => DateTime.fromJSDate(d).setZone(zone).toFormat("yyyy-LL-dd'T'HH:mm");

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-brass">Timetable</p>
          <h1 className="mt-1 text-3xl text-ink">{tt.term.title}</h1>
          <p className="mt-1 text-sm text-ink-2">
            Plan version {tt.plan.version} · {zone} · {(tt.plan.summary.plannedMinutes / 60).toFixed(0)} hours planned
          </p>
        </div>
        <nav aria-label="Timetable views" className="flex gap-2 text-sm">
          {(["week", "agenda", "term"] as const).map((v) => (
            <Link
              key={v}
              href={`/timetable?view=${v}${params.course ? `&course=${params.course}` : ""}`}
              aria-current={view === v ? "page" : undefined}
              className={["rounded-[var(--radius-control)] border px-3 py-1.5", view === v ? "border-brass bg-brass-soft text-brass-strong" : "border-stone bg-paper-2 text-ink-2 hover:text-ink"].join(" ")}
            >
              {v[0]!.toUpperCase() + v.slice(1)}
            </Link>
          ))}
        </nav>
      </header>

      {params.error ? (
        <div className="mb-4">
          <Notice tone="rust">{decodeURIComponent(params.error)}</Notice>
        </div>
      ) : null}
      {params.token ? (
        <div className="mb-4">
          <Notice tone="moss" title="Calendar subscription link created">
            Copy it now; it is shown once. <code className="break-all font-mono text-xs">{`${process.env.BETTER_AUTH_URL ?? ""}/api/calendar/${params.token}.ics`}</code>
            <br />
            Subscribing in a calendar app keeps it updated; importing a downloaded file is a one-off snapshot.
          </Notice>
        </div>
      ) : null}

      {proposals.length > 0 ? (
        <section className="mb-6 flex flex-col gap-3" aria-labelledby="proposals">
          <h2 id="proposals" className="text-lg text-ink">
            Proposed changes awaiting your decision
          </h2>
          {proposals.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brass">{p.kind}</Badge>
                <span className="text-xs text-ink-3">proposed by {p.proposedBy}</span>
              </div>
              <h3 className="mt-1 text-ink">{p.title}</h3>
              <p className="mt-1 text-sm text-ink-2">{p.rationale}</p>
              <form action={decideProposalAction} className="mt-3 flex gap-2">
                <input type="hidden" name="proposalId" value={p.id} />
                <button type="submit" name="decision" value="confirmed" className="rounded-[var(--radius-control)] bg-brass px-3 py-1.5 text-sm text-paper-2 hover:bg-brass-strong">
                  Confirm
                </button>
                <button type="submit" name="decision" value="rejected" className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-3 py-1.5 text-sm hover:bg-paper-3">
                  Reject
                </button>
              </form>
            </Card>
          ))}
        </section>
      ) : null}

      {missed.length > 0 && proposals.length === 0 ? (
        <div className="mb-6">
          <Notice tone="neutral" title={`${missed.length} session${missed.length === 1 ? "" : "s"} passed without being marked`}>
            Life happens. A catch-up plan moves only what needs moving and shows you the difference before anything changes.
            <form action={catchUpAction} className="mt-2">
              <button type="submit" className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-3 py-1.5 text-sm hover:bg-paper-3">
                Propose a catch-up plan
              </button>
            </form>
          </Notice>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-3">Course:</span>
        <Link href={`/timetable?view=${view}`} className={!params.course ? "font-medium text-ink" : "text-ink-2"}>
          All
        </Link>
        {enrolments
          .filter((e) => e.enrolment.status === "active")
          .map((e) => (
            <Link key={e.course.id} href={`/timetable?view=${view}&course=${e.course.id}`} className={params.course === e.course.id ? "font-medium text-ink" : "text-ink-2"}>
              {e.course.id}
            </Link>
          ))}
      </div>

      {view === "week" ? (
        <section aria-labelledby="week-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="week-heading" className="text-lg text-ink">
              Week {weekIndex + 1} · {weekStart.toFormat("d LLL")} to {weekEnd.minus({ days: 1 }).toFormat("d LLL yyyy")}
            </h2>
            <div className="flex gap-2 text-sm">
              {weekIndex > 0 ? (
                <Link href={`/timetable?view=week&week=${weekIndex - 1}`} className="text-brass underline underline-offset-4">
                  ← Previous
                </Link>
              ) : null}
              {weekIndex < weekCount - 1 ? (
                <Link href={`/timetable?view=week&week=${weekIndex + 1}`} className="text-brass underline underline-offset-4">
                  Next →
                </Link>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-7">
            {Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i })).map((day) => {
              const items = inWeek.filter((s) => DateTime.fromJSDate(s.startsAt).setZone(zone).hasSame(day, "day"));
              return (
                <div key={day.toISODate()} className={["rounded-[var(--radius-panel)] border bg-paper-2 p-2", day.hasSame(now, "day") ? "border-brass" : "border-stone"].join(" ")}>
                  <p className="text-xs uppercase tracking-wide text-ink-3">{day.toFormat("ccc d")}</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {items.map((s) => (
                      <li key={s.id} className={["rounded-[var(--radius-control)] border border-stone p-2 text-xs", s.status === "completed" ? "opacity-60" : "", s.status === "cancelled" ? "line-through opacity-50" : ""].join(" ")}>
                        <p className="text-ink-3">
                          {DateTime.fromJSDate(s.startsAt).setZone(zone).toFormat("HH:mm")}–{DateTime.fromJSDate(s.endsAt).setZone(zone).toFormat("HH:mm")}
                        </p>
                        <Badge tone={KIND_TONE[s.sessionKind] ?? "neutral"}>{s.sessionKind.replace("_", " ")}</Badge>
                        {s.unitId ? (
                          <Link href={`/courses/${courseOf.get(s.enrolmentId)?.id}/units/${s.unitId}`} className="mt-1 block text-ink underline-offset-4 hover:underline">
                            {s.title}
                          </Link>
                        ) : (
                          <p className="mt-1 text-ink">{s.title}</p>
                        )}
                        <SessionActions sessionId={s.id} status={s.status} locked={s.locked} startsAtIso={fmtStart(s.startsAt)} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {view === "agenda" ? (
        <section aria-labelledby="agenda-heading">
          <h2 id="agenda-heading" className="text-lg text-ink">
            Agenda
          </h2>
          <ol className="mt-3 flex flex-col gap-2">
            {filtered
              .filter((s) => s.status === "planned" || DateTime.fromJSDate(s.endsAt) >= DateTime.now().minus({ days: 1 }))
              .map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-stone bg-paper-2 px-3 py-2 text-sm">
                  <span className="w-44 text-ink-3">{DateTime.fromJSDate(s.startsAt).setZone(zone).toFormat("ccc d LLL HH:mm")}</span>
                  <Badge tone={KIND_TONE[s.sessionKind] ?? "neutral"}>{s.sessionKind.replace("_", " ")}</Badge>
                  <span className="flex-1 text-ink">{s.title}</span>
                  <Badge>{s.status}</Badge>
                  <SessionActions sessionId={s.id} status={s.status} locked={s.locked} startsAtIso={fmtStart(s.startsAt)} />
                </li>
              ))}
          </ol>
        </section>
      ) : null}

      {view === "term" ? (
        <section aria-labelledby="term-heading">
          <h2 id="term-heading" className="text-lg text-ink">
            Term overview
          </h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-3">
                <th className="py-1 pr-3 font-medium">Week</th>
                <th className="py-1 pr-3 font-medium">Starts</th>
                <th className="py-1 pr-3 font-medium">Sessions</th>
                <th className="py-1 pr-3 font-medium">Planned</th>
                <th className="py-1 font-medium">Cap</th>
              </tr>
            </thead>
            <tbody>
              {tt.plan.summary.weekly.map((w, i) => {
                const ws = DateTime.fromISO(w.weekStart, { zone });
                const count = filtered.filter((s) => {
                  const d = DateTime.fromJSDate(s.startsAt).setZone(zone);
                  return d >= ws && d < ws.plus({ weeks: 1 });
                }).length;
                return (
                  <tr key={w.weekStart} className="border-t border-stone">
                    <td className="py-1 pr-3">
                      <Link href={`/timetable?view=week&week=${i}`} className="text-brass underline underline-offset-4">
                        Week {i + 1}
                      </Link>
                    </td>
                    <td className="py-1 pr-3 text-ink-2">{ws.toFormat("d LLL")}</td>
                    <td className="py-1 pr-3 text-ink-2">{count}</td>
                    <td className="py-1 pr-3 text-ink-2">{(w.plannedMinutes / 60).toFixed(1)} h</td>
                    <td className="py-1 text-ink-3">{(w.capMinutes / 60).toFixed(0)} h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {tt.plan.summary.unplaced.length ? (
            <div className="mt-4">
              <Notice tone="rust" title={`${tt.plan.summary.unplaced.length} activities could not be placed`}>
                <ul className="list-disc pl-5">
                  {tt.plan.summary.unplaced.map((u) => (
                    <li key={u.activityId}>
                      {u.title}: {u.reason}
                    </li>
                  ))}
                </ul>
              </Notice>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="calendar-heading">
        <h2 id="calendar-heading" className="text-lg text-ink">
          Calendar export
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-2">
          Download a snapshot, or create a private subscription link that your calendar app refreshes itself. The link is a secret: anyone holding it can read your timetable (minimal detail by default). Revoke it here at any time. Nothing is written to any external calendar.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a href="/api/calendar/export.ics" className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-3 py-1.5 text-sm hover:bg-paper-3">
            Download .ics snapshot
          </a>
          <form action={createCalendarLinkAction} className="flex items-center gap-2">
            <select name="detail" defaultValue="minimal" className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1.5 text-sm">
              <option value="minimal">Minimal detail (busy blocks)</option>
              <option value="full">Full detail (course and unit)</option>
            </select>
            <button type="submit" className="rounded-[var(--radius-control)] bg-brass px-3 py-1.5 text-sm text-paper-2 hover:bg-brass-strong">
              Create subscription link
            </button>
          </form>
          {activeTokens.length ? (
            <form action={revokeCalendarLinksAction}>
              <button type="submit" className="rounded-[var(--radius-control)] border border-rust px-3 py-1.5 text-sm text-rust hover:bg-rust-soft">
                Revoke {activeTokens.length} link{activeTokens.length === 1 ? "" : "s"}
              </button>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  );
}
