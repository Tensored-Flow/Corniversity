import { getUnitDetail } from "@corniversity/db/services/catalogue";
import { getEnrolmentForCourse } from "@corniversity/db/services/enrolment";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LocatorLink } from "@/components/LocatorLink";
import { Markdown } from "@/components/Markdown";
import { UnitStatusBadge } from "@/components/Readiness";
import { Badge, Button, Card, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { startActivityAction } from "./actions";

const ASSESSED_KINDS = new Set(["tutorial", "problem_class", "oral", "project", "lab"]);

export default async function UnitPage({ params }: { params: Promise<{ id: string; unitId: string }> }) {
  const { id, unitId } = await params;
  const session = await requireSession(`/courses/${id}/units/${unitId}`);
  const detail = await getUnitDetail(db(), unitId);
  if (!detail || detail.course.id !== id) notFound();
  const enrolment = await getEnrolmentForCourse(db(), session.user.id, id);
  if (!enrolment) redirect(`/courses/${id}`);
  const { unit, exercises, locators } = detail;
  const locatorById = new Map(locators.map((l) => [l.id, l]));
  const mode = enrolment.enrolment.mode;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-3">
        <Link href={`/courses/${id}`} className="hover:text-ink">
          {detail.course.id} {detail.course.title}
        </Link>
        <span className="mx-2">/</span>
        <span>Unit {unit.sequence}</span>
      </nav>
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <UnitStatusBadge status={unit.status} />
          <Badge>{mode.replace("_", " ")}</Badge>
          <span className="text-xs text-ink-3">about {Math.round((unit.estimatedMinutes / 60) * 10) / 10} hours in total</span>
        </div>
        <h1 className="mt-2 text-3xl text-ink">{unit.title}</h1>
        <p className="mt-3 max-w-prose text-ink-2">{unit.summary}</p>
      </header>

      {unit.status !== "ready" ? (
        <Notice tone="neutral" title="This unit is an outline">
          The reading list is verified, but the lesson, exercises and feedback for this unit have not been prepared yet. Nothing is
          generated when you click Start; the unit is prepared through the content pipeline first.
        </Notice>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-8">
          <section aria-labelledby="objectives">
            <h2 id="objectives" className="text-xl text-ink">
              By the end of this unit
            </h2>
            <ul className="mt-3 list-disc pl-5 text-sm text-ink-2">
              {unit.objectives.map((o) => (
                <li key={o.id} className="mb-1">
                  {o.description}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="lesson">
            <h2 id="lesson" className="text-xl text-ink">
              Lesson
            </h2>
            <div className="mt-3">
              <Markdown source={unit.lessonMarkdown} />
            </div>
          </section>

          <section aria-labelledby="activities">
            <h2 id="activities" className="text-xl text-ink">
              Activities
            </h2>
            <ol className="mt-3 flex flex-col gap-3">
              {unit.activities.map((a) => {
                const assessed = ASSESSED_KINDS.has(a.sessionKind);
                const allowed = unit.status === "ready" && (mode === "enrolled" || !assessed);
                return (
                  <li key={a.id}>
                    <Card>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={assessed ? "brass" : "neutral"}>{a.sessionKind.replace("_", " ")}</Badge>
                            <span className="text-xs text-ink-3">{a.estimatedMinutes} min</span>
                          </div>
                          <h3 className="mt-1 text-lg text-ink">{a.title}</h3>
                          <p className="mt-1 text-sm text-ink-2">{a.instructions}</p>
                          {a.exerciseIds.length > 0 ? (
                            <p className="mt-2 text-xs text-ink-3">
                              Exercises: {a.exerciseIds.map((eid) => exercises.find((e) => e.id === eid)?.title ?? eid).join("; ")}
                            </p>
                          ) : null}
                        </div>
                        <form action={startActivityAction}>
                          <input type="hidden" name="unitId" value={unit.id} />
                          <input type="hidden" name="activityId" value={a.id} />
                          <input type="hidden" name="courseId" value={id} />
                          <Button type="submit" disabled={!allowed} variant={assessed ? "primary" : "secondary"}>
                            {allowed ? "Start" : mode !== "enrolled" && assessed ? "Enrol to attempt" : "Not prepared"}
                          </Button>
                        </form>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ol>
          </section>

          {unit.misconceptions.length > 0 ? (
            <section aria-labelledby="watch">
              <h2 id="watch" className="text-xl text-ink">
                Watch for
              </h2>
              <ul className="mt-3 flex flex-col gap-3">
                {unit.misconceptions.map((m) => (
                  <li key={m.claim} className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4 text-sm">
                    <p className="text-ink-2">
                      <span className="font-medium text-rust">Tempting claim:</span> {m.claim}
                    </p>
                    <p className="mt-1 text-ink">
                      <span className="font-medium text-moss">Correction:</span> {m.correction}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          <Card as="aside">
            <h2 className="text-lg text-ink">Preparation</h2>
            <ol className="mt-3 flex flex-col gap-3 text-sm">
              {unit.preparation.map((p) => {
                const loc = locatorById.get(p.locatorId);
                return (
                  <li key={p.locatorId}>
                    <p className="text-ink-2">{p.description}</p>
                    {loc ? (
                      <p className="mt-1">
                        <LocatorLink label={loc.label} locator={loc.payload} />
                      </p>
                    ) : null}
                    {p.estimatedMinutes ? <p className="text-xs text-ink-3">{p.estimatedMinutes} min</p> : null}
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-xs text-ink-3">
              Sources open in a new tab. Locators were verified on the date shown in the source record.
            </p>
          </Card>
          <Card as="aside">
            <h2 className="text-lg text-ink">Exit check</h2>
            <p className="mt-2 text-sm text-ink-2">{unit.exitCheck.description}</p>
          </Card>
          <div className="flex justify-between text-sm">
            {detail.previous ? (
              <Link href={`/courses/${id}/units/${detail.previous.id}`} className="text-brass underline underline-offset-4">
                ← Unit {detail.previous.sequence}
              </Link>
            ) : (
              <span />
            )}
            {detail.next ? (
              <Link href={`/courses/${id}/units/${detail.next.id}`} className="text-brass underline underline-offset-4">
                Unit {detail.next.sequence} →
              </Link>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
