import { describe, expect, it } from "vitest";
import { nextState } from "./evidence";

describe("nextState (pure evidence rules)", () => {
  it("reading introduces a concept but never demonstrates it", () => {
    expect(nextState("unassessed", { type: "reading" })).toBe("introduced");
    expect(nextState("practised", { type: "reading" })).toBe("practised");
  });
  it("an unassisted accepted attempt demonstrates", () => {
    expect(nextState("practised", { type: "assessment", verdict: "accepted", assisted: false })).toBe("demonstrated");
  });
  it("an assisted accepted attempt counts as practice, not demonstration", () => {
    expect(nextState("introduced", { type: "assessment", verdict: "accepted", assisted: true })).toBe("practised");
  });
  it("a later gap on a demonstrated concept marks it for revisiting", () => {
    expect(nextState("demonstrated", { type: "assessment", verdict: "revision_requested" })).toBe("revisit");
  });
  it("a reveal does not move a practised concept backwards", () => {
    expect(nextState("practised", { type: "solution_revealed" })).toBe("practised");
    expect(nextState("unassessed", { type: "solution_revealed" })).toBe("introduced");
  });
});
