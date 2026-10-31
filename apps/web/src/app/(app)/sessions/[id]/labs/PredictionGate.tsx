"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui";
import { type ActionResult, recordLabPredictionAction } from "../actions";

/**
 * The prediction stage of a laboratory: the learner writes down what they expect before any
 * result is shown. The prediction is saved to the notebook (it is a prediction, not evidence of
 * understanding), and the page then reveals the results it was written against.
 */
export function PredictionGate({ sessionId, labId, prompt }: { sessionId: string; labId: string; prompt: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult, FormData>(recordLabPredictionAction, { ok: false });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);
  return (
    <section aria-labelledby="prediction-heading" className="rounded-[var(--radius-panel)] border border-brass/50 bg-paper-2 p-4">
      <h3 id="prediction-heading" className="text-sm font-medium text-ink">
        Your prediction first
      </h3>
      <p className="mt-1 text-sm text-ink-2">{prompt}</p>
      <p className="mt-1 text-xs text-ink-3">
        The results stay hidden until you have written it. It is saved to your notebook with today's date, so you can compare it with what
        happened.
      </p>
      <form action={action} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="labId" value={labId} />
        <label htmlFor={`prediction-${labId}`} className="sr-only">
          Prediction
        </label>
        <textarea
          id={`prediction-${labId}`}
          name="prediction"
          rows={4}
          className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 text-sm text-ink"
          disabled={pending}
        />
        {state.error ? (
          <p role="alert" className="text-sm text-rust">
            {state.error}
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save my prediction and show the results"}
          </Button>
        </div>
      </form>
    </section>
  );
}
