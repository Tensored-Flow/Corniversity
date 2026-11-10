import { supportedModel } from "./models";
import type { AttemptUsage, Usage } from "./provider";

/**
 * Price table used for estimates and usage records. Prices change; every estimate carries the
 * table version so a later reader knows which assumptions produced the figure.
 */
export const PRICING_VERSION = "anthropic-2026-10-06.2";
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
  "claude-opus-4-8": { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.5, cacheWritePerMTok: 6.25 },
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: 0.2, cacheWritePerMTok: 2.5 },
  "claude-sonnet-5": { inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: 0.2, cacheWritePerMTok: 2.5 },
  "claude-haiku-5-5": { inputPerMTok: 0.1, outputPerMTok: 0.5, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.125 },
  "claude-fable-5-1": { inputPerMTok: 10, outputPerMTok: 50, cacheReadPerMTok: 0.25, cacheWritePerMTok: 12.5 },
};

/** Claude Haiku 5.5 costs five times as much once a prompt exceeds 100,000 tokens. */
const HAIKU_LONG_PROMPT_TOKENS = 100_000;
const HAIKU_LONG_PROMPT_FACTOR = 5;

export function knownModels(): string[] {
  return Object.keys(PRICES);
}

export function isKnownModel(model: string): boolean {
  return model in PRICES;
}

/**
 * An unknown model id is priced at the dearest known rate for each component, so a budget
 * estimate can only over-count, never under-count. The fixture provider makes no request and
 * costs nothing.
 */
function priceFor(model: string, promptTokens: number): Price | null {
  if (model === "fixture") return null;
  const price = PRICES[model];
  if (price) {
    if (model === "claude-haiku-5-5" && promptTokens > HAIKU_LONG_PROMPT_TOKENS) {
      return {
        inputPerMTok: price.inputPerMTok * HAIKU_LONG_PROMPT_FACTOR,
        outputPerMTok: price.outputPerMTok * HAIKU_LONG_PROMPT_FACTOR,
        cacheReadPerMTok: price.cacheReadPerMTok * HAIKU_LONG_PROMPT_FACTOR,
        cacheWritePerMTok: price.cacheWritePerMTok * HAIKU_LONG_PROMPT_FACTOR,
      };
    }
    return price;
  }
  const all = Object.values(PRICES);
  return {
    inputPerMTok: Math.max(...all.map((p) => p.inputPerMTok)),
    outputPerMTok: Math.max(...all.map((p) => p.outputPerMTok)),
    cacheReadPerMTok: Math.max(...all.map((p) => p.cacheReadPerMTok)),
    cacheWritePerMTok: Math.max(...all.map((p) => p.cacheWritePerMTok)),
  };
}

const round6 = (usd: number) => Math.round(usd * 1_000_000) / 1_000_000;

export function estimateCostUsd(model: string, usage: Usage): number {
  const price = priceFor(model, usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens);
  if (!price) return 0;
  const cost =
    (usage.inputTokens * price.inputPerMTok +
      usage.outputTokens * price.outputPerMTok +
      usage.cacheReadTokens * price.cacheReadPerMTok +
      usage.cacheWriteTokens * price.cacheWritePerMTok) /
    1_000_000;
  return round6(cost);
}

/** What a run actually cost: each attempt at its own model's rates, as the provider bills it. */
export function costOfAttempts(attempts: readonly AttemptUsage[]): number {
  return round6(attempts.reduce((sum, a) => sum + estimateCostUsd(a.model, a), 0));
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

/**
 * A run's worst case, for the budget gate. The output allowance is exact: the provider stops at
 * the allowance, and thinking counts towards it. The prompt is a conservative estimate (see
 * `estimatePromptTokens`) priced at the cache-write rate, the dearer of the two input rates. With
 * refusal fallback on, a second full run on the dearest documented fallback model is added, whose
 * prompt also carries the text the declined attempt had already produced, because the provider
 * passes that text on as continuation and bills both attempts. Prompt text denser than the
 * estimate can cost more; the actual cost is recorded afterwards and counts towards the limits.
 */
export function worstCaseRunUsd(model: string, inputText: string, maxOutputTokens: number, refusalFallback: boolean): number {
  const promptTokens = estimatePromptTokens(inputText);
  const run = (m: string, continuationTokens: number) =>
    estimateCostUsd(m, {
      inputTokens: 0,
      outputTokens: maxOutputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: promptTokens + continuationTokens,
    });
  const primary = run(model, 0);
  const targets = refusalFallback && supportedModel(model)?.serverFallback ? (supportedModel(model)?.fallbackTargets ?? []) : [];
  const fallback = targets.length ? Math.max(...targets.map((t) => run(t, maxOutputTokens))) : 0;
  return round6(primary + fallback);
}

/**
 * Prompt tokens for the budget gate: ASCII text at three characters a token (English averages
 * nearer four) and every other character at its UTF-8 bytes, since a token never covers less than
 * a byte. Symbol-dense ASCII, such as long digit strings, can still use more tokens than this.
 */
export function estimatePromptTokens(text: string): number {
  let ascii = 0;
  let otherBytes = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x80) ascii += 1;
    else otherBytes += code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return Math.ceil(ascii / 3) + otherBytes;
}
