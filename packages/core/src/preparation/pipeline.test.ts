import { describe, expect, it } from "vitest";
import { checkUnitDraft, PREPARATION_STAGES, preparationSummary, stageWithinBudget, type UnitDraft } from "./pipeline";
import { preparationDraft } from "./pipeline.fixture";

const draft = (over: Partial<UnitDraft> = {}): UnitDraft => ({ ...preparationDraft("passage-1", "fa21-l1-def14"), ...over });
const context = { verifiedLocatorIds: new Set(["fa21-l1-def14"]), suppliedPassageIds: new Set(["passage-1"]) };

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
    const ok = checkUnitDraft(draft(), context);
    expect(ok.every((c) => c.result === "pass")).toBe(true);
    const unsourced = checkUnitDraft(draft({ sourceLocatorIds: ["made-up-locator"] }), context);
    expect(unsourced.find((c) => c.name === "verified-sources")?.result).toBe("fail");
    const leaky = draft();
    leaky.exercises[0]!.hintLadder.push(leaky.exercises[0]!.referenceSolution);
    expect(checkUnitDraft(leaky, context).find((c) => c.name === "exercise-1-no-leak")?.result).toBe("fail");
    expect(
      checkUnitDraft(draft({ lessonMarkdown: "Too short $x", workedExamples: [] }), context)
        .filter((c) => c.result === "fail")
        .map((c) => c.name),
    ).toEqual(expect.arrayContaining(["lesson-length", "notation-balanced"]));
  });
  it("rejects the previous repeated-sentence fixture and missing worked reasoning", () => {
    const filler = draft({
      lessonMarkdown: "A substantive lesson sentence about completeness and Cauchy sequences. ".repeat(80),
      workedExamples: [],
    });
    const failures = checkUnitDraft(filler, context)
      .filter((c) => c.result === "fail")
      .map((c) => c.name);
    expect(failures).toContain("non-repetitive-teaching");
    expect(failures).toContain("worked-reasoning");
  });

  it("refuses citation of an existing passage that was not actually supplied", () => {
    expect(
      checkUnitDraft(draft({ sourcePassageIds: ["other-passage"] }), context).find((c) => c.name === "supplied-source-passages")?.result,
    ).toBe("fail");
    expect(checkUnitDraft(draft({ sourcePassageIds: [] }), context).find((c) => c.name === "supplied-source-passages")?.result).toBe(
      "fail",
    );
  });

  it("requires every planned objective to remain and have assessment, including transfer", () => {
    const omitted = draft();
    omitted.objectives.push("Distinguish interpolation from extrapolation.");
    expect(checkUnitDraft(omitted, context).find((c) => c.name === "objective-coverage")?.result).toBe("fail");
    const allRoutine = draft();
    for (const e of allRoutine.exercises) e.stage = "independent";
    expect(checkUnitDraft(allRoutine, context).find((c) => c.name === "problem-progression")?.result).toBe("fail");
    expect(
      checkUnitDraft(draft(), { ...context, expectedObjectives: ["A different planned capability."] }).find(
        (c) => c.name === "objective-coverage",
      )?.result,
    ).toBe("fail");
  });
});
