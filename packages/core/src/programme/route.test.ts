import { describe, expect, it } from "vitest";
import type { ProgrammeBlock } from "../domain/course";
import type { BlockReadinessReport } from "./progress";
import { proposeRoute, type RouteInput, type RuleAssessment } from "./route";

const block = (id: string, sequence: number, courseId: string, unitIds: string[]): ProgrammeBlock => ({
  id,
  sequence,
  title: id,
  centralQuestion: "q",
  entryLevel: "e",
  requiredCoverage: ["c"],
  prerequisiteReasoning: "r",
  bridges: [],
  canStudyAlongside: [],
  courseMappings: [{ courseId, unitIds, contribution: "x" }],
  sourceShelf: [],
  activities: [{ title: "a", description: "d", methodIds: [] }],
  evidenceOfUnderstanding: "e",
  gaps: [],
});
const report = (readiness: BlockReadinessReport["readiness"], prepared: string[]): BlockReadinessReport => ({
  readiness,
  preparedUnitIds: prepared,
  unpreparedUnitIds: [],
  missingUnitIds: [],
  coursesToRefine: [],
});
const rule = (ruleId: string, satisfied: boolean, over: Partial<RuleAssessment> = {}): RuleAssessment => ({
  ruleId,
  strength: "soft",
  description: ruleId,
  satisfied,
  satisfiedBy: satisfied ? "Demonstrated concepts" : null,
  basis: satisfied ? "evidence" : "none",
  alternativeCourseIds: satisfied ? [] : ["CSA-100"],
  ...over,
});

const blocks = [
  { block: block("B1", 1, "NEU-220", ["NEU-220-u01"]), report: report("partly_prepared", ["NEU-220-u01"]) },
  { block: block("B2", 2, "COG-201", ["COG-201-u01"]), report: report("partly_prepared", ["COG-201-u01"]) },
  { block: block("B3", 3, "COG-260", ["COG-260-u01"]), report: report("partly_prepared", ["COG-260-u01"]) },
  { block: block("B4", 4, "COG-210", []), report: report("proposed", []) },
];
const base = (over: Partial<RouteInput["learner"]> = {}, prerequisites: [string, RuleAssessment[]][] = []): RouteInput => ({
  blocks,
  courseTitles: new Map([
    ["NEU-220", "Computational Neuroscience"],
    ["COG-201", "Computational Cognitive Science"],
    ["COG-260", "Models of Human Behaviour"],
  ]),
  learner: { activeCourses: [], focusBlockIds: [], load: { mainCourseLimit: 1, exploratoryLimit: 1, main: 0, exploratory: 0 }, ...over },
  prerequisites: new Map(prerequisites),
});

describe("the director's starting route", () => {
  it("is small: two focus blocks at most and no more new courses than the chosen load allows", () => {
    const route = proposeRoute(base());
    expect(route.focusBlockIds).toHaveLength(2);
    expect(route.steps.map((s) => s.action)).toEqual(["enrol", "audit_or_read"]);
    expect(route.steps.filter((s) => s.action === "enrol")).toHaveLength(1);
  });

  it("starts from the courses the learner already takes and keeps the focus already chosen", () => {
    const route = proposeRoute(
      base({
        activeCourses: [{ courseId: "COG-260", mode: "enrolled" }],
        focusBlockIds: ["B2"],
        load: { mainCourseLimit: 1, exploratoryLimit: 1, main: 1, exploratory: 0 },
      }),
    );
    // B2 is kept; B3 is served by a course already taken, so it is preferred over B1.
    expect(route.focusBlockIds).toEqual(["B2", "B3"]);
    expect(route.steps[0]).toMatchObject({ courseId: "COG-260", action: "continue" });
    // The one main place is taken, so the new course is audited or read alongside.
    expect(route.steps.find((s) => s.courseId === "COG-201")?.action).toBe("audit_or_read");
  });

  it("prefers blocks whose prerequisites are met, unless the learner chose the block", () => {
    const prerequisites: [string, RuleAssessment[]][] = [["NEU-220", [rule("NEU-220-python-and-statistics", false)]]];
    expect(proposeRoute(base({}, prerequisites)).focusBlockIds).toEqual(["B2", "B3"]);
    expect(proposeRoute(base({ focusBlockIds: ["B1"] }, prerequisites)).focusBlockIds).toEqual(["B1", "B2"]);
  });

  it("never suggests enrolling past a required prerequisite that is not met", () => {
    const route = proposeRoute(base({ focusBlockIds: ["B1"] }, [["NEU-220", [rule("NEU-220-hard", false, { strength: "hard" })]]]));
    const neu = route.steps.find((s) => s.courseId === "NEU-220");
    expect(neu?.action).toBe("audit_or_read");
    expect(neu?.why).toMatch(/required prerequisite is not met/);
  });

  it("recognises prior knowledge rule by rule, so a mathematics background leaves programming unmet", () => {
    const route = proposeRoute(
      base({ focusBlockIds: ["B1"] }, [
        [
          "NEU-220",
          [
            rule("NEU-220-mathematics", true, { basis: "self_report", satisfiedBy: "Demonstrated concepts (self-reported, unverified)" }),
            rule("NEU-220-python-and-statistics", false),
          ],
        ],
      ]),
    );
    expect(route.recognised).toEqual([
      {
        courseId: "NEU-220",
        description: "NEU-220-mathematics",
        basis: "self_report",
        satisfiedBy: "Demonstrated concepts (self-reported, unverified)",
      },
    ]);
    expect(route.toPrepare).toEqual([
      { courseId: "NEU-220", description: "NEU-220-python-and-statistics", strength: "soft", alternativeCourseIds: ["CSA-100"] },
    ]);
    expect(route.steps.find((s) => s.courseId === "NEU-220")?.why).toMatch(/Preparation not yet shown: NEU-220-python-and-statistics/);
    expect(route.rationale.join(" ")).toMatch(/1 by your own report, shown as unverified/);
  });

  it("proposes nothing from a block without prepared units, and names those blocks", () => {
    const route = proposeRoute(base());
    expect(route.focusBlockIds).not.toContain("B4");
    expect(route.steps.map((s) => s.courseId)).not.toContain("COG-210");
    expect(route.notYetPrepared).toEqual(["B4"]);
  });

  it("shows the change of focus it would make, and none when nothing changes", () => {
    expect(proposeRoute(base({ focusBlockIds: ["B4"] })).focusChange).toEqual({ before: ["B4"], after: ["B1", "B2"] });
    expect(proposeRoute(base({ focusBlockIds: ["B1", "B2"] })).focusChange).toBeNull();
  });

  it("says that confirming enrols in nothing", () => {
    expect(proposeRoute(base()).rationale.at(-1)).toMatch(/enrols you in nothing/);
  });
});
