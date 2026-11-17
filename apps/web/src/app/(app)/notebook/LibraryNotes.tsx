import type { AnnotationKind } from "@corniversity/db/schema/library";
import { listEnrolments } from "@corniversity/db/services/enrolment";
import { listReadingNotes, type ReadingNote } from "@corniversity/db/services/library";
import { libraryNoteSubjects, notesPaper, OPENALEX_FIELD_ID, type PaperNote, paperNotes } from "@corniversity/db/services/notebook";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, Select } from "@/components/ui";
import { db } from "@/lib/db";
import { errorNotice } from "@/lib/notices";
import { createPaperNoteAction, deleteReadingNoteAction } from "./actions";
import { NoteBodyField } from "./NoteBodyField";
import { KIND_OPTIONS } from "./shared";

/** How many notes the library view lists; older ones are reached by search or a filter. */
const LIMIT = 100;

export type LibraryKind = AnnotationKind | "paper";

const KINDS: { value: LibraryKind; label: string }[] = [
  { value: "highlight", label: "Highlights" },
  { value: "note", label: "Page and area notes" },
  { value: "bookmark", label: "Bookmarks" },
  { value: "paper", label: "Paper notes" },
];

const ANNOTATION_LABEL: Record<AnnotationKind, string> = { highlight: "Highlight", note: "Note", bookmark: "Bookmark" };
const SWATCH: Record<string, string> = { brass: "bg-brass", moss: "bg-moss", rust: "bg-rust", slate: "bg-slate", neutral: "bg-stone-2" };

export interface LibraryNotesParams {
  work?: string;
  kind?: string;
  subject?: string;
  q?: string;
}

type Item = { type: "annotation"; at: Date; note: ReadingNote } | { type: "paper"; at: Date; note: PaperNote };

/**
 * The notebook's library view (`/notebook?library=1`, contract §2): every library note, newest
 * first: highlights, page and area notes and bookmarks made in the reader (each reopens its page,
 * where it is edited, and can be deleted here, even when its file was removed),
 * and paper notes (notebook entries linked to a paper). Filters: one paper, a kind, the paper's
 * OpenAlex field, and words. With a paper chosen, *New note for this paper* writes a paper note.
 */
export async function LibraryNotes({
  ownerId,
  params,
  noteError,
}: {
  ownerId: string;
  params: LibraryNotesParams;
  /** A refusal of *New note for this paper*, shown on that form (where the browser lands), or above the notes without one. */
  noteError?: string;
}) {
  const database = db();
  const q = params.q?.trim().slice(0, 300) ?? "";
  const kind = KINDS.some((k) => k.value === params.kind) ? (params.kind as LibraryKind) : undefined;
  const subject = params.subject && OPENALEX_FIELD_ID.test(params.subject) ? params.subject : undefined;
  const workParam = params.work?.trim() ?? "";
  const paper = workParam ? await notesPaper(database, ownerId, workParam) : null;
  // A merged paper's notes are its survivor's.
  if (paper && paper.id !== workParam) redirect(libraryHref({ work: paper.id, kind, subject, q }));
  const unknownPaper = Boolean(workParam) && !paper;
  const workId = paper?.id;
  const [annotations, papers, subjects, enrolments] = await Promise.all([
    unknownPaper || kind === "paper"
      ? Promise.resolve([] as ReadingNote[])
      : listReadingNotes(database, ownerId, {
          query: q || undefined,
          kind: kind as AnnotationKind | undefined,
          workId,
          subject,
          limit: LIMIT,
        }),
    unknownPaper || (kind && kind !== "paper")
      ? Promise.resolve([] as PaperNote[])
      : paperNotes(database, ownerId, { workId, subject, query: q || undefined, limit: LIMIT }),
    libraryNoteSubjects(database, ownerId),
    // The optional course of a new note for this paper (brief §20.3): the courses the owner takes.
    paper ? listEnrolments(database, ownerId) : Promise.resolve([]),
  ]);
  const courses = enrolments.filter((e, i, all) => all.findIndex((o) => o.course.id === e.course.id) === i);
  const items: Item[] = [
    ...annotations.map((note) => ({ type: "annotation" as const, at: note.updatedAt, note })),
    ...papers.map((note) => ({ type: "paper" as const, at: note.entry.updatedAt, note })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, LIMIT);
  const truncated = annotations.length === LIMIT || papers.length === LIMIT;
  const filtered = Boolean(q || kind || subject || workId);
  const href = (patch: Partial<Record<"work" | "kind" | "subject" | "q", string | undefined>>) =>
    libraryHref({ work: workId, kind, subject, q: q || undefined, ...patch });

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* On phones the notes come first and the filters follow them. */}
      <aside className="order-last flex flex-col gap-4 lg:order-first">
        <Card as="div">
          <form method="get" action="/notebook" className="flex flex-col gap-2">
            <input type="hidden" name="library" value="1" />
            {workId ? <input type="hidden" name="work" value={workId} /> : null}
            {kind ? <input type="hidden" name="kind" value={kind} /> : null}
            {subject ? <input type="hidden" name="subject" value={subject} /> : null}
            <label htmlFor="library-notes-search" className="text-sm font-medium text-ink">
              Search library notes
            </label>
            <div className="flex gap-2">
              <input
                id="library-notes-search"
                name="q"
                type="search"
                defaultValue={q}
                maxLength={300}
                className="w-full min-w-0 rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-3 py-1.5 text-sm text-ink"
              />
              <Button type="submit" variant="secondary">
                Go
              </Button>
            </div>
          </form>
        </Card>
        <nav aria-label="Kinds of library notes">
          <Card as="div">
            <h2 className="text-sm font-medium text-ink">Kind</h2>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              <li>
                <Link
                  href={href({ kind: undefined })}
                  aria-current={!kind ? "page" : undefined}
                  className={!kind ? "inline-block py-0.5 font-medium text-ink" : "inline-block py-0.5 text-ink-2 hover:text-ink"}
                >
                  All kinds
                </Link>
              </li>
              {KINDS.map((k) => (
                <li key={k.value}>
                  <Link
                    href={href({ kind: k.value })}
                    aria-current={kind === k.value ? "page" : undefined}
                    className={
                      kind === k.value ? "inline-block py-0.5 font-medium text-ink" : "inline-block py-0.5 text-ink-2 hover:text-ink"
                    }
                  >
                    {k.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </nav>
        {subjects.length ? (
          <nav aria-label="Subjects of the papers">
            <Card as="div">
              <h2 className="text-sm font-medium text-ink">Subject</h2>
              <p className="text-xs text-ink-3">The paper's field, as classified by OpenAlex.</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                <li>
                  <Link
                    href={href({ subject: undefined })}
                    aria-current={!subject ? "page" : undefined}
                    className={!subject ? "inline-block py-0.5 font-medium text-ink" : "inline-block py-0.5 text-ink-2 hover:text-ink"}
                  >
                    All subjects
                  </Link>
                </li>
                {subjects.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={href({ subject: s.id })}
                      aria-current={subject === s.id ? "page" : undefined}
                      className={
                        subject === s.id ? "inline-block py-0.5 font-medium text-ink" : "inline-block py-0.5 text-ink-2 hover:text-ink"
                      }
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </nav>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        {noteError && !paper ? <Notice tone="rust">{errorNotice(noteError)}</Notice> : null}
        {unknownPaper ? (
          <EmptyState
            title="Paper not found"
            body="That paper is not in your library (it may have been deleted; its notebook entries stay, without the link)."
            action={
              <Link href="/notebook?library=1" className="text-sm inline-flex min-h-6 items-center text-brass underline underline-offset-4">
                All library notes
              </Link>
            }
          />
        ) : null}
        {paper ? (
          <Card as="div">
            <p className="text-xs uppercase tracking-wide text-ink-3">Notes for this paper</p>
            <h2 className="mt-1 text-xl text-ink [overflow-wrap:anywhere]">
              <Link href={`/library/papers/${paper.id}`} className="inline-flex min-h-6 items-center hover:underline">
                {paper.title ?? "Untitled paper"}
              </Link>
            </h2>
            <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
              <Link
                href={`/library/papers/${paper.id}`}
                className="inline-flex min-h-6 items-center text-brass underline underline-offset-4"
              >
                Paper page
              </Link>
              <Link href={href({ work: undefined })} className="inline-flex min-h-6 items-center text-brass underline underline-offset-4">
                All library notes
              </Link>
            </p>
          </Card>
        ) : null}

        {unknownPaper ? null : (
          <section aria-labelledby="library-notes-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="library-notes-heading" className="text-lg text-ink">
                {q ? `Library notes matching “${q}”` : "Library notes"}
              </h2>
              <span className="text-xs text-ink-3">{items.length} shown</span>
            </div>
            {truncated ? (
              <p className="mt-1 text-xs text-ink-3">
                Showing the {LIMIT} most recently changed notes of each kind; search, or choose a paper, kind or subject, to find older
                ones.
              </p>
            ) : null}
            {items.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title={filtered ? "No library note matches" : "No library notes yet"}
                  body={
                    filtered
                      ? "Try other words or another filter; search covers notes and highlighted text."
                      : "Highlights, page and area notes and bookmarks you make in the reader, and notes you write for a paper, appear here."
                  }
                />
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {items.map((item) =>
                  item.type === "annotation" ? (
                    <AnnotationItem
                      key={`a-${item.note.id}`}
                      note={item.note}
                      filters={{ work: workId, kind, subject, q: q || undefined }}
                    />
                  ) : (
                    <PaperNoteItem key={`p-${item.note.entry.id}`} note={item.note} />
                  ),
                )}
              </ul>
            )}
          </section>
        )}

        {paper ? (
          <section id="new-note" aria-labelledby="new-note-heading" className="scroll-mt-4">
            <Card as="div">
              <h2 id="new-note-heading" className="text-lg text-ink">
                New note for this paper
              </h2>
              {noteError ? (
                <div className="mt-3">
                  <Notice tone="rust">{errorNotice(noteError)}</Notice>
                </div>
              ) : null}
              <form action={createPaperNoteAction} className="mt-3 grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="workId" value={paper.id} />
                <Field label="Title" htmlFor="paper-note-title">
                  <Input id="paper-note-title" name="title" required maxLength={200} />
                </Field>
                <Field label="Kind" htmlFor="paper-note-kind">
                  <Select id="paper-note-kind" name="kind" defaultValue="note">
                    {KIND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                {courses.length ? (
                  <Field label="Course (optional)" htmlFor="paper-note-course">
                    <Select id="paper-note-course" name="courseId" defaultValue="">
                      <option value="">None</option>
                      {courses.map((e) => (
                        <option key={e.course.id} value={e.course.id}>
                          {e.course.id} · {e.course.title}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <div className="sm:col-span-2">
                  <NoteBodyField id="paper-note-body" label="Note (Markdown with LaTeX)" rows={8} required />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit">Save note</Button>
                </div>
              </form>
            </Card>
          </section>
        ) : unknownPaper ? null : (
          <p className="text-sm text-ink-2">
            A note about one paper starts from its paper page (<em>New note for this paper</em>) or from that paper's notes here.{" "}
            <Link href="/notebook#new-heading" className="text-brass underline underline-offset-4">
              Write a free note
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

/** `/notebook?library=1` with the given filters. */
export function libraryHref(filters: { work?: string; kind?: string; subject?: string; q?: string }): string {
  const params = new URLSearchParams({ library: "1" });
  for (const key of ["work", "kind", "subject", "q"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  return `/notebook?${params.toString()}`;
}

async function AnnotationItem({
  note,
  filters,
}: {
  note: ReadingNote;
  /** The view's filters, so a deletion returns to the same list. */
  filters: { work?: string; kind?: string; subject?: string; q?: string };
}) {
  const removed = note.documentDeleted || !note.assetId;
  const label = ANNOTATION_LABEL[note.kind].toLowerCase();
  const readerHref = note.assetId ? `/library/read/${note.assetId}${note.page ? `?page=${note.page}` : ""}` : null;
  return (
    <Card as="li">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={note.kind === "highlight" ? "brass" : note.kind === "bookmark" ? "slate" : "neutral"}>
          {ANNOTATION_LABEL[note.kind]}
        </Badge>
        {note.color ? (
          <span className="flex items-center gap-1 text-xs text-ink-3">
            <span
              aria-hidden="true"
              className={`inline-block h-3 w-3 rounded-full border border-stone ${SWATCH[note.color] ?? "bg-stone-2"}`}
            />
            {note.color.charAt(0).toUpperCase() + note.color.slice(1)}
          </span>
        ) : null}
        {note.mappingStatus === "needs_repair" && !removed ? <Badge tone="rust">Needs repair</Badge> : null}
      </div>
      {note.selectedText ? (
        <blockquote className="mt-2 border-l-2 border-brass pl-3 text-sm text-ink-2 [overflow-wrap:anywhere]">
          {note.selectedText}
        </blockquote>
      ) : null}
      {note.note ? (
        <div className="mt-2">
          <Markdown source={note.note} className="text-sm [overflow-wrap:anywhere]" />
        </div>
      ) : null}
      <p className="mt-2 text-xs text-ink-3 [overflow-wrap:anywhere]">
        {note.workId ? (
          <Link href={`/library/papers/${note.workId}`} className="text-brass underline underline-offset-4">
            {note.item}
          </Link>
        ) : (
          <span>{note.item}</span>
        )}
        {note.versionLabel ? ` · ${note.versionLabel}` : ""}
        {note.page ? ` · page ${note.page}` : ""} · {note.updatedAt.toISOString().slice(0, 10)}
      </p>
      {removed ? (
        <p className="mt-1 text-xs text-ink-2">The file this note was made on was removed; the note is kept.</p>
      ) : readerHref ? (
        <p className="mt-1 text-sm">
          <Link href={readerHref} className="inline-flex min-h-6 items-center text-brass underline underline-offset-4">
            {note.page ? `Open page ${note.page} in the reader` : "Open in the reader"}
          </Link>
          {note.mappingStatus === "needs_repair" ? (
            <span className="ml-1 text-xs text-ink-2">
              Its exact place could not be confirmed on the file as it is now, so the reader opens the page it was made on and lists it
              under Needs repair.
            </span>
          ) : null}
        </p>
      ) : null}
      {/* Deleting asks for the box first; it is the only way to delete a note whose file was removed. */}
      <details className="mt-1 text-sm">
        <summary className="inline-flex min-h-6 cursor-pointer items-center text-brass underline underline-offset-4">
          Delete<span className="sr-only"> this {label}</span>
        </summary>
        <form action={deleteReadingNoteAction} className="mt-2 flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={note.id} />
          {(["work", "kind", "subject", "q"] as const).map((key) =>
            filters[key] ? <input key={key} type="hidden" name={key} value={filters[key]} /> : null,
          )}
          <label className="flex min-h-6 items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="confirm" value="1" /> I want to delete this {label}
          </label>
          <Button type="submit" variant="danger">
            Delete {label}
          </Button>
        </form>
      </details>
    </Card>
  );
}

async function PaperNoteItem({ note }: { note: PaperNote }) {
  const { entry } = note;
  return (
    <Card as="li">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 text-base text-ink [overflow-wrap:anywhere]">
          <Link href={`/notebook/${entry.id}`} className="inline-flex min-h-6 items-center hover:underline">
            {entry.title}
          </Link>
        </h3>
        <Badge tone="moss">Paper note</Badge>
      </div>
      <div className="mt-2">
        <Markdown source={entry.bodyMarkdown} className="text-sm [overflow-wrap:anywhere]" />
      </div>
      <p className="mt-2 text-xs text-ink-3 [overflow-wrap:anywhere]">
        {entry.scholarlyWorkId ? (
          <Link href={`/library/papers/${entry.scholarlyWorkId}`} className="text-brass underline underline-offset-4">
            {note.workTitle ?? "Untitled paper"}
          </Link>
        ) : null}{" "}
        · updated {entry.updatedAt.toISOString().slice(0, 10)} ·{" "}
        <Link href={`/notebook/${entry.id}#edit-heading`} className="text-brass underline underline-offset-4">
          Edit<span className="sr-only"> {entry.title}</span>
        </Link>
      </p>
    </Card>
  );
}
