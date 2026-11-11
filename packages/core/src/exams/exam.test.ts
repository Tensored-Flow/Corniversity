import { describe, expect, it } from "vitest";
import { ExamRuleError, examResult, pickExamQuestions, questionScore, validateExamSettings, withinExamTime } from "./exam";

describe("exam rules", () => {
  it("accepts whole numbers of questions and minutes within the limits", () => {
    expect(validateExamSettings({ questions: 4, minutes: 60 })).toEqual({ questions: 4, minutes: 60 });
    for (const bad of [
      { questions: 0, minutes: 60 },
      { questions: 11, minutes: 60 },
      { questions: 2.5, minutes: 60 },
      { questions: 4, minutes: 4 },
      { questions: 4, minutes: 301 },
    ]) {
      expect(() => validateExamSettings(bad)).toThrow(ExamRuleError);
    }
  });

  it("samples unattempted problems at random and presents them in course order", () => {
    const pool = [
      { id: "u2-p1", unitSequence: 2, sequence: 1 },
      { id: "u1-p2", unitSequence: 1, sequence: 2 },
      { id: "u1-p1", unitSequence: 1, sequence: 1 },
      { id: "u3-p1", unitSequence: 3, sequence: 1 },
    ];
    const picked = pickExamQuestions(pool, 3, () => 0.99);
    expect(picked).toHaveLength(3);
    expect(picked.map((p) => p.id)).toEqual(
      [...picked].sort((a, b) => a.unitSequence - b.unitSequence || a.sequence - b.sequence).map((p) => p.id),
    );
    expect(pickExamQuestions(pool, 10)).toHaveLength(4);
    expect(pickExamQuestions([], 3)).toEqual([]);
  });

  it("accepts work up to thirty seconds after the deadline, not later", () => {
    const deadline = new Date("2026-11-11T10:00:00Z");
    expect(withinExamTime(deadline, new Date("2026-11-11T10:00:29Z"))).toBe(true);
    expect(withinExamTime(deadline, new Date("2026-11-11T10:00:31Z"))).toBe(false);
  });

  it("scores a question by weighted criteria: met full, partly met half, not met or unchecked nothing, not applicable left out", () => {
    const criteria = [
      { id: "a", weight: 0.5 },
      { id: "b", weight: 0.3 },
      { id: "c", weight: 0.2 },
    ];
    expect(
      questionScore(criteria, [
        { criterionId: "a", status: "met" },
        { criterionId: "b", status: "partially_met" },
        { criterionId: "c", status: "not_met" },
      ]),
    ).toBeCloseTo(0.65);
    expect(
      questionScore(criteria, [
        { criterionId: "a", status: "met" },
        { criterionId: "b", status: "not_applicable" },
        { criterionId: "c", status: "not_applicable" },
      ]),
    ).toBeCloseTo(1);
    // An unchecked criterion counts as not met: leaving one out never raises the score.
    expect(questionScore(criteria, [{ criterionId: "a", status: "met" }])).toBeCloseTo(0.5);
    expect(questionScore(criteria, [])).toBe(0);
    expect(
      questionScore(
        criteria,
        criteria.map((c) => ({ criterionId: c.id, status: "not_applicable" as const })),
      ),
    ).toBeNull();
    expect(questionScore([{ id: "a", weight: 0 }], [{ criterionId: "a", status: "met" }])).toBeNull();
  });

  it("gives an overall score only when nothing answered awaits marking; unanswered counts as zero", () => {
    expect(examResult([{ kind: "marked", score: 1 }, { kind: "marked", score: 0.5 }, { kind: "unanswered" }])).toEqual({
      questions: 3,
      marked: 2,
      awaiting: 0,
      unanswered: 1,
      score: 0.5,
    });
    expect(examResult([{ kind: "marked", score: 1 }, { kind: "awaiting" }]).score).toBeNull();
    expect(examResult([]).score).toBeNull();
    // An unscored question is marked but left out of the mean; it does not hold the result back.
    expect(examResult([{ kind: "marked", score: 0.6 }, { kind: "unscored" }, { kind: "unanswered" }])).toMatchObject({
      marked: 2,
      awaiting: 0,
      score: 0.3,
    });
    expect(examResult([{ kind: "unscored" }]).score).toBeNull();
  });
});
