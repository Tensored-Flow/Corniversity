import { describe, expect, it } from "vitest";
import { defaultContentRoot, loadContent } from "./load";

/** Completion contract for the five full courses requested on 12 November 2026.
 * These are availability/integrity checks. Correctness of explanations and solutions is
 * reviewed separately; neither a word count nor this suite is academic certification.
 */
const bundle = loadContent(defaultContentRoot());
const selected = [
  ["CHE-101", 10],
  ["PHY-210", 10],
  ["MAT-230", 12],
  ["MAT-261", 12],
  ["CSA-210", 10],
] as const;

describe("five complete first courses", () => {
  for (const [id, count] of selected) {
    it(`${id} exposes its entire promised sequence with usable problem sheets and private solutions`, () => {
      const course = bundle.courses.find((c) => c.spec.id === id)!;
      expect(course, id).toBeDefined();
      expect(course.units.map((u) => u.spec.id)).toEqual(course.spec.unitIds);
      expect(course.units).toHaveLength(count);
      for (const unit of course.units) {
        const label = `${id}/${unit.spec.id}`;
        expect(unit.spec.status, label).toBe("ready");
        expect(unit.exercises.length, label).toBeGreaterThanOrEqual(3);
        expect(unit.spec.preparation.length, label).toBeGreaterThan(0);
        const assigned = new Set(unit.spec.activities.flatMap((a) => a.exerciseIds));
        for (const exercise of unit.exercises) {
          expect(assigned.has(exercise.id), `${label}: ${exercise.id} must be reachable in an activity`).toBe(true);
          expect(exercise.rubric.acceptAlternateApproaches, exercise.id).toBe(true);
          const solution = unit.instructor.find((a) => a.exerciseId === exercise.id && a.kind === "reference_solution");
          expect(solution?.markdown.trim(), `${exercise.id}: missing private reference solution`).toBeTruthy();
        }
        expect(
          unit.exercises.some((e) => e.id === unit.spec.exitCheck.exerciseId),
          `${label}: exit task must exist`,
        ).toBe(true);
      }
    });
  }
});
