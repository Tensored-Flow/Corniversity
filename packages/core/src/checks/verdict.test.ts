import { describe, expect, it } from "vitest";
import { reconcileVerdict } from "./verdict";

const failedForbidden = [
  { passed: false, detail: "The submission appears to assert something that is not true in general: all norms equivalent." },
];

describe("reconcileVerdict", () => {
  it("withholds every fixture verdict, however confident the fixture claims to be", () => {
    const out = reconcileVerdict({ verdict: "accepted", confidence: 0.82, live: false, deterministic: [] });
    expect(out.verdict).toBe("needs_review");
    expect(out.confidence).toBeLessThanOrEqual(0.5);
    expect(out.notes.some((n) => /withheld/.test(n))).toBe(true);
  });

  it("holds a live acceptance for review when an automatic check found a claim that is not true in general", () => {
    const out = reconcileVerdict({ verdict: "accepted", confidence: 0.9, live: true, deterministic: failedForbidden });
    expect(out.verdict).toBe("needs_review");
    expect(out.confidence).toBeLessThanOrEqual(0.4);
  });

  it("routes a low-confidence live verdict to review and never upgrades one", () => {
    expect(reconcileVerdict({ verdict: "revision_requested", confidence: 0.5, live: true, deterministic: [] }).verdict).toBe(
      "needs_review",
    );
    const kept = reconcileVerdict({ verdict: "accepted", confidence: 0.9, live: true, deterministic: [{ passed: true, detail: "ok" }] });
    expect(kept.verdict).toBe("accepted");
    expect(kept.confidence).toBe(0.9);
    expect(kept.notes).toEqual([]);
  });
});
