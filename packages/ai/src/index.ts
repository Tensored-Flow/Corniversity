export * from "./anthropic";
export * from "./assets";
export * from "./budget";
export * from "./fixture";
export * from "./models";
export * from "./notes";
export * from "./pricing";
export * from "./prompts/assessor";
export * from "./prompts/director";
export * from "./prompts/discussion";
export * from "./prompts/reading";
export * from "./prompts/supervisor";
export * from "./prompts/tutor";
export * from "./provider";
export * from "./roles/contracts";
export * from "./roles/schemas";
export * from "./state";

import { AnthropicProvider } from "./anthropic";
import { FixtureProvider } from "./fixture";
import type { ModelProvider } from "./provider";

export type ProviderChoice =
  | { provider: "fixture"; fixtureRoot?: string }
  | { provider: "anthropic"; apiKey: string; model: string; refusalFallback: boolean; baseURL?: string };

/**
 * Builds the provider a resolved configuration names. It never substitutes one provider for
 * another: whether a live model may run at all is decided before this, by the provider state.
 */
export function createProvider(choice: ProviderChoice): ModelProvider {
  if (choice.provider === "anthropic") {
    return new AnthropicProvider({
      apiKey: choice.apiKey,
      model: choice.model,
      refusalFallback: choice.refusalFallback,
      baseURL: choice.baseURL,
    });
  }
  return new FixtureProvider(choice.fixtureRoot);
}
