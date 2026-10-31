import { describe, expect, it } from "vitest";
import type { DeterministicCheck } from "../domain/course";
import { normaliseMath, runDeterministicChecks } from "./deterministic";

/** The C1 task: f_n(x) = x^n on [0,1]; sup norm 1, L¹ norm 1/(n+1). Mirrors the authored exercise. */
const normChecks: DeterministicCheck[] = [
  {
    id: "sup-norm-one",
    kind: "expression_present",
    description: "sup norm of x^n equals 1",
    params: {
      patterns: [
        "(_inf|_∞|supnorm|sup_|‖f_n‖_∞|‖f_n‖_inf)[^=]{0,80}=1(?![0-9]|\\.[0-9]|/)",
        "supnormis1(?![0-9]|\\.[0-9]|/)",
        "(infinity|inf|sup)norm[^=]{0,30}(=|is|equals)1(?![0-9]|\\.[0-9]|/)",
      ],
    },
  },
  {
    id: "l1-norm",
    kind: "expression_present",
    description: "L¹ norm of x^n equals 1/(n+1)",
    params: { patterns: ["\\(1\\)/\\(n\\+1\\)", "1/\\(n\\+1\\)", "\\(n\\+1\\)\\^\\{?-1", "1/\\(1\\+n\\)"] },
  },
  {
    id: "no-equivalence-claim",
    kind: "forbidden_claim",
    description: "asserting that the norms are equivalent on C([0,1])",
    params: {
      patterns: [
        "(since|because|as) all norms are equivalent",
        "all norms are equivalent[,;]? ?(so|hence|therefore|thus)",
        "(the|these|both|the two) norms are equivalent(?! only| in finite| on finite)",
        "normsareequivalenton(c\\(\\[0,1\\]\\)|thisspace)",
      ],
    },
  },
  {
    id: "examples-only",
    kind: "finite_examples_not_proof",
    description: "a few values of n are not a proof",
    params: {},
  },
];

describe("normaliseMath", () => {
  it("turns LaTeX fractions, double bars and spacing into a canonical form", () => {
    expect(normaliseMath("\\frac{1}{n+1}")).toBe("(1)/(n+1)");
    expect(normaliseMath("\\|f_n\\|_{\\infty} = 1")).toBe("‖f_n‖_inf=1");
    expect(normaliseMath("||T|| = 1")).toBe("‖t‖=1");
    expect(normaliseMath("$\\dfrac{ 1 }{ n + 1 }$")).toBe("(1)/(n+1)");
  });
});

describe("runDeterministicChecks on the x^n norm task", () => {
  it("accepts a correct calculation in LaTeX", () => {
    const text = [
      "Let $f_n(x) = x^n$ on $[0,1]$.",
      "Sup norm: $\\|f_n\\|_\\infty = \\sup_{x\\in[0,1]} x^n = 1$ for every $n$.",
      "Integral norm: $\\|f_n\\|_1 = \\int_0^1 x^n\\,dx = \\frac{1}{n+1}$.",
      "So the ratio is unbounded: no constant $C$ with $\\|f\\|_\\infty \\le C\\|f\\|_1$ exists, hence the norms are not equivalent on $C([0,1])$, unlike the finite-dimensional case.",
    ].join("\n");
    const results = runDeterministicChecks(text, normChecks);
    expect(results.find((r) => r.checkId === "sup-norm-one")?.passed).toBe(true);
    expect(results.find((r) => r.checkId === "l1-norm")?.passed).toBe(true);
    expect(results.find((r) => r.checkId === "no-equivalence-claim")?.passed).toBe(true);
    expect(results.find((r) => r.checkId === "examples-only")?.passed).toBe(true);
  });

  it("accepts a value at the end of a sentence but not a decimal continuation", () => {
    expect(runDeterministicChecks("The sup norm is 1.", normChecks).find((r) => r.checkId === "sup-norm-one")?.passed).toBe(true);
    expect(runDeterministicChecks("The sup norm is 1.5 at most.", normChecks).find((r) => r.checkId === "sup-norm-one")?.passed).toBe(
      false,
    );
  });

  it("flags the over-generalisation that all norms are equivalent", () => {
    const text = "Since all norms are equivalent, the sup norm and the integral norm are comparable here too.";
    const results = runDeterministicChecks(text, normChecks);
    expect(results.find((r) => r.checkId === "no-equivalence-claim")?.passed).toBe(false);
  });

  it("does not flag a learner who mentions the finite-dimensional theorem in order to deny it applies", () => {
    const text =
      "The theorem that all norms are equivalent needs finite dimension, and C([0,1]) is infinite-dimensional, so the norms are not equivalent here.";
    const results = runDeterministicChecks(text, normChecks);
    expect(results.find((r) => r.checkId === "no-equivalence-claim")?.passed).toBe(true);
  });

  it("flags a list of numerical instances with no general argument", () => {
    const text = "For n=1 the integral is 1/2, for n=2 it is 1/3, for n=3 it is 1/4. So the claim holds.";
    const results = runDeterministicChecks(text, normChecks);
    expect(results.find((r) => r.checkId === "examples-only")?.passed).toBe(false);
  });

  it("does not flag instances when a general argument is present", () => {
    const text = "For n=1 the integral is 1/2 and for n=2 it is 1/3; in general, for all n, ∫x^n = 1/(n+1).";
    const results = runDeterministicChecks(text, normChecks);
    expect(results.find((r) => r.checkId === "examples-only")?.passed).toBe(true);
  });
});

describe("requires_hypothesis", () => {
  const check: DeterministicCheck = {
    id: "closed-subspace-complete",
    kind: "requires_hypothesis",
    description: "a closed subspace is complete only inside a complete (Banach) space",
    params: {
      triggerPatterns: ["closed (linear )?subspace[^.]*(is|are) complete", "closed subspace[^.]*banach"],
      hypothesisPatterns: ["banach", "complete normed", "complete space", "ambient space is complete", "complete metric"],
    },
  };
  it("objects to the blanket claim", () => {
    const [r] = runDeterministicChecks("Every closed subspace of a normed space is complete.", [check]);
    expect(r?.passed).toBe(false);
  });
  it("accepts the claim with the hypothesis", () => {
    const [r] = runDeterministicChecks(
      "A closed subspace of a Banach space is complete, since Cauchy sequences converge in the ambient space.",
      [check],
    );
    expect(r?.passed).toBe(true);
  });
});
