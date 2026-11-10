import { supportedModel } from "./models";
import type { TextResult } from "./provider";
import type { PublicProviderState } from "./state";

/** A model's display name where it is known, otherwise its identifier. */
export function modelLabel(id: string): string {
  if (id === "fixture") return "Scripted demo";
  return supportedModel(id)?.label ?? id;
}

/** Who answers, in a few words: the API model, the owner's ChatGPT plan, the scripted demo or a block. */
export function providerLabel(state: PublicProviderState): string {
  if (state.mode === "live") return `Anthropic (${modelLabel(state.model)})`;
  if (state.mode === "plan") return `${state.model} via your ChatGPT plan`;
  if (state.mode === "blocked") return "model blocked";
  return "Scripted demo";
}

/**
 * What the learner is told at the end of a live reply, beyond the reply itself: a decline, a
 * reply cut off at its length allowance, or a fallback model taking over part of the request.
 * Each is a fact about how the reply was produced, kept out of the model's own words.
 */
export function turnNotes(result: Pick<TextResult, "stopReason" | "refusalCategory" | "fallbacks">): string[] {
  const notes: string[] = [];
  for (const f of result.fallbacks) {
    notes.push(
      `\n\n*(${modelLabel(f.from)} declined part of this request and ${modelLabel(f.to)} continued it; both attempts are recorded with their costs.)*`,
    );
  }
  if (result.stopReason === "refusal") {
    notes.push(
      `\n\n*(The model declined to continue${result.refusalCategory ? ` (category: ${result.refusalCategory})` : ""}. Nothing has been lost; try rephrasing.)*`,
    );
  }
  if (result.stopReason === "max_tokens") notes.push("\n\n*(This reply reached its length allowance and stops here.)*");
  return notes;
}
