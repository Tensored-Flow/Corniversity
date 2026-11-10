import { describe, expect, it } from "vitest";
import { BudgetLimitError, decideBudget, validateBudgetLimits } from "./budget";
import { DEFAULT_MODEL } from "./models";
import {
  costOfAttempts,
  estimateCostUsd,
  estimateRunCostUsd,
  FRAMING_TOKENS_PER_MESSAGE,
  FRAMING_TOKENS_PER_REQUEST,
  MAX_TOKENS_PER_IMAGE,
  parseUsdMicros,
  promptTokenBound,
  UnpricedModelError,
  usdToMicros,
  utf8Bytes,
  worstCaseRunUsd,
} from "./pricing";
import { ROLE_CONTRACTS } from "./roles/contracts";

const limits = { perRunUsd: 0.5, dailyUsd: 3, monthlyUsd: 40, warnFraction: 0.8 };

describe("decideBudget", () => {
  it("allows a small run with no warnings", () => {
    const d = decideBudget(limits, { todayUsd: 0.1, monthUsd: 1 }, 0.05);
    expect(d.allowed).toBe(true);
    expect(d.warnings).toEqual([]);
  });

  it("refuses a run whose worst case is above the per-run limit", () => {
    const d = decideBudget(limits, { todayUsd: 0, monthUsd: 0 }, 0.75);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/per-run limit/);
  });

  it("refuses a run above the role's own ceiling even when the owner's per-run limit allows it", () => {
    const d = decideBudget(limits, { todayUsd: 0, monthUsd: 0 }, 0.3, 0.2);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/role's ceiling/);
  });

  it("stops when the daily or the monthly limit could be crossed", () => {
    expect(decideBudget(limits, { todayUsd: 2.9, monthUsd: 10 }, 0.2).allowed).toBe(false);
    expect(decideBudget(limits, { todayUsd: 0, monthUsd: 39.9 }, 0.2).allowed).toBe(false);
  });

  it("warns near the daily limit", () => {
    const d = decideBudget(limits, { todayUsd: 2.3, monthUsd: 10 }, 0.2);
    expect(d.allowed).toBe(true);
    expect(d.warnings[0]).toMatch(/Approaching today's limit/);
  });
});

describe("validateBudgetLimits", () => {
  it("accepts finite, positive, nested limits within the ceilings", () => {
    expect(validateBudgetLimits({ perRunUsd: 1, dailyUsd: 5, monthlyUsd: 40 })).toEqual({ perRunUsd: 1, dailyUsd: 5, monthlyUsd: 40 });
  });

  it("refuses zero, negative, missing and infinite amounts", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => validateBudgetLimits({ perRunUsd: bad, dailyUsd: 5, monthlyUsd: 40 })).toThrow(BudgetLimitError);
    }
  });

  it("refuses limits above the ceilings, so a typing slip cannot authorise open-ended spending", () => {
    expect(() => validateBudgetLimits({ perRunUsd: 1, dailyUsd: 5, monthlyUsd: 10_000 })).toThrow(/at most \$500/);
    expect(() => validateBudgetLimits({ perRunUsd: 6, dailyUsd: 10, monthlyUsd: 40 })).toThrow(/at most \$5/);
  });

  it("refuses a per-run limit above the daily one, or a daily limit above the monthly one", () => {
    expect(() => validateBudgetLimits({ perRunUsd: 4, dailyUsd: 3, monthlyUsd: 40 })).toThrow(/per-run/);
    expect(() => validateBudgetLimits({ perRunUsd: 1, dailyUsd: 45, monthlyUsd: 40 })).toThrow(/daily/);
  });
});

describe("pricing", () => {
  it("prices opus 5.5 usage from the table", () => {
    const cost = estimateCostUsd("claude-opus-5-5", { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    expect(cost).toBe(4);
  });

  it("estimates a run from input text and expected output", () => {
    // 1000 input tokens * $4/M + 1000 output * $20/M = $0.024
    expect(estimateRunCostUsd("claude-opus-5-5", "x".repeat(4000), 1000)).toBeCloseTo(0.024, 6);
  });

  it("prices an unknown model at the dearest known rate so an estimate never under-counts", () => {
    // 100 input tokens at $10/M plus 100 output tokens at $50/M (the dearest entries in the table).
    expect(estimateCostUsd("some-new-model", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBeCloseTo(
      0.006,
      9,
    );
  });

  it("the scripted demo costs nothing", () => {
    expect(estimateCostUsd("fixture", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(0);
  });

  it("charges Claude Haiku 5.5 five times as much once a prompt exceeds 100,000 tokens", () => {
    const usage = (inputTokens: number) => ({ inputTokens, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    expect(estimateCostUsd("claude-haiku-5-5", usage(100_000))).toBeCloseTo(0.01, 9); // 100k at $0.10/M
    expect(estimateCostUsd("claude-haiku-5-5", usage(200_000))).toBeCloseTo(0.1, 9); // 200k at $0.50/M
  });

  it("costs each attempt at its own model's rates when a fallback model took over", () => {
    const attempts = [
      { kind: "message" as const, model: "claude-opus-5-5", inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0 },
      {
        kind: "fallback_message" as const,
        model: "claude-opus-4-8",
        inputTokens: 1000,
        outputTokens: 1000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    ];
    // 1000*$4/M + 500*$20/M = 0.014; then 1000*$5/M + 1000*$25/M = 0.030.
    expect(costOfAttempts(attempts)).toBeCloseTo(0.044, 9);
  });

  it("prices Claude Sonnet 5.5 cache reads at 0.05x of input, as the pricing page of 10 Nov 2026 states", () => {
    expect(estimateCostUsd("claude-sonnet-5-5", { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0 })).toBe(
      0.1,
    );
  });

  it("puts a run's worst case at the whole allowance, the strict prompt bound at the cache-write rate, and a fallback run", () => {
    const prompt = { text: "x".repeat(3000), messages: 1 };
    const bound = 3000 + FRAMING_TOKENS_PER_MESSAGE + FRAMING_TOKENS_PER_REQUEST; // 3080
    expect(promptTokenBound(prompt)).toBe(bound);
    // Opus 5.5: 3080*$5/M (cache write) + 1000*$20/M = 0.0354.
    expect(worstCaseRunUsd("claude-opus-5-5", prompt, 1000, false)).toBeCloseTo(0.0354, 9);
    // Plus the dearest documented fallback (Opus 5 / Opus 4.8), whose prompt also carries the
    // declined attempt's output as continuation: (3080 + 1000)*$6.25/M + 1000*$25/M = 0.0505.
    expect(worstCaseRunUsd("claude-opus-5-5", prompt, 1000, true)).toBeCloseTo(0.0859, 9);
    // Haiku 5.5 has no server-side fallback, so the flag changes nothing.
    expect(worstCaseRunUsd("claude-haiku-5-5", prompt, 1000, true)).toBeCloseTo(0.000885, 9);
  });

  it("never allows fewer prompt tokens than the text has UTF-8 bytes, however dense the text", () => {
    // The old estimate counted ASCII at three characters a token; digit strings, LaTeX and
    // symbol-heavy mathematics can need nearly a token per character, so it could under-count.
    const digits = "31415926535897932384626433832795".repeat(100);
    const latex = String.raw`\forall\varepsilon>0\,\exists\delta>0:\ |x-y|<\delta\Rightarrow|f(x)-f(y)|<\varepsilon`.repeat(50);
    for (const text of [digits, latex, "∀ε>0∃δ>0".repeat(200), "ab😀".repeat(100)]) {
      expect(promptTokenBound({ text, messages: 1 })).toBeGreaterThanOrEqual(utf8Bytes(text));
      expect(promptTokenBound({ text, messages: 1 })).toBeGreaterThanOrEqual(text.length);
    }
    expect(utf8Bytes("abc")).toBe(3);
    expect(utf8Bytes("é".repeat(100))).toBe(200);
    expect(utf8Bytes("∀ε>0")).toBe(3 + 2 + 2);
    expect(utf8Bytes("ab😀")).toBe(2 + 4);
    // Long Unicode input: a hundred thousand CJK characters are three hundred thousand bytes.
    expect(promptTokenBound({ text: "数".repeat(100_000), messages: 1 })).toBeGreaterThanOrEqual(300_000);
  });

  it("counts framing for every message and the documented ceiling for every image", () => {
    const base = promptTokenBound({ text: "q", messages: 1 });
    expect(promptTokenBound({ text: "q", messages: 11 })).toBe(base + 10 * FRAMING_TOKENS_PER_MESSAGE);
    expect(promptTokenBound({ text: "q", messages: 1, images: 3 })).toBe(base + 3 * MAX_TOKENS_PER_IMAGE);
  });

  it("puts a long Haiku prompt in the dearer tier when its bound passes 100,000 tokens", () => {
    const short = worstCaseRunUsd("claude-haiku-5-5", { text: "x".repeat(50_000), messages: 1 }, 0, false);
    const long = worstCaseRunUsd("claude-haiku-5-5", { text: "x".repeat(150_000), messages: 1 }, 0, false);
    expect(long / short).toBeGreaterThan(3 * 5 * 0.9); // three times the tokens at five times the rate
  });

  it("refuses to state a worst case for a model without a known price (fails closed)", () => {
    expect(() => worstCaseRunUsd("claude-unknown-9", { text: "q", messages: 1 }, 100, false)).toThrow(UnpricedModelError);
  });

  it("rounds a reservation up to the next micro-dollar, never down", () => {
    const usd = worstCaseRunUsd("claude-haiku-5-5", { text: "x", messages: 1 }, 1, false);
    // 81 tokens (1 + 16 + 64) at $0.125/M + 1 token at $0.5/M = 0.000010125 + 0.0000005 = 0.000010625 -> 0.000011
    expect(usd).toBe(0.000011);
  });
});

describe("money", () => {
  it("parses decimal amounts from the database exactly into micro-dollars", () => {
    expect(parseUsdMicros("0")).toBe(0);
    expect(parseUsdMicros("12.345678")).toBe(12_345_678);
    expect(parseUsdMicros("0.000001")).toBe(1);
    expect(parseUsdMicros("5")).toBe(5_000_000);
    expect(parseUsdMicros("0.1")).toBe(100_000);
    expect(parseUsdMicros(null)).toBe(0);
    expect(() => parseUsdMicros("1e3")).toThrow();
  });

  it("decides limits in integer micro-dollars, so many small runs cannot slip past by rounding", () => {
    // 0.1 + 0.2 is 0.30000000000000004 in floating point; a limit of 0.3 must still admit it.
    const limits = { perRunUsd: 0.3, dailyUsd: 0.3, monthlyUsd: 0.3, warnFraction: 0.99 };
    expect(decideBudget(limits, { todayUsd: 0.1, monthUsd: 0.1 }, 0.2).allowed).toBe(true);
    expect(decideBudget(limits, { todayUsd: 0.100001, monthUsd: 0.100001 }, 0.2).allowed).toBe(false);
    expect(usdToMicros(0.1 + 0.2)).toBe(300_000);
  });
});

describe("role ceilings under the strict bound", () => {
  it("admit each role's whole output allowance with the prompt it normally carries, on the default model with fallback", () => {
    // Ordinary prompts: persona turns carry bounded history (24 KB) plus system and evidence; the
    // assessor and supervisor carry the rubric, reference, evidence, the work and the schema.
    const ordinaryBytes: Record<string, number> = {
      director: 32_000,
      convenor: 64_000,
      lecturer: 32_000,
      tutor: 40_000,
      librarian: 8_000,
      assessor: 48_000,
      seminar_chair: 16_000,
      supervisor: 48_000,
      peer: 16_000,
      transcriber: 4_000,
    };
    // The transcriber also carries up to twelve page images at the documented per-image ceiling.
    const ordinaryImages: Record<string, number> = { transcriber: 12 };
    for (const [role, contract] of Object.entries(ROLE_CONTRACTS)) {
      const bytes = ordinaryBytes[role];
      expect(bytes, `an ordinary prompt size is stated for ${role}`).toBeDefined();
      const worst = worstCaseRunUsd(
        DEFAULT_MODEL,
        { text: "x".repeat(bytes!), messages: 4, images: ordinaryImages[role] ?? 0 },
        contract.limits.maxOutputTokens,
        true,
      );
      expect(worst, `${role}: worst case ${worst} within its ceiling ${contract.limits.maxRunUsd}`).toBeLessThanOrEqual(
        contract.limits.maxRunUsd,
      );
    }
  });
});
