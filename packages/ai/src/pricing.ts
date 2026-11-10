import { supportedModel } from "./models";
import type { AttemptUsage, Usage } from "./provider";

/**
 * Price table used for estimates and usage records. Prices change; every estimate carries the
 * table version so a later reader knows which assumptions produced the figure.
 */
export const PRICING_VERSION = "anthropic-2026-11-10.1";
export const PRICING_SOURCE = "https://platform.claude.com/docs/en/about-claude/pricing (fetched 2026-11-10)";

interface Price {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  /** Five-minute cache writes: the only cache lifetime this application requests. */
  cacheWritePerMTok: number;
}

const PRICES: Record<string, Price> = {
  "claude-opus-5-5": { inputPerMTok: 4, outputPerMTok: 20, cacheReadPerMTok: 0.2, cacheWritePerMTok: 5 },
  "claude-opus-5": { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.5, cacheWritePerMTok: 6.25 },
  "claude-opus-4-8": { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.5, cacheWritePerMTok: 6.25 },
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: 0.1, cacheWritePerMTok: 2.5 },
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

/** A live run asked for a model this table cannot price; strict admission refuses it. */
export class UnpricedModelError extends Error {
  constructor(readonly model: string) {
    super(`No price is known for ${model}, so no worst case can be stated and paid runs on it are refused.`);
    this.name = "UnpricedModelError";
  }
}

function tierPrice(model: string, price: Price, promptTokens: number): Price {
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

/**
 * The price used to record what a run cost. An unknown model id (a fallback the provider chose
 * that this table predates) is priced at the dearest known rate for each component, so a record
 * can only over-count. The fixture provider makes no request and costs nothing.
 */
function recordingPrice(model: string, promptTokens: number): Price | null {
  if (model === "fixture") return null;
  const price = PRICES[model];
  if (price) return tierPrice(model, price, promptTokens);
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
  const price = recordingPrice(model, usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens);
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

/** Rough display estimate (~4 characters per token); never used to admit a paid run. */
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
 * The shape of everything a request sends, for the strict bound: all text (system prompt, every
 * message, any output schema), how many messages carry it, and how many images are attached.
 */
export interface PromptShape {
  text: string;
  messages: number;
  images?: number;
}

/**
 * Allowance for the role and turn markers around each message and the request as a whole. The
 * provider states that billing reflects only the caller's content and that tokens it adds itself
 * are not billed; the allowance covers markers in case some of them are billed after all.
 */
export const FRAMING_TOKENS_PER_MESSAGE = 16;
export const FRAMING_TOKENS_PER_REQUEST = 64;
/**
 * The documented ceiling on one image: ⌈w/28⌉ × ⌈h/28⌉ visual tokens, with larger images
 * downscaled to at most 4,784 visual tokens on Claude 4.7 and later (every supported model).
 */
export const MAX_TOKENS_PER_IMAGE = 4_784;

/** UTF-8 length of a string without allocating a buffer. */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * The most input tokens a request can be billed for. Text is counted at one token per UTF-8 byte:
 * the tokenizer is byte-level, so every token encodes at least one byte and no text can need more
 * tokens than it has bytes, however dense its digits, symbols or LaTeX. The provider does not
 * publish its tokenizer, so this rests on that stated property rather than on a proof; it is far
 * above any realistic count (English averages about four bytes a token).
 */
export function promptTokenBound(prompt: PromptShape): number {
  return (
    utf8Bytes(prompt.text) +
    Math.max(1, prompt.messages) * FRAMING_TOKENS_PER_MESSAGE +
    FRAMING_TOKENS_PER_REQUEST +
    (prompt.images ?? 0) * MAX_TOKENS_PER_IMAGE
  );
}

/**
 * A run's worst case, for the budget gate. The output allowance is exact: the provider stops at
 * it, and thinking counts towards it. The prompt is the strict bound above, priced at the
 * cache-write rate, the dearer of the two input rates. With refusal fallback on, a second full run
 * on the dearest documented fallback model is added, whose prompt also carries the text the
 * declined attempt had already produced, because the provider passes that text on as continuation
 * and bills both attempts. A model without a known price has no worst case: it fails closed.
 */
export function worstCaseRunUsd(model: string, prompt: PromptShape, maxOutputTokens: number, refusalFallback: boolean): number {
  const promptTokens = promptTokenBound(prompt);
  const run = (m: string, continuationTokens: number) => {
    const base = PRICES[m];
    if (!base) throw new UnpricedModelError(m);
    const price = tierPrice(m, base, promptTokens + continuationTokens);
    return ((promptTokens + continuationTokens) * price.cacheWritePerMTok + maxOutputTokens * price.outputPerMTok) / 1_000_000;
  };
  const primary = run(model, 0);
  const targets = refusalFallback && supportedModel(model)?.serverFallback ? (supportedModel(model)?.fallbackTargets ?? []) : [];
  const fallback = targets.length ? Math.max(...targets.map((t) => run(t, maxOutputTokens))) : 0;
  // Round up to the next micro-dollar so the reservation is never below the computed bound.
  return Math.ceil((primary + fallback) * 1_000_000 - 1e-6) / 1_000_000;
}

/** Money as integer micro-dollars, so limits and spend are compared without floating-point drift. */
export function usdToMicros(usd: number): number {
  return Math.round(usd * 1_000_000);
}

export function microsToUsd(micros: number): number {
  return micros / 1_000_000;
}

/** Parses a decimal amount as PostgreSQL returns it ("12.345678") into micro-dollars exactly. */
export function parseUsdMicros(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return usdToMicros(value);
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(value.trim());
  if (!match) throw new Error(`not a decimal amount: ${value}`);
  const [, sign, whole = "", fraction = ""] = match;
  const micros = Number(whole || "0") * 1_000_000 + Number(`${fraction}000000`.slice(0, 6));
  // Digits beyond the sixth round half up, as numeric(…, 6) storage already guarantees none.
  const roundUp = fraction.length > 6 && Number(fraction[6]) >= 5 ? 1 : 0;
  return (sign ? -1 : 1) * (micros + roundUp);
}
