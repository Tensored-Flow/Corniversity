import { describe, expect, it } from "vitest";
import {
  classifyConceptEvidence,
  MAX_BRIDGE_DEPTH,
  nextBridgeStep,
  type PrerequisiteEvidence,
  ruleStanding,
  unitPrerequisites,
} from "./bridges";

const ev = (entries: [string, PrerequisiteEvidence][]) => new Map(entries);

describe("concept evidence", () => {
  it("counts only submitted work as support; reading, viewing and solutions never do", () => {
    expect(classifyConceptEvidence({ state: "demonstrated" })).toBe("supported_by_work");
    expect(classifyConceptEvidence({ state: "practised" })).toBe("supported_by_work");
    expect(classifyConceptEvidence({ state: "revisit" })).toBe("supported_by_work");
    // "introduced" is what reading, a lecture or a revealed solution produce.
    expect(classifyConceptEvidence({ state: "introduced" })).toBe("not_shown");
    expect(classifyConceptEvidence({ state: "unassessed" })).toBe("not_shown");
    expect(classifyConceptEvidence({})).toBe("not_shown");
  });

  it("keeps a learner's own report apart from work, and work wins", () => {
    expect(classifyConceptEvidence({ state: "introduced", selfKnown: true })).toBe("self_reported");
    expect(classifyConceptEvidence({ state: "demonstrated", selfKnown: true })).toBe("supported_by_work");
  });
});

describe("a unit's prerequisite concepts", () => {
  const concepts = new Map([
    ["membrane-potential-basics", { title: "The membrane potential", description: "…" }],
    ["ode-basics", { title: "ODEs", description: "…" }],
  ]);

  it("lists a required concept even when no bridge or supplying course is prepared", () => {
    const list = unitPrerequisites(
      ["ode-basics", "membrane-potential-basics"],
      concepts,
      ev([["ode-basics", "supported_by_work"]]),
      new Set(),
    );
    expect(list.map((c) => c.conceptId)).toEqual(["membrane-potential-basics", "ode-basics"]);
    expect(list[0]).toMatchObject({ evidence: "not_shown", bridge: "unprepared" });
  });

  it("reports a prepared bridge without changing the evidence", () => {
    const [m] = unitPrerequisites(["membrane-potential-basics"], concepts, ev([]), new Set(["membrane-potential-basics"]));
    expect(m).toMatchObject({ evidence: "not_shown", bridge: "prepared" });
  });
});

describe("rules are met only by their own concepts", () => {
  const biology = {
    id: "NEU-220-membrane-biology",
    strength: "soft" as const,
    alternatives: [
      { label: "The biology", conceptIds: ["membrane-potential-basics"], courseIds: [] },
      { label: "Neuroscience Foundations", conceptIds: [], courseIds: ["NEU-101"] },
    ],
  };

  it("is not met by mathematical evidence, however strong", () => {
    const strongMaths = ev([
      ["ode-basics", "supported_by_work"],
      ["linear-algebra-vector-spaces", "supported_by_work"],
      ["multivariable-calculus", "supported_by_work"],
    ]);
    expect(ruleStanding(biology, strongMaths)).toEqual({ status: "not_met", missing: ["membrane-potential-basics"] });
  });

  it("distinguishes work from a self-report, and an override never counts as work", () => {
    expect(ruleStanding(biology, ev([["membrane-potential-basics", "self_reported"]]))).toEqual({
      status: "met_by_report",
      alternative: "The biology",
    });
    expect(ruleStanding(biology, ev([["membrane-potential-basics", "supported_by_work"]]))).toEqual({
      status: "met_by_work",
      alternative: "The biology",
    });
  });

  it("needs every concept of an alternative", () => {
    const rule = {
      id: "r",
      strength: "soft" as const,
      alternatives: [{ label: "both", conceptIds: ["a", "b"], courseIds: [] }],
    };
    expect(ruleStanding(rule, ev([["a", "supported_by_work"]]))).toEqual({ status: "not_met", missing: ["b"] });
  });
});

describe("bridge trails terminate", () => {
  it("opens a bridge from a lesson and one bridge it assumes, then stops", () => {
    const one = nextBridgeStep([], "membrane-potential-basics");
    expect(one).toEqual({ ok: true, trail: ["membrane-potential-basics"] });
    const two = nextBridgeStep(["membrane-potential-basics"], "ode-basics");
    expect(two).toEqual({ ok: true, trail: ["membrane-potential-basics", "ode-basics"] });
    const three = nextBridgeStep(["membrane-potential-basics", "ode-basics"], "complex-analysis-basics");
    expect(three).toMatchObject({ ok: false, reason: "depth" });
    expect(MAX_BRIDGE_DEPTH).toBe(2);
  });

  it("reports a cycle instead of following it", () => {
    expect(nextBridgeStep(["a", "b"], "a", 5)).toMatchObject({ ok: false, reason: "cycle" });
    expect(nextBridgeStep(["a"], "a")).toMatchObject({ ok: false, reason: "cycle" });
  });
});
