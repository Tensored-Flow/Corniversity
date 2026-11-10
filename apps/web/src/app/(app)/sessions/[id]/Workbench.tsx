"use client";
import { lineRangeOfSelection, linesOf } from "@corniversity/core/paper/transcription";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { RenderedHtml } from "@/components/RenderedHtml";
import { Badge, Button, Notice } from "@/components/ui";
import type { ActionResult, DraftResult } from "./actions";
import { type HelpMode, useWorkspace } from "./Workspace";

interface Props {
  sessionId: string;
  exerciseId: string;
  attemptState: string;
  attemptMode: "practice" | "self_test";
  submitted: boolean;
  initialDraft: string;
  initialRevision: number;
  initialSavedAt: string | null;
  hints: string[];
  hintsTotal: number;
  solutionRevealed: boolean;
  saveDraft: (sessionId: string, exerciseId: string, draft: string, baseRevision: number) => Promise<DraftResult>;
  requestHint: (sessionId: string, exerciseId: string) => Promise<ActionResult>;
  submit: (sessionId: string, exerciseId: string, content: string) => Promise<ActionResult>;
  reveal: (sessionId: string, exerciseId: string) => Promise<ActionResult>;
  startAttempt: (sessionId: string, exerciseId: string, mode: "practice" | "self_test") => Promise<ActionResult>;
  /** Nothing written, no hint, no reveal, no submission: the mode can still be chosen. */
  fresh: boolean;
}

const STATE_LABEL: Record<string, { label: string; tone: "neutral" | "brass" | "moss" | "rust" | "slate" }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "brass" },
  reviewing: { label: "Being assessed", tone: "brass" },
  feedback_ready: { label: "Feedback ready", tone: "slate" },
  revision_requested: { label: "Revision requested", tone: "rust" },
  needs_review: { label: "Needs review", tone: "rust" },
  revised: { label: "Revised", tone: "brass" },
  accepted: { label: "Accepted", tone: "moss" },
};

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; revision: number; at: string }
  | { kind: "local"; reason: string }
  | { kind: "conflict"; serverRevision: number; serverDraft: string; serverSavedAt: string | null }
  | { kind: "error"; message: string };

interface LocalBuffer {
  text: string;
  baseRevision: number;
  at: string;
}

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");

function readBuffer(key: string): LocalBuffer | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as LocalBuffer) : null;
  } catch {
    return null;
  }
}

function writeBuffer(key: string, value: LocalBuffer | null): void {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {
    // Private windows and full storage: the server save still runs; only the device copy is lost.
  }
}

/**
 * The attempt editor. Every change is kept on this device first, then saved on the server on top
 * of the revision it started from; the state line says which. A save made stale by another device
 * is refused by the server, and both versions are shown for the learner to choose: nothing is
 * overwritten silently. Selecting lines offers a check of that step. No decoration, no timers.
 */
export function Workbench(props: Props) {
  const router = useRouter();
  const { setSelection, selection, requestHelp } = useWorkspace();
  const bufferKey = `corniversity:draft:${props.exerciseId}`;
  const [draft, setDraft] = useState(props.initialDraft);
  const [status, setStatus] = useState<SaveStatus>(
    props.initialSavedAt ? { kind: "saved", revision: props.initialRevision, at: props.initialSavedAt } : { kind: "idle" },
  );
  const [restore, setRestore] = useState<LocalBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealHtml, setRevealHtml] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const base = useRef(props.initialRevision);
  const lastSent = useRef(props.initialDraft);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  // A newer revision from the server (a submission saved the text, or another tab saved) is
  // adopted when this editor holds no unsaved change; with unsaved changes, a save reports the
  // conflict instead.
  useEffect(() => {
    if (props.initialRevision > base.current && draft === lastSent.current) {
      base.current = props.initialRevision;
      lastSent.current = props.initialDraft;
      setDraft(props.initialDraft);
    }
  }, [props.initialRevision, props.initialDraft, draft]);

  // Work left on this device that never reached the server (a closed tab, a lost connection).
  useEffect(() => {
    const local = readBuffer(bufferKey);
    if (local && local.text !== props.initialDraft) setRestore(local);
    else writeBuffer(bufferKey, null);
  }, [bufferKey, props.initialDraft]);

  const save = useCallback(
    async (text: string, baseRevision: number) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setStatus({ kind: "local", reason: "offline" });
        return;
      }
      setStatus({ kind: "saving" });
      try {
        const r = await props.saveDraft(props.sessionId, props.exerciseId, text, baseRevision);
        if (!r.ok) {
          setStatus({ kind: "error", message: r.error });
        } else if (r.status === "saved") {
          base.current = r.revision;
          lastSent.current = text;
          writeBuffer(bufferKey, null);
          setStatus({ kind: "saved", revision: r.revision, at: r.savedAt });
        } else {
          setStatus({ kind: "conflict", serverRevision: r.revision, serverDraft: r.serverDraft, serverSavedAt: r.savedAt });
        }
      } catch {
        setStatus({ kind: "local", reason: "the server could not be reached" });
      }
    },
    [props, bufferKey],
  );

  useEffect(() => {
    if (draft === lastSent.current || status.kind === "conflict") return;
    writeBuffer(bufferKey, { text: draft, baseRevision: base.current, at: new Date().toISOString() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(draft, base.current), 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, save, bufferKey, status.kind]);

  // Back online, or still unsaved: try again.
  useEffect(() => {
    if (status.kind !== "local") return;
    const retry = () => void save(draft, base.current);
    window.addEventListener("online", retry);
    const interval = setInterval(retry, 15_000);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(interval);
    };
  }, [status.kind, save, draft]);

  const onSelect = () => {
    const el = area.current;
    if (!el || el.selectionStart === el.selectionEnd) return;
    const lines = lineRangeOfSelection(el.value, el.selectionStart, el.selectionEnd);
    setSelection({ origin: "attempt", text: linesOf(el.value, lines[0], lines[1]), lines });
  };

  const accepted = props.attemptState === "accepted";
  const reviewing = props.attemptState === "reviewing";
  const stateLabel = STATE_LABEL[props.attemptState] ?? STATE_LABEL.draft!;
  const attemptLines = selection?.origin === "attempt" ? selection.lines : undefined;
  const fullBlocked = props.attemptMode === "self_test" && !props.submitted;

  const help = (mode: HelpMode) => {
    if (mode === "check_step" && !attemptLines) {
      setError("Select the lines of your attempt you want checked, then choose Check this step.");
      return;
    }
    setError(null);
    requestHelp(mode);
  };

  return (
    <section aria-labelledby="attempt-heading" id="attempt" className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 id="attempt-heading" className="text-lg text-ink">
            Your attempt
          </h2>
          <Badge tone={stateLabel.tone}>{stateLabel.label}</Badge>
          <Badge>{props.attemptMode === "practice" ? "practice mode" : "self-test mode"}</Badge>
        </div>
        <span className="text-xs text-ink-3" aria-live="polite" data-testid="save-state">
          {status.kind === "saving"
            ? "Saving…"
            : status.kind === "saved"
              ? `Saved on the server · revision ${status.revision} · ${time(status.at)}`
              : status.kind === "local"
                ? `Saved on this device only (${status.reason}); retrying`
                : status.kind === "conflict"
                  ? "Not saved: a newer version exists"
                  : status.kind === "error"
                    ? `Not saved: ${status.message}`
                    : "Drafts save automatically"}
        </span>
      </div>

      {accepted || props.fresh ? (
        <div className="mt-3 rounded-[var(--radius-control)] border border-stone bg-paper p-3 text-sm">
          <p className="text-ink-2">
            {accepted
              ? "This attempt was accepted and stays as it is. A new attempt is a separate record:"
              : "Choose how to work on this attempt (you can change it until you write, take a hint or reveal anything):"}
          </p>
          <fieldset className="mt-2 flex flex-wrap gap-2">
            <legend className="sr-only">Attempt mode</legend>
            {(["practice", "self_test"] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                variant={!accepted && props.attemptMode === mode ? "primary" : "secondary"}
                disabled={pending}
                aria-pressed={!accepted ? props.attemptMode === mode : undefined}
                onClick={() =>
                  startTransition(async () => {
                    const r = await props.startAttempt(props.sessionId, props.exerciseId, mode);
                    if (!r.ok) setError(r.error ?? "Could not start the attempt.");
                    else router.refresh();
                  })
                }
              >
                {accepted ? "Start a new attempt: " : ""}
                {mode === "practice"
                  ? "Practice (hints, explanations and the reference allowed)"
                  : "Self-test (explanations withheld until you submit)"}
              </Button>
            ))}
          </fieldset>
        </div>
      ) : null}

      {restore ? (
        <div className="mt-3">
          <Notice tone="slate" title="Unsaved work on this device">
            Work from {new Date(restore.at).toLocaleString("en-GB")} never reached the server
            {restore.baseRevision === props.initialRevision
              ? "."
              : ` (it was based on revision ${restore.baseRevision}; the server now has revision ${props.initialRevision}).`}
            <span className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDraft(restore.text);
                  setRestore(null);
                }}
              >
                Restore it
              </Button>
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  writeBuffer(bufferKey, null);
                  setRestore(null);
                }}
              >
                Keep the server version
              </Button>
            </span>
          </Notice>
        </div>
      ) : null}

      {status.kind === "conflict" ? (
        <div className="mt-3 rounded-[var(--radius-panel)] border border-rust/50 bg-paper p-3" role="alert">
          <p className="text-sm text-ink">
            This attempt was saved elsewhere (revision {status.serverRevision}
            {status.serverSavedAt ? `, ${time(status.serverSavedAt)}` : ""}) after this page loaded. Nothing was overwritten. Choose what to
            keep:
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-3">On the server</p>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-stone bg-paper-2 p-2 font-mono text-xs text-ink">
                {status.serverDraft}
              </pre>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-3">On this device</p>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-stone bg-paper-2 p-2 font-mono text-xs text-ink">
                {draft}
              </pre>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                base.current = status.serverRevision;
                lastSent.current = status.serverDraft;
                setDraft(status.serverDraft);
                writeBuffer(bufferKey, null);
                setStatus({ kind: "saved", revision: status.serverRevision, at: status.serverSavedAt ?? new Date().toISOString() });
              }}
            >
              Use the server version
            </Button>
            <Button type="button" variant="secondary" onClick={() => void save(draft, status.serverRevision)}>
              Keep mine (save it as a new revision)
            </Button>
            <Button
              type="button"
              variant="quiet"
              onClick={() => {
                base.current = status.serverRevision;
                setDraft(`${draft}\n\n<!-- server revision ${status.serverRevision} -->\n${status.serverDraft}`);
                setStatus({ kind: "idle" });
              }}
            >
              Combine them to edit by hand
            </Button>
          </div>
        </div>
      ) : null}

      <label htmlFor="attempt-text" className="sr-only">
        Attempt (Markdown with LaTeX)
      </label>
      <textarea
        id="attempt-text"
        ref={area}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onSelect={onSelect}
        disabled={accepted || reviewing}
        spellCheck={false}
        rows={14}
        placeholder={"Write the argument here. Markdown and LaTeX work: $\\|f_n\\|_\\infty = \\dots$"}
        className="mt-3 w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 font-mono text-sm leading-relaxed text-ink focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-70"
      />
      <p className="mt-1 text-[0.7rem] text-ink-3" aria-live="polite">
        {attemptLines
          ? `Lines ${attemptLines[0]}–${attemptLines[1]} selected for a step check.`
          : "Select lines to ask for a check of that step."}
      </p>

      <fieldset className="mt-3 flex flex-wrap gap-2">
        <legend className="sr-only">Ask the tutor</legend>
        <Button type="button" variant="secondary" onClick={() => help("small_hint")} disabled={accepted}>
          Small hint
        </Button>
        <Button type="button" variant="secondary" onClick={() => help("discuss_approach")} disabled={accepted || draft.trim().length < 10}>
          Discuss my approach
        </Button>
        <Button type="button" variant="secondary" onClick={() => help("check_step")} disabled={accepted || !attemptLines}>
          Check this step
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => help("full_explanation")}
          disabled={fullBlocked}
          title={fullBlocked ? "Self-test mode withholds full explanations until you submit." : undefined}
        >
          Full explanation
        </Button>
      </fieldset>
      {fullBlocked ? (
        <p className="mt-1 text-[0.7rem] text-ink-3">Self-test mode: a full explanation becomes available after you submit.</p>
      ) : null}

      {props.hints.length > 0 ? (
        <ol className="mt-4 flex flex-col gap-2" aria-label="Hints revealed">
          {props.hints.map((h, i) => (
            <li key={h} className="rounded-[var(--radius-control)] border border-stone bg-paper px-3 py-2 text-sm text-ink-2">
              <span className="mr-2 text-xs uppercase tracking-wide text-brass">Hint {i + 1}</span>
              {h}
            </li>
          ))}
        </ol>
      ) : null}

      {error ? (
        <div className="mt-3">
          <Notice tone="rust">{error}</Notice>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={pending || accepted || reviewing || status.kind === "conflict"}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await props.submit(props.sessionId, props.exerciseId, draft);
              if (!r.ok) setError(r.error ?? "Could not submit.");
              else {
                // Submitting saved exactly this text as a new revision.
                if (r.revision !== undefined) {
                  base.current = r.revision;
                  lastSent.current = draft;
                  setStatus({ kind: "saved", revision: r.revision, at: new Date().toISOString() });
                }
                writeBuffer(bufferKey, null);
                router.refresh();
              }
            });
          }}
        >
          {reviewing ? "Being assessed…" : accepted ? "Accepted" : props.attemptState === "draft" ? "Submit attempt" : "Submit revision"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || props.hints.length >= props.hintsTotal || accepted}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await props.requestHint(props.sessionId, props.exerciseId);
              if (!r.ok) setError(r.error ?? "No hint available.");
              else router.refresh();
            });
          }}
        >
          {props.hints.length >= props.hintsTotal
            ? "No more authored hints"
            : `Next authored hint (${props.hints.length}/${props.hintsTotal})`}
        </Button>
        {props.attemptMode === "practice" ? (
          <Button
            type="button"
            variant="quiet"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await props.reveal(props.sessionId, props.exerciseId);
                if (!r.ok) setError(r.error ?? "No reference available.");
                else {
                  setRevealHtml(r.html ?? null);
                  router.refresh();
                }
              });
            }}
          >
            {props.solutionRevealed ? "Show reference reasoning again" : "Show reference reasoning"}
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-ink-3">
        Hints, explanations and reveals are recorded as assistance, not as failure, and never as evidence of understanding. Submitting
        creates an immutable version; feedback is provisional and can be appealed.
      </p>

      {revealHtml ? (
        <div className="mt-4 rounded-[var(--radius-panel)] border border-brass/40 bg-brass-soft/30 p-4">
          <p className="text-xs uppercase tracking-wide text-brass">Reference reasoning (practice mode)</p>
          <RenderedHtml html={revealHtml} className="mt-2 text-sm" />
        </div>
      ) : null}
    </section>
  );
}
