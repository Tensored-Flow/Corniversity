import "server-only";
import { modelLabel } from "@corniversity/ai";
import { currentProviderMode } from "@/lib/provider-mode";
import { Badge } from "./ui";

/**
 * Says that a persona is an AI, not a person, and what actually answers for it: a live model the
 * owner approved, or the scripted demo, whose replies do not read the learner's work. "AI" is
 * never shown alone, so it cannot be taken to mean a live model.
 */
export async function AiLabel({ kind }: { kind: string }) {
  const state = await currentProviderMode();
  if (state.mode === "live") {
    return (
      <Badge tone="slate" title={`An AI persona, not a person. Its replies come from ${modelLabel(state.model)}.`}>
        AI {kind} · {modelLabel(state.model)}
      </Badge>
    );
  }
  if (state.mode === "blocked") {
    return (
      <Badge tone="rust" title={`An AI persona, not a person. The live model is blocked: ${state.reason}`}>
        AI {kind} · model blocked
      </Badge>
    );
  }
  return (
    <Badge
      tone="neutral"
      title="An AI persona, not a person. No model is configured, so its replies are scripted and do not read your work."
    >
      AI {kind} · scripted demo
    </Badge>
  );
}
