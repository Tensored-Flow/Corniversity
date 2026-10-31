import { describe, expect, it } from "vitest";
import type { ModellingMethod, ProgrammeBlock } from "../domain/course";
import { blockLearnerView, blockReadiness, type CourseState, methodCoverage, programmeWorkItems } from "./progress";

const block = (id: string, sequence: number, mappings: ProgrammeBlock["courseMappings"]): ProgrammeBlock => ({
  id,
  sequence,
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
    "COG-210",
    {
      courseId: "COG-210",
      title: "Experimental Design and Statistics",
      readiness: "source_verified",
      units: [
        { id: "COG-210-u01", sequence: 1, title: "Inference", status: "ready" },
        { id: "COG-210-u02", sequence: 2, title: "Reliability", status: "draft" },
      ],
    },
  ],
  ["COG-220", { courseId: "COG-220", title: "Psychometrics", readiness: "proposed", units: [] }],
  ["CSA-220", { courseId: "CSA-220", title: "Probabilistic Modelling", readiness: "source_verified", units: [] }],
]);

describe("blockReadiness", () => {
  it("is derived from the mapped units and never claims more than the catalogue holds", () => {
    expect(
      blockReadiness(block("MBI-04", 4, [{ courseId: "COG-210", unitIds: ["COG-210-u01"], contribution: "x" }]), courses).readiness,
    ).toBe("teaching_available");
    const partly = blockReadiness(
      block("MBI-05", 5, [
        { courseId: "COG-210", unitIds: ["COG-210-u01", "COG-210-u02"], contribution: "x" },
        { courseId: "COG-220", unitIds: [], contribution: "y" },
      ]),
      courses,
    );
    expect(partly.readiness).toBe("partly_prepared");
    expect(partly.unpreparedUnitIds).toEqual(["COG-210-u02"]);
    expect(partly.coursesToRefine).toEqual(["COG-220"]);
    expect(blockReadiness(block("MBI-06", 6, [{ courseId: "CSA-220", unitIds: [], contribution: "z" }]), courses).readiness).toBe(
      "sources_only",
    );
    expect(blockReadiness(block("MBI-07", 7, [{ courseId: "COG-220", unitIds: [], contribution: "z" }]), courses).readiness).toBe(
      "proposed",
    );
  });

  it("reports a mapped unit that does not exist instead of counting it", () => {
    const report = blockReadiness(block("MBI-04", 4, [{ courseId: "COG-210", unitIds: ["COG-210-u99"], contribution: "x" }]), courses);
    expect(report.missingUnitIds).toEqual(["COG-210-u99"]);
    expect(report.readiness).toBe("sources_only");
  });
});

describe("shared units", () => {
  const blocks = [
    block("MBI-04", 4, [{ courseId: "COG-210", unitIds: ["COG-210-u01"], contribution: "inference" }]),
    block("MBI-05", 5, [{ courseId: "COG-210", unitIds: ["COG-210-u01", "COG-210-u02"], contribution: "measurement" }]),
  ];

  it("lists a unit once however many blocks it serves, so its reading is assigned once", () => {
    const items = programmeWorkItems(blocks);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.unitId === "COG-210-u01")?.blockIds).toEqual(["MBI-04", "MBI-05"]);
  });

  it("shows the learner that a unit is shared rather than presenting it as separate work", () => {
    const view = blockLearnerView(blocks[1]!, blocks, courses, {
      activeCourseIds: new Set(["COG-210"]),
      workedUnitIds: new Set(["COG-210-u01"]),
    });
    expect(view.takingCourseIds).toEqual(["COG-210"]);
    expect(view.unitsWorked).toEqual(["COG-210-u01"]);
    expect(view.unitsOpen).toEqual([]);
    expect(view.sharedUnits).toEqual([{ unitId: "COG-210-u01", alsoServes: ["MBI-04"] }]);
  });
});

describe("methodCoverage", () => {
  const methods: ModellingMethod[] = [
    {
      id: "parameter-recovery",
      section: "9.3",
      title: "Parameter recovery",
      conceptId: "method-parameter-recovery",
      learnerShould: ["refit simulated data"],
      units: [{ courseId: "COG-210", unitId: "COG-210-u01", role: "practises" }],
      plannedIn: [],
      evidence: "a recovery report",
    },
    {
      id: "model-recovery",
      section: "9.4",
      title: "Model recovery",
      conceptId: "method-model-recovery",
      learnerShould: ["confusion matrix"],
      units: [{ courseId: "COG-210", unitId: "COG-210-u02", role: "practises" }],
      plannedIn: [],
      evidence: "a confusion matrix",
    },
  ];

  it("keeps introduced, practised and demonstrated distinct and marks methods with no prepared unit as planned only", () => {
    const states = new Map([
      ["method-parameter-recovery", "practised" as const],
      ["method-model-recovery", "introduced" as const],
    ]);
    const cover = methodCoverage(methods, courses, states);
    expect(cover.map((c) => c.state)).toEqual(["practised", "introduced"]);
    expect(cover[0]?.plannedOnly).toBe(false);
    expect(cover[1]?.plannedOnly).toBe(true);
  });
});
