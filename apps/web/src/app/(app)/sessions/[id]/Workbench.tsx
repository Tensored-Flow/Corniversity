"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Badge, Button, Notice } from "@/components/ui";
import type { ActionResult } from "./actions";

interface Props {
  sessionId: string;
  exerciseId: string;
  attemptState: string;
  attemptMode: "practice" | "self_test";
  initialDraft: string;
  hints: string[];
  hintsTotal: number;
  solutionRevealed: boolean;
  saveDraft: (sessionId: string, exerciseId: string, draft: string) => Promise<ActionResult>;
  requestHint: (sessionId: string, exerciseId: string) => Promise<ActionResult>;
  submit: (sessionId: string, exerciseId: string, content: string) => Promise<ActionResult>;
  reveal: (sessionId: string, exerciseId: string) => Promise<ActionResult>;
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

/**
 * The attempt editor. Drafts autosave after a pause in typing; hints come one at a time;
 * submission creates an immutable version. No decoration, no timers: the measured window is still.
 */
export function Workbench(props: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState(props.initialDraft);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [revealHtml, setRevealHtml] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(props.initialDraft);

  useEffect(() => {
    if (draft === lastSaved.current) return;
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void props.saveDraft(props.sessionId, props.exerciseId, draft).then((r) => {
        if (r.ok) {
          lastSaved.current = draft;
          setSaved("saved");
        }
      });
    }, 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, props]);

  const accepted = props.attemptState === "accepted";
  const reviewing = props.attemptState === "reviewing";
  const state = STATE_LABEL[props.attemptState] ?? STATE_LABEL.draft!;

  return (
    <section aria-labelledby="attempt-heading" className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 id="attempt-heading" className="text-lg text-ink">
            Your attempt
          </h2>
          <Badge tone={state.tone}>{state.label}</Badge>
          <Badge>{props.attemptMode === "practice" ? "practice mode" : "self-test mode"}</Badge>
        </div>
        <span className="text-xs text-ink-3" aria-live="polite">
          {saved === "saving" ? "Saving…" : saved === "saved" ? "Draft saved" : "Drafts save automatically"}
        </span>
      </div>

      <label htmlFor="attempt" className="sr-only">
        Attempt (Markdown with LaTeX)
      </label>
      <textarea
        id="attempt"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={accepted || reviewing}
        spellCheck={false}
        rows={14}
        placeholder={"Write the argument here. Markdown and LaTeX work: $\\|f_n\\|_\\infty = \\dots$"}
        className="mt-3 w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 font-mono text-sm leading-relaxed text-ink focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-70"
      />

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
          disabled={pending || accepted || reviewing}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await props.submit(props.sessionId, props.exerciseId, draft);
              if (!r.ok) setError(r.error ?? "Could not submit.");
              else router.refresh();
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
          {props.hints.length >= props.hintsTotal ? "No more hints" : `Next hint (${props.hints.length}/${props.hintsTotal})`}
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
        Hints and reveals are recorded as assistance, not as failure. Submitting creates an immutable version; feedback is provisional and can be appealed.
      </p>

      {revealHtml ? (
        <div className="mt-4 rounded-[var(--radius-panel)] border border-brass/40 bg-brass-soft/30 p-4">
          <p className="text-xs uppercase tracking-wide text-brass">Reference reasoning (practice mode)</p>
          <div className="prose-reading mt-2 text-sm" dangerouslySetInnerHTML={{ __html: revealHtml }} />
        </div>
      ) : null}
    </section>
  );
}
