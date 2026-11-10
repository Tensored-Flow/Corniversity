import { listEnrolments } from "@corniversity/db/services/enrolment";
import { listReadingNotes } from "@corniversity/db/services/library";
import { countEntries, listEntries, listTags, type NotebookKind, questionsShelf, searchEntries } from "@corniversity/db/services/notebook";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { createEntryAction, toggleResolvedAction } from "./actions";
import { IssuesSection } from "./IssuesSection";
import { excerpt, KIND_LABEL, KIND_OPTIONS, KindBadge } from "./shared";

export const metadata = { title: "Notebook" };

const KINDS = Object.keys(KIND_LABEL) as NotebookKind[];

/**
 * The notebook: every durable thought the learner keeps (definitions, theorems, examples, proof
 * attempts, calculations, questions, notes), searchable, tagged, linked to courses and exact
 * sources, with a standing shelf of questions not yet resolved. The database is the record;
 * exports under Records are derived from it.
 */
/** How many entries one listing shows; older ones are reached by search or a filter. */
const LIST_LIMIT = 100;

export default async function NotebookPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; tag?: string; course?: string; error?: string; deleted?: string }>;
}) {
  const session = await requireSession("/notebook");
  const params = await searchParams;
  const database = db();
  const ownerId = session.user.id;
  const kind = KINDS.includes(params.kind as NotebookKind) ? (params.kind as NotebookKind) : undefined;
  const [entries, questions, tags, counts, enrolments, readingNotes] = await Promise.all([
    params.q
      ? searchEntries(database, ownerId, params.q)
      : listEntries(database, ownerId, { kind, tag: params.tag, courseId: params.course, limit: LIST_LIMIT }),
    questionsShelf(database, ownerId),
    listTags(database, ownerId),
    countEntries(database, ownerId),
    listEnrolments(database, ownerId),
    listReadingNotes(database, ownerId, params.q),
  ]);
  const filterHref = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: params.q, kind: params.kind, tag: params.tag, course: params.course, ...patch }))
      if (v) next.set(k, v);
    const s = next.toString();
    return `/notebook${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Notebook</p>
        <h1 className="mt-1 text-3xl text-ink">Your notebook</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-2">
          {counts.total} entries · {counts.openQuestions} open question{counts.openQuestions === 1 ? "" : "s"}. Markdown and LaTeX; every
          entry can carry tags, a course and exact source links. Nothing here is generated for you.
        </p>
        {!params.q && entries.length === LIST_LIMIT ? (
          <p className="mt-1 max-w-prose text-xs text-ink-3" data-testid="notebook-limit">
            Showing the {LIST_LIMIT} most recently updated entries; search, or choose a kind, tag or course, to find older ones.
          </p>
        ) : null}
      </header>
      {params.error ? (
        <div className="mb-4">
          <Notice tone="rust">{params.error}</Notice>
        </div>
      ) : null}
      {params.deleted ? (
        <div className="mb-4">
          <Notice tone="moss">Entry deleted.</Notice>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-4">
          <Card as="div">
            <form method="get" className="flex flex-col gap-2">
              <label htmlFor="nb-search" className="text-sm font-medium text-ink">
                Search
              </label>
              <div className="flex gap-2">
                <input
                  id="nb-search"
                  name="q"
                  defaultValue={params.q ?? ""}
                  placeholder="e.g. completeness"
                  className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-3 py-1.5 text-sm text-ink"
                />
                <Button type="submit" variant="secondary">
                  Go
                </Button>
              </div>
            </form>
          </Card>
          <Card as="nav" aria-label="Kinds">
            <h2 className="text-sm font-medium text-ink">Kind</h2>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              <li>
                <Link href={filterHref({ kind: undefined, q: undefined })} className={!kind ? "text-ink" : "text-ink-2 hover:text-ink"}>
                  All
                </Link>
              </li>
              {KINDS.map((k) => (
                <li key={k}>
                  <Link href={filterHref({ kind: k, q: undefined })} className={kind === k ? "text-ink" : "text-ink-2 hover:text-ink"}>
                    {KIND_LABEL[k].label}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          {tags.length ? (
            <Card as="nav" aria-label="Tags">
              <h2 className="text-sm font-medium text-ink">Tags</h2>
              <ul className="mt-2 flex flex-wrap gap-1">
                {tags.map((t) => (
                  <li key={t.tag}>
                    <Link
                      href={filterHref({ tag: params.tag === t.tag ? undefined : t.tag, q: undefined })}
                      className={[
                        "rounded-full border px-2 py-0.5 text-xs",
                        params.tag === t.tag ? "border-brass bg-brass-soft text-brass-strong" : "border-stone text-ink-2 hover:text-ink",
                      ].join(" ")}
                    >
                      {t.tag} <span className="text-ink-3">{t.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {enrolments.length ? (
            <Card as="nav" aria-label="Courses">
              <h2 className="text-sm font-medium text-ink">Course</h2>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {enrolments.map((e) => (
                  <li key={e.enrolment.id}>
                    <Link
                      href={filterHref({ course: params.course === e.course.id ? undefined : e.course.id, q: undefined })}
                      className={params.course === e.course.id ? "text-ink" : "text-ink-2 hover:text-ink"}
                    >
                      <span className="font-mono text-xs text-ink-3">{e.course.id}</span> {e.course.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>

        <div className="flex flex-col gap-6">
          <IssuesSection ownerId={ownerId} />
          {questions.length ? (
            <Card as="section" aria-labelledby="questions-heading">
              <h2 id="questions-heading" className="text-lg text-ink">
                Questions you have not resolved
              </h2>
              <p className="mt-1 text-xs text-ink-3">A question survives across courses until you mark it resolved.</p>
              <ul className="mt-3 flex flex-col gap-2">
                {questions.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                    <div>
                      <Link href={`/notebook/${q.id}`} className="text-ink hover:underline">
                        {q.title}
                      </Link>
                      <p className="text-xs text-ink-3">
                        {q.courseId ?? "no course"} · {q.createdAt.toISOString().slice(0, 10)}
                      </p>
                    </div>
                    <form action={toggleResolvedAction}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="resolved" value="1" />
                      <Button type="submit" variant="quiet">
                        Mark resolved
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <section aria-labelledby="entries-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="entries-heading" className="text-lg text-ink">
                {params.q ? `Results for “${params.q}”` : "Entries"}
              </h2>
              <span className="text-xs text-ink-3">{entries.length} shown</span>
            </div>
            {entries.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title={params.q ? "Nothing matches" : "No entries yet"}
                  body={
                    params.q
                      ? "Try another word; search covers titles and bodies."
                      : "Write a definition in your own words, a question you cannot yet answer, or record a laboratory interpretation from a session."
                  }
                />
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {entries.map((e) => (
                  <Card key={e.id} as="li">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-base text-ink">
                        <Link href={`/notebook/${e.id}`} className="hover:underline">
                          {e.title}
                        </Link>
                      </h3>
                      <div className="flex flex-wrap items-center gap-1">
                        <KindBadge kind={e.kind} />
                        {e.kind === "question" && e.resolved ? <Badge tone="moss">resolved</Badge> : null}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-ink-2">{excerpt(e.bodyMarkdown)}</p>
                    <p className="mt-2 text-xs text-ink-3">
                      {e.courseId ? `${e.courseId} · ` : ""}
                      {e.tags.length ? `${e.tags.join(", ")} · ` : ""}
                      {e.sourceLinks.length ? `${e.sourceLinks.length} source link${e.sourceLinks.length === 1 ? "" : "s"} · ` : ""}
                      updated {e.updatedAt.toISOString().slice(0, 10)}
                    </p>
                  </Card>
                ))}
              </ul>
            )}
          </section>

          {readingNotes.length ? (
            <Card as="section" aria-labelledby="reading-notes-heading">
              <h2 id="reading-notes-heading" className="text-lg text-ink">
                Reading notes
              </h2>
              <p className="mt-1 text-xs text-ink-3">Written in the reading room; each one opens the page it was made on.</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {readingNotes.map((n) => (
                  <li key={n.id} className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 px-3 py-2">
                    <p className="text-ink">{n.note}</p>
                    <p className="mt-1 text-xs text-ink-3">
                      {n.assetId ? (
                        <Link
                          href={`/library/read/${n.assetId}${n.page ? `?page=${n.page}` : ""}`}
                          className="text-brass underline underline-offset-4"
                        >
                          {n.item}
                          {n.page ? `, PDF page ${n.page}` : ""}
                        </Link>
                      ) : (
                        <span>{n.item} (item removed; note kept)</span>
                      )}
                      {" · "}
                      {n.createdAt.toISOString().slice(0, 10)}
                      {n.mappingStatus === "needs_repair" ? " · needs repair" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card as="section" aria-labelledby="new-heading">
            <h2 id="new-heading" className="text-lg text-ink">
              New entry
            </h2>
            <form action={createEntryAction} className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="nb-title">
                <Input id="nb-title" name="title" required maxLength={200} />
              </Field>
              <Field label="Kind" htmlFor="nb-kind">
                <Select id="nb-kind" name="kind" defaultValue="note">
                  {KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tags (comma or space separated)" htmlFor="nb-tags">
                <Input id="nb-tags" name="tags" maxLength={300} />
              </Field>
              <Field label="Course" htmlFor="nb-course">
                <Select id="nb-course" name="courseId" defaultValue="">
                  <option value="">None</option>
                  {enrolments
                    .filter((e, i, all) => all.findIndex((o) => o.course.id === e.course.id) === i)
                    .map((e) => (
                      <option key={e.course.id} value={e.course.id}>
                        {e.course.id} · {e.course.title}
                      </option>
                    ))}
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Body (Markdown with LaTeX)" htmlFor="nb-body">
                  <Textarea id="nb-body" name="body" rows={8} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Save entry</Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
