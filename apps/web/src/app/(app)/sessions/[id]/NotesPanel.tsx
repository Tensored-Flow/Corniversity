"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { addSessionNoteAction } from "./actions";
import { useWorkspace } from "./Workspace";

interface Note {
  id: string;
  title: string;
  excerpt: string;
  kind: string;
  resolved: boolean;
  when: string;
}

/**
 * Notes and questions written in this session, linked to it in the notebook. A note can point at
 * the selected passage, or at a moment of an external lecture typed as minutes:seconds (no
 * external player is controlled, so the time is the learner's own).
 */
export function NotesPanel({ sessionId, notes, videos }: { sessionId: string; notes: Note[]; videos: { id: string; label: string }[] }) {
  const router = useRouter();
  const { selection, noteRequest } = useWorkspace();
  const [kind, setKind] = useState<"note" | "question">("note");
  const [body, setBody] = useState("");
  const [attach, setAttach] = useState(true);
  const [timestamp, setTimestamp] = useState("");
  const [video, setVideo] = useState(videos[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const lessonSelection = selection?.origin === "lesson" ? selection : null;

  useEffect(() => {
    if (noteRequest) {
      setAttach(true);
      ref.current?.focus();
    }
  }, [noteRequest]);

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setSaved(false);
          startTransition(async () => {
            const r = await addSessionNoteAction(sessionId, {
              kind,
              body,
              selection: attach && lessonSelection ? lessonSelection.text : null,
              timestamp: timestamp.trim() || null,
              locatorId: timestamp.trim() ? video || null : null,
              locatorLabel: videos.find((v) => v.id === video)?.label ?? null,
            });
            if (!r.ok) setError(r.error ?? "The note was not saved.");
            else {
              setBody("");
              setTimestamp("");
              setSaved(true);
              router.refresh();
            }
          });
        }}
      >
        <fieldset className="flex gap-3 text-sm">
          <legend className="sr-only">Kind</legend>
          <label className="flex items-center gap-1">
            <input type="radio" name="note-kind" checked={kind === "note"} onChange={() => setKind("note")} /> Note
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="note-kind" checked={kind === "question"} onChange={() => setKind("question")} /> Open question
          </label>
        </fieldset>
        {lessonSelection ? (
          <label className="flex items-start gap-2 text-xs text-ink-2">
            <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} className="mt-0.5" />
            <span className="line-clamp-2">Quote the selected passage: “{lessonSelection.text}”</span>
          </label>
        ) : null}
        <label htmlFor="note-body" className="sr-only">
          Note text
        </label>
        <textarea
          id="note-body"
          ref={ref}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder={kind === "question" ? "What do you want to understand?" : "Write a note (Markdown and LaTeX work)"}
          className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 text-sm text-ink"
        />
        {videos.length ? (
          <div className="flex flex-wrap items-end gap-2 text-xs">
            <label className="flex flex-col gap-1">
              <span className="text-ink-2">Lecture moment (mm:ss, optional)</span>
              <input
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                inputMode="numeric"
                placeholder="12:34"
                className="w-24 rounded-[var(--radius-control)] border border-stone-2 bg-paper px-2 py-1 text-sm"
              />
            </label>
            {videos.length > 1 ? (
              <label className="flex flex-col gap-1">
                <span className="text-ink-2">In</span>
                <select
                  value={video}
                  onChange={(e) => setVideo(e.target.value)}
                  className="rounded-[var(--radius-control)] border border-stone-2 bg-paper px-2 py-1 text-sm"
                >
                  {videos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Button type="submit" variant="secondary" disabled={pending || body.trim().length < 2}>
            {kind === "question" ? "Save question" : "Save note"}
          </Button>
          <span className="text-xs text-ink-3" aria-live="polite">
            {pending ? "Saving…" : saved ? "Saved on the server, in your notebook." : ""}
          </span>
        </div>
        {error ? <Notice tone="rust">{error}</Notice> : null}
      </form>
      <div>
        <h3 className="text-sm font-medium text-ink">From this session</h3>
        {notes.length === 0 ? <p className="mt-1 text-xs text-ink-3">Nothing yet.</p> : null}
        <ul className="mt-2 flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-[var(--radius-control)] border border-stone bg-paper px-3 py-2 text-xs">
              <Link href={`/notebook/${n.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                {n.title}
              </Link>
              <span className="ml-1 text-ink-3">
                · {n.when}
                {n.kind === "question" ? (n.resolved ? " · resolved" : " · open") : ""}
              </span>
              <p className="mt-1 line-clamp-2 text-ink-2">{n.excerpt}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
