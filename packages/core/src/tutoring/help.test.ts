import { describe, expect, it } from "vitest";
import { decideHelp, HELP_INSTRUCTIONS, HELP_MODES } from "./help";

const base = {
  hasExercise: true,
  attemptMode: "practice" as const,
  submitted: false,
  attemptText: "Let f_n(x) = x^n on [0,1].",
  lines: null,
};

describe("the help contract", () => {
  it("refuses a full explanation in self-test mode until the attempt is submitted", () => {
    expect(decideHelp({ ...base, mode: "full_explanation", attemptMode: "self_test" })).toMatchObject({ allowed: false });
    expect(decideHelp({ ...base, mode: "full_explanation", attemptMode: "self_test", submitted: true })).toEqual({ allowed: true });
    expect(decideHelp({ ...base, mode: "full_explanation" })).toEqual({ allowed: true });
  });

  it("needs selected lines to check a step, and something written to discuss", () => {
    expect(decideHelp({ ...base, mode: "check_step" })).toEqual({
      allowed: false,
      reason: "Select the lines of your attempt you want checked.",
    });
    expect(decideHelp({ ...base, mode: "check_step", lines: [1, 1] })).toEqual({ allowed: true });
    expect(decideHelp({ ...base, mode: "discuss_approach", attemptText: "" })).toMatchObject({ allowed: false });
  });

  it("allows a question anywhere, and exercise help only on an exercise", () => {
    expect(decideHelp({ ...base, mode: "question", hasExercise: false })).toEqual({ allowed: true });
    expect(decideHelp({ ...base, mode: "small_hint", hasExercise: false })).toMatchObject({ allowed: false });
  });

  it("states for every mode what the tutor may and may not do", () => {
    for (const mode of HELP_MODES) expect(HELP_INSTRUCTIONS[mode].length).toBeGreaterThan(40);
    expect(HELP_INSTRUCTIONS.small_hint).toMatch(/Do not give the solution/);
    expect(HELP_INSTRUCTIONS.check_step).toMatch(/Do not grade or comment on lines that were not selected/);
    expect(HELP_INSTRUCTIONS.full_explanation).toMatch(/not independent evidence/);
  });
});
