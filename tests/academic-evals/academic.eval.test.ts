import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DeterministicCheck } from "@corniversity/core";
import { runDeterministicChecks } from "@corniversity/core/checks/deterministic";
import { annotateTurn, formatEvidenceBlocks } from "@corniversity/core/grounding/citations";
import { l1NormXn, supNormXn } from "@corniversity/core/labs/index";
import { describe, expect, it } from "vitest";
import { fixtureScenario } from "../../apps/worker/src/handlers/assess";

/**
 * Academic evaluation set. Each case is inspectable and names what it can and cannot show:
 * deterministic checks exercise the rules the assessor sees first; fixture cases show how the
 * worker maps those results to a scripted assessor outcome; grounding cases show that a
 * fabricated citation cannot reach the learner as if it were real. None of this is evidence
 * about a live model's judgement; live-model behaviour is recorded separately in QA_REPORT.md.
 */

const root = resolve(__dirname, "../..");
const exercise = (course: string, unitGlob: string, id: string) => {
  const dir = resolve(root, "content/courses", course, "units");
  const unitDir = readdirSync(dir).find((d) => d.startsWith(unitGlob));
  if (!unitDir) throw new Error(`unit ${unitGlob} not found for ${course}`);
  return JSON.parse(readFileSync(resolve(dir, unitDir, "exercises", `${id}.json`), "utf8")) as {
    deterministicChecks: DeterministicCheck[];
    checkExamples: { label: string; text: string; expect: Record<string, boolean> }[];
  };
};

import { readdirSync } from "node:fs";

const passedIds = (text: string, checks: DeterministicCheck[]) =>
  runDeterministicChecks(text, checks)
    .filter((r) => r.passed)
    .map((r) => r.checkId);
const failedIds = (text: string, checks: DeterministicCheck[]) =>
  runDeterministicChecks(text, checks)
    .filter((r) => !r.passed)
    .map((r) => r.checkId);

describe("norm comparison with f_n(x) = x^n (MAT-230, unit 1)", () => {
  const ex = exercise("MAT-230", "01-", "MAT-230-u01-ex1");
  it("the expected calculation is sup norm 1 and integral norm 1/(n+1)", () => {
    expect(supNormXn(7)).toBe(1);
    expect(l1NormXn(7)).toBeCloseTo(1 / 8, 12);
  });
  it("a correct attempt in different words passes the checks a reference-structured proof passes", () => {
    const different =
      "Take g_n(x)=x^n. Its maximum on the interval is attained at x=1, so the sup norm is 1 for every n, while ∫_0^1 x^n dx = 1/(n+1) → 0. Were the norms comparable, a constant would bound 1 by C/(n+1) for all n, absurd. The equivalence theorem needs finite dimension and C([0,1]) is not finite-dimensional.";
    expect(failedIds(different, ex.deterministicChecks)).toEqual([]);
  });
  it("a finite collection of numerical examples is not accepted as a general argument", () => {
    const examplesOnly =
      "For n=1 the integral is 1/2, for n=2 it is 1/3, for n=3 it is 1/4, and the sup norm is 1 each time, so the norms are not equivalent.";
    const failed = failedIds(examplesOnly, ex.deterministicChecks);
    expect(failed.length).toBeGreaterThan(0);
    expect(fixtureScenario("MAT-230-u01-ex1", runDeterministicChecks(examplesOnly, ex.deterministicChecks))).toMatch(
      /examples-only|default/,
    );
  });
  it("an over-generalised appeal to norm equivalence triggers the objection", () => {
    const over =
      "Since all norms are equivalent, the sup norm and the integral norm are comparable on C([0,1]), so the sequence shows nothing special.";
    const results = runDeterministicChecks(over, ex.deterministicChecks);
    expect(results.some((r) => !r.passed && /not true in general|finite/i.test(r.detail))).toBe(true);
    expect(fixtureScenario("MAT-230-u01-ex1", results)).toBe("MAT-230-u01-ex1_overgeneralisation");
  });
  it("every authored check example behaves as its author declared", () => {
    for (const example of ex.checkExamples) {
      const results = runDeterministicChecks(example.text, ex.deterministicChecks);
      for (const [checkId, expected] of Object.entries(example.expect)) {
        expect(results.find((r) => r.checkId === checkId)?.passed, `${example.label} / ${checkId}`).toBe(expected);
      }
    }
  });
});

describe("hypothesis discipline", () => {
  it("a closed-subspace claim without completeness of the ambient space is flagged by a requires_hypothesis check", () => {
    const check: DeterministicCheck = {
      id: "closed-needs-complete",
      kind: "requires_hypothesis",
      description: "A closed subspace is complete only inside a complete space.",
      params: {
        triggerPatterns: ["closed subspace", "closedsubspace"],
        hypothesisPatterns: [
          "banach",
          "complete(ness)? of (the )?(ambient|whole|surrounding) space",
          "ambient space is complete",
          "complete normed space",
        ],
      },
    };
    const blanket = "Every closed subspace of a normed space is complete, so the kernel is complete.";
    const careful = "Every closed subspace of a Banach space is complete; here the ambient space is complete, so the kernel is complete.";
    expect(runDeterministicChecks(blanket, [check])[0]?.passed).toBe(false);
    expect(runDeterministicChecks(careful, [check])[0]?.passed).toBe(true);
  });
});

describe("source grounding", () => {
  const allowed = formatEvidenceBlocks([
    { label: "Lecture 1, Definition 7 (norm)", locatorId: "fa21-l1-def7", text: "Location only." },
  ]).refs;
  it("a fabricated citation is removed and the sentence is recorded as uncited rather than shown as sourced", () => {
    const turn = annotateTurn(
      "{source-backed} The theorem is proved on page 212 of the notes [E7].\n\nA norm is positive definite [E1].",
      allowed,
    );
    expect(turn.unknownTags).toEqual(["E7"]);
    expect(turn.markdown).not.toContain("E7");
    expect(turn.uncitedClaims.length).toBe(1);
    expect(turn.labels).toContain("needs_checking");
    expect(turn.citations.map((c) => c.tag)).toEqual(["E1"]);
  });
  it("evidence blocks never carry URLs or page numbers for the model to copy", () => {
    const { prompt } = formatEvidenceBlocks([
      { label: "Lecture 1, Definition 7", locatorId: "fa21-l1-def7", text: "Location only (passage text not retrieved)." },
    ]);
    expect(prompt).not.toMatch(/https?:\/\//);
    expect(prompt).toContain("[E1]");
  });
});

describe("conventions, constraints and leakage (authored checks from the launch courses)", () => {
  it("the general-relativity unit declares its signature and its check examples hold", () => {
    const ex = exercise("PHY-240", "01-", "PHY-240-u01-ex1");
    for (const example of ex.checkExamples) {
      const results = runDeterministicChecks(example.text, ex.deterministicChecks);
      for (const [checkId, expected] of Object.entries(example.expect))
        expect(results.find((r) => r.checkId === checkId)?.passed, `${example.label} / ${checkId}`).toBe(expected);
    }
  });
  it("the kinetics report must respect the stated model numbers and the check examples hold", () => {
    const ex = exercise("CHE-101", "05-", "CHE-101-u05-ex3");
    const wrongK = "At equilibrium [A]eq = 0.25 M and [B]eq = 0.75 M, so K = 0.33 and the relaxation time is 2.5 min.";
    expect(failedIds(wrongK, ex.deterministicChecks).length).toBeGreaterThan(0);
    for (const example of ex.checkExamples) {
      const results = runDeterministicChecks(example.text, ex.deterministicChecks);
      for (const [checkId, expected] of Object.entries(example.expect))
        expect(results.find((r) => r.checkId === checkId)?.passed, `${example.label} / ${checkId}`).toBe(expected);
    }
  });
  it("the leakage exercise does not reward a high metric uncritically", () => {
    const ex = exercise("CSA-210", "01-", "CSA-210-u01-ex1");
    const uncritical = "The pipeline looks sound; 97.4% shows a strong model and there are no leaks in the pipeline.";
    const results = runDeterministicChecks(uncritical, ex.deterministicChecks);
    expect(results.some((r) => !r.passed)).toBe(true);
    const careful =
      "The ticket feature leaks the target; the trivial baseline is 94% (predict no failure), so 97.4% on a random split is not evidence.";
    expect(passedIds(careful, ex.deterministicChecks).length).toBeGreaterThan(passedIds(uncritical, ex.deterministicChecks).length);
  });
  it("the synthetic neuroscience report must say the data are synthetic", () => {
    const ex = exercise("NEU-220", "02-", "NEU-220-u02-ex3");
    const claims =
      "The tuning curve fitted to the spike count data shows the neuron recorded from V1 prefers 65 degrees; the held-out baseline comparison favours the tuning model.";
    const results = runDeterministicChecks(claims, ex.deterministicChecks);
    expect(results.some((r) => !r.passed)).toBe(true);
  });
});

describe("cases that need a live model or a human reviewer (recorded, not claimed)", () => {
  it("lists the evaluations this set cannot perform deterministically", () => {
    const pending = [
      "a correct proof with a novel structure judged by the assessor (fixture: accepted when all checks pass; live: unverified)",
      "a lecturer adapting a weak-prerequisite route without infantilising the learner",
      "conflicting source conventions handled explicitly in a live explanation",
      "low-quality handwritten transcription asking for confirmation (upload of images is not implemented)",
      "a peer refusing to retrieve an unreleased solution (common room is Milestone 6)",
    ];
    expect(pending.length).toBe(5);
  });
});
