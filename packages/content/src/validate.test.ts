import { describe, expect, it } from "vitest";
import { defaultContentRoot, loadContent } from "./load";
import { validateContent } from "./validate";

const bundle = loadContent(defaultContentRoot());
const errors = (b: typeof bundle) =>
  validateContent(b)
    .issues.filter((i) => i.level === "error")
    .map((i) => i.message);

describe("content validation", () => {
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
