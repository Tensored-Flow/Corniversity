import { listEnrolments } from "@corniversity/db/services/enrolment";
import { getConceptStates } from "@corniversity/db/services/evidence";
import { listOpenSessions } from "@corniversity/db/services/learning";
import { listIssues } from "@corniversity/db/services/learning-issues";
import Link from "next/link";
import { ReadinessBadge } from "@/components/Readiness";
import { Badge, Card, EmptyState, LinkButton } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { ProgrammeMap } from "./ProgrammeMap";
import { ReviewSection } from "./ReviewSection";

export const metadata = { title: "My Studies" };

const STATE_TONE: Record<string, "neutral" | "brass" | "moss" | "rust" | "slate"> = {
  unassessed: "neutral",
  introduced: "slate",
  practised: "brass",
  demonstrated: "moss",
  revisit: "rust",
};

export default async function StudiesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await requireSession("/studies");
  const [enrolments, open, states, issues] = await Promise.all([
    listEnrolments(db(), session.user.id),
    listOpenSessions(db(), session.user.id),
    getConceptStates(db(), session.user.id),
    listIssues(db(), session.user.id, { current: true }),
  ]);
  const active = enrolments.filter((e) => e.enrolment.status !== "withdrawn");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">My Studies</p>
        <h1 className="mt-1 text-3xl text-ink">Your courses</h1>
      </header>

      {active.length === 0 ? (
        <EmptyState
          title="No courses yet"
          body="Browse the catalogue and take a course, or let the director propose a first term during orientation."
          action={<LinkButton href="/catalogue">Open the catalogue</LinkButton>}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {active.map(({ enrolment, course, version }) => (
            <li key={enrolment.id}>
              <Card>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-ink-3">{course.id}</span>
                  <ReadinessBadge readiness={version.readiness} />
                  <Badge tone="brass">{enrolment.mode.replace("_", " ")}</Badge>
                  {enrolment.status !== "active" ? <Badge>{enrolment.status}</Badge> : null}
                </div>
                <h2 className="mt-2 text-xl text-ink">
                  <Link href={`/courses/${course.id}`} className="hover:underline underline-offset-4">
                    {course.title}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-ink-2">{version.purpose}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {open.length > 0 ? (
        <section className="mt-10" aria-labelledby="continue">
          <h2 id="continue" className="text-xl text-ink">
            Continue where you left off
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {open.slice(0, 5).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sessions/${s.id}`}
                  className="flex items-center justify-between rounded-[var(--radius-panel)] border border-stone bg-paper-2 px-4 py-3 text-sm hover:border-stone-2"
                >
                  <span className="text-ink">
                    {s.sessionKind.replace("_", " ")} · unit {s.unitId}
                  </span>
                  <span className="text-xs text-ink-3">
                    last active {s.lastActiveAt.toLocaleString("en-GB", { timeZone: "Europe/London" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="issues">
        <h2 id="issues" className="text-xl text-ink">
          Issues to revisit
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Specific points in your work, proposed by an automatic check or written by you. They describe a piece of work, not you.{" "}
          <Link href="/notebook#issues-heading" className="text-brass underline underline-offset-4">
            Open them in the notebook
          </Link>
          .
        </p>
        {issues.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">None open.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {issues.slice(0, 5).map(({ issue }) => (
              <li key={issue.id} className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 px-4 py-2">
                <span className="text-xs uppercase tracking-wide text-ink-3">{issue.status}</span> {issue.claim}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReviewSection ownerId={session.user.id} error={error} />

      <section className="mt-10" aria-labelledby="evidence">
        <h2 id="evidence" className="text-xl text-ink">
          Evidence of understanding
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          States are derived from concrete attempts and readings, never from time spent. Reading introduces; an accepted unassisted attempt
          demonstrates; a later gap marks a concept to revisit.
        </p>
        {states.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">Nothing recorded yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {states.map(({ state, concept }) => (
              <li key={concept.id} className="flex items-center gap-2 rounded-full border border-stone bg-paper-2 py-1 pl-3 pr-1 text-sm">
                <span className="text-ink">{concept.title}</span>
                <Badge tone={STATE_TONE[state.state] ?? "neutral"}>{state.state}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ProgrammeMap ownerId={session.user.id} />
    </div>
  );
}
