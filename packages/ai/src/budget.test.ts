import { describe, expect, it } from "vitest";
import { BudgetLimitError, decideBudget, validateBudgetLimits } from "./budget";
import { costOfAttempts, estimateCostUsd, estimatePromptTokens, estimateRunCostUsd, worstCaseRunUsd } from "./pricing";

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

  it("puts a run's worst case at the whole allowance, the estimated prompt at the cache-write rate, and a fallback run", () => {
    const prompt = "x".repeat(3000); // 1000 tokens at three characters a token
    // Opus 5.5: 1000*$5/M (cache write) + 1000*$20/M = 0.025.
    expect(worstCaseRunUsd("claude-opus-5-5", prompt, 1000, false)).toBeCloseTo(0.025, 9);
    // Plus the dearest documented fallback (Opus 5 / Opus 4.8), whose prompt also carries the
    // declined attempt's output as continuation: (1000 + 1000)*$6.25/M + 1000*$25/M = 0.0375.
    expect(worstCaseRunUsd("claude-opus-5-5", prompt, 1000, true)).toBeCloseTo(0.0625, 9);
    // Haiku 5.5 has no server-side fallback, so the flag changes nothing.
    expect(worstCaseRunUsd("claude-haiku-5-5", prompt, 1000, true)).toBeCloseTo(0.000625, 9);
  });

  it("counts characters outside ASCII at their UTF-8 bytes, never fewer tokens than a byte each", () => {
    expect(estimatePromptTokens("abc")).toBe(1);
    expect(estimatePromptTokens("é".repeat(100))).toBe(200);
    expect(estimatePromptTokens("∀ε>0")).toBe(1 + 3 + 2); // two ASCII characters, ∀ and ε
    expect(estimatePromptTokens("ab😀")).toBe(1 + 4);
    // A prompt of symbols costs more in the worst case than the same number of ASCII letters.
    expect(worstCaseRunUsd("claude-opus-5-5", "∀".repeat(300), 0, false)).toBeGreaterThan(
      worstCaseRunUsd("claude-opus-5-5", "x".repeat(300), 0, false),
    );
  });
});
