import { getUnitDetail } from "@corniversity/db/services/catalogue";
import { getEnrolmentForCourse } from "@corniversity/db/services/enrolment";
import { listUnitVisuals } from "@corniversity/db/services/visuals";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LocatorLink } from "@/components/LocatorLink";
import { Markdown } from "@/components/Markdown";
import { Button, LinkButton, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { errorNotice } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import { startActivityAction, startUnitWorkAction } from "./actions";

const link = "text-brass underline underline-offset-4";

/** A unit's lecture notes, with its problem sheet and tutorial one click away. */
export default async function UnitNotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; unitId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, unitId } = await params;
  const { error } = await searchParams;
  const session = await requireSession(`/courses/${id}/units/${unitId}`);
  const detail = await getUnitDetail(db(), unitId);
  if (!detail || detail.course.id !== id) notFound();
  const enrolment = await getEnrolmentForCourse(db(), session.user.id, id);
  if (!enrolment) redirect(`/courses/${id}`);
  const { unit, exercises, locators } = detail;
  const locatorById = new Map(locators.map((l) => [l.id, l]));
  const visuals = await listUnitVisuals(db(), session.user.id, unitId);
  const ready = unit.status === "ready";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-3">
        <Link href={`/courses/${id}`} className="hover:text-ink">
          {detail.course.title}
        </Link>
        <span className="mx-2">/</span>
        <span>Unit {unit.sequence}</span>
      </nav>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl text-ink">{unit.title}</h1>
        {ready ? (
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/courses/${id}/units/${unitId}/sheet`}>Problem sheet ({exercises.length})</LinkButton>
            <form action={startUnitWorkAction}>
              <input type="hidden" name="unitId" value={unit.id} />
              <input type="hidden" name="courseId" value={id} />
              <Button type="submit" variant="secondary">
                Tutorial
              </Button>
            </form>
          </div>
        ) : null}
      </header>

      {error ? (
        <div className="mb-4">
          <Notice tone="rust">{errorNotice(error)}</Notice>
        </div>
      ) : null}

      {ready ? (
        // A wide formula scrolls inside the notes instead of widening the page on a phone.
        <article aria-label="Lecture notes" className="min-w-0 overflow-x-auto">
          <Markdown source={unit.lessonMarkdown} />
        </article>
      ) : (
        <Notice tone="neutral" title="Not prepared yet">
          Its readings are listed below.{" "}
          <Link href={`/courses/${id}/prepare`} className={link}>
            Prepare it
          </Link>
        </Notice>
      )}

      <div className="mt-8 flex flex-col gap-3">
        {unit.misconceptions.length > 0 ? (
          <details className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4">
            <summary className="cursor-pointer text-sm text-ink">Common mistakes ({unit.misconceptions.length})</summary>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {unit.misconceptions.map((m) => (
                <li key={m.claim}>
                  <p className="text-ink-2">
                    <span className="font-medium text-rust">Wrong:</span> {m.claim}
                  </p>
                  <p className="text-ink">
                    <span className="font-medium text-moss">Right:</span> {m.correction}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {unit.preparation.length > 0 ? (
          <details className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4" open={!ready}>
            <summary className="cursor-pointer text-sm text-ink">Readings ({unit.preparation.length})</summary>
            <ol className="mt-3 flex flex-col gap-2 text-sm">
              {unit.preparation.map((p) => {
                const loc = locatorById.get(p.locatorId);
                return (
                  <li key={p.locatorId}>
                    <span className="text-ink-2">{p.description}</span>
                    {loc ? (
                      <>
                        {" "}
                        <LocatorLink label={loc.label} locator={loc.payload} />
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </details>
        ) : null}

        {visuals.length > 0 ? (
          <details className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4">
            <summary className="cursor-pointer text-sm text-ink">Visual explanations ({visuals.length})</summary>
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {visuals.map((v) => (
                <li key={v.slug}>
                  <Link href={`/visuals/${v.slug}`} className={link}>
                    {v.title}
                  </Link>
                  {v.gate.open ? null : <span className="text-xs text-ink-3"> · opens after you attempt the problem it solves</span>}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {ready && unit.activities.length > 0 ? (
          <details className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4">
            <summary className="cursor-pointer text-sm text-ink">All activities ({unit.activities.length})</summary>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {unit.activities.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink">
                    {a.title} <span className="text-xs text-ink-3">· {a.sessionKind.replace("_", " ")}</span>
                  </span>
                  <form action={startActivityAction}>
                    <input type="hidden" name="unitId" value={unit.id} />
                    <input type="hidden" name="activityId" value={a.id} />
                    <input type="hidden" name="courseId" value={id} />
                    <Button type="submit" variant="quiet">
                      Start
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <nav aria-label="Units" className="mt-8 flex justify-between text-sm">
        {detail.previous ? (
          <Link href={`/courses/${id}/units/${detail.previous.id}`} className={link}>
            ← Unit {detail.previous.sequence}
          </Link>
        ) : (
          <span />
        )}
        {detail.next ? (
          <Link href={`/courses/${id}/units/${detail.next.id}`} className={link}>
            Unit {detail.next.sequence} →
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
