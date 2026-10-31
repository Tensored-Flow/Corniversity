import { describe, expect, it } from "vitest";
import { academicConsequences, appointmentOutcome, type Deadline, deadlineAllowed, deadlineOutcome, rollingHorizon } from "./obligations";
import {
  applyPreferenceChange,
  checkCourseLoad,
  DEFAULT_STUDY_PREFERENCES,
  explicitKeys,
  PreferenceError,
  resolveStudyPreferences,
} from "./preferences";

describe("study preference defaults", () => {
  it("a new learner gets rolling study, weekly appointments, one main and one lighter course, no deadlines or examinations", () => {
    expect(resolveStudyPreferences({})).toEqual({
      rhythm: "rolling",
      weeklyAppointments: true,
      hardDeadlines: false,
      examinations: false,
      mainCourseLimit: 1,
      exploratoryLimit: 1,
    });
  });

  it("an explicit earlier choice is preserved, including a rhythm stored in the older field", () => {
    expect(resolveStudyPreferences({}, "term").rhythm).toBe("term");
    expect(resolveStudyPreferences({ rhythm: "reading_course" }, "term").rhythm).toBe("reading_course");
    expect(resolveStudyPreferences({ hardDeadlines: true }).hardDeadlines).toBe(true);
    expect(explicitKeys({ hardDeadlines: true }, "term").sort()).toEqual(["hardDeadlines", "rhythm"]);
    expect(explicitKeys({}, null)).toEqual([]);
  });
});

describe("changing preferences", () => {
  it("choosing term mode changes the rhythm only: it never switches on examinations or deadlines", () => {
    const next = applyPreferenceChange({}, { rhythm: "term" });
    const effective = resolveStudyPreferences(next);
    expect(effective.rhythm).toBe("term");
    expect(effective.examinations).toBe(false);
    expect(effective.hardDeadlines).toBe(false);
  });

  it("a heavier load needs the workload preview first", () => {
    expect(() => applyPreferenceChange({}, { mainCourseLimit: 2 })).toThrow(PreferenceError);
    const ok = applyPreferenceChange({}, { mainCourseLimit: 2, heavierLoadPreviewedAt: "2026-10-31T10:00:00Z" });
    expect(resolveStudyPreferences(ok).mainCourseLimit).toBe(2);
    // Lowering the load never needs a preview.
    expect(resolveStudyPreferences(applyPreferenceChange({}, { exploratoryLimit: 0 })).exploratoryLimit).toBe(0);
  });

  it("rejects values outside the permitted range", () => {
    expect(() => applyPreferenceChange({}, { mainCourseLimit: 0 })).toThrow(PreferenceError);
    expect(() => applyPreferenceChange({}, { rhythm: "weekly" as never })).toThrow(PreferenceError);
  });

  it("checks one more course against the chosen load without enrolling anything", () => {
    const prefs = { ...DEFAULT_STUDY_PREFERENCES };
    expect(checkCourseLoad(prefs, { main: 0, exploratory: 0 }, "main").allowed).toBe(true);
    expect(checkCourseLoad(prefs, { main: 1, exploratory: 0 }, "main").allowed).toBe(false);
    expect(checkCourseLoad(prefs, { main: 1, exploratory: 0 }, "exploratory").allowed).toBe(true);
    expect(checkCourseLoad(prefs, { main: 1, exploratory: 1 }, "exploratory").reason).toMatch(/lighter course/);
  });
});

describe("appointments are not deadlines", () => {
  const now = "2026-11-10T12:00:00Z";

  it("a missed appointment is a scheduling fact with no consequence", () => {
    const missed = { startsAt: "2026-11-03T18:00:00Z", endsAt: "2026-11-03T19:00:00Z", status: "planned" };
    expect(appointmentOutcome(missed, now)).toBe("passed_unmarked");
    // Appointments are not an input to consequences at all; with no deadlines there are none.
    expect(academicConsequences([], { hardDeadlines: true, examinations: true }, now)).toEqual([]);
  });

  it("only binding deadlines of a kind the learner switched on can be late", () => {
    const deadlines: Deadline[] = [
      { id: "a", kind: "assessment", dueAt: "2026-11-05T17:00:00Z", binding: true, status: "open" },
      { id: "m", kind: "milestone", dueAt: "2026-11-05T17:00:00Z", binding: false, status: "open" },
      { id: "x", kind: "examination", dueAt: "2026-11-06T09:00:00Z", binding: true, status: "met", metAt: "2026-11-06T10:00:00Z" },
    ];
    expect(academicConsequences(deadlines, { hardDeadlines: false, examinations: false }, now)).toEqual([]);
    expect(academicConsequences(deadlines, { hardDeadlines: true, examinations: false }, now)).toEqual([
      { deadlineId: "a", kind: "assessment", outcome: "passed" },
    ]);
    expect(academicConsequences(deadlines, { hardDeadlines: true, examinations: true }, now).map((c) => c.deadlineId)).toEqual(["a", "x"]);
    expect(deadlineOutcome(deadlines[2]!, now)).toBe("met_after_due");
  });

  it("deadlines of a kind that is switched off cannot be created; milestones always can", () => {
    const off = { hardDeadlines: false, examinations: false };
    expect(deadlineAllowed("assessment", off).allowed).toBe(false);
    expect(deadlineAllowed("examination", off).allowed).toBe(false);
    expect(deadlineAllowed("milestone", off).allowed).toBe(true);
    expect(deadlineAllowed("assessment", { hardDeadlines: true, examinations: false }).allowed).toBe(true);
  });
});

describe("rolling horizon", () => {
  it("is a moving planning window, extended when it runs low, never a completion date", () => {
    const early = rollingHorizon("2026-11-02", "2026-11-10T00:00:00Z", 10);
    expect(early.horizonEnd).toBe("2027-01-11");
    expect(early.shouldExtend).toBe(false);
    const late = rollingHorizon("2026-11-02", "2027-01-01T00:00:00Z", 10);
    expect(late.shouldExtend).toBe(true);
    expect(late.weeksRemaining).toBe(1);
  });
});
