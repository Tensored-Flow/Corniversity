import type { Usage } from "./provider";

/**
 * Price table used for estimates and usage records. Prices change; every estimate carries the
 * table version so a later reader knows which assumptions produced the figure.
 */
export const PRICING_VERSION = "anthropic-2026-10-06";
export const PRICING_SOURCE = "https://platform.claude.com/docs/en/about-claude/pricing (cached 2026-10-06)";

interface Price {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
}

const PRICES: Record<string, Price> = {
  "claude-opus-5-5": { inputPerMTok: 4, outputPerMTok: 20, cacheReadPerMTok: 0.2, cacheWritePerMTok: 5 },
  "claude-opus-5": { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.5, cacheWritePerMTok: 6.25 },
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: 0.2, cacheWritePerMTok: 2.5 },
  "claude-sonnet-5": { inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: 0.2, cacheWritePerMTok: 2.5 },
  "claude-haiku-5-5": { inputPerMTok: 0.1, outputPerMTok: 0.5, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.125 },
  "claude-fable-5-1": { inputPerMTok: 10, outputPerMTok: 50, cacheReadPerMTok: 0.25, cacheWritePerMTok: 12.5 },
};

export function knownModels(): string[] {
  return Object.keys(PRICES);
}

export function estimateCostUsd(model: string, usage: Usage): number {
  const price = PRICES[model];
  if (!price) return 0;
  const cost =
    (usage.inputTokens * price.inputPerMTok +
      usage.outputTokens * price.outputPerMTok +
      usage.cacheReadTokens * price.cacheReadPerMTok +
      usage.cacheWriteTokens * price.cacheWritePerMTok) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Rough pre-run estimate: ~4 characters per token for English and LaTeX-heavy text. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateRunCostUsd(model: string, inputText: string, expectedOutputTokens: number): number {
  return estimateCostUsd(model, {
    inputTokens: estimateTokens(inputText),
    outputTokens: expectedOutputTokens,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  });
}
