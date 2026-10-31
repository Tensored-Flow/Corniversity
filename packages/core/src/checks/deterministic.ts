import type { DeterministicCheck } from "../domain/course";

/**
 * Deterministic checks run before any model sees a submission. They are honest about their
 * scope: pattern checks establish presence or absence of specific expressions and claims, not
 * correctness of a proof. Their results are shown to the learner as "automatic checks" and
 * handed to the assessor as evidence; they never award acceptance on their own.
 *
 * Absence checks (no forbidden claim, hypothesis present, not merely examples) can only be
 * meaningful on text that could carry an argument, so they refuse to pass on a submission of a
 * few words: an empty answer must not light up a row of green ticks.
 */
export interface CheckResult {
  checkId: string;
  passed: boolean;
  detail: string;
  kind: DeterministicCheck["kind"];
}

const DOUBLE_BAR = "‖"; // ‖

/** Fewer words than this cannot contain an argument for an absence check to examine. */
export const MIN_WORDS_FOR_ARGUMENT = 8;

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

/** Words that carry a letter or a digit; punctuation and bare symbols do not count. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * Every number written in the text: plain decimals, scientific notation (1.312e+3, 6.564e-7),
 * the forms 6.564 × 10^-7, 6.564 x 10^{-7}, 6.564\times10^{-7} and a bare power of ten, with a
 * Unicode minus accepted and thousands separators (10,000) removed first.
 */
export function extractNumbers(text: string): number[] {
  const s = text.replace(/[−–]/g, "-").replace(/(\d),(\d{3})(?!\d)/g, "$1$2");
  const token =
    /(?<![\d.])10\s*\^\s*\{?\s*([-+]?\d+)\s*\}?|(-?\d+(?:\.\d+)?)(?:\s*[eE]\s*([-+]?\d+)|\s*(?:×|x|X|\\times|\\cdot|·|\*)\s*10\s*\^\s*\{?\s*([-+]?\d+)\s*\}?)?/g;
  const numbers: number[] = [];
  for (const match of s.matchAll(token)) {
    if (match[1] !== undefined && match[2] === undefined) {
      numbers.push(10 ** Number(match[1]));
      continue;
    }
    const mantissa = Number(match[2]);
    const exponent = Number(match[3] ?? match[4] ?? 0);
    numbers.push(mantissa * 10 ** exponent);
  }
  return numbers.filter((n) => Number.isFinite(n));
}

function toRegExps(raw: unknown): RegExp[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === "string").map((p) => new RegExp(p, "i"));
}

/**
 * Sentences of the lower-cased text, so a hypothesis can be required near the claim it
 * supports. Semicolons join clauses of one sentence and do not split.
 */
function sentences(lower: string): string[] {
  return lower
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * How far from a claim its hypothesis may sit and still count: the three sentences before it (a
 * hypothesis is usually declared first) and the one after it (a qualification often follows
 * the computation). A check may set `scope: "anywhere"` for document-level discipline, such as
 * a report that must say once that its data are synthetic.
 */
const HYPOTHESIS_WINDOW_BEFORE = 3;
const HYPOTHESIS_WINDOW_AFTER = 1;

/** "n = 1", "n=2", "n = 1, 2, 3", "n = 1, 2 and 3": the number of instances named. */
function instanceCount(lower: string): number {
  let count = 0;
  for (const match of lower.matchAll(/\bn\s*=\s*(\d+(?:\s*(?:,|and)\s*\d+)*)/g)) {
    count += (match[1]!.match(/\d+/g) ?? []).length;
  }
  return count;
}

const GENERAL_ARGUMENT =
  /(for (all|every|each|any)\b|arbitrary|general\s+n\b|\b(let|fix|suppose|assume|take|given)\s+n\s*(≥|>=|\\ge\b|\\geq\b|be\b|is\b|∈|\\in\b|>\s*0|\\to)|induction|\\forall|∀)/i;

export function runDeterministicChecks(submission: string, checks: DeterministicCheck[]): CheckResult[] {
  const normalised = normaliseMath(submission);
  const lower = submission.toLowerCase();
  const tooShort = wordCount(submission) < MIN_WORDS_FOR_ARGUMENT;
  const nothingToCheck = (check: DeterministicCheck): CheckResult => ({
    checkId: check.id,
    kind: check.kind,
    passed: false,
    detail: "Nothing to check: the submission is too short to contain an argument.",
  });
  // biome-ignore lint/suspicious/useIterableCallbackReturn: every branch of the exhaustive switch returns a result
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
        const numbers = extractNumbers(submission);
        const passed = numbers.some((n) => Math.abs(n - expected) <= tolerance);
        return {
          checkId: check.id,
          kind: check.kind,
          passed,
          detail: passed
            ? `Found the value ${expected}.`
            : `The value ${expected} does not appear, written plainly or in scientific notation (${check.description}).`,
        };
      }
      case "forbidden_claim": {
        if (tooShort) return nothingToCheck(check);
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
        if (tooShort) return nothingToCheck(check);
        const triggers = toRegExps(check.params.triggerPatterns);
        const hypotheses = toRegExps(check.params.hypothesisPatterns);
        // The hypothesis must sit with the claim (see the window above), not anywhere at all in
        // the text, unless the check asks for document-level scope.
        const anywhere = check.params.scope === "anywhere";
        const parts = sentences(lower);
        let triggered = false;
        let unsupported = false;
        parts.forEach((sentence, index) => {
          if (!triggers.some((p) => p.test(sentence))) return;
          triggered = true;
          const window = anywhere
            ? lower
            : parts.slice(Math.max(0, index - HYPOTHESIS_WINDOW_BEFORE), index + 1 + HYPOTHESIS_WINDOW_AFTER).join(" ");
          if (!hypotheses.some((p) => p.test(window))) unsupported = true;
        });
        if (!triggered && triggers.some((p) => p.test(lower))) {
          // A trigger spanning a sentence boundary: fall back to the whole text.
          triggered = true;
          unsupported = !hypotheses.some((p) => p.test(lower));
        }
        const passed = !triggered || !unsupported;
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
        if (tooShort) return nothingToCheck(check);
        const exampleCount = instanceCount(lower);
        const passed = exampleCount < 2 || GENERAL_ARGUMENT.test(submission);
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
