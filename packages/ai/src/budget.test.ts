import { describe, expect, it } from "vitest";
import { decideBudget } from "./budget";
import { estimateCostUsd, estimateRunCostUsd } from "./pricing";

const limits = { perRunUsd: 0.5, dailyUsd: 3, monthlyUsd: 40, hardStop: true, warnFraction: 0.8 };

describe("decideBudget", () => {
  it("allows a small run with no warnings", () => {
    const d = decideBudget(limits, { todayUsd: 0.1, monthUsd: 1 }, 0.05);
    expect(d.allowed).toBe(true);
    expect(d.warnings).toEqual([]);
  });
  it("refuses a run above the per-run limit", () => {
    const d = decideBudget(limits, { todayUsd: 0, monthUsd: 0 }, 0.75);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/per-run limit/);
  });
  it("hard-stops when the daily cap would be exceeded", () => {
    const d = decideBudget(limits, { todayUsd: 2.9, monthUsd: 10 }, 0.2);
    expect(d.allowed).toBe(false);
  });
  it("warns near the daily cap", () => {
    const d = decideBudget(limits, { todayUsd: 2.3, monthUsd: 10 }, 0.2);
    expect(d.allowed).toBe(true);
    expect(d.warnings[0]).toMatch(/Approaching today's budget/);
  });
  it("only warns (does not stop) when hardStop is off", () => {
    const d = decideBudget({ ...limits, hardStop: false }, { todayUsd: 5, monthUsd: 50 }, 0.1);
    expect(d.allowed).toBe(true);
  });
});

describe("pricing", () => {
  it("prices opus 5.5 usage from the table", () => {
    const cost = estimateCostUsd("claude-opus-5-5", {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    expect(cost).toBe(4);
  });
  it("estimates a run from input text and expected output", () => {
    const cost = estimateRunCostUsd("claude-opus-5-5", "x".repeat(4000), 1000);
    // 1000 input tokens * $4/M + 1000 output * $20/M = $0.024
    expect(cost).toBeCloseTo(0.024, 6);
  });
  it("prices an unknown model at the dearest known rate so an estimate never under-counts", () => {
    // 100 input tokens at $10/M plus 100 output tokens at $50/M (the dearest entries in the table).
    expect(estimateCostUsd("some-new-model", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBeCloseTo(
      0.006,
      9,
    );
  });
  it("the fixture provider costs nothing", () => {
    expect(estimateCostUsd("fixture", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(0);
  });
});
