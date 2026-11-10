import { describe, expect, it } from "vitest";
import {
  captionsVtt,
  filmIsCurrent,
  plotGeometry,
  runVisualChecks,
  samplePlot,
  storyboardHash,
  type VisualSpec,
  visualGate,
} from "./visual";

const norms: VisualSpec = {
  slug: "two-norms",
  title: "Two norms",
  origin: "original",
  status: "checked",
  version: 1,
  unitIds: ["MAT-230-u01"],
  objective: "See why no constant bounds the sup norm by the integral norm.",
  sourceLocatorIds: [],
  revealsExerciseIds: ["MAT-230-u01-ex1"],
  scenes: [
    {
      id: "s1",
      title: "The family",
      caption: "Curves x^n.",
      equations: ["f_n(x)=x^n"],
      plot: { kind: "power_family", exponents: [1, 2, 5, 20], shadeLast: true },
      durationSeconds: 6,
    },
    { id: "s2", title: "Norms", caption: "Sup is 1, integral is 1/(n+1).", equations: ["\\|f_n\\|_1=\\frac1{n+1}"], durationSeconds: 7.5 },
  ],
  checks: [
    { kind: "power_l1", id: "l1", exponents: [1, 2, 5, 20] },
    { kind: "power_sup", id: "sup", exponents: [1, 2, 5, 20] },
  ],
};

describe("visual explanations", () => {
  it("checks the claims a visual makes numerically", () => {
    expect(runVisualChecks(norms).every((c) => c.passed)).toBe(true);
  });

  it("checks a relaxation plot conserves matter and shows the equilibrium, and refuses one that stops too early", () => {
    const base = {
      ...norms,
      scenes: [
        {
          id: "k",
          title: "A ⇌ B",
          caption: "Approach to equilibrium.",
          equations: [],
          plot: { kind: "relaxation" as const, kf: 2, kb: 1, a0: 1, b0: 0, tMax: 3 },
          durationSeconds: 5,
        },
      ],
      checks: [{ kind: "relaxation_equilibrium" as const, id: "eq" }],
    };
    expect(runVisualChecks(base)[0]?.passed).toBe(true);
    const early = { ...base, scenes: [{ ...base.scenes[0]!, plot: { ...base.scenes[0]!.plot, tMax: 0.3 } }] };
    expect(runVisualChecks(early)[0]).toMatchObject({ passed: false });
  });

  it("checks an integrate-and-fire claim about firing against the trajectory", () => {
    const lif = (rI: number, fires: boolean): VisualSpec => ({
      ...norms,
      scenes: [
        {
          id: "v",
          title: "LIF",
          caption: "Membrane potential.",
          equations: [],
          plot: { kind: "lif", tauMs: 20, eL: -70, rI, vTh: -50, vReset: -65, tMaxMs: 200 },
          durationSeconds: 5,
        },
      ],
      checks: [{ kind: "lif_steady_state", id: "lif", fires }],
    });
    expect(runVisualChecks(lif(25, true))[0]?.passed).toBe(true); // -70 + 25 = -45 > -50: fires
    expect(runVisualChecks(lif(15, false))[0]?.passed).toBe(true); // -55 < -50: silent
    expect(runVisualChecks(lif(15, true))[0]?.passed).toBe(false); // a wrong claim is caught
  });

  it("derives captions aligned to the scenes and a hash that changes with the storyboard", () => {
    const vtt = captionsVtt(norms);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:00.000 --> 00:00:06.000");
    expect(vtt).toContain("00:00:06.000 --> 00:00:13.500");
    expect(captionsVtt(norms, 1.25)).toContain("00:00:01.250 --> 00:00:07.250");
    const changed = { ...norms, scenes: [{ ...norms.scenes[0]!, caption: "Changed." }, norms.scenes[1]!] };
    expect(storyboardHash(changed)).not.toBe(storyboardHash(norms));
    expect(storyboardHash({ ...norms, status: "published" })).toBe(storyboardHash(norms));
  });

  it("samples plots deterministically", () => {
    const a = samplePlot({ kind: "power_family", exponents: [3], shadeLast: false }, 10);
    expect(a.series[0]!.points[10]).toEqual([1, 1]);
    expect(a.series[0]!.points[5]![1]).toBeCloseTo(0.125, 12);
  });

  it("treats a film as current only when it was made from this exact storyboard", () => {
    const render = {
      file: "film.webm",
      captionsFile: "captions.vtt",
      storyboardHash: storyboardHash(norms),
      durationSeconds: 13.5,
      renderedAt: "2026-11-10T00:00:00Z",
      tool: "test",
      leadInSeconds: 0,
    };
    expect(filmIsCurrent(norms)).toBe(false);
    expect(filmIsCurrent({ ...norms, render })).toBe(true);
    expect(filmIsCurrent({ ...norms, status: "published", render })).toBe(true);
    expect(filmIsCurrent({ ...norms, objective: "Corrected.", render })).toBe(false);
  });

  it("keeps an answer-revealing visual closed until one of its exercises was attempted or revealed", () => {
    expect(visualGate([], new Set())).toEqual({ open: true, waitingFor: [] });
    expect(visualGate(["e1", "e2"], new Set(["other"]))).toEqual({ open: false, waitingFor: ["e1", "e2"] });
    expect(visualGate(["e1", "e2"], new Set(["e2"]))).toEqual({ open: true, waitingFor: [] });
  });

  it("lays a plot out in its box from the checked samples, with ticks, a shaded area and the LIF threshold", () => {
    const g = plotGeometry({ kind: "power_family", exponents: [1, 5], shadeLast: true }, 560, 320);
    expect(g.series.map((s) => s.label)).toEqual(["x^1", "x^5"]);
    expect(g.series[0]!.d.startsWith(`M${g.frame.left.toFixed(1)} ${g.frame.bottom.toFixed(1)}`)).toBe(true);
    expect(g.series[0]!.d.endsWith(`L${g.frame.right.toFixed(1)} ${g.frame.top.toFixed(1)}`)).toBe(true);
    expect(g.area?.endsWith("Z")).toBe(true);
    expect(g.yTicks.map((t) => t.label)).toEqual(["0", "0.2", "0.4", "0.6", "0.8", "1"]);
    expect(g.guides).toEqual([]);
    const lif = plotGeometry({ kind: "lif", tauMs: 10, eL: -70, rI: 25, vTh: -50, vReset: -75, tMaxMs: 100 });
    expect(lif.guides).toHaveLength(1);
    expect(lif.guides[0]!.label).toBe("threshold -50");
    expect(lif.guides[0]!.y).toBeGreaterThan(lif.frame.top);
    expect(lif.guides[0]!.y).toBeLessThan(lif.frame.bottom);
  });
});
