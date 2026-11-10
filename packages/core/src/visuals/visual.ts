import { z } from "zod";

/**
 * Visual explanations: a storyboard of scenes (a caption, equations in LaTeX, an optional plot
 * computed deterministically from stated parameters), checked numerically against the claims it
 * makes, rendered by the application itself (never a generated bitmap of equations), with
 * captions derived from the same scenes. A short film is a recording of the same storyboard, made
 * locally; its file records the storyboard it was made from, so a corrected storyboard is a new
 * version and the old film is visibly stale.
 */

export const PlotSpec = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("power_family"),
    /** f_n(x) = x^n on [0, 1] for each n. */
    exponents: z.array(z.number().int().positive()).min(1).max(8),
    /** Shade the area under the last curve (its L1 norm on [0,1]). */
    shadeLast: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal("relaxation"),
    /** A ⇌ B with first-order rate constants; concentrations of A and B over time. */
    kf: z.number().positive(),
    kb: z.number().positive(),
    a0: z.number().min(0),
    b0: z.number().min(0),
    tMax: z.number().positive(),
  }),
  z.object({
    kind: z.literal("lif"),
    /** Leaky integrate-and-fire membrane potential for constant input, with threshold and reset. */
    tauMs: z.number().positive(),
    eL: z.number(),
    rI: z.number(),
    vTh: z.number(),
    vReset: z.number(),
    tMaxMs: z.number().positive(),
  }),
]);
export type PlotSpec = z.infer<typeof PlotSpec>;

export const VisualCheck = z.discriminatedUnion("kind", [
  /** ∫_0^1 x^n dx = 1/(n+1) for every listed n, by numerical integration. */
  z.object({ kind: z.literal("power_l1"), id: z.string(), exponents: z.array(z.number().int().positive()).min(1) }),
  /** sup_{[0,1]} x^n = 1 for every listed n, by sampling. */
  z.object({ kind: z.literal("power_sup"), id: z.string(), exponents: z.array(z.number().int().positive()).min(1) }),
  /** The relaxation reaches B_eq = kf/(kf+kb)(a0+b0) and conserves a0+b0 at every sample. */
  z.object({ kind: z.literal("relaxation_equilibrium"), id: z.string(), sceneId: z.string().optional() }),
  /** Without a threshold the LIF trajectory tends to eL + rI; the stated firing condition matches eL + rI > vTh. */
  z.object({ kind: z.literal("lif_steady_state"), id: z.string(), fires: z.boolean(), sceneId: z.string().optional() }),
]);
export type VisualCheck = z.infer<typeof VisualCheck>;

/** The record of a film recorded locally from a storyboard (kept in the visual's render/render.json). */
export const VisualRender = z.object({
  /** Bare file names inside the visual's render folder; never a path. */
  file: z.string().regex(/^[a-z0-9][a-z0-9-]*\.webm$/),
  captionsFile: z.string().regex(/^[a-z0-9][a-z0-9-]*\.vtt$/),
  storyboardHash: z.string(),
  durationSeconds: z.number().positive(),
  renderedAt: z.string(),
  tool: z.string(),
  /** Seconds of the recording before the first scene's timer starts; captions for the film are shifted by it. */
  leadInSeconds: z.number().min(0).default(0),
});
export type VisualRender = z.infer<typeof VisualRender>;

export const VisualSpec = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  /** What the material is: original teaching, an authorised external lecture, or an AI-assisted draft. */
  origin: z.enum(["original", "external", "ai_assisted_draft"]),
  status: z.enum(["draft", "checked", "published"]),
  version: z.number().int().positive(),
  unitIds: z.array(z.string()).min(1),
  objective: z.string().min(1),
  sourceLocatorIds: z.array(z.string()).default([]),
  /**
   * Exercises whose answer this visual shows: it stays closed until the learner has submitted an
   * attempt at one of them or chosen to see its reference reasoning.
   */
  revealsExerciseIds: z.array(z.string()).default([]),
  scenes: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        caption: z.string().min(1),
        equations: z.array(z.string()).default([]),
        plot: PlotSpec.optional(),
        /** What the plot shows, for anyone not seeing it. */
        plotDescription: z.string().optional(),
        durationSeconds: z.number().positive().max(30),
      }),
    )
    .min(1)
    .max(12),
  checks: z.array(VisualCheck).min(1),
  /**
   * A second reader's review, required before a visual may be `published`: who read the storyboard,
   * its checks and its film, on which date, and what they found. A `checked` visual has passed its
   * automatic checks only.
   */
  review: z
    .object({
      by: z.string().min(1),
      on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      notes: z.string().min(1),
    })
    .optional(),
  /** A rendered film of this storyboard, made locally. */
  render: VisualRender.optional(),
});
export type VisualSpec = z.infer<typeof VisualSpec>;

export interface Series {
  label: string;
  points: [number, number][];
}

/** Deterministic samples of a plot, in the plot's own units. */
export function samplePlot(plot: PlotSpec, samples = 200): { series: Series[]; xLabel: string; yLabel: string; area?: [number, number][] } {
  const xs = (a: number, b: number) => Array.from({ length: samples + 1 }, (_, i) => a + ((b - a) * i) / samples);
  switch (plot.kind) {
    case "power_family": {
      const series = plot.exponents.map((n) => ({ label: `x^${n}`, points: xs(0, 1).map((x) => [x, x ** n] as [number, number]) }));
      return { series, xLabel: "x", yLabel: "f(x)", area: plot.shadeLast ? series.at(-1)?.points : undefined };
    }
    case "relaxation": {
      const total = plot.a0 + plot.b0;
      const k = plot.kf + plot.kb;
      const bEq = (plot.kf / k) * total;
      const b = (t: number) => bEq + (plot.b0 - bEq) * Math.exp(-k * t);
      const ts = xs(0, plot.tMax);
      return {
        series: [
          { label: "[A]", points: ts.map((t) => [t, total - b(t)] as [number, number]) },
          { label: "[B]", points: ts.map((t) => [t, b(t)] as [number, number]) },
        ],
        xLabel: "time",
        yLabel: "concentration",
      };
    }
    case "lif": {
      const dt = plot.tMaxMs / samples;
      let v = plot.eL;
      const points: [number, number][] = [[0, v]];
      for (let i = 1; i <= samples; i++) {
        v += (dt / plot.tauMs) * (-(v - plot.eL) + plot.rI);
        if (v >= plot.vTh) v = plot.vReset;
        points.push([i * dt, v]);
      }
      return { series: [{ label: "V(t)", points }], xLabel: "time (ms)", yLabel: "V (mV)" };
    }
  }
}

export interface CheckResult {
  id: string;
  passed: boolean;
  detail: string;
}

function simpson(f: (x: number) => number, a: number, b: number, n = 2000): number {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

/** Runs a visual's numerical checks against its own plots and claims. */
export function runVisualChecks(spec: VisualSpec): CheckResult[] {
  const plotFor = (kind: PlotSpec["kind"], sceneId?: string) =>
    spec.scenes.find((s) => s.plot?.kind === kind && (!sceneId || s.id === sceneId))?.plot;
  return spec.checks.map((check): CheckResult => {
    switch (check.kind) {
      case "power_l1": {
        const bad = check.exponents.filter((n) => Math.abs(simpson((x) => x ** n, 0, 1) - 1 / (n + 1)) > 1e-6);
        return {
          id: check.id,
          passed: bad.length === 0,
          detail: bad.length ? `∫x^n ≠ 1/(n+1) for n = ${bad.join(", ")}` : `∫_0^1 x^n dx = 1/(n+1) for n = ${check.exponents.join(", ")}`,
        };
      }
      case "power_sup": {
        const bad = check.exponents.filter(
          (n) =>
            Math.abs(
              Math.max(...samplePlot({ kind: "power_family", exponents: [n], shadeLast: false }).series[0]!.points.map((p) => p[1])) - 1,
            ) > 1e-9,
        );
        return {
          id: check.id,
          passed: bad.length === 0,
          detail: bad.length ? `sup x^n ≠ 1 for n = ${bad.join(", ")}` : `sup_[0,1] x^n = 1 for n = ${check.exponents.join(", ")}`,
        };
      }
      case "relaxation_equilibrium": {
        const plot = plotFor("relaxation", check.sceneId);
        if (plot?.kind !== "relaxation") return { id: check.id, passed: false, detail: "No relaxation plot to check." };
        const sampled = samplePlot(plot);
        const total = plot.a0 + plot.b0;
        const conserved = sampled.series[0]!.points.every((p, i) => Math.abs(p[1] + sampled.series[1]!.points[i]![1] - total) < 1e-9);
        const bEq = (plot.kf / (plot.kf + plot.kb)) * total;
        // The plot must actually show the approach: by its end [B] is within 1% of equilibrium.
        const last = sampled.series[1]!.points.at(-1)![1];
        const shown = Math.abs(last - bEq) <= 0.01 * Math.max(total, 1e-9);
        const passed = conserved && shown;
        return {
          id: check.id,
          passed,
          detail: `[A]+[B] = ${total} at every sample: ${conserved}; [B] reaches ${last.toFixed(4)} by t = ${plot.tMax}, against kf/(kf+kb)·total = ${bEq.toFixed(4)}${shown ? "" : " (the plot stops too early to show equilibrium)"}.`,
        };
      }
      case "lif_steady_state": {
        const plot = plotFor("lif", check.sceneId);
        if (plot?.kind !== "lif") return { id: check.id, passed: false, detail: "No LIF plot to check." };
        const target = plot.eL + plot.rI;
        const fires = target > plot.vTh;
        const sampled = samplePlot(plot, 4000).series[0]!.points.map((p) => p[1]);
        const resets = sampled.some((v, i) => i > 0 && v < sampled[i - 1]! - 1e-9);
        const passed = fires === check.fires && resets === fires;
        return {
          id: check.id,
          passed,
          detail: `E_L + RI = ${target} mV ${fires ? ">" : "≤"} V_th = ${plot.vTh} mV, so the model ${fires ? "fires" : "stays silent"}; the trajectory ${resets ? "resets" : "never resets"}.`,
        };
      }
      default: {
        // Unreachable for a parsed spec; an unknown kind fails rather than passing silently.
        const unknown: { id: string } = check;
        return { id: unknown.id, passed: false, detail: "Unknown check kind." };
      }
    }
  });
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const stamp = (s: number) =>
  `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))}.${pad(Math.round((s % 1) * 1000), 3)}`;

/** WebVTT captions from the scenes, aligned to their durations and starting `offsetSeconds` in. */
export function captionsVtt(spec: VisualSpec, offsetSeconds = 0): string {
  let t = offsetSeconds;
  const cues = spec.scenes.map((s, i) => {
    const cue = `${i + 1}\n${stamp(t)} --> ${stamp(t + s.durationSeconds)}\n${s.title}: ${s.caption}`;
    t += s.durationSeconds;
    return cue;
  });
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

/** A stable hash of the storyboard (FNV-1a over its JSON without the render record). */
export function storyboardHash(spec: VisualSpec): string {
  // The film depends on the storyboard only: its status, review and render record are not part of it.
  const { render: _render, status: _status, review: _review, ...rest } = spec;
  const text = JSON.stringify(rest);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function totalDuration(spec: VisualSpec): number {
  return spec.scenes.reduce((s, x) => s + x.durationSeconds, 0);
}

/** Whether the recorded film was made from this exact storyboard; a stale film is never shown as current. */
export function filmIsCurrent(spec: VisualSpec): boolean {
  return spec.render !== undefined && spec.render.storyboardHash === storyboardHash(spec);
}

/**
 * Whether an answer-revealing visual may open: only once the learner has submitted an attempt at
 * one of the exercises it reveals, or chosen to see that exercise's reference reasoning.
 */
export function visualGate(
  revealsExerciseIds: readonly string[],
  openedExerciseIds: ReadonlySet<string>,
): { open: boolean; waitingFor: string[] } {
  if (revealsExerciseIds.length === 0) return { open: true, waitingFor: [] };
  const open = revealsExerciseIds.some((id) => openedExerciseIds.has(id));
  return { open, waitingFor: open ? [] : [...revealsExerciseIds] };
}

export interface PlotGeometry {
  width: number;
  height: number;
  frame: { left: number; top: number; right: number; bottom: number };
  series: { label: string; d: string }[];
  /** The shaded region under the last curve, closed to the x axis. */
  area?: string;
  /** Horizontal reference lines (the LIF threshold), with their labels. */
  guides: { y: number; label: string }[];
  xTicks: { x: number; label: string }[];
  yTicks: { y: number; label: string }[];
  xLabel: string;
  yLabel: string;
}

function niceTicks(min: number, max: number, count = 5): number[] {
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

const tickLabel = (v: number) => String(Number(v.toFixed(6)));

/** SVG geometry for a plot in a width × height box, from the same samples the checks use. */
export function plotGeometry(plot: PlotSpec, width = 560, height = 320): PlotGeometry {
  const sampled = samplePlot(plot);
  const frame = { left: 56, top: 16, right: width - 16, bottom: height - 44 };
  const guides = plot.kind === "lif" ? [{ value: plot.vTh, label: "threshold" }] : [];
  const xs = sampled.series.flatMap((s) => s.points.map((p) => p[0]));
  const ys = [...sampled.series.flatMap((s) => s.points.map((p) => p[1])), ...guides.map((g) => g.value)];
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = plot.kind === "lif" ? Math.min(...ys) : Math.min(0, ...ys);
  const top = Math.max(...ys) > yMin ? Math.max(...ys) : yMin + 1;
  // Headroom above a guide (a trajectory resets at the threshold, so it is the maximum) keeps it off the frame.
  const yMax = guides.length ? top + 0.1 * (top - yMin) : top;
  const sx = (x: number) => frame.left + ((x - xMin) / (xMax - xMin)) * (frame.right - frame.left);
  const sy = (y: number) => frame.bottom - ((y - yMin) / (yMax - yMin)) * (frame.bottom - frame.top);
  const n = (v: number) => v.toFixed(1);
  const path = (points: [number, number][]) => points.map((p, i) => `${i ? "L" : "M"}${n(sx(p[0]))} ${n(sy(p[1]))}`).join(" ");
  const area = sampled.area
    ? `${path(sampled.area)} L${n(sx(sampled.area.at(-1)![0]))} ${n(sy(yMin))} L${n(sx(sampled.area[0]![0]))} ${n(sy(yMin))} Z`
    : undefined;
  return {
    width,
    height,
    frame,
    series: sampled.series.map((s) => ({ label: s.label, d: path(s.points) })),
    area,
    guides: guides.map((g) => ({ y: sy(g.value), label: `${g.label} ${tickLabel(g.value)}` })),
    xTicks: niceTicks(xMin, xMax).map((v) => ({ x: sx(v), label: tickLabel(v) })),
    yTicks: niceTicks(yMin, yMax).map((v) => ({ y: sy(v), label: tickLabel(v) })),
    xLabel: sampled.xLabel,
    yLabel: sampled.yLabel,
  };
}
