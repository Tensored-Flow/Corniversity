import { ensureProfile } from "@corniversity/db/services/onboarding";
import { endOfTermReview, listExports, portfolio, transcript } from "@corniversity/db/services/records";
import { DateTime } from "luxon";
import Link from "next/link";
import { RenderedHtml } from "@/components/RenderedHtml";
import { Badge, Button, Card, EmptyState, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { requireSession } from "@/lib/session";
import { AutoRefresh } from "../sessions/[id]/AutoRefresh";
import { requestExportAction } from "./actions";

export const metadata = { title: "Records" };

const EXPORTS: { kind: "full" | "notebook" | "records" | "alter_markdown"; label: string; help: string }[] = [
  {
    kind: "alter_markdown",
    label: "Markdown record",
    help: "One readable document: courses, portfolio, every attempt with its outcome, appeals, review, notebook, reading notes.",
  },
  { kind: "records", label: "Records (JSON)", help: "Transcript, portfolio, review, concept states and evidence events." },
  { kind: "notebook", label: "Notebook (JSON)", help: "Every notebook entry and reading note with its source links." },
  { kind: "full", label: "Everything (JSON)", help: "The complete bundle, for import into a fresh installation." },
];

/**
 * Records: an explicitly informal transcript, the portfolio of accepted work and laboratory
 * interpretations, an end-of-term review derived by fixed rules from recorded evidence, and
 * portable exports built from the database by the worker.
 */
export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ requested?: string }> }) {
  const session = await requireSession("/records");
  const { requested } = await searchParams;
  const database = db();
  const ownerId = session.user.id;
  const [rows, items, review, exports, profile] = await Promise.all([
    transcript(database, ownerId),
    portfolio(database, ownerId),
    endOfTermReview(database, ownerId),
    listExports(database, ownerId),
    ensureProfile(database, ownerId),
  ]);
  const zone = profile.timezone;
  const when = (d: Date | null) => (d ? DateTime.fromJSDate(d).setZone(zone).toFormat("d LLL yyyy") : "—");
  const pending = exports.some((e) => e.status === "queued");

  const excerptHtml = await Promise.all(items.map((item) => renderMarkdown(item.excerpt)));
  return (
    <div className="mx-auto w-full max-w-6xl">
      <AutoRefresh active={pending} intervalMs={3000} />
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Records</p>
        <h1 className="mt-1 text-3xl text-ink">Your academic record</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-2">
          An informal record kept by a private, independent, non-accredited institution. It documents what you attempted, what was accepted
          and what the evidence shows; it is not a transcript from a university and confers nothing.
        </p>
      </header>
      {requested ? (
        <div className="mb-4">
          <Notice tone="moss">Export queued. It appears below when the worker has built it.</Notice>
        </div>
      ) : null}

      <section aria-labelledby="transcript-heading">
        <h2 id="transcript-heading" className="text-xl text-ink">
          Courses (informal transcript)
        </h2>
        {rows.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No enrolments yet" body="Take a course from the catalogue; the record starts with the first session." />
          </div>
        ) : (
          <Card className="mt-3 overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-4 py-2">Course</th>
                  <th className="px-4 py-2">Mode</th>
                  <th className="px-4 py-2">Units worked</th>
                  <th className="px-4 py-2">Exercises accepted</th>
                  <th className="px-4 py-2">Concepts</th>
                  <th className="px-4 py-2">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.courseId}-${r.status}-${r.enrolledAt.toISOString()}`} className="border-t border-stone align-top">
                    <td className="px-4 py-2">
                      <Link href={`/courses/${r.courseId}`} className="text-ink hover:underline">
                        <span className="font-mono text-xs text-ink-3">{r.courseId}</span> {r.title}
                      </Link>
                      <p className="text-xs text-ink-3">
                        enrolled {when(r.enrolledAt)} · version {r.version} · {r.status}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-ink-2">{r.mode.replace("_", " ")}</td>
                    <td className="px-4 py-2 text-ink-2">
                      {r.units.withCompletedSessions} of {r.units.prepared} prepared ({r.units.total} in syllabus)
                    </td>
                    <td className="px-4 py-2 text-ink-2">
                      {r.exercises.accepted} of {r.exercises.attempted} attempted
                      {r.exercises.revisionRequested ? ` · ${r.exercises.revisionRequested} awaiting revision` : ""}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {r.concepts.demonstrated ? <Badge tone="moss">{r.concepts.demonstrated} demonstrated</Badge> : null}
                        {r.concepts.practised ? <Badge tone="brass">{r.concepts.practised} practised</Badge> : null}
                        {r.concepts.introduced ? <Badge tone="slate">{r.concepts.introduced} introduced</Badge> : null}
                        {r.concepts.revisit ? <Badge tone="rust">{r.concepts.revisit} revisit</Badge> : null}
                        {r.concepts.unassessed ? <Badge tone="neutral">{r.concepts.unassessed} unassessed</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-ink-2">{when(r.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section aria-labelledby="portfolio-heading" className="mt-10">
        <h2 id="portfolio-heading" className="text-xl text-ink">
          Portfolio
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Accepted work and laboratory interpretations, newest first. Feedback that led to acceptance came from an AI assessor or
          deterministic checks and is provisional.
        </p>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">Nothing accepted yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {items.map((item, i) => (
              <Card key={`${item.kind}-${i}`} as="li">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={item.kind === "accepted_submission" ? "moss" : item.kind === "lab_interpretation" ? "brass" : "neutral"}>
                    {item.kind.replace("_", " ")}
                  </Badge>
                  {item.courseId ? <span className="font-mono text-xs text-ink-3">{item.courseId}</span> : null}
                  <span className="text-xs text-ink-3">{when(item.date)}</span>
                </div>
                <h3 className="mt-1 text-base text-ink">
                  {item.href ? (
                    <Link href={item.href} className="hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </h3>
                <RenderedHtml html={excerptHtml[i] ?? ""} className="mt-1 text-sm text-ink-2" />
              </Card>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="review-heading" className="mt-10">
        <h2 id="review-heading" className="text-xl text-ink">
          End-of-term review
        </h2>
        <p className="mt-1 text-xs text-ink-3">{review.basis}</p>
        {review.courses.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">No active courses to review.</p>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {review.courses.map((c) => (
              <Card key={c.courseId} as="article">
                <h3 className="text-base text-ink">
                  <span className="font-mono text-xs text-ink-3">{c.courseId}</span> {c.title}
                </h3>
                <p className="mt-1 text-sm text-ink-2">{c.progress}</p>
                <dl className="mt-2 text-sm">
                  {c.strengths.length ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-ink-3">Demonstrated</dt>
                      <dd className="text-ink">{c.strengths.join(", ")}</dd>
                    </div>
                  ) : null}
                  {c.gaps.length ? (
                    <div className="mt-1">
                      <dt className="text-xs uppercase tracking-wide text-ink-3">To revisit</dt>
                      <dd className="text-ink">{c.gaps.join(", ")}</dd>
                    </div>
                  ) : null}
                  {c.unfinished.length ? (
                    <div className="mt-1">
                      <dt className="text-xs uppercase tracking-wide text-ink-3">Met but not yet demonstrated</dt>
                      <dd className="text-ink">{c.unfinished.join(", ")}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mt-2 text-sm text-ink">{c.recommendation}</p>
              </Card>
            ))}
          </div>
        )}
        {review.nextTerm.length ? (
          <Card className="mt-4" as="aside">
            <h3 className="text-sm font-medium text-ink">Carried forward</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-ink-2">
              {review.nextTerm.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Card>
        ) : null}
      </section>

      <section aria-labelledby="export-heading" className="mt-10">
        <h2 id="export-heading" className="text-xl text-ink">
          Exports
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Built by the worker from the database, which stays the source of truth. Files are private to your session and are removed thirty
          days after they are built; the record itself stays, so build a fresh export whenever you need one.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EXPORTS.map((e) => (
            <Card key={e.kind} as="div" className="flex flex-col justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-ink">{e.label}</h3>
                <p className="mt-1 text-xs text-ink-2">{e.help}</p>
              </div>
              <form action={requestExportAction}>
                <input type="hidden" name="kind" value={e.kind} />
                <Button type="submit" variant="secondary">
                  Build
                </Button>
              </form>
            </Card>
          ))}
        </div>
        {exports.length ? (
          <ul className="mt-4 flex flex-col gap-1 text-sm">
            {exports.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-panel)] border border-stone bg-paper-2 px-3 py-2"
              >
                <span className="text-ink">
                  {EXPORTS.find((x) => x.kind === e.kind)?.label ?? e.kind} · <span className="text-ink-3">{when(e.createdAt)}</span>
                </span>
                {e.status === "ready" ? (
                  <a href={`/api/records/exports/${e.id}`} className="text-brass underline underline-offset-4">
                    Download
                  </a>
                ) : (
                  <Badge tone={e.status === "failed" ? "rust" : e.status === "expired" ? "neutral" : "brass"}>
                    {e.status === "expired" ? "expired after 30 days" : e.status}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
