import "server-only";
import { modelLabel } from "@corniversity/ai";
import { useId } from "react";
import { currentProviderMode } from "@/lib/provider-mode";
import { Badge } from "./ui";

/**
 * Says that a persona is an AI, not a person, and what actually answers for it: a live model the
 * owner approved, the owner's ChatGPT plan, or the scripted demo, whose replies do not read the
 * learner's work. "AI" is
 * never shown alone, so it cannot be taken to mean a live model.
 */
export async function AiLabel({ kind }: { kind: string }) {
  const state = await currentProviderMode();
  if (state.mode === "live") {
    return (
      <Explained
        tone="slate"
        label={`AI ${kind} · ${modelLabel(state.model)}`}
        explanation={`An AI persona, not a person. Its replies come from ${modelLabel(state.model)}.`}
      />
    );
  }
  if (state.mode === "plan") {
    return (
      <Explained
        tone="slate"
        label={`AI ${kind} · ${state.model} via your ChatGPT plan`}
        explanation={`An AI persona, not a person. Its replies come from ${state.model} through your own ChatGPT plan.`}
      />
    );
  }
  if (state.mode === "blocked") {
    return (
      <Explained
        tone="rust"
        label={`AI ${kind} · model blocked`}
        explanation={`An AI persona, not a person. The live model is blocked: ${state.reason}`}
      />
    );
  }
  return (
    <Explained
      tone="neutral"
      label={`AI ${kind} · scripted demo`}
      explanation="An AI persona, not a person. No model is configured, so its replies are scripted and do not read your work."
    />
  );
}

/**
 * The label as a button that opens its explanation (a popover: keyboard, touch and pointer, without
 * script); the explanation is also the button's description, so a screen reader announces it on focus.
 */
function Explained({ tone, label, explanation }: { tone: "slate" | "rust" | "neutral"; label: string; explanation: string }) {
  const id = useId();
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-describedby={id}
        title={explanation}
        className="inline-flex min-h-6 cursor-help items-center rounded-full focus-visible:outline-2 focus-visible:outline-focus"
      >
        <Badge tone={tone}>{label}</Badge>
      </button>
      <span
        id={id}
        popover="auto"
        className="max-w-xs rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-3 text-sm text-ink shadow-lg"
      >
        {explanation}
      </span>
    </>
  );
}
