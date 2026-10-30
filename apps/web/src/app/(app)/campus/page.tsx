import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { listPersonas } from "@corniversity/db/services/catalogue";
import { listEnrolments } from "@corniversity/db/services/enrolment";
import { listOpenSessions } from "@corniversity/db/services/learning";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { getTimetable, listOpenProposals } from "@corniversity/db/services/timetable";
import { AiLabel, Badge, Card, EmptyState, LinkButton } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Campus" };

export default async function CampusPage() {
  const session = await requireSession("/campus");
  const profile = await ensureProfile(db(), session.user.id);
  if (!profile.onboardingCompletedAt) redirect(`/onboarding/${profile.onboardingStep}`);
  const [tt, enrolments, open, proposals, personas] = await Promise.all([
    getTimetable(db(), session.user.id),
    listEnrolments(db(), session.user.id),
    listOpenSessions(db(), session.user.id),
    listOpenProposals(db(), session.user.id),
    listPersonas(db()),
  ]);
  const zone = profile.timezone;
  const now = DateTime.now().setZone(zone);
  const courseOf = new Map(enrolments.map((e) => [e.enrolment.id, e.course]));
  const upcoming = tt?.plan ? tt.sessions.filter((s) => s.status === "planned" && DateTime.fromJSDate(s.endsAt) > DateTime.now()) : [];
  const next = upcoming[0] ?? null;
  const missed = tt?.plan ? tt.sessions.filter((s) => s.status === "planned" && DateTime.fromJSDate(s.endsAt) < DateTime.now()).length : 0;
  const director = personas.find((p) => p.role === "director");
  const continueSession = open[0] ?? null;
  const weekLabel = next ? DateTime.fromJSDate(next.startsAt).setZone(zone) : null;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Campus</p>
        <h1 className="mt-1 text-3xl text-ink">
          {now.hour < 12 ? "Good morning" : now.hour < 18 ? "Good afternoon" : "Good evening"}, {profile.displayName}.
        </h1>
        <p className="mt-1 text-sm text-ink-2">{now.toFormat("cccc d LLLL yyyy")}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="text-lg text-ink">Next session</h2>
            {next ? (
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-ink-3">{weekLabel!.hasSame(now, "day") ? "Today" : weekLabel!.toFormat("cccc d LLL")} at {weekLabel!.toFormat("HH:mm")}</span>
                  <Badge tone="brass">{next.sessionKind.replace("_", " ")}</Badge>
                  <span className="font-mono text-xs text-ink-3">{courseOf.get(next.enrolmentId)?.id}</span>
                </div>
                <h3 className="mt-2 text-xl text-ink">{next.title}</h3>
                <div className="mt-4 flex flex-wrap gap-3">
                  {next.unitId ? <LinkButton href={`/courses/${courseOf.get(next.enrolmentId)?.id}/units/${next.unitId}`}>Open the material</LinkButton> : null}
                  <LinkButton href="/timetable" variant="secondary">Timetable</LinkButton>
                </div>
                {missed > 0 ? <p className="mt-3 text-xs text-ink-3">{missed} earlier session{missed === 1 ? "" : "s"} passed without being marked; the timetable offers a catch-up plan.</p> : null}
              </div>
            ) : tt?.plan ? (
              <EmptyState title="Nothing further is scheduled" body="The term's sessions are all in the past or completed. Open the timetable to plan more, or browse the catalogue." action={<LinkButton href="/timetable" variant="secondary">Timetable</LinkButton>} />
            ) : (
              <EmptyState title="No timetable yet" body="Confirm a first term in orientation and the next lecture, tutorial or reading appears here with its exact material." action={<LinkButton href="/onboarding/1" variant="secondary">Orientation</LinkButton>} />
            )}
          </Card>
          <Card>
            <h2 className="text-lg text-ink">Continue where you left off</h2>
            {continueSession ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-ink">
                  {continueSession.sessionKind.replace("_", " ")} in unit {continueSession.unitId} · last active {DateTime.fromJSDate(continueSession.lastActiveAt).setZone(zone).toRelative()}
                </span>
                <LinkButton href={`/sessions/${continueSession.id}`} variant="secondary">Resume</LinkButton>
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-2">No open session. Your reader and workbench resume exactly where you left them.</p>
            )}
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card as="aside">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg text-ink">{director?.name ?? "Director of Studies"}</h2>
              <AiLabel role="Director" />
            </div>
            <p className="mt-2 text-sm text-ink-2">
              {proposals.length > 0
                ? `${proposals.length} proposed change${proposals.length === 1 ? "" : "s"} awaiting your decision on the timetable page.`
                : upcoming.length > 0
                  ? "Your first week is light on purpose: one reading, one tutorial, one attempt. If the schedule is wrong, say so; the timetable moves, not you."
                  : "Your programme is confirmed. Come and talk when you want to change its shape."}
            </p>
            <Link href="/director" className="mt-3 inline-block text-sm text-brass underline underline-offset-4">Open a conversation</Link>
          </Card>
          <Card as="aside">
            <h2 className="text-lg text-ink">Your courses</h2>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {enrolments.filter((e) => e.enrolment.status === "active").map((e) => (
                <li key={e.enrolment.id} className="flex items-center justify-between gap-2">
                  <Link href={`/courses/${e.course.id}`} className="text-ink hover:underline underline-offset-4">{e.course.title}</Link>
                  <Badge>{e.enrolment.mode.replace("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          </Card>
          {profile.immersion !== "quiet" ? (
            <Card as="aside">
              <h2 className="text-lg text-ink">Around the college</h2>
              <p className="mt-2 text-sm text-ink-2">Society seminars and common-room conversations appear here after a real session or two. Nothing happens while you are away.</p>
              <Link href="/common-room" className="mt-3 inline-block text-sm text-brass underline underline-offset-4">Common room</Link>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
