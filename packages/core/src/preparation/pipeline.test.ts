import { describe, expect, it } from "vitest";
import { checkUnitDraft, PREPARATION_STAGES, preparationSummary, stageWithinBudget, type UnitDraft } from "./pipeline";

const lesson = `${"A substantive lesson sentence about completeness and Cauchy sequences. ".repeat(60)} $x^n$ on $[0,1]$.`;
const draft = (over: Partial<UnitDraft> = {}): UnitDraft => ({
  lessonMarkdown: lesson,
  objectives: ["State the definition of a Banach space."],
  sourceLocatorIds: ["fa21-l1-def14"],
  exercises: [
    {
      title: "Completeness of C(X)",
      kind: "proof",
      promptMarkdown: "Prove that C_inf(X) with the sup norm is complete.",
      hintLadder: ["Start from a Cauchy sequence."],
      criteria: [
        { criterion: "Candidate limit defined pointwise.", weight: 0.5 },
        { criterion: "Uniform convergence shown.", weight: 0.5 },
      ],
      referenceSolution: "Take a Cauchy sequence u_n in the sup norm and fix x so that u_n(x) is Cauchy in C and converges.",
      stage: "independent",
    },
  ],
  misconceptions: [],
  ...over,
});

describe("the preparation pipeline", () => {
  it("names a role and an artifact for every stage, and leaves publication to the owner", () => {
    expect(PREPARATION_STAGES.map((s) => s.key)).toEqual([
      "source_inspection",
      "primary_shelf",
      "concept_mapping",
      "syllabus_workload",
      "resource_requirements",
      "unit_authoring",
      "checks",
      "publication",
    ]);
    expect(PREPARATION_STAGES.at(-1)).toMatchObject({ role: "owner", kind: "owner" });
    expect(PREPARATION_STAGES.filter((s) => s.kind === "model").map((s) => s.key)).toEqual(["unit_authoring"]);
  });

  it("states readiness from records, keeping source needs apart", () => {
    expect(
      preparationSummary(
        [
          { unitId: "u1", status: "ready", sourced: true },
          { unitId: "u2", status: "ready", sourced: true },
          { unitId: "u3", status: "draft", sourced: false },
          { unitId: "u4", status: "draft", sourced: true },
        ],
        true,
      ),
    ).toBe("4 units mapped; 2 prepared; 1 need source access; your next sessions are ready.");
  });

  it("admits a model step only when its worst case fits what is left of the budget", () => {
    expect(stageWithinBudget(1_000_000, 200_000, 800_000)).toEqual({ ok: true });
    expect(stageWithinBudget(1_000_000, 300_000, 800_000)).toMatchObject({ ok: false });
  });

  it("checks a draft's structure, sources, notation, rubric and leakage, not its correctness", () => {
    const ok = checkUnitDraft(draft(), { verifiedLocatorIds: new Set(["fa21-l1-def14"]) });
    expect(ok.every((c) => c.result === "pass")).toBe(true);
    const unsourced = checkUnitDraft(draft({ sourceLocatorIds: ["made-up-locator"] }), { verifiedLocatorIds: new Set(["fa21-l1-def14"]) });
    expect(unsourced.find((c) => c.name === "verified-sources")?.result).toBe("fail");
    const leaky = draft();
    leaky.exercises[0]!.hintLadder.push("Take a Cauchy sequence u_n in the sup norm and fix x so that u_n(x) is Cauchy.");
    expect(
      checkUnitDraft(leaky, { verifiedLocatorIds: new Set(["fa21-l1-def14"]) }).find((c) => c.name === "exercise-1-no-leak")?.result,
    ).toBe("fail");
    expect(
      checkUnitDraft(draft({ lessonMarkdown: "Too short $x" }), { verifiedLocatorIds: new Set(["fa21-l1-def14"]) })
        .filter((c) => c.result === "fail")
        .map((c) => c.name),
    ).toEqual(["lesson-length", "notation-balanced"]);
  });
});
