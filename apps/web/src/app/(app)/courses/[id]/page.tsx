import { getCourseDetail } from "@corniversity/db/services/catalogue";
import { getEnrolmentForCourse } from "@corniversity/db/services/enrolment";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { ReadinessBadge, readinessHelp, UnitStatusBadge } from "@/components/Readiness";
import { AiLabel, Badge, Card, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { enrolAction, withdrawAction } from "./actions";
import { EnrolControls } from "./EnrolControls";

export default async function CourseFoyerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession(`/courses/${id}`);
  const detail = await getCourseDetail(db(), id);
  if (!detail) notFound();
  const enrolment = await getEnrolmentForCourse(db(), session.user.id, id);
  const { course, version } = detail;
  const prepared = version.readiness === "teaching_ready";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-ink-3">{course.id}</span>
          <ReadinessBadge readiness={version.readiness} />
          <span className="text-xs text-ink-3">
            {detail.units.filter((u) => u.status === "ready").length} of {detail.units.length} units prepared
          </span>
          <Badge>{course.level}</Badge>
          {course.launch ? <Badge tone="brass">Launch course</Badge> : null}
          <span className="text-xs text-ink-3">version {version.version}</span>
        </div>
        <h1 className="mt-2 text-3xl text-ink">{course.title}</h1>
        <p className="mt-3 max-w-prose text-ink-2">{version.purpose}</p>
        <p className="mt-2 max-w-prose text-xs text-ink-3">{readinessHelp(version.readiness)}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-8">
          <section aria-labelledby="about">
            <h2 id="about" className="text-xl text-ink">
              About this course
            </h2>
            <div className="mt-3">
              <Markdown source={version.description} />
            </div>
            {version.externalSyllabusNote ? (
              <Notice tone="slate" title="Adapted study path">
                {version.externalSyllabusNote}
              </Notice>
            ) : null}
            {enrolment && enrolment.version.version !== version.version ? (
              <div className="mt-3">
                <Notice tone="brass" title={`Course updated to version ${version.version}`}>
                  You enrolled under version {enrolment.version.version}. The syllabus has since been updated; everything you submitted and
                  every piece of feedback is kept exactly as it was, and you now see the current units.
                </Notice>
              </div>
            ) : null}
          </section>

          {version.outcomes.length > 0 ? (
            <section aria-labelledby="outcomes">
              <h2 id="outcomes" className="text-xl text-ink">
                What you should be able to do afterwards
              </h2>
              <ul className="mt-3 flex flex-col gap-3">
                {version.outcomes.map((o) => (
                  <li key={o.id} className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4 text-sm">
                    <p className="text-ink">{o.description}</p>
                    <p className="mt-1 text-xs text-ink-3">Evidence expected: {o.evidenceExpected}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="units">
            <h2 id="units" className="text-xl text-ink">
              Syllabus
            </h2>
            {detail.units.length === 0 ? (
              <p className="mt-3 text-sm text-ink-2">No units have been outlined. This course is a proposal.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-2">
                {detail.units.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-panel)] border border-stone bg-paper-2 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-6 font-mono text-xs text-ink-3">{String(u.sequence).padStart(2, "0")}</span>
                      {u.status === "ready" && enrolment ? (
                        <Link href={`/courses/${course.id}/units/${u.id}`} className="text-ink underline-offset-4 hover:underline">
                          {u.title}
                        </Link>
                      ) : (
                        <span className="text-ink">{u.title}</span>
                      )}
                      <UnitStatusBadge status={u.status} />
                    </div>
                    <span className="text-xs text-ink-3">
                      {u.exerciseCount} exercise{u.exerciseCount === 1 ? "" : "s"} · ~{Math.round(u.estimatedMinutes / 60)} h
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {version.assessmentSpecs.length > 0 ? (
            <section aria-labelledby="assessment">
              <h2 id="assessment" className="text-xl text-ink">
                Assessment
              </h2>
              <ul className="mt-3 flex flex-col gap-3">
                {version.assessmentSpecs.map((a) => (
                  <li key={a.id} className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{a.title}</span>
                      <Badge>{a.kind.replace(/_/g, " ")}</Badge>
                      {a.weight !== undefined ? <span className="text-xs text-ink-3">{Math.round(a.weight * 100)}%</span> : null}
                    </div>
                    <p className="mt-1 text-ink-2">{a.description}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-3">
                All feedback is provisional and produced by an AI assessor; appeals are available on every piece of work. Records here are
                informal.
              </p>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          <Card as="aside">
            <h2 className="text-lg text-ink">Your place in this course</h2>
            <div className="mt-3">
              <EnrolControls
                courseId={course.id}
                modesOffered={version.modesOffered}
                prepared={prepared}
                enrolment={
                  enrolment ? { id: enrolment.enrolment.id, mode: enrolment.enrolment.mode, status: enrolment.enrolment.status } : null
                }
                enrolAction={enrolAction}
                withdrawAction={withdrawAction}
              />
            </div>
            <p className="mt-3 text-xs text-ink-3">
              {prepared
                ? `Workload about ${version.workload.typical} hours over the course (${version.workload.minimum}–${version.workload.maximum}).`
                : "Workload will be estimated when the syllabus is prepared; the figure in the catalogue is a placeholder."}
            </p>
          </Card>

          <Card as="aside">
            <h2 className="text-lg text-ink">Sources</h2>
            {detail.primarySources.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">No sources verified yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3 text-sm">
                {detail.primarySources.map(({ source: s, version: v }) => (
                  <li key={s.id}>
                    <a href={s.canonicalUrl} target="_blank" rel="noreferrer" className="text-brass underline underline-offset-4">
                      {s.title}
                    </a>
                    <p className="text-xs text-ink-3">
                      {s.institution ?? s.authors.join(", ")} · {v?.label} · {v?.licence} · verified {v?.verifiedAt}
                    </p>
                  </li>
                ))}
                {detail.supplementalSources.map(({ source: s, version: v }) => (
                  <li key={s.id}>
                    <a href={s.canonicalUrl} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-4">
                      {s.title}
                    </a>
                    <p className="text-xs text-ink-3">supplement · {v?.licence}</p>
                  </li>
                ))}
              </ul>
            )}
            {version.blockers.length > 0 ? (
              <div className="mt-3">
                <Notice tone="rust" title="Still needed">
                  <ul className="list-disc pl-4">
                    {version.blockers.map((b) => (
                      <li key={b.reason}>
                        {b.reason} — {b.resolutionAction}
                      </li>
                    ))}
                  </ul>
                </Notice>
              </div>
            ) : null}
          </Card>

          {detail.tutor ? (
            <Card as="aside">
              <h2 className="text-lg text-ink">Teaching</h2>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-medium text-ink">{detail.tutor.name}</span>
                <AiLabel kind={detail.tutor.title} />
              </div>
              <p className="mt-1 text-sm text-ink-2">{detail.tutor.introduction}</p>
              <p className="mt-2 text-xs text-ink-3">{detail.tutor.style.officeHours}</p>
            </Card>
          ) : null}

          {detail.prerequisites.length > 0 ? (
            <Card as="aside">
              <h2 className="text-lg text-ink">Prerequisites</h2>
              <ul className="mt-3 flex flex-col gap-3 text-sm">
                {detail.prerequisites.map((r) => (
                  <li key={r.id}>
                    <div className="flex items-center gap-2">
                      <Badge tone={r.strength === "hard" ? "rust" : "neutral"}>{r.strength}</Badge>
                    </div>
                    <p className="mt-1 text-ink-2">{r.description}</p>
                    <p className="mt-1 text-xs text-ink-3">Satisfied by any of: {r.alternatives.map((a) => a.label).join("; ")}.</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-3">Audit mode ignores prerequisites. Soft prerequisites are advice, not gates.</p>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
