import { describe, expect, it } from "vitest";
import { defaultContentRoot, loadContent } from "./load";
import { validateContent } from "./validate";

const bundle = loadContent(defaultContentRoot());
const errors = (b: typeof bundle) =>
  validateContent(b)
    .issues.filter((i) => i.level === "error")
    .map((i) => i.message);

describe("content validation", () => {
  it("refuses a checked visual that fails its checks, and a published visual without a review", () => {
    const failing = structuredClone(bundle);
    const visual = failing.visuals[0]!;
    visual.spec.status = "checked";
    visual.spec.checks = [{ id: "impossible", kind: "series_value", series: "missing", at: 0, expected: 1, tolerance: 0.001 } as never];
    expect(errors(failing).some((m) => m.includes("visual fails its checks"))).toBe(true);
    const unreviewed = structuredClone(bundle);
    unreviewed.visuals[0]!.spec.status = "published";
    delete unreviewed.visuals[0]!.spec.review;
    expect(errors(unreviewed)).toContain("a published visual needs a second reader's review (review.by, review.on, review.notes)");
    unreviewed.visuals[0]!.spec.review = { by: "A second reader", on: "2026-11-10", notes: "Checked the storyboard against the unit." };
    expect(errors(unreviewed).some((m) => m.includes("second reader"))).toBe(false);
  });

  it("accepts the committed catalogue", () => {
    expect(errors(bundle)).toEqual([]);
  });

  it("refuses a method mapped to a unit that does not teach the method's concept", () => {
    const broken = structuredClone(bundle);
    const unit = broken.courses.find((c) => c.spec.id === "NEU-220")!.units.find((u) => u.spec.id === "NEU-220-u02")!;
    unit.spec.teachesConceptIds = unit.spec.teachesConceptIds.filter((c) => c !== "method-predictive-checks");
    expect(errors(broken)).toContain("method predictive-checks maps NEU-220-u02, which does not teach method-predictive-checks");
  });
});
