"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { RenderedHtml } from "@/components/RenderedHtml";
import { Badge, Button } from "@/components/ui";
import { DictationButton } from "@/components/voice/DictationButton";
import { ReadAloud } from "@/components/voice/ReadAloud";
import { type HelpMode, useWorkspace } from "./Workspace";

/** Appends dictated text to what is already written, with a space between. */
const append = (text: string) => (prev: string) => (prev === "" || /\s$/.test(prev) ? `${prev}${text}` : `${prev} ${text}`);

const MODES: { mode: HelpMode; label: string; describe: string }[] = [
  { mode: "question", label: "Question", describe: "Ask about the material or your work." },
  { mode: "small_hint", label: "Small hint", describe: "One small direction, no solution." },
  { mode: "discuss_approach", label: "Discuss my approach", describe: "Its structure and assumptions, without replacing it." },
  { mode: "check_step", label: "Check this step", describe: "Only the lines you selected in your attempt." },
  { mode: "full_explanation", label: "Full explanation", describe: "A complete explanation, recorded as assisted study." },
];

interface Preview {
  decision: { allowed: true } | { allowed: false; reason: string };
  attached: string[];
  notAttached: string[];
}

interface RenderedMessage {
  id: string;
  sender: "learner" | "persona" | "system";
  /** What wrote a stored reply: a model's name, or "Scripted demo". */
  producedBy: string | null;
  html: string;
  /** The reply as plain text for reading aloud, formulas replaced by spoken markers. */
  spoken: string;
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
  const [mode, setMode] = useState<HelpMode>("question");
  const [scope, setScope] = useState<"selection" | "unit">("selection");
  const [preview, setPreview] = useState<Preview | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { selection, setSelection, helpRequest, voiceAllowed } = useWorkspace();

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, []);

  // A help button on the attempt prepares the request here, for the learner to inspect and send.
  useEffect(() => {
    if (!helpRequest) return;
    setMode(helpRequest.mode);
    inputRef.current?.focus();
  }, [helpRequest]);

  const request = { sessionId, exerciseId, mode, selection: selection ?? null, scope };
  const requestKey = JSON.stringify(request);
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch("/api/tutor/context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: requestKey,
        signal: controller.signal,
      })
        .then((r) => (r.ok ? (r.json() as Promise<Preview>) : null))
        .then((p) => setPreview(p))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [requestKey]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message && mode === "question") return;
    setInput("");
    setError(null);
    setNotice(null);
    setPending("");
    const response = await fetch("/api/tutor/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...request, message }),
    });
    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? `The tutor could not reply (${response.status}).`);
      setPending(null);
      // A kind of help the contract refuses sent nothing; keep the learner's words.
      if (response.status === 422) {
        setInput(message);
        return;
      }
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
    if (mode !== "question") setMode("question");
    router.refresh();
  }

  const current = MODES.find((m) => m.mode === mode)!;

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div ref={scroller} className="flex max-h-[min(28rem,45vh)] flex-col gap-3 overflow-y-auto pr-1" aria-live="polite">
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
            {m.sender === "persona" && m.spoken ? (
              <div className="mt-1">
                <ReadAloud text={m.spoken} />
              </div>
            ) : null}
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
        <fieldset>
          <legend className="text-xs font-medium text-ink">Kind of help</legend>
          <div className="mt-1 flex flex-wrap gap-1">
            {MODES.filter((m) => m.mode === "question" || exerciseId).map((m) => (
              <label
                key={m.mode}
                className={[
                  "cursor-pointer rounded-[var(--radius-control)] border px-2 py-1 text-xs",
                  m.mode === mode ? "border-brass bg-brass-soft text-brass-strong" : "border-stone bg-paper text-ink-2",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="help-mode"
                  value={m.mode}
                  checked={m.mode === mode}
                  onChange={() => setMode(m.mode)}
                  className="sr-only"
                />
                {m.label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-[0.7rem] text-ink-3">{current.describe}</p>
        </fieldset>
        {selection ? (
          <div className="rounded-[var(--radius-control)] border border-stone bg-paper px-2 py-1.5 text-xs text-ink-2">
            <p className="line-clamp-3">
              <span className="font-medium text-ink">
                {selection.origin === "attempt" ? `Attempt lines ${selection.lines?.[0]}–${selection.lines?.[1]}` : "Selected passage"}:
              </span>{" "}
              {selection.text}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1">
                <input type="radio" name="scope" checked={scope === "selection"} onChange={() => setScope("selection")} /> Only this
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name="scope" checked={scope === "unit"} onChange={() => setScope("unit")} /> Use the whole unit
              </label>
              <button type="button" className="underline" onClick={() => setSelection(null)}>
                Remove
              </button>
            </div>
          </div>
        ) : null}
        {preview ? (
          <details className="text-xs text-ink-2">
            <summary className="cursor-pointer text-ink">What the tutor will see</summary>
            <ul className="mt-1 list-disc pl-4">
              {preview.attached.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p className="mt-1 text-ink-3">Not sent: {preview.notAttached.join("; ")}.</p>
          </details>
        ) : null}
        {preview && !preview.decision.allowed ? (
          <p className="text-xs text-rust" role="status">
            {preview.decision.reason}
          </p>
        ) : null}
        <label htmlFor="tutor-input" className="sr-only">
          Message to the tutor
        </label>
        <textarea
          id="tutor-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder={mode === "question" ? "Ask a question or describe where you are stuck" : "Add a note for the tutor (optional)"}
          className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-focus"
          disabled={pending !== null}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2 text-[0.7rem] text-ink-3">
            <DictationButton allowed={voiceAllowed} disabled={pending !== null} onText={(t) => setInput(append(t))} />
            {locators.length} source locations available to cite
          </span>
          <Button
            type="submit"
            variant="secondary"
            disabled={
              pending !== null || (mode === "question" && input.trim().length === 0) || (preview !== null && !preview.decision.allowed)
            }
          >
            {mode === "question" ? "Send" : `Ask for: ${current.label.toLowerCase()}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
