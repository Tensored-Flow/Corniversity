import { EXAM_DEFAULTS, EXAM_LIMITS } from "@corniversity/core/exams/exam";
import { getCourseDetail } from "@corniversity/db/services/catalogue";
import { getEnrolmentForCourse } from "@corniversity/db/services/enrolment";
import { examOverview } from "@corniversity/db/services/exams";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { courseProgress } from "@corniversity/db/services/sheets";
import { DateTime } from "luxon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { ReadinessBadge } from "@/components/Readiness";
import { Badge, Button, Card, Field, Input, LinkButton, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { errorNotice } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import { startExamAction } from "../../exams/actions";
import { leaveCourseAction, takeCourseAction } from "./actions";
import { startUnitWorkAction } from "./units/[unitId]/actions";

const unitLink = "text-brass underline-offset-4 hover:underline";

/** A course: its units as rows (notes, problem sheet, tutorial), then its exam. */
export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await requireSession(`/courses/${id}`);
  const ownerId = session.user.id;
  const detail = await getCourseDetail(db(), id);
  if (!detail) notFound();
  const { course, version } = detail;
  const enrolment = await getEnrolmentForCourse(db(), ownerId, id);
  const [progress, exams] = enrolment
    ? await Promise.all([courseProgress(db(), ownerId, id), examOverview(db(), ownerId, id)])
    : [[], null];
  const zone = (await ensureProfile(db(), ownerId)).timezone;
  const done = new Map(progress.map((p) => [p.unitId, p]));
  const ready = detail.units.filter((u) => u.status === "ready").length;
  const outlined = detail.units.length - ready;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
          <span className="font-mono">{course.id}</span>
          <Badge>{course.level}</Badge>
          <ReadinessBadge readiness={version.readiness} />
          <span>
            {ready} of {detail.units.length} units ready
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl text-ink">{course.title}</h1>
          {enrolment ? (
            <form action={leaveCourseAction}>
              <input type="hidden" name="courseId" value={course.id} />
              <input type="hidden" name="enrolmentId" value={enrolment.enrolment.id} />
              <Button type="submit" variant="quiet">
                Leave course
              </Button>
            </form>
          ) : ready > 0 ? (
            <form action={takeCourseAction}>
              <input type="hidden" name="courseId" value={course.id} />
              <Button type="submit">Take this course</Button>
            </form>
          ) : null}
        </div>
        <p className="mt-2 max-w-prose text-ink-2">{version.purpose}</p>
      </header>

      {error ? (
        <div className="mb-4">
          <Notice tone="rust">{errorNotice(error)}</Notice>
        </div>
      ) : null}

      <section aria-labelledby="units">
        <h2 id="units" className="sr-only">
          Units
        </h2>
        {detail.units.length === 0 ? (
          <p className="text-sm text-ink-2">No units yet: this course is a proposal.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-stone rounded-[var(--radius-panel)] border border-stone bg-paper-2">
            {detail.units.map((u) => {
              const p = done.get(u.id);
              const open = u.status === "ready" && enrolment;
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <span className="w-6 font-mono text-xs text-ink-3">{u.sequence}</span>
                  <span className={`min-w-0 flex-1 ${u.status === "ready" ? "text-ink" : "text-ink-3"}`}>{u.title}</span>
                  {open ? (
                    <span className="flex flex-wrap items-center gap-3 text-sm">
                      <Link href={`/courses/${course.id}/units/${u.id}`} className={unitLink}>
                        Notes
                      </Link>
                      <Link href={`/courses/${course.id}/units/${u.id}/sheet`} className={unitLink}>
                        Problem sheet ({u.exerciseCount})
                      </Link>
                      <form action={startUnitWorkAction}>
                        <input type="hidden" name="unitId" value={u.id} />
                        <input type="hidden" name="courseId" value={course.id} />
                        <button type="submit" className={unitLink}>
                          Tutorial
                        </button>
                      </form>
                      <span className="w-12 text-right text-xs text-ink-3" title="Problems done">
                        {p ? `${p.done}/${p.problems}` : ""}
                      </span>
                    </span>
                  ) : u.status === "ready" ? (
                    <span className="text-xs text-ink-3">Take the course to open</span>
                  ) : (
                    <span className="text-xs text-ink-3">Not prepared yet</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {outlined > 0 ? (
          <p className="mt-2 text-sm text-ink-2">
            {outlined} unit{outlined === 1 ? "" : "s"} not prepared yet.{" "}
            <Link href={`/courses/${course.id}/prepare`} className="text-brass underline underline-offset-4">
              Prepare them
            </Link>
          </p>
        ) : null}
      </section>

      {exams ? (
        <section aria-labelledby="exam" className="mt-8">
          <Card>
            <h2 id="exam" className="text-lg text-ink">
              Exam
            </h2>
            {exams.running ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-ink">
                  In progress · ends {DateTime.fromJSDate(exams.running.deadlineAt).setZone(zone).toFormat("HH:mm")}
                </span>
                <LinkButton href={`/exams/${exams.running.id}`}>Continue exam</LinkButton>
              </div>
            ) : exams.available === 0 ? (
              <p className="mt-2 text-sm text-ink-2">No unseen problems left. Prepare more units to sit another exam.</p>
            ) : (
              <form action={startExamAction} className="mt-2 flex flex-wrap items-end gap-3">
                <input type="hidden" name="courseId" value={course.id} />
                <p className="w-full text-sm text-ink-2">
                  Timed and closed-book: problems you haven't tried, no tutor or hints. {exams.available} available.
                </p>
                <Field label="Questions" htmlFor="exam-questions">
                  <Input
                    id="exam-questions"
                    name="questions"
                    type="number"
                    min={EXAM_LIMITS.minQuestions}
                    max={exams.maxQuestions}
                    defaultValue={Math.min(EXAM_DEFAULTS.questions, exams.maxQuestions)}
                  />
                </Field>
                <Field label="Minutes" htmlFor="exam-minutes">
                  <Input
                    id="exam-minutes"
                    name="minutes"
                    type="number"
                    min={EXAM_LIMITS.minMinutes}
                    max={EXAM_LIMITS.maxMinutes}
                    defaultValue={EXAM_DEFAULTS.minutes}
                  />
                </Field>
                <Button type="submit">Start exam</Button>
              </form>
            )}
            {exams.past.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {exams.past.map((x) => (
                  <li key={x.id}>
                    <Link href={`/exams/${x.id}`} className={unitLink}>
                      {DateTime.fromJSDate(x.startedAt).setZone(zone).toFormat("d LLL yyyy, HH:mm")} · {x.exerciseIds.length} question
                      {x.exerciseIds.length === 1 ? "" : "s"}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </section>
      ) : null}

      <details className="mt-8 rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4">
        <summary className="cursor-pointer text-sm text-ink">About this course</summary>
        <div className="mt-3 flex flex-col gap-4 text-sm">
          <Markdown source={version.description} />
          {version.outcomes.length > 0 ? (
            <div>
              <h3 className="font-medium text-ink">Outcomes</h3>
              <ul className="mt-1 list-disc pl-5 text-ink-2">
                {version.outcomes.map((o) => (
                  <li key={o.id}>{o.description}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {detail.prerequisites.length > 0 ? (
            <div>
              <h3 className="font-medium text-ink">Prerequisites</h3>
              <ul className="mt-1 list-disc pl-5 text-ink-2">
                {detail.prerequisites.map((r) => (
                  <li key={r.id}>
                    {r.description} <span className="text-ink-3">({r.strength})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {detail.primarySources.length > 0 ? (
            <div>
              <h3 className="font-medium text-ink">Sources</h3>
              <ul className="mt-1 flex flex-col gap-1">
                {[...detail.primarySources, ...detail.supplementalSources].map(({ source: s, version: v }) => (
                  <li key={s.id}>
                    <a href={s.canonicalUrl} target="_blank" rel="noreferrer" className={unitLink}>
                      {s.title}
                    </a>{" "}
                    <span className="text-xs text-ink-3">{v?.licence}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
