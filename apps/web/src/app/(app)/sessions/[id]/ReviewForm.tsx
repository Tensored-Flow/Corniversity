"use client";
import { useParams } from "next/navigation";
import { useActionState, useState } from "react";
import { Button, Notice } from "@/components/ui";
import type { ActionResult } from "./actions";

export function ReviewForm({
  assessmentRunId,
  action,
}: {
  assessmentRunId: string;
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const params = useParams<{ id: string }>();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, { ok: false } as ActionResult);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-brass underline underline-offset-4">
        Disagree with this assessment? Appeal or request a regrade
      </button>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-2 text-sm">
      <input type="hidden" name="assessmentRunId" value={assessmentRunId} />
      <input type="hidden" name="sessionId" value={params.id} />
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-3">Kind</span>
        <select name="kind" defaultValue="appeal" className="rounded-[var(--radius-control)] border border-stone-2 bg-paper px-2 py-1.5">
          <option value="appeal">Appeal: the judgement is wrong</option>
          <option value="regrade">Regrade: please assess again</option>
          <option value="learner_challenge">Challenge: a specific comment is mistaken</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-3">What did the assessor miss?</span>
        <textarea name="note" rows={3} required className="rounded-[var(--radius-control)] border border-stone-2 bg-paper px-2 py-1.5" />
      </label>
      {state.error ? <Notice tone="rust">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="moss">Filed. It appears on the record with this submission.</Notice> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Filing…" : "File"}
        </Button>
        <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
