import { describe, expect, it } from "vitest";
import { CONDITIONS, DEFAULT_SETTINGS, key, PlanningLabError, render, runTransfer, shortestPath, TRANSFER_CONTRACT } from "./planning";

describe("the grid and its routes", () => {
  it("has a short route on the right and a long one on the left, and each condition changes what it says", () => {
    const block = runTransfer("block", DEFAULT_SETTINGS, 1);
    expect([block.shortestBefore, block.shortestAfter]).toEqual([8, 16]);
    const shortcut = runTransfer("shortcut", DEFAULT_SETTINGS, 1);
    expect([shortcut.shortestBefore, shortcut.shortestAfter]).toEqual([16, 8]);
    expect(render(CONDITIONS.revaluation.after)[0]).toBe("G........");
  });

  it("breadth-first search finds no path when the goal is walled off", () => {
    const w = CONDITIONS.block.after;
    const sealed = new Set(w.layout.walls);
    sealed.add(key([1, 0]));
    sealed.add(key([0, 7]));
    sealed.add(key([1, 8]));
    expect(shortestPath({ ...w.layout, walls: sealed }, w.start, w.goal)).toBeNull();
  });
});

describe("what distinguishes the strategies", () => {
  it("block: the planner bumps into the closed door once and replans; the cached policy keeps trying it", () => {
    const r = runTransfer("block", DEFAULT_SETTINGS, 1);
    expect(r.planner[0]?.steps).toBe(25);
    expect(r.planner[0]?.bumps).toBe(1);
    expect(r.planner[1]?.steps).toBe(16);
    expect(r.cached[0]!.bumps).toBeGreaterThan(5);
    expect(r.cached[0]!.steps).toBeGreaterThan(r.planner[0]!.steps);
  });

  it("revaluation: the very first decision differs; the planner turns towards the new goal, the cached policy towards the old one", () => {
    const r = runTransfer("revaluation", DEFAULT_SETTINGS, 1);
    expect(r.planner[0]?.firstAction).toBe("left");
    expect(r.planner[0]?.steps).toBe(8);
    expect(r.cached[0]?.firstAction).toBe("right");
  });

  it("shortcut: neither strategy uses the new opening at first, so the condition hardly tells them apart", () => {
    const r = runTransfer("shortcut", DEFAULT_SETTINGS, 1);
    const throughOpening = (path: readonly (readonly [number, number])[]) => path.some((c) => c[0] === 2 && c[1] === 7);
    expect(throughOpening(r.planner[0]!.path)).toBe(false);
    expect(throughOpening(r.cached[0]!.path)).toBe(false);
    expect(Math.abs(r.gapByWindow[0]!)).toBeLessThan(10);
  });

  it("averaging over more episodes after the change dilutes the difference, because the cached policy relearns", () => {
    for (const c of ["block", "revaluation"] as const) {
      const r = runTransfer(c, DEFAULT_SETTINGS, 1);
      expect(r.gapByWindow[0]!).toBeGreaterThan(2 * r.gapByWindow.at(-1)!);
    }
  });
});

describe("determinism and limits", () => {
  it("the same seed gives the same run", () => {
    expect(runTransfer("block", DEFAULT_SETTINGS, 4)).toEqual(runTransfer("block", DEFAULT_SETTINGS, 4));
  });

  it("refuses settings outside the stated ranges", () => {
    expect(() => runTransfer("block", { ...DEFAULT_SETTINGS, alpha: 0 }, 1)).toThrow(PlanningLabError);
    expect(() => runTransfer("block", { ...DEFAULT_SETTINGS, testEpisodes: 500 }, 1)).toThrow(PlanningLabError);
  });

  it("an episode that cannot reach the goal stops at the step cap and says so", () => {
    const r = runTransfer("revaluation", { ...DEFAULT_SETTINGS, stepCap: 12, testEpisodes: 1 }, 1);
    expect(r.cached[0]?.steps).toBe(12);
    expect(r.cached[0]?.reachedGoal).toBe(false);
  });
});

describe("the transfer test states its contract", () => {
  it("names all ten points, and the cap that can stop an episode", () => {
    expect(Object.keys(TRANSFER_CONTRACT)).toHaveLength(10);
    for (const text of Object.values(TRANSFER_CONTRACT)) expect(text.length).toBeGreaterThan(20);
    expect(TRANSFER_CONTRACT.target).toMatch(/step cap/);
  });
});
