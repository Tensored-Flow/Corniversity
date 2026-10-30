export * from "./provider";
export * from "./pricing";
export * from "./budget";
export * from "./fixture";
export * from "./anthropic";
export * from "./roles/contracts";
export * from "./roles/schemas";
export * from "./prompts/tutor";
export * from "./prompts/assessor";
export * from "./prompts/director";

import { AnthropicProvider } from "./anthropic";
import { FixtureProvider } from "./fixture";
import type { ModelProvider } from "./provider";

export interface ProviderConfig {
  provider: "fixture" | "anthropic";
  anthropicApiKey?: string;
  defaultModel: string;
  modelMap?: Record<string, string>;
  fixtureRoot?: string;
}

/** Builds the configured provider. Falls back to fixtures when a live provider lacks a key. */
export function createProvider(config: ProviderConfig): { provider: ModelProvider; live: boolean; reason?: string } {
  if (config.provider === "anthropic") {
    if (!config.anthropicApiKey) {
      return {
        provider: new FixtureProvider(config.fixtureRoot),
        live: false,
        reason: "Anthropic selected but no API key is configured; using fixtures.",
      };
    }
    return {
      provider: new AnthropicProvider({
        apiKey: config.anthropicApiKey,
        defaultModel: config.defaultModel,
        modelMap: config.modelMap,
      }),
      live: true,
    };
  }
  return { provider: new FixtureProvider(config.fixtureRoot), live: false };
}
