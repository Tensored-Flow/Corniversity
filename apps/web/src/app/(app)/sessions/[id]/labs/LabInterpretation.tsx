"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui";
import { type ActionResult, recordLabInterpretationAction } from "../actions";

/**
 * Where the learner writes what the model showed and why. The interpretation becomes a
 * notebook entry linked to the unit's sources and, for a laboratory with no graded report, a
 * practice-evidence event; running the simulation alone records nothing.
 */
export function LabInterpretation({
  sessionId,
  prompts,
  previous,
}: {
  sessionId: string;
  prompts: string[];
  previous: { id: string; title: string; excerpt: string; when: string }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult, FormData>(recordLabInterpretationAction, { ok: false });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-ink">Your interpretation</h3>
      <ul className="list-disc pl-5 text-sm text-ink-2">
        {prompts.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="sessionId" value={sessionId} />
        <label htmlFor="lab-interpretation" className="sr-only">
          Interpretation
        </label>
        <textarea
          id="lab-interpretation"
          name="interpretation"
          rows={6}
          placeholder="What did the model do, why, and what would you check next? Markdown and LaTeX are fine."
          className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 font-mono text-sm text-ink focus-visible:outline-2 focus-visible:outline-focus"
          disabled={pending}
        />
        {state.error ? (
          <p role="alert" className="text-sm text-rust">
            {state.error}
          </p>
        ) : null}
        {state.ok ? <p className="text-sm text-moss">Recorded in your notebook.</p> : null}
        <div>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Recording…" : "Record in the notebook"}
          </Button>
        </div>
      </form>
      {previous.length ? (
        <div className="border-t border-stone pt-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-ink-3">Earlier interpretations</h4>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {previous.map((p) => (
              <li key={p.id} className="text-ink-2">
                <span className="text-ink-3">{p.when}</span> · {p.excerpt}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
