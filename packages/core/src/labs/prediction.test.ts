import { describe, expect, it } from "vitest";
import { predictionRevealed } from "./prediction";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 9, 12, minute));

describe("prediction before results", () => {
  it("keeps results hidden until a prediction is saved", () => {
    expect(predictionRevealed([], [])).toBe(false);
  });

  it("shows them once a prediction exists, and keeps showing them (persistent reveal)", () => {
    expect(predictionRevealed([at(1)], [])).toBe(true);
  });

  it("hides them again after a deliberate request to predict again, until a newer prediction is saved", () => {
    expect(predictionRevealed([at(1)], [at(2)])).toBe(false);
    expect(predictionRevealed([at(1), at(3)], [at(2)])).toBe(true);
  });

  it("counts only the latest request: an earlier reset does not hide a later prediction", () => {
    expect(predictionRevealed([at(5)], [at(2), at(4)])).toBe(true);
    expect(predictionRevealed([at(3)], [at(2), at(4)])).toBe(false);
  });
});
