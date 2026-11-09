import { describe, expect, it } from "vitest";
import { buildAssessorSystemPrompt } from "./assessor";
import { buildSupervisorPrompt, MODELLING_DIMENSIONS } from "./supervisor";

const assessor = buildAssessorSystemPrompt({
  institutionName: "Corniversity",
  courseTitle: "Models of Human Behaviour",
  exerciseTitle: "A modelling report",
  exercisePrompt: "Write the report.",
  exerciseKind: "project",
  rubricVersion: 1,
  rubricCriteria: [],
  acceptAlternateApproaches: true,
  referenceIsExhaustive: false,
  referenceReasoning: null,
  deterministicResults: [],
  evidencePrompt: "",
  submissionNumbered: "1 | text",
  assistanceDisclosed: "{}",
});
const supervisor = buildSupervisorPrompt({
  institutionName: "Corniversity",
  projectTitle: "Forgetting",
  kindLabel: "Computational modelling",
  question: "Does forgetting matter?",
  documentKind: "proposal",
  version: 2,
  body: "## Question",
  provenance: [],
  sources: [],
  checks: [],
});

describe("the modelling standard in feedback", () => {
  it("asks the assessor and the supervisor to keep the seven dimensions apart", () => {
    expect(MODELLING_DIMENSIONS).toEqual([
      "implementation",
      "statistical or computational method",
      "evaluation design",
      "interpretation",
      "scientific claims",
      "reproducibility",
      "uncertainty",
    ]);
    for (const prompt of [assessor, supervisor]) for (const d of MODELLING_DIMENSIONS) expect(prompt).toContain(d);
  });

  it("refuses the four false equivalences", () => {
    for (const prompt of [assessor, supervisor]) {
      expect(prompt).toContain("Code that runs is not understanding");
      expect(prompt).toContain("a high metric is not a valid evaluation");
      expect(prompt).toContain("a parameter's name is not a validated psychological construct");
      expect(prompt).toContain("agreement from an AI reviewer, including you, is not mathematical or scientific certification");
    }
  });

  it("accepts defensible alternatives and negative results, and keeps held-out trials apart from generalisation", () => {
    expect(assessor).toMatch(/well-argued negative or inconclusive result are acceptable answers/);
    expect(supervisor).toMatch(/treat a well-made negative or inconclusive result as a result/);
    expect(supervisor).toMatch(/held-out trials of familiar stimuli, new people, new tasks and later time periods are different questions/);
  });

  it("tells the supervisor the studio collects no new data from people", () => {
    expect(supervisor).toMatch(/collects no new data from people/);
  });
});
