import { describe, expect, it } from "vitest";
import { hiddenRuns, WITHHELD, withholdReferenceText } from "./leakage";

const reference =
  "Take f_n(x) = x^n. Then the sup norm of every f_n equals one while the integral norm equals one over n plus one, so no constant can bound the first norm by the second.";
const prompt = "Show that the sup norm and the integral norm on C([0,1]) are not equivalent.";
const submission = "Let f_n(x) = x^n on [0,1]; the sup norm is 1 and the integral norm is 1/(n+1).";
const feedback = (over: Partial<Parameters<typeof withholdReferenceText>[0]> = {}) => ({
  summary: "The argument is close; say why the ratio is unbounded.",
  firstGap: { line: 2, excerpt: "the integral norm is 1/(n+1)", issue: "State the inequality you are refuting." },
  checks: [{ criterionId: "c1", status: "partially_met", comment: "The family is well chosen." }],
  strengths: ["A clear choice of functions."],
  nextStep: "Write the inequality with its constant and show it fails.",
  ...over,
});

describe("feedback that repeats the reference solution", () => {
  it("is withheld field by field, wherever it appears", () => {
    const quote = "the sup norm of every f_n equals one while the integral norm equals one over n plus one";
    for (const over of [
      { summary: `As the model answer says, ${quote}.` },
      { checks: [{ criterionId: "c1", status: "met", comment: `Correct: ${quote}.` }] },
      { strengths: [`You noticed that ${quote}.`] },
      { nextStep: `Conclude that ${quote}.` },
      { firstGap: { line: 2, excerpt: "x", issue: `Missing: ${quote}.` } },
    ]) {
      const result = withholdReferenceText(feedback(over), reference, [prompt, submission]);
      expect(result.withheld, JSON.stringify(over)).toBe(1);
      expect(JSON.stringify(result.feedback)).toContain(WITHHELD);
      expect(JSON.stringify(result.feedback)).not.toContain("equals one over n plus one");
    }
  });

  it("is kept when it only shares short phrases, or repeats what the learner has already seen", () => {
    const short = withholdReferenceText(feedback({ summary: "The sup norm of every f_n is right." }), reference, [prompt, submission]);
    expect(short.withheld).toBe(0);
    // Ten words of the reference that the learner wrote themselves are not hidden from them.
    const echoed = "while the integral norm equals one over n plus one so";
    const own = withholdReferenceText(feedback({ summary: `You wrote that ${echoed}.` }), reference, [prompt, `${submission} ${echoed}`]);
    expect(own.withheld).toBe(0);
    expect(withholdReferenceText(feedback(), null, [prompt]).withheld).toBe(0);
  });

  it("leaves the excerpt quoting the learner's own submission untouched", () => {
    const quote = "the sup norm of every f_n equals one while the integral norm equals one over n plus one";
    const result = withholdReferenceText(feedback({ firstGap: { line: 1, excerpt: quote, issue: "Fine." } }), reference, [prompt]);
    expect(result.feedback.firstGap?.excerpt).toBe(quote);
    expect(result.withheld).toBe(0);
  });

  it("counts runs of the reference the learner has not seen", () => {
    expect(hiddenRuns(reference, [reference]).size).toBe(0);
    expect(hiddenRuns(reference, []).size).toBeGreaterThan(0);
  });
});
