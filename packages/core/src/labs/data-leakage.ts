import { mulberry32 } from "./random";

/**
 * A synthetic predictive-maintenance dataset with deliberate leaks (Deep Learning Foundations,
 * unit 1). 250 machines × 20 consecutive weeks; the label is "fails next week" with a base
 * rate near 6%. Two sensor features carry weak genuine signal; `ticketOpenedThisWeek` leaks the
 * target because tickets are opened when a fault is detected, mostly in the failure week or the
 * week before. Every number is invented; the point is the protocol, not the machines.
 */

export interface Record {
  machine: number;
  week: number;
  vibration: number;
  temperature: number;
  ticketOpenedThisWeek: 0 | 1;
  failsNextWeek: 0 | 1;
}

export interface DatasetSummary {
  rows: number;
  machines: number;
  weeks: number;
  baseRate: number;
}

export function generateDataset(seed = 2026, machines = 250, weeks = 20): Record[] {
  const rng = mulberry32(seed);
  const records: Record[] = [];
  for (let m = 0; m < machines; m++) {
    const wear = rng.next(); // machine-specific propensity
    const failWeeks = new Set<number>();
    for (let w = 0; w < weeks; w++) if (rng.next() < 0.03 + 0.06 * wear) failWeeks.add(w);
    for (let w = 0; w < weeks; w++) {
      const failsNextWeek: 0 | 1 = failWeeks.has(w + 1) ? 1 : 0;
      const failsThisWeek = failWeeks.has(w);
      const vibration = 1 + 0.6 * wear + (failsNextWeek ? 0.35 : 0) + 0.5 * rng.normal();
      const temperature = 60 + 8 * wear + (failsNextWeek ? 3 : 0) + 4 * rng.normal();
      const ticketOpenedThisWeek: 0 | 1 =
        (failsNextWeek && rng.next() < 0.9) || (failsThisWeek && rng.next() < 0.5) || rng.next() < 0.01 ? 1 : 0;
      records.push({ machine: m, week: w, vibration, temperature, ticketOpenedThisWeek, failsNextWeek });
    }
  }
  return records;
}

export function summarise(records: Record[]): DatasetSummary {
  const machines = new Set(records.map((r) => r.machine)).size;
  const weeks = new Set(records.map((r) => r.week)).size;
  return { rows: records.length, machines, weeks, baseRate: records.reduce((s, r) => s + r.failsNextWeek, 0) / records.length };
}

/** Accuracy of always predicting "no failure": 1 − base rate. The number any model must beat. */
export function trivialBaselineAccuracy(records: Record[]): number {
  return 1 - summarise(records).baseRate;
}

export type Split = { train: Record[]; test: Record[] };

/** The leaky split: rows shuffled uniformly, so a machine's weeks (and its future) land on both sides. */
export function randomSplit(records: Record[], seed = 7, testFraction = 0.2): Split {
  const rng = mulberry32(seed);
  const shuffled = [...records];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const cut = Math.floor(shuffled.length * (1 - testFraction));
  return { train: shuffled.slice(0, cut), test: shuffled.slice(cut) };
}

/** The honest split: later weeks are the test set, so nothing from the future is trained on. */
export function temporalSplit(records: Record[], testWeeks = 4): Split {
  const maxWeek = Math.max(...records.map((r) => r.week));
  return { train: records.filter((r) => r.week <= maxWeek - testWeeks), test: records.filter((r) => r.week > maxWeek - testWeeks) };
}

export interface Features {
  useTicket: boolean;
  /** Where the standardisation statistics come from: the training rows (correct) or every row (leak). */
  standardiseOn: "train" | "all";
}

interface Model {
  weights: number[];
  bias: number;
  means: number[];
  sds: number[];
}

function featureVector(r: Record, f: Features): number[] {
  return f.useTicket ? [r.vibration, r.temperature, r.ticketOpenedThisWeek] : [r.vibration, r.temperature];
}

function stats(rows: number[][]): { means: number[]; sds: number[] } {
  const d = rows[0]?.length ?? 0;
  const means = Array.from({ length: d }, (_, j) => rows.reduce((s, r) => s + r[j]!, 0) / rows.length);
  const sds = Array.from({ length: d }, (_, j) => Math.sqrt(rows.reduce((s, r) => s + (r[j]! - means[j]!) ** 2, 0) / rows.length) || 1);
  return { means, sds };
}

/** Logistic regression by full-batch gradient descent: deterministic, dependency-free, adequate for 2–3 features. */
export function trainLogistic(
  split: Split,
  features: Features,
  options: { epochs?: number; learningRate?: number; l2?: number } = {},
): Model {
  const all = [...split.train, ...split.test];
  const statRows = (features.standardiseOn === "all" ? all : split.train).map((r) => featureVector(r, features));
  const { means, sds } = stats(statRows);
  const x = split.train.map((r) => featureVector(r, features).map((v, j) => (v - means[j]!) / sds[j]!));
  const y = split.train.map((r) => r.failsNextWeek);
  const d = means.length;
  let weights = Array.from({ length: d }, () => 0);
  let bias = Math.log(Math.max(1e-6, summarise(split.train).baseRate) / (1 - summarise(split.train).baseRate));
  const epochs = options.epochs ?? 300;
  const lr = options.learningRate ?? 0.5;
  const l2 = options.l2 ?? 1e-3;
  for (let e = 0; e < epochs; e++) {
    const gw = Array.from({ length: d }, () => 0);
    let gb = 0;
    for (let i = 0; i < x.length; i++) {
      const z = bias + x[i]!.reduce((s, v, j) => s + v * weights[j]!, 0);
      const p = 1 / (1 + Math.exp(-z));
      const err = p - y[i]!;
      for (let j = 0; j < d; j++) gw[j]! += err * x[i]![j]!;
      gb += err;
    }
    weights = weights.map((w, j) => w - lr * (gw[j]! / x.length + l2 * w));
    bias -= lr * (gb / x.length);
  }
  return { weights, bias, means, sds };
}

export function predict(model: Model, r: Record, features: Features, threshold = 0.5): 0 | 1 {
  const x = featureVector(r, features).map((v, j) => (v - model.means[j]!) / model.sds[j]!);
  const z = model.bias + x.reduce((s, v, j) => s + v * model.weights[j]!, 0);
  return 1 / (1 + Math.exp(-z)) >= threshold ? 1 : 0;
}

export function accuracy(model: Model, rows: Record[], features: Features): number {
  return rows.reduce((s, r) => s + (predict(model, r, features) === r.failsNextWeek ? 1 : 0), 0) / rows.length;
}

export interface PipelineReport {
  name: string;
  accuracy: number;
  notes: string;
}

/**
 * The pipelines the exercise contrasts. "Leaky" is the tidy-looking one from the exercise
 * (ticket feature, statistics over every row, random split); "honest" removes the leak and
 * splits by time; "baseline" predicts no failure for everyone.
 */
export function comparePipelines(records: Record[]): PipelineReport[] {
  const leakySplit = randomSplit(records);
  const leakyFeatures: Features = { useTicket: true, standardiseOn: "all" };
  const leaky = trainLogistic(leakySplit, leakyFeatures);
  const honestSplit = temporalSplit(records);
  const honestFeatures: Features = { useTicket: false, standardiseOn: "train" };
  const honest = trainLogistic(honestSplit, honestFeatures);
  return [
    {
      name: "baseline",
      accuracy: trivialBaselineAccuracy(records),
      notes: "Predict 'no failure' for every machine-week. Any model must beat this to count as evidence.",
    },
    {
      name: "leaky",
      accuracy: accuracy(leaky, leakySplit.test, leakyFeatures),
      notes:
        "Ticket feature (opened after the fault is detected), statistics fitted on all rows, random row split: future and target information reach the training set.",
    },
    {
      name: "honest",
      accuracy: accuracy(honest, honestSplit.test, honestFeatures),
      notes:
        "Sensor features only, statistics fitted on the training weeks, later weeks held out: the number a deployed model could actually hope for.",
    },
  ];
}

/**
 * Selection on the test set: trying many configurations and keeping the best test score turns
 * noise into apparent skill. Each "configuration" here perturbs the decision threshold; the
 * spread between the median and the maximum is the optimism the protocol in the exercise buys.
 */
export function selectionOptimism(records: Record[], configurations = 30, seed = 11): { median: number; best: number } {
  const split = randomSplit(records, seed);
  const features: Features = { useTicket: false, standardiseOn: "train" };
  const model = trainLogistic(split, features, { epochs: 150 });
  const rng = mulberry32(seed + 1);
  const scores: number[] = [];
  for (let c = 0; c < configurations; c++) {
    const subset = split.test.filter(() => rng.next() < 0.5); // a different "test batch" per run, as noisy evaluation does
    const threshold = 0.3 + 0.4 * rng.next();
    scores.push(
      subset.reduce((s, r) => s + (predict(model, r, features, threshold) === r.failsNextWeek ? 1 : 0), 0) / Math.max(1, subset.length),
    );
  }
  scores.sort((a, b) => a - b);
  return { median: scores[Math.floor(scores.length / 2)]!, best: scores[scores.length - 1]! };
}
