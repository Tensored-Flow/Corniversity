import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { listPersonas } from "@corniversity/db/services/catalogue";
import { listEnrolments } from "@corniversity/db/services/enrolment";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { getTimetable } from "@corniversity/db/services/timetable";
import { AiLabel, Badge, Card, LinkButton } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const session = await requireSession("/welcome");
  const profile = await ensureProfile(db(), session.user.id);
  const tt = await getTimetable(db(), session.user.id);
  if (!tt?.plan) redirect("/onboarding/1");
  const [enrolments, personas] = await Promise.all([listEnrolments(db(), session.user.id), listPersonas(db())]);
  const active = enrolments.filter((e) => e.enrolment.status === "active");
  const director = personas.find((p) => p.role === "director");
  const zone = profile.timezone;
  const termStart = DateTime.fromISO(tt.term.startDate, { zone });
  const firstWeek = tt.sessions.filter((s) => DateTime.fromJSDate(s.startsAt).setZone(zone) < termStart.plus({ weeks: 1 }));

  return (
    <div className="mx-auto w-full max-w-4xl">
      <article className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-8 shadow-[var(--shadow)]">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Welcome letter</p>
        <h1 className="mt-2 text-3xl text-ink">Congratulations, {profile.displayName}. Welcome to your first term at Corniversity.</h1>
        <div className="prose-reading mt-6 text-ink-2">
          <p>
            Your programme is confirmed: {active.map((e) => `${e.course.title} (${e.enrolment.mode.replace("_", " ")})`).join("; ")}. It begins on {termStart.toFormat("cccc d LLLL yyyy")} and runs for {tt.term.teachingWeeks} teaching weeks{tt.term.readingWeek ? ", a reading week" : ""}{tt.term.synthesisWeek ? " and a synthesis week" : ""}.
          </p>
          <p>
            The first week is deliberately light: one reading, one tutorial, one attempt at a real problem, a source-backed response, and a clear next session. The point is to find out how the sources read and how the tutorial feels before the load rises. If the timetable is wrong for your life, say so; the timetable moves, not you.
          </p>
          <p>
            Everything here is honest about what it is. Your teachers and any classmates are AI personas and are labelled as such. Feedback is provisional and can be appealed. Your records are informal and carry no accreditation. Progress is shown as evidence of what you have demonstrated, never as a percentage.
          </p>
          <p>
            With warm regards,
            <br />
            {director?.name ?? "The Director of Studies"} <AiLabel role="Director of Studies" />
          </p>
        </div>
      </article>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl text-ink">Your first week</h2>
          {firstWeek.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">Nothing is scheduled in week one; open the timetable to adjust.</p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2">
              {firstWeek.map((s) => {
                const courseId = active.find((e) => e.enrolment.id === s.enrolmentId)?.course.id;
                return (
                  <li key={s.id} className="rounded-[var(--radius-control)] border border-stone bg-paper px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-ink-3">{DateTime.fromJSDate(s.startsAt).setZone(zone).toFormat("ccc d LLL HH:mm")}</span>
                      <Badge>{s.sessionKind.replace("_", " ")}</Badge>
                    </div>
                    {courseId && s.unitId ? (
                      <Link href={`/courses/${courseId}/units/${s.unitId}`} className="mt-1 block text-ink underline-offset-4 hover:underline">
                        {s.title}
                      </Link>
                    ) : (
                      <span className="mt-1 block text-ink">{s.title}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <div className="mt-4">
            <LinkButton href="/timetable" variant="secondary">
              Open the timetable
            </LinkButton>
          </div>
        </Card>
        <Card>
          <h2 className="text-xl text-ink">Your course handbook</h2>
          <dl className="mt-3 flex flex-col gap-3 text-sm">
            <div>
              <dt className="font-medium text-ink">How a unit works</dt>
              <dd className="text-ink-2">Read the lesson with its sources, attempt the exercises in the tutorial, submit when you believe an argument is complete, revise after feedback. Hints are recorded as assistance, never as failure.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">How feedback works</dt>
              <dd className="text-ink-2">Automatic checks run first and are advisory. The AI assessor localises the first substantive gap and records its confidence; low confidence becomes "needs review". Appeal from any feedback card.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">How progress is shown</dt>
              <dd className="text-ink-2">Concepts move from introduced to practised to demonstrated on concrete evidence; a later gap marks a concept to revisit. Time spent is activity, not competence.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Sources</dt>
              <dd className="text-ink-2">Every reading has an exact source and location; courses say which materials they adapt and under which licence. Nothing here is an official delivery of another institution's course.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">If life intervenes</dt>
              <dd className="text-ink-2">Missed sessions produce a small catch-up proposal you confirm or reject. Pause a course from its foyer; completed work is kept.</dd>
            </div>
          </dl>
          <div className="mt-4 flex gap-3">
            <LinkButton href="/onboarding/12">Meet the college</LinkButton>
            <LinkButton href="/campus" variant="secondary">
              Campus
            </LinkButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
