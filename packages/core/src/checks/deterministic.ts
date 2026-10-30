import type { DeterministicCheck } from "../domain/course";

/**
 * Deterministic checks run before any model sees a submission. They are honest about their
 * scope: pattern checks establish presence or absence of specific expressions and claims, not
 * correctness of a proof. Their results are shown to the learner as "automatic checks" and
 * handed to the assessor as evidence; they never award acceptance on their own.
 */
export interface CheckResult {
  checkId: string;
  passed: boolean;
  detail: string;
  kind: DeterministicCheck["kind"];
}

const DOUBLE_BAR = "‖"; // ‖

/**
 * Normalises mathematical text so that equivalent spellings compare equal:
 * lowercase; $ delimiters dropped; LaTeX \| and ASCII || become the single symbol ‖;
 * \left/\right removed; \frac{a}{b} → (a)/(b); ^{x} → ^x and _{x} → _x; \infty → inf;
 * leading backslash dropped from \sup \inf \max \min \lim \int \sum; whitespace removed.
 */
export function normaliseMath(text: string): string {
  let s = text.toLowerCase();
  s = s.replace(/\$+/g, "");
  s = s.split("\\|").join(DOUBLE_BAR);
  s = s.split("||").join(DOUBLE_BAR);
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)");
  s = s.replace(/\\(?:cdot|times)/g, "*");
  s = s.replace(/[−–]/g, "-");
  s = s.replace(/\\,|\\;|\\!|\\ /g, "");
  s = s.replace(/\^\{([^{}]*)\}/g, "^$1");
  s = s.replace(/_\{([^{}]*)\}/g, "_$1");
  s = s.replace(/\\infty/g, "inf");
  s = s.replace(/\\(?:sup|inf|max|min|lim|int|sum)/g, (m) => m.slice(1));
  s = s.replace(/\s+/g, "");
  return s;
}

function toRegExps(raw: unknown): RegExp[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === "string").map((p) => new RegExp(p, "i"));
}

export function runDeterministicChecks(submission: string, checks: DeterministicCheck[]): CheckResult[] {
  const normalised = normaliseMath(submission);
  const lower = submission.toLowerCase();
  return checks.map((check) => {
    switch (check.kind) {
      case "expression_present": {
        const patterns = toRegExps(check.params.patterns);
        const requireAll = check.params.requireAll === true;
        const hits = patterns.map((p) => p.test(normalised));
        const passed = requireAll ? hits.every(Boolean) : hits.some(Boolean);
        return {
          checkId: check.id,
          kind: check.kind,
          passed,
          detail: passed
            ? `Found the expected expression (${check.description}).`
            : `Did not find the expected expression (${check.description}).`,
        };
      }
      case "numeric_value": {
        const expected = Number(check.params.expected);
        const tolerance = Number(check.params.tolerance ?? 1e-9);
        const numbers = (submission.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
        const passed = numbers.some((n) => Math.abs(n - expected) <= tolerance);
        return {
          checkId: check.id,
          kind: check.kind,
          passed,
          detail: passed ? `Found the value ${expected}.` : `The value ${expected} does not appear (${check.description}).`,
        };
      }
      case "forbidden_claim": {
        const patterns = toRegExps(check.params.patterns);
        const offending = patterns.find((p) => p.test(lower) || p.test(normalised));
        return {
          checkId: check.id,
          kind: check.kind,
          passed: !offending,
          detail: offending
            ? `The submission appears to assert something that is not true in general: ${check.description}.`
            : `No forbidden claim detected (${check.description}).`,
        };
      }
      case "requires_hypothesis": {
        const triggers = toRegExps(check.params.triggerPatterns);
        const hypotheses = toRegExps(check.params.hypothesisPatterns);
        const triggered = triggers.some((p) => p.test(lower));
        const hasHypothesis = hypotheses.some((p) => p.test(lower));
        const passed = !triggered || hasHypothesis;
        return {
          checkId: check.id,
          kind: check.kind,
          passed,
          detail: passed
            ? triggered
              ? "The claim is stated with its necessary hypothesis."
              : "The claim that needs a hypothesis was not made."
            : `A claim is made without a hypothesis it needs: ${check.description}.`,
        };
      }
      case "finite_examples_not_proof": {
        const exampleCount = (lower.match(/\bn\s*=\s*\d+/g) ?? []).length;
        const generalMarkers = /(for (all|every|each)|arbitrary|let\s+n|fix\s+n|suppose|assume|general|induction|\\forall|∀)/i;
        const passed = exampleCount < 2 || generalMarkers.test(submission);
        return {
          checkId: check.id,
          kind: check.kind,
          passed,
          detail: passed
            ? "The argument is not merely a list of numerical instances."
            : `Several numerical instances appear (${exampleCount}) but no general argument; examples alone do not prove a statement for all n.`,
        };
      }
    }
  });
}

/** Summary used in the UI: automatic checks are advisory. */
export function summariseChecks(results: CheckResult[]): { passed: number; failed: number; advisory: true } {
  return {
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    advisory: true,
  };
}
