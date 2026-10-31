"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Button, Notice } from "@/components/ui";

interface Props {
  assetId: string;
  physicalIndex: number;
  pageLabel: string;
  personaName: string;
  ask: { allowed: boolean; reason?: string };
  saveAnnotation: (form: FormData) => Promise<void>;
}

/**
 * Selection-aware tools for the reading room. Selecting text inside the page captures it for a
 * note or a question. Questions stream from the server; the server alone decides whether the
 * passage may be discussed and says why not when it may not.
 */
export function ReaderTools({ assetId, physicalIndex, pageLabel, personaName, ask, saveAnnotation }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const container = document.getElementById("page-text");
      const node = selection.anchorNode;
      if (!container || !node || !container.contains(node)) return;
      const text = selection.toString().trim();
      if (text.length >= 3) setSelected(text.slice(0, 4000));
    };
    document.addEventListener("mouseup", onSelection);
    document.addEventListener("keyup", onSelection);
    return () => {
      document.removeEventListener("mouseup", onSelection);
      document.removeEventListener("keyup", onSelection);
    };
  }, []);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !question.trim()) return;
    setError(null);
    setPending("");
    const response = await fetch("/api/library/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId, physicalIndex, selectedText: selected, question: question.trim() }),
    });
    if (!response.ok || !response.body) {
      const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      setError(body.message ?? body.error ?? `No reply (${response.status}).`);
      setPending(null);
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      setPending(accumulated);
    }
    setPending(null);
    setQuestion("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="selection-heading">
        <h3 id="selection-heading" className="text-sm font-medium text-ink">
          Selected passage
        </h3>
        {selected ? (
          <blockquote className="mt-1 max-h-32 overflow-y-auto border-l-2 border-brass pl-3 text-sm text-ink-2">{selected}</blockquote>
        ) : (
          <p className="mt-1 text-sm text-ink-3">Select text in the page to annotate it or ask about it.</p>
        )}
      </section>

      <form action={saveAnnotation} className="flex flex-col gap-2">
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="physicalIndex" value={physicalIndex} />
        <input type="hidden" name="selectedText" value={selected} />
        <label htmlFor="note" className="text-sm font-medium text-ink">
          Note on {pageLabel}
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-focus"
          placeholder="Markdown and LaTeX are fine"
        />
        <div>
          <Button type="submit" variant="secondary">
            Save note
          </Button>
        </div>
      </form>

      <section aria-labelledby="ask-heading">
        <h3 id="ask-heading" className="text-sm font-medium text-ink">
          Ask about this passage
        </h3>
        {ask.allowed ? (
          <form onSubmit={send} className="mt-1 flex flex-col gap-2">
            <label htmlFor="question" className="sr-only">
              Question for {personaName}
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-focus"
              placeholder={selected ? `Ask ${personaName} about the selected passage` : "Select a passage first"}
              disabled={!selected || pending !== null}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.7rem] text-ink-3">Only the selected passage and this page are sent.</span>
              <Button type="submit" variant="secondary" disabled={!selected || !question.trim() || pending !== null}>
                Ask
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-1">
            <Notice tone="neutral">{ask.reason}</Notice>
          </div>
        )}
        {error ? (
          <div className="mt-2">
            <Notice tone="rust">{error}</Notice>
          </div>
        ) : null}
        {pending !== null ? (
          <div className="mt-2 rounded-[var(--radius-panel)] border border-stone bg-paper-3/60 px-3 py-2 text-sm">
            <p className="mb-1 text-[0.65rem] uppercase tracking-wide text-ink-3">{personaName} · writing</p>
            <p className="whitespace-pre-wrap text-ink-2">{pending || "…"}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
