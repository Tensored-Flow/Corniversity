"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { RenderedHtml } from "@/components/RenderedHtml";
import { Badge, Button } from "@/components/ui";

interface RenderedMessage {
  id: string;
  sender: "learner" | "persona" | "system";
  /** What wrote a stored reply: a model's name, or "Scripted demo". */
  producedBy: string | null;
  html: string;
  citations: { tag: string; label: string; locatorId?: string }[];
  labels: string[];
  uncited: number;
}

interface Props {
  sessionId: string;
  exerciseId: string | null;
  personaName: string;
  initialMessages: RenderedMessage[];
  locators: { id: string; label: string }[];
}

const LABEL_TEXT: Record<string, string> = {
  source_backed: "source-backed",
  derived: "derived",
  conjecture: "conjecture",
  needs_checking: "needs checking",
  location_only: "location cited, text not seen",
};

/**
 * The tutor conversation. Replies stream as plain text; once a turn completes the server has
 * validated its citations and stored it, and the panel reloads the stored version.
 */
export function TutorPanel({ sessionId, exerciseId, personaName, initialMessages, locators }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, []);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message) return;
    setInput("");
    setError(null);
    setNotice(null);
    setPending("");
    const response = await fetch("/api/tutor/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, exerciseId, message }),
    });
    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? `The tutor could not reply (${response.status}).`);
      setPending(null);
      // A refused run (provider blocked, or a limit reached) has already stored the message, so
      // show it; anything else may not have, so the text goes back into the box.
      if (response.status === 402 || response.status === 409) router.refresh();
      else setInput(message);
      return;
    }
    setPendingLabel(response.headers.get("x-provider-label"));
    const warning = response.headers.get("x-budget-warning");
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
    setPendingLabel(null);
    if (warning) setNotice(decodeURIComponent(warning));
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div ref={scroller} className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-1" aria-live="polite">
        {initialMessages.length === 0 && pending === null ? (
          <p className="text-sm text-ink-2">
            Ask about the material or about your attempt. {personaName} works from what you have tried and gives hints before answers; ask
            directly if you want a full explanation.
          </p>
        ) : null}
        {initialMessages.map((m) => (
          <div
            key={m.id}
            className={[
              "rounded-[var(--radius-panel)] px-3 py-2 text-sm",
              m.sender === "learner" ? "ml-6 border border-stone bg-paper" : "border border-stone bg-paper-3/60",
            ].join(" ")}
          >
            <p className="mb-1 text-[0.65rem] uppercase tracking-wide text-ink-3">
              {m.sender === "learner" ? "You" : `${personaName}${m.producedBy ? ` · ${m.producedBy}` : ""}`}
            </p>
            <RenderedHtml html={m.html} className="text-sm" />
            {m.sender === "persona" && (m.labels.length || m.citations.length || m.uncited) ? (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {m.labels.map((l) => (
                  <Badge key={l} tone={l === "source_backed" ? "moss" : l === "needs_checking" ? "rust" : "neutral"}>
                    {LABEL_TEXT[l] ?? l}
                  </Badge>
                ))}
                {m.citations.map((c) => (
                  <span key={c.tag} id={`cite-${c.tag}`} className="text-[0.7rem] text-ink-3">
                    {c.tag}: {c.label}
                  </span>
                ))}
                {m.uncited > 0 ? <Badge tone="rust">{m.uncited} unverifiable citation removed</Badge> : null}
              </div>
            ) : null}
          </div>
        ))}
        {pending !== null ? (
          <div className="rounded-[var(--radius-panel)] border border-stone bg-paper-3/60 px-3 py-2 text-sm">
            <p className="mb-1 text-[0.65rem] uppercase tracking-wide text-ink-3">
              {personaName}
              {pendingLabel ? ` · ${pendingLabel}` : ""} · writing
            </p>
            <p className="whitespace-pre-wrap text-ink-2">{pending || "…"}</p>
          </div>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-rust">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-xs text-ink-3">{notice}</p> : null}
      <form onSubmit={send} className="flex flex-col gap-2">
        <label htmlFor="tutor-input" className="sr-only">
          Message to the tutor
        </label>
        <textarea
          id="tutor-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="Ask a question or describe where you are stuck"
          className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-focus"
          disabled={pending !== null}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.7rem] text-ink-3">{locators.length} source locations available to cite</span>
          <Button type="submit" variant="secondary" disabled={pending !== null || input.trim().length === 0}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
