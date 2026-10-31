import { listEnrolments } from "@corniversity/db/services/enrolment";
import { getConceptStates } from "@corniversity/db/services/evidence";
import { listOpenSessions } from "@corniversity/db/services/learning";
import { dueRevisionItems, revisionLoad } from "@corniversity/db/services/revision";
import Link from "next/link";
import { ReadinessBadge } from "@/components/Readiness";
import { Badge, Card, EmptyState, LinkButton } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { reviewRevisionAction } from "./actions";

export const metadata = { title: "My Studies" };

const STATE_TONE: Record<string, "neutral" | "brass" | "moss" | "rust" | "slate"> = {
  unassessed: "neutral",
  introduced: "slate",
  practised: "brass",
  demonstrated: "moss",
  revisit: "rust",
};

export default async function StudiesPage() {
  const session = await requireSession("/studies");
  const [enrolments, open, states, due, load] = await Promise.all([
    listEnrolments(db(), session.user.id),
    listOpenSessions(db(), session.user.id),
    getConceptStates(db(), session.user.id),
    dueRevisionItems(db(), session.user.id),
    revisionLoad(db(), session.user.id),
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

      <section className="mt-10" aria-labelledby="revision">
        <h2 id="revision" className="text-xl text-ink">
          Revision due
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Definition prompts created when you complete a reading, capped at {load.cap} a week from your hours ceiling ({load.dueThisWeek}{" "}
          due this week, {load.total} in all). Recalling a definition reschedules it; it is not evidence of understanding.
        </p>
        {due.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">Nothing due now.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {due.map((item) => (
              <li key={item.id} className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-ink-3">{item.conceptTitle}</p>
                <p className="mt-1 text-sm text-ink">{item.prompt}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["recalled", "shaky", "forgot"] as const).map((outcome) => (
                    <form key={outcome} action={reviewRevisionAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="outcome" value={outcome} />
                      <button
                        type="submit"
                        className="rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-1 text-xs text-ink hover:bg-paper-3"
                      >
                        {outcome === "recalled" ? "Recalled it" : outcome === "shaky" ? "Shaky" : "Forgot"}
                      </button>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

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
    </div>
  );
}
