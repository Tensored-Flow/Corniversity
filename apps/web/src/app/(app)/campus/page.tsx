import { listEnrolments } from "@corniversity/db/services/enrolment";
import { runningExams } from "@corniversity/db/services/exams";
import { listOpenSessions } from "@corniversity/db/services/learning";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { courseProgress, unitLabels } from "@corniversity/db/services/sheets";
import { DateTime } from "luxon";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, LinkButton } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Your courses" };

/** Home: the courses being taken, with progress, plus whatever is in progress. */
export default async function CoursesHomePage() {
  const session = await requireSession("/campus");
  const ownerId = session.user.id;
  const profile = await ensureProfile(db(), ownerId);
  if (!profile.onboardingCompletedAt) redirect(`/onboarding/${profile.onboardingStep}`);
  const [enrolments, open, exams] = await Promise.all([
    listEnrolments(db(), ownerId),
    listOpenSessions(db(), ownerId),
    runningExams(db(), ownerId),
  ]);
  const taking = enrolments.filter((e) => e.enrolment.status !== "withdrawn");
  const progress = await Promise.all(taking.map((e) => courseProgress(db(), ownerId, e.course.id)));
  const last = open[0] ?? null;
  const labels = await unitLabels(db(), last ? [last.unitId] : []);
  const lastUnit = last ? labels.get(last.unitId) : undefined;
  const lastCourse = lastUnit ? taking.find((e) => e.course.id === lastUnit.courseId)?.course : undefined;
  const zone = profile.timezone;
  const titleOf = new Map(taking.map((e) => [e.course.id, e.course.title]));

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl text-ink">Your courses</h1>
        <LinkButton href="/catalogue" variant="secondary">
          Find courses
        </LinkButton>
      </header>

      {exams.length > 0 || (last && lastUnit) ? (
        <div className="mb-6 flex flex-col gap-2">
          {exams.map((x) => (
            <Card key={x.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-ink">
                  Exam in progress: {titleOf.get(x.courseId) ?? x.courseId} · ends{" "}
                  {DateTime.fromJSDate(x.deadlineAt).setZone(zone).toFormat("HH:mm")}
                </span>
                <LinkButton href={`/exams/${x.id}`}>Continue exam</LinkButton>
              </div>
            </Card>
          ))}
          {last && lastUnit ? (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-ink">
                  Continue: {lastCourse ? `${lastCourse.title} · ` : ""}Unit {lastUnit.sequence}, {lastUnit.title}
                </span>
                <LinkButton href={`/sessions/${last.id}`} variant="secondary">
                  Resume
                </LinkButton>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {taking.length === 0 ? (
        <EmptyState
          title="No courses yet"
          body="Pick any number from the catalogue."
          action={<LinkButton href="/catalogue">Open the catalogue</LinkButton>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {taking.map(({ course, enrolment }, i) => {
            const units = progress[i] ?? [];
            const problems = units.reduce((s, u) => s + u.problems, 0);
            const done = units.reduce((s, u) => s + u.done, 0);
            return (
              <li key={enrolment.id}>
                <Link
                  href={`/courses/${course.id}`}
                  className="block h-full rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4 hover:border-brass"
                >
                  <span className="font-mono text-xs text-ink-3">{course.id}</span>
                  <span className="mt-1 block text-lg text-ink">{course.title}</span>
                  <span className="mt-2 block text-xs text-ink-2">
                    {units.length} unit{units.length === 1 ? "" : "s"} ready · {done}/{problems} problems done
                  </span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-paper-3" aria-hidden="true">
                    <span className="block h-full bg-brass" style={{ width: `${problems ? Math.round((done / problems) * 100) : 0}%` }} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
