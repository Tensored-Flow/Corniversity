"use client";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { RenderedHtml } from "@/components/RenderedHtml";
import {
  ANNOTATION_COLORS,
  type AnnotationColor,
  annotationLabel,
  COLOR_LABELS,
  type PendingAnchor,
  type ReaderAnnotation,
} from "./annotations";
import { deleteAnnotationRequest, updateAnnotationRequest } from "./api";

const control =
  "inline-flex items-center justify-center rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-0.5 text-sm text-ink hover:bg-paper-3 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";
// At least 24 px high, so a finger can hit it on a phone (WCAG 2.5.8).
const quiet =
  "inline-flex min-h-6 items-center text-sm text-brass underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50";
const field = "w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-2 py-1.5 text-sm text-ink";

export interface NotesPanelProps {
  /** Drawn and listed annotations, in reading order. */
  notes: ReaderAnnotation[];
  /** Annotations that are not drawn: marked for repair, or measured on a file whose pages differ. */
  repair: ReaderAnnotation[];
  /** Why the pages differ (the drift check's findings), when they do. */
  problems: string[];
  pageLabel: (pageIndex: number) => string;
  /** 1-based page in view. */
  currentPage: number;
  ready: boolean;
  /** A highlight or bookmark request is in flight. */
  busy: boolean;
  bookmarked: boolean;
  composer: PendingAnchor | null;
  composerColor: AnnotationColor;
  onComposerColor: (color: AnnotationColor) => void;
  onToggleBookmark: () => void;
  onPageNote: () => void;
  onMarkArea: () => void;
  /** Saves the composer's note; resolves to an error sentence, or null when saved. */
  onSaveComposer: (note: string) => Promise<string | null>;
  onCancelComposer: () => void;
  onJump: (annotation: ReaderAnnotation) => void;
  onChanged: (annotation: ReaderAnnotation) => void;
  onDeleted: (id: string) => void;
  /** The last bookmark or creation failure, shown above the list. */
  error: string | null;
}

/**
 * The Notes panel: add a bookmark, a page note or an area note on the page in view; finish a note
 * started from a selection; list the Document's highlights, notes and bookmarks with Go to, Edit and
 * Delete. Notes render through the server's Markdown and KaTeX sanitiser; quotes are plain text.
 * Annotations that cannot be drawn on this file are listed apart under Needs repair.
 */
export function NotesPanel(props: NotesPanelProps) {
  const { notes, repair, problems, pageLabel, currentPage, ready, composer } = props;
  const listHeading = useRef<HTMLHeadingElement>(null);
  const pageNoteButton = useRef<HTMLButtonElement>(null);
  // A saved or deleted note takes its controls away; keyboard focus moves to the list instead of being lost.
  const focusList = () => listHeading.current?.focus();
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-2">
        <p className="text-ink-2">On {ready ? pageLabel(currentPage - 1) : "this page"}:</p>
        <div className="flex flex-wrap gap-2">
          {/* aria-disabled while a request runs, so the button keeps keyboard focus (the reader ignores a second press). */}
          <button
            type="button"
            className={control}
            onClick={props.onToggleBookmark}
            disabled={!ready}
            aria-disabled={props.busy || undefined}
          >
            {props.bookmarked ? "Remove bookmark" : "Bookmark page"}
          </button>
          <button ref={pageNoteButton} type="button" className={control} onClick={props.onPageNote} disabled={!ready}>
            Page note
          </button>
          <button type="button" className={control} onClick={props.onMarkArea} disabled={!ready}>
            Mark area
          </button>
        </div>
        {props.error ? (
          <p role="alert" className="rounded-[var(--radius-control)] border border-rust/30 bg-rust-soft px-2 py-1 text-rust">
            {props.error}
          </p>
        ) : null}
      </div>

      {composer ? (
        <Composer
          key={`${composer.source}-${composer.pageIndex}-${composer.anchor.rects.join(";")}`}
          pending={composer}
          pageLabel={pageLabel}
          color={props.composerColor}
          onColor={props.onComposerColor}
          onSave={async (note) => {
            const failure = await props.onSaveComposer(note);
            if (!failure) focusList();
            return failure;
          }}
          onCancel={() => {
            props.onCancelComposer();
            pageNoteButton.current?.focus();
          }}
        />
      ) : null}

      <section aria-labelledby="reader-notes-list" className="flex flex-col gap-2">
        <h3 id="reader-notes-list" ref={listHeading} tabIndex={-1} className="text-sm font-medium text-ink">
          All notes ({notes.length})
        </h3>
        {notes.length === 0 ? (
          <p className="text-ink-3">Nothing yet. Select text in the pages to highlight it or note it.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((a) => (
              <NoteItem
                key={a.id}
                annotation={a}
                pageLabel={pageLabel}
                onJump={props.onJump}
                onChanged={props.onChanged}
                onDeleted={(id) => {
                  props.onDeleted(id);
                  focusList();
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {repair.length ? (
        <section aria-labelledby="reader-notes-repair" className="flex flex-col gap-2 border-t border-stone pt-3">
          <h3 id="reader-notes-repair" className="text-sm font-medium text-ink">
            Needs repair ({repair.length})
          </h3>
          <p className="text-ink-2">
            These were made on a file whose pages differ from the one shown, so they are not drawn. Each keeps its original page.
          </p>
          {problems.length ? (
            <ul className="list-disc pl-5 text-ink-2">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          <ul className="flex flex-col gap-3">
            {repair.map((a) => (
              <NoteItem
                key={a.id}
                annotation={a}
                pageLabel={pageLabel}
                onJump={props.onJump}
                onChanged={props.onChanged}
                onDeleted={(id) => {
                  props.onDeleted(id);
                  focusList();
                }}
                repair
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Composer({
  pending,
  pageLabel,
  color,
  onColor,
  onSave,
  onCancel,
}: {
  pending: PendingAnchor;
  pageLabel: (pageIndex: number) => string;
  color: AnnotationColor;
  onColor: (color: AnnotationColor) => void;
  onSave: (note: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => textRef.current?.focus(), []);
  const what = pending.source === "selection" ? "Note" : pending.source === "area" ? "Area note" : "Page note";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim()) {
      setError("Write a note before saving.");
      textRef.current?.focus();
      return;
    }
    setBusy(true);
    const failure = await onSave(note);
    setBusy(false);
    if (failure) {
      setError(failure);
      // Saving disabled the buttons, which drops keyboard focus; the draft takes it back.
      textRef.current?.focus();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-stone bg-paper p-3"
      aria-labelledby="reader-composer-title"
    >
      <h3 id="reader-composer-title" className="text-sm font-medium text-ink">
        {what} on {pageLabel(pending.pageIndex)}
      </h3>
      {pending.quote ? (
        <blockquote className="max-h-24 overflow-y-auto border-l-2 border-brass pl-2 text-ink-2">{pending.quote}</blockquote>
      ) : null}
      <label htmlFor="reader-composer-note" className="text-ink-2">
        Note
      </label>
      <textarea
        id="reader-composer-note"
        ref={textRef}
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Markdown and LaTeX are fine"
        className={field}
      />
      {pending.anchor.rects.length ? <ColorSelect id="reader-composer-colour" value={color} onChange={onColor} /> : null}
      {error ? (
        <p role="alert" className="text-rust">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" className={control} disabled={busy}>
          {busy ? "Saving…" : "Save note"}
        </button>
        <button type="button" className={control} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ColorSelect({ id, value, onChange }: { id: string; value: AnnotationColor; onChange: (color: AnnotationColor) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-ink-2">
        Colour
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as AnnotationColor)}
        className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-0.5 text-sm text-ink"
      >
        {ANNOTATION_COLORS.map((c) => (
          <option key={c} value={c}>
            {COLOR_LABELS[c]}
          </option>
        ))}
      </select>
    </div>
  );
}

function NoteItem({
  annotation: a,
  pageLabel,
  onJump,
  onChanged,
  onDeleted,
  repair = false,
}: {
  annotation: ReaderAnnotation;
  pageLabel: (pageIndex: number) => string;
  onJump: (annotation: ReaderAnnotation) => void;
  onChanged: (annotation: ReaderAnnotation) => void;
  onDeleted: (id: string) => void;
  repair?: boolean;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [draft, setDraft] = useState(a.noteMarkdown);
  const [color, setColor] = useState<AnnotationColor>(a.color ?? "brass");
  const [conflict, setConflict] = useState<ReaderAnnotation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Edit, Cancel, Delete and Keep each replace the controls that were pressed: keyboard focus moves to
  // the control that takes their place (the draft, Edit, Keep, Delete) instead of falling to the page.
  const [focusNext, setFocusNext] = useState<"draft" | "edit" | "delete" | "keep" | null>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!focusNext) return;
    ({ draft: draftRef, edit: editRef, delete: deleteRef, keep: keepRef })[focusNext].current?.focus();
    setFocusNext(null);
  }, [focusNext]);
  const label = annotationLabel(a);
  const coloured = Boolean(a.anchor?.rects.length);
  const editId = `reader-note-edit-${a.id}`;
  const confirmId = `reader-note-delete-${a.id}`;

  function startEdit() {
    setDraft(a.noteMarkdown);
    setColor(a.color ?? "brass");
    setConflict(null);
    setError(null);
    setMode("edit");
    setFocusNext("draft");
  }

  function backToView() {
    setMode("view");
    setFocusNext("edit");
  }

  async function save(expectedUpdatedAt: string) {
    setBusy(true);
    setError(null);
    const result = await updateAnnotationRequest({
      id: a.id,
      noteMarkdown: draft,
      ...(coloured ? { color } : {}),
      expectedUpdatedAt,
    });
    setBusy(false);
    if (result.ok) {
      setConflict(null);
      backToView();
      onChanged(result.value);
      return;
    }
    if ("conflict" in result) setConflict(result.conflict);
    else setError(result.message);
    setFocusNext("draft");
  }

  async function remove() {
    setBusy(true);
    const result = await deleteAnnotationRequest(a.id);
    setBusy(false);
    if (result.ok) onDeleted(a.id);
    else {
      setError(result.message);
      setFocusNext("keep");
    }
  }

  return (
    <li className="flex flex-col gap-1 border-b border-stone pb-3 last:border-b-0" data-annotation={a.id}>
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
        {coloured ? (
          <span className={`reader-swatch reader-swatch-${a.color ?? (a.kind === "highlight" ? "brass" : "slate")}`} aria-hidden="true" />
        ) : null}
        <span className="font-medium text-ink-2">{label}</span>
        <span>{repair ? `originally ${pageLabel(a.pageIndex)}` : pageLabel(a.pageIndex)}</span>
        {coloured && a.color ? <span>{COLOR_LABELS[a.color]}</span> : null}
      </p>
      {a.anchor?.quote || a.selectedText ? (
        <blockquote className="max-h-24 overflow-y-auto border-l-2 border-stone-2 pl-2 text-ink-2">
          {a.anchor?.quote ?? a.selectedText}
        </blockquote>
      ) : null}
      {a.quoteMatched === false ? <p className="text-xs text-ink-3">This text was not found in the extracted text of that page.</p> : null}

      {mode === "edit" ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={editId} className="text-ink-2">
            {conflict ? "Your draft" : "Note"}
          </label>
          <textarea
            id={editId}
            ref={draftRef}
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className={field}
          />
          {coloured ? <ColorSelect id={`${editId}-colour`} value={color} onChange={setColor} /> : null}
          {conflict ? (
            <div
              role="alert"
              className="flex flex-col gap-1 rounded-[var(--radius-control)] border border-brass/30 bg-brass-soft px-2 py-1.5"
            >
              <p className="text-brass-strong">
                This note was changed elsewhere after you opened it. Both versions are shown; nothing was overwritten.
              </p>
              <p className="text-xs font-medium text-ink-2">Saved version</p>
              {conflict.noteHtml ? (
                <RenderedHtml html={conflict.noteHtml} className="text-sm" />
              ) : (
                <p className="text-ink-3">(no note text)</p>
              )}
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-rust">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {conflict ? (
              <>
                <button type="button" className={control} disabled={busy} onClick={() => void save(conflict.updatedAt)}>
                  Save my draft over it
                </button>
                <button
                  type="button"
                  className={control}
                  disabled={busy}
                  onClick={() => {
                    onChanged(conflict);
                    setConflict(null);
                    backToView();
                  }}
                >
                  Use the saved version
                </button>
              </>
            ) : (
              <>
                <button type="button" className={control} disabled={busy} onClick={() => void save(a.updatedAt)}>
                  {busy ? "Saving…" : "Save"}
                </button>
                <button type="button" className={control} disabled={busy} onClick={backToView}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {a.noteHtml ? <RenderedHtml html={a.noteHtml} className="text-sm" /> : null}
          {error ? (
            <p role="alert" className="text-rust">
              {error}
            </p>
          ) : null}
          {mode === "confirm-delete" ? (
            // Keep takes focus first, so a second Enter never deletes; the group's name is the question.
            // biome-ignore lint/a11y/useSemanticElements: a fieldset's legend cannot sit on one line with the buttons it names
            <div role="group" aria-labelledby={confirmId} className="flex flex-wrap items-center gap-2">
              <span id={confirmId} className="text-ink-2">
                Delete this {label.toLowerCase()}?
              </span>
              <button type="button" className={control} disabled={busy} onClick={() => void remove()}>
                Delete
              </button>
              <button
                ref={keepRef}
                type="button"
                className={control}
                disabled={busy}
                onClick={() => {
                  setMode("view");
                  setFocusNext("delete");
                }}
              >
                Keep
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button type="button" className={quiet} onClick={() => onJump(a)}>
                Go to {pageLabel(a.pageIndex)}
              </button>
              <button
                ref={editRef}
                type="button"
                className={quiet}
                onClick={startEdit}
                aria-label={`Edit ${label.toLowerCase()} on ${pageLabel(a.pageIndex)}`}
              >
                Edit
              </button>
              <button
                ref={deleteRef}
                type="button"
                className={quiet}
                onClick={() => {
                  setMode("confirm-delete");
                  setFocusNext("keep");
                }}
                aria-label={`Delete ${label.toLowerCase()} on ${pageLabel(a.pageIndex)}`}
              >
                Delete
              </button>
            </div>
          )}
        </>
      )}
    </li>
  );
}
