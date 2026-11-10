"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { saveExternalProgressAction } from "./actions";

/**
 * How far the learner got in a reading that lives outside the site (a book, an external page),
 * in their own words. The book is never embedded and progress is never inferred.
 */
export function ExternalProgress({ sessionId, current }: { sessionId: string; current?: { text: string; at: string } }) {
  const [text, setText] = useState(current?.text ?? "");
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await saveExternalProgressAction(sessionId, text);
          setState(r.ok ? "saved" : "error");
        });
      }}
    >
      <label htmlFor="external-progress" className="text-xs text-ink-2">
        How far you got in the external reading
      </label>
      <div className="flex gap-2">
        <input
          id="external-progress"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. read to §2.3, Example 2.7"
          className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-stone-2 bg-paper px-2 py-1 text-sm"
        />
        <Button type="submit" variant="secondary" disabled={pending || !text.trim()}>
          Save
        </Button>
      </div>
      <span className="text-[0.7rem] text-ink-3" aria-live="polite">
        {state === "saved"
          ? "Saved on the server."
          : state === "error"
            ? "Not saved."
            : current
              ? `Last recorded ${new Date(current.at).toLocaleString("en-GB")}.`
              : "Recorded in your words; nothing is inferred."}
      </span>
    </form>
  );
}
