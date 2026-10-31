import { describe, expect, it } from "vitest";
import { learnerVisibleReference } from "./reference";

const file = [
  "## Reference reasoning (instructor only)",
  "",
  "**1. Balancing.** C2H5OH + 3 O2 -> 2 CO2 + 3 H2O.",
  "",
  "**2. Mass.** 21.97 g, which is 22.0 g at three significant figures.",
  "",
  "**Alternative valid approaches.** Accept 22.0 g or 21.97 g; accept totals of 35.4–35.5 g.",
  "",
  "**Common gaps.** Dividing grams of ethanol by 44.01.",
  "",
  "## Grading notes (instructor only)",
  "",
  "Award full marks when all four masses are independent.",
  "",
  "## Lesson notes (instructor only)",
  "",
  "Mention the phase question in the seminar.",
].join("\n");

describe("learnerVisibleReference", () => {
  it("keeps the reasoning, relabels it for practice mode and drops everything meant for the grader", () => {
    const shown = learnerVisibleReference(file);
    expect(shown).toContain("## Reference reasoning (practice mode)");
    expect(shown).toContain("**1. Balancing.**");
    expect(shown).toContain("**2. Mass.**");
    expect(shown).not.toMatch(/instructor only/i);
    expect(shown).not.toMatch(/Accept 22\.0/);
    expect(shown).not.toMatch(/Common gaps/);
    expect(shown).not.toMatch(/full marks/);
    expect(shown).not.toMatch(/seminar/);
  });

  it("leaves a file without grader material unchanged apart from the label", () => {
    const plain = "## Reference reasoning (instructor only)\n\nA short argument.";
    expect(learnerVisibleReference(plain)).toBe("## Reference reasoning (practice mode)\n\nA short argument.");
  });
});
