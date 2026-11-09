import { describe, expect, it } from "vitest";
import type { ProgrammeBlock } from "../domain/course";
import { blockNextStep, programmeNextStep } from "./next-step";
import { blockLearnerView, blockReadiness, type CourseState } from "./progress";

const block = (id: string, mappings: ProgrammeBlock["courseMappings"]): ProgrammeBlock => ({
  id,
  sequence: 1,
  title: id,
  centralQuestion: "q",
  entryLevel: "e",
  requiredCoverage: ["c"],
  prerequisiteReasoning: "r",
  bridges: [],
  canStudyAlongside: [],
  courseMappings: mappings,
  sourceShelf: [],
  activities: [{ title: "a", description: "d", methodIds: [] }],
  evidenceOfUnderstanding: "e",
  gaps: [],
});
const courses = new Map<string, CourseState>([
  [
    "COG-260",
    {
      courseId: "COG-260",
      title: "Models",
      readiness: "source_verified",
      units: [
        { id: "COG-260-u01", sequence: 1, title: "Loop", status: "ready" },
        { id: "COG-260-u02", sequence: 2, title: "Validation", status: "draft" },
      ],
    },
  ],
  ["COG-210", { courseId: "COG-210", title: "Design", readiness: "proposed", units: [] }],
]);
const loop = block("MBI-06", [{ courseId: "COG-260", unitIds: ["COG-260-u01", "COG-260-u02"], contribution: "x" }]);
const unprepared = block("MBI-02", [{ courseId: "COG-210", unitIds: [], contribution: "y" }]);
const empty = block("MBI-99", []);
const none = { activeCourseIds: new Set<string>(), workedUnitIds: new Set<string>() };

describe("readiness is the curriculum's, never the learner's", () => {
  it("an empty mapping, or mappings without units, never reads as ready", () => {
    expect(blockReadiness(empty, courses).readiness).toBe("proposed");
    expect(blockReadiness(unprepared, courses).readiness).toBe("proposed");
    expect(blockReadiness(block("MBI-98", [{ courseId: "COG-260", unitIds: [], contribution: "z" }]), courses).readiness).toBe(
      "sources_only",
    );
  });

  it("a prepared block says nothing about what the learner understands", () => {
    const view = blockLearnerView(loop, [loop], courses, none);
    expect(view.readiness).toBe("partly_prepared");
    expect(view.unitsWorked).toEqual([]);
    expect(view.takingCourseIds).toEqual([]);
  });
});

describe("the next step for a block", () => {
  it("asks nothing of the learner when nothing is prepared, and does not hold other blocks up", () => {
    expect(blockNextStep(unprepared, blockReadiness(unprepared, courses), none)).toMatchObject({ kind: "obtain_sources" });
    expect(blockNextStep(empty, blockReadiness(empty, courses), none).kind).toBe("obtain_sources");
  });

  it("previews the course before anything else when the learner does not take it", () => {
    expect(blockNextStep(loop, blockReadiness(loop, courses), none)).toMatchObject({ kind: "preview_course", courseId: "COG-260" });
  });

  it("opens the next prepared unit of a course the learner takes", () => {
    const step = blockNextStep(loop, blockReadiness(loop, courses), { activeCourseIds: new Set(["COG-260"]), workedUnitIds: new Set() });
    expect(step).toMatchObject({ kind: "open_unit", courseId: "COG-260", unitId: "COG-260-u01" });
  });

  it("suggests reflection, not more enrolment, once every prepared unit is worked", () => {
    const step = blockNextStep(loop, blockReadiness(loop, courses), {
      activeCourseIds: new Set(["COG-260"]),
      workedUnitIds: new Set(["COG-260-u01"]),
    });
    expect(step.kind).toBe("reflect");
  });
});

describe("the next step for a programme", () => {
  const blocks = [
    { block: unprepared, report: blockReadiness(unprepared, courses) },
    { block: loop, report: blockReadiness(loop, courses) },
  ];

  it("is to follow or ask the director when the learner does not follow it", () => {
    expect(programmeNextStep(null, blocks, none).kind).toBe("follow");
    expect(programmeNextStep({ status: "paused", focusBlockIds: ["MBI-06"] }, blocks, none).kind).toBe("follow");
  });

  it("is to ask for a route when no focus is set", () => {
    expect(programmeNextStep({ status: "following", focusBlockIds: [] }, blocks, none).kind).toBe("ask_director");
  });

  it("comes from the first focus block that has something to study", () => {
    const step = programmeNextStep({ status: "following", focusBlockIds: ["MBI-02", "MBI-06"] }, blocks, none);
    expect(step).toMatchObject({ kind: "preview_course", courseId: "COG-260" });
    expect(step.text).toMatch(/^MBI-06: /);
  });
});
