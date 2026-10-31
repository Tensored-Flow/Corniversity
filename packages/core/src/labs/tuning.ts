import { mulberry32, type Rng } from "./random";

/**
 * Synthetic orientation tuning: λ(θ) = b + A·exp(κ·cos(2(θ − θ_pref))) spikes per second,
 * counts n ~ Poisson(λ(θ)·T). Everything generated here is synthetic and labelled so; nothing
 * is a recording. Fitting maximises the Poisson log-likelihood by a coarse grid followed by
 * coordinate refinement, which is adequate for four parameters and keeps the lab deterministic.
 */

export interface TuningParams {
  b: number; // baseline rate (Hz)
  A: number; // modulation amplitude (Hz)
  kappa: number; // concentration (sharpness)
  thetaPref: number; // preferred orientation in degrees, [0, 180)
}

export interface Trial {
  thetaDegrees: number;
  count: number;
}

export const ORIENTATIONS = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5] as const;

const rad = (deg: number) => (deg * Math.PI) / 180;

export function tuningRate(p: TuningParams, thetaDegrees: number): number {
  return p.b + p.A * Math.exp(p.kappa * Math.cos(2 * rad(thetaDegrees - p.thetaPref)));
}

export function generateTrials(
  p: TuningParams,
  trialsPerOrientation: number,
  windowSeconds: number,
  seed: number,
  rng: Rng = mulberry32(seed),
): Trial[] {
  const trials: Trial[] = [];
  for (let i = 0; i < trialsPerOrientation; i++) {
    for (const theta of ORIENTATIONS) trials.push({ thetaDegrees: theta, count: rng.poisson(tuningRate(p, theta) * windowSeconds) });
  }
  return trials;
}

/** A dataset built to break the unimodal model: two preferred orientations 90° apart. */
export function generateBimodalTrials(trialsPerOrientation: number, windowSeconds: number, seed: number): Trial[] {
  const rng = mulberry32(seed);
  const p1: TuningParams = { b: 2, A: 12, kappa: 2.5, thetaPref: 20 };
  const p2: TuningParams = { b: 0, A: 12, kappa: 2.5, thetaPref: 110 };
  const trials: Trial[] = [];
  for (let i = 0; i < trialsPerOrientation; i++) {
    for (const theta of ORIENTATIONS)
      trials.push({ thetaDegrees: theta, count: rng.poisson((tuningRate(p1, theta) + tuningRate(p2, theta)) * windowSeconds) });
  }
  return trials;
}

/** Deterministic interleaved split: every k-th trial is held out. */
export function splitTrials(trials: Trial[], holdOutEvery = 4): { train: Trial[]; test: Trial[] } {
  const train: Trial[] = [];
  const test: Trial[] = [];
  trials.forEach((t, i) => {
    (i % holdOutEvery === holdOutEvery - 1 ? test : train).push(t);
  });
  return { train, test };
}

function logFactorial(n: number): number {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}

/** Σ [n log(λT) − λT − log n!] over trials. */
export function poissonLogLikelihood(trials: Trial[], rate: (thetaDegrees: number) => number, windowSeconds: number): number {
  let ll = 0;
  for (const t of trials) {
    const mean = Math.max(rate(t.thetaDegrees) * windowSeconds, 1e-9);
    ll += t.count * Math.log(mean) - mean - logFactorial(t.count);
  }
  return ll;
}

/** Constant-rate baseline: the MLE is the mean count divided by the window. */
export function fitBaseline(trials: Trial[], windowSeconds: number): { b: number } {
  const mean = trials.reduce((s, t) => s + t.count, 0) / Math.max(1, trials.length);
  return { b: mean / windowSeconds };
}

export function fitTuning(trials: Trial[], windowSeconds: number): TuningParams {
  const ll = (p: TuningParams) => poissonLogLikelihood(trials, (theta) => tuningRate(p, theta), windowSeconds);
  const counts = trials.map((t) => t.count / windowSeconds);
  const maxRate = Math.max(...counts, 1);
  const minRate = Math.min(...counts);
  let best: TuningParams = { b: Math.max(0.1, minRate), A: Math.max(0.5, (maxRate - minRate) / Math.E), kappa: 1, thetaPref: 0 };
  let bestLl = Number.NEGATIVE_INFINITY;
  // Coarse grid over the two parameters that make the surface multimodal.
  for (let thetaPref = 0; thetaPref < 180; thetaPref += 5) {
    for (const kappa of [0.25, 0.5, 1, 1.5, 2, 3, 4]) {
      for (const scale of [0.5, 1, 1.5]) {
        const candidate = { ...best, kappa, thetaPref, A: Math.max(0.1, ((maxRate - minRate) * scale) / Math.exp(kappa)) };
        const value = ll(candidate);
        if (value > bestLl) {
          bestLl = value;
          best = candidate;
        }
      }
    }
  }
  // Coordinate refinement with shrinking steps.
  let steps = { b: 0.5, A: 0.5, kappa: 0.25, thetaPref: 2.5 };
  for (let round = 0; round < 40; round++) {
    let improved = false;
    for (const key of ["b", "A", "kappa", "thetaPref"] as const) {
      for (const direction of [1, -1]) {
        const candidate = { ...best, [key]: best[key] + direction * steps[key] } as TuningParams;
        if (candidate.b < 0 || candidate.A < 0 || candidate.kappa < 0) continue;
        candidate.thetaPref = ((candidate.thetaPref % 180) + 180) % 180;
        const value = ll(candidate);
        if (value > bestLl + 1e-12) {
          bestLl = value;
          best = candidate;
          improved = true;
        }
      }
    }
    if (!improved) steps = { b: steps.b / 2, A: steps.A / 2, kappa: steps.kappa / 2, thetaPref: steps.thetaPref / 2 };
    if (steps.thetaPref < 0.05) break;
  }
  return best;
}

export interface ComparisonResult {
  tuning: TuningParams;
  baseline: { b: number };
  trainLogLikPerTrial: { tuning: number; baseline: number };
  heldOutLogLikPerTrial: { tuning: number; baseline: number };
  /** Positive favours the tuning model on held-out trials. */
  heldOutAdvantagePerTrial: number;
}

export function compareModels(train: Trial[], test: Trial[], windowSeconds: number): ComparisonResult {
  const tuning = fitTuning(train, windowSeconds);
  const baseline = fitBaseline(train, windowSeconds);
  const per = (trials: Trial[], rate: (theta: number) => number) =>
    poissonLogLikelihood(trials, rate, windowSeconds) / Math.max(1, trials.length);
  const trainLogLikPerTrial = { tuning: per(train, (t) => tuningRate(tuning, t)), baseline: per(train, () => baseline.b) };
  const heldOutLogLikPerTrial = { tuning: per(test, (t) => tuningRate(tuning, t)), baseline: per(test, () => baseline.b) };
  return {
    tuning,
    baseline,
    trainLogLikPerTrial,
    heldOutLogLikPerTrial,
    heldOutAdvantagePerTrial: heldOutLogLikPerTrial.tuning - heldOutLogLikPerTrial.baseline,
  };
}

/** Percentile bootstrap over trials (resampling with replacement), deterministic by seed. */
export function bootstrapTuning(
  train: Trial[],
  windowSeconds: number,
  resamples: number,
  seed: number,
): Record<keyof TuningParams, { low: number; high: number; samples: number[] }> {
  const rng = mulberry32(seed);
  const samples: TuningParams[] = [];
  for (let r = 0; r < resamples; r++) {
    const resampled = Array.from({ length: train.length }, () => rng.pick(train));
    samples.push(fitTuning(resampled, windowSeconds));
  }
  const interval = (key: keyof TuningParams) => {
    const values = samples.map((s) => s[key]).sort((a, b) => a - b);
    const at = (q: number) => values[Math.min(values.length - 1, Math.max(0, Math.floor(q * (values.length - 1))))]!;
    return { low: at(0.025), high: at(0.975), samples: values };
  };
  return { b: interval("b"), A: interval("A"), kappa: interval("kappa"), thetaPref: interval("thetaPref") };
}

/** Mean count per orientation, for plotting alongside the fitted curve. */
export function meanCounts(trials: Trial[]): { thetaDegrees: number; mean: number; n: number }[] {
  return ORIENTATIONS.map((theta) => {
    const group = trials.filter((t) => t.thetaDegrees === theta);
    return { thetaDegrees: theta, mean: group.reduce((s, t) => s + t.count, 0) / Math.max(1, group.length), n: group.length };
  });
}
