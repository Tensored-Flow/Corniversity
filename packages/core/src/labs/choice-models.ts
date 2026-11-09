import type { InformationContract } from "./contract";
import { mulberry32, type Rng } from "./random";

/**
 * A complete modelling loop on a two-armed bandit, following the procedure set out by Wilson and
 * Collins (2019): simulate from candidate models, fit by maximum likelihood, check that
 * parameters can be recovered, check that the models can be told apart, then compare them on a
 * properly specified held-out split against a baseline. Everything here is synthetic: no
 * person's data is involved, and every run is reproducible from its seed.
 *
 * Models (choices are 0 or 1; rewards are 0 or 1):
 * - bias:  random responding, P(choose 1) = b.
 * - wsls:  noisy win-stay lose-shift. Trial 1 is a coin flip; afterwards the WSLS rule is
 *          followed with probability 1 - eps and the choice is random otherwise, so
 *          P(repeat | win) = 1 - eps/2 and P(switch | loss) = 1 - eps/2.
 * - rw:    Rescorla-Wagner values with softmax choice. Q starts at 0.5 for both arms;
 *          P(choose k) = exp(beta Q_k) / sum_j exp(beta Q_j); after each trial only the chosen
 *          arm is updated, Q_k <- Q_k + alpha (r - Q_k).
 */

export type ModelId = "bias" | "wsls" | "rw";
export const MODEL_IDS: readonly ModelId[] = ["bias", "wsls", "rw"];

export const MODEL_LABEL: Record<ModelId, string> = {
  bias: "Biased random responding (baseline)",
  wsls: "Noisy win-stay lose-shift",
  rw: "Rescorla-Wagner learning with softmax choice",
};

export const MODEL_ASSUMPTIONS: Record<ModelId, string[]> = {
  bias: ["Each choice ignores history and outcomes.", "One parameter b: the probability of choosing arm 1."],
  wsls: [
    "Only the previous choice and its outcome matter; nothing is learned across trials.",
    "One parameter eps: how often the rule is replaced by a random choice.",
  ],
  rw: [
    "The learner keeps a value for each arm and updates the chosen arm towards the outcome.",
    "alpha in [0, 1] sets how fast values change; beta >= 0 sets how deterministically higher values are chosen.",
    "Values start at 0.5; the unchosen arm's value does not change.",
  ],
};

export interface RwParams {
  alpha: number;
  beta: number;
}
export type ModelParams = { model: "bias"; b: number } | { model: "wsls"; eps: number } | { model: "rw"; alpha: number; beta: number };

export interface TaskDesign {
  trials: number;
  /** Reward probability of arm 0 and arm 1. */
  rewardProbabilities: [number, number];
}

export interface Session {
  choices: number[];
  rewards: number[];
}

/** Limits that keep every run within the browser's budget. */
export const LIMITS = { minTrials: 20, maxTrials: 1000, maxParticipants: 40, maxRecoveryFits: 60, maxDatasetsPerModel: 40 };

export class ChoiceLabError extends Error {}
export class ComputeLimitError extends ChoiceLabError {}

const BETA_MAX = 20;
const TINY = 1e-12;

export function validateDesign(design: TaskDesign): void {
  if (!Number.isInteger(design.trials) || design.trials < LIMITS.minTrials)
    throw new ChoiceLabError(`A session needs at least ${LIMITS.minTrials} trials.`);
  if (design.trials > LIMITS.maxTrials) throw new ComputeLimitError(`At most ${LIMITS.maxTrials} trials per session run in the browser.`);
  for (const p of design.rewardProbabilities)
    if (!(p >= 0 && p <= 1)) throw new ChoiceLabError("Reward probabilities must lie between 0 and 1.");
}

export function validateParams(params: ModelParams): void {
  if (params.model === "bias" && !(params.b >= 0 && params.b <= 1)) throw new ChoiceLabError("b must lie in [0, 1].");
  if (params.model === "wsls" && !(params.eps >= 0 && params.eps <= 1)) throw new ChoiceLabError("eps must lie in [0, 1].");
  if (params.model === "rw") {
    if (!(params.alpha >= 0 && params.alpha <= 1)) throw new ChoiceLabError("alpha must lie in [0, 1].");
    if (!(params.beta >= 0 && params.beta <= BETA_MAX)) throw new ChoiceLabError(`beta must lie in [0, ${BETA_MAX}].`);
  }
}

/** Probability of choosing arm 1 on trial t given the history before it. */
function probabilityOfOne(params: ModelParams, history: Session, t: number, q: [number, number]): number {
  switch (params.model) {
    case "bias":
      return params.b;
    case "wsls": {
      if (t === 0) return 0.5;
      const prev = history.choices[t - 1]!;
      const won = history.rewards[t - 1] === 1;
      const ruleChoice = won ? prev : 1 - prev;
      const pRule = 1 - params.eps / 2;
      return ruleChoice === 1 ? pRule : 1 - pRule;
    }
    case "rw":
      return 1 / (1 + Math.exp(-params.beta * (q[1] - q[0])));
  }
}

function updateValues(params: ModelParams, q: [number, number], choice: number, reward: number): void {
  if (params.model !== "rw") return;
  q[choice] = q[choice]! + params.alpha * (reward - q[choice]!);
}

/** Simulates one synthetic participant. Deterministic in the seed. */
export function simulate(params: ModelParams, design: TaskDesign, seed: number): Session {
  validateDesign(design);
  validateParams(params);
  const rng: Rng = mulberry32(seed);
  const session: Session = { choices: [], rewards: [] };
  const q: [number, number] = [0.5, 0.5];
  for (let t = 0; t < design.trials; t++) {
    const p1 = probabilityOfOne(params, session, t, q);
    const choice = rng.next() < p1 ? 1 : 0;
    const reward = rng.next() < design.rewardProbabilities[choice]! ? 1 : 0;
    session.choices.push(choice);
    session.rewards.push(reward);
    updateValues(params, q, choice, reward);
  }
  return session;
}

/**
 * Negative log-likelihood of the choices on the trials selected by `include` (all by default).
 * The model's state always runs through the whole observed history, because in a sequential
 * task every earlier choice and outcome is available when the next choice is predicted.
 */
export function negLogLikelihood(params: ModelParams, session: Session, include?: (t: number) => boolean): number {
  const q: [number, number] = [0.5, 0.5];
  let nll = 0;
  for (let t = 0; t < session.choices.length; t++) {
    const choice = session.choices[t]!;
    if (!include || include(t)) {
      const p1 = probabilityOfOne(params, session, t, q);
      nll -= Math.log(Math.max(TINY, choice === 1 ? p1 : 1 - p1));
    }
    updateValues(params, q, choice, session.rewards[t]!);
  }
  return nll;
}

export const PARAMETER_COUNT: Record<ModelId, number> = { bias: 1, wsls: 1, rw: 2 };

export interface Fit {
  model: ModelId;
  params: ModelParams;
  nll: number;
  trials: number;
  bic: number;
}

const ALPHA_GRID = Array.from({ length: 21 }, (_, i) => i / 20);
const BETA_GRID = [0, 0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12.5, 15, 17.5, 20];

/** Golden-section minimisation of f on [lo, hi]; deterministic. */
function golden(f: (x: number) => number, lo: number, hi: number, iterations = 30): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < iterations; i++) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - g * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + g * (b - a);
      fd = f(d);
    }
  }
  return (a + b) / 2;
}

/**
 * Maximum-likelihood fit within the parameter bounds. bias and wsls have closed forms; rw uses
 * a grid followed by coordinate-wise golden-section refinement, so the same data always give the
 * same estimate.
 */
export function fitModel(model: ModelId, sessions: readonly Session[], include?: (s: number, t: number) => boolean): Fit {
  const trials = sessions.reduce((n, s, si) => n + s.choices.filter((_, t) => !include || include(si, t)).length, 0);
  if (trials === 0) throw new ChoiceLabError("No trials to fit.");
  const total = (params: ModelParams) =>
    sessions.reduce((sum, s, si) => sum + negLogLikelihood(params, s, include ? (t) => include(si, t) : undefined), 0);
  let params: ModelParams;
  if (model === "bias") {
    let ones = 0;
    sessions.forEach((s, si) => {
      s.choices.forEach((c, t) => {
        if (!include || include(si, t)) ones += c;
      });
    });
    params = { model: "bias", b: Math.min(1 - 1e-6, Math.max(1e-6, ones / trials)) };
  } else if (model === "wsls") {
    let consistent = 0;
    let n = 0;
    sessions.forEach((s, si) => {
      for (let t = 1; t < s.choices.length; t++) {
        if (include && !include(si, t)) continue;
        n++;
        const rule = s.rewards[t - 1] === 1 ? s.choices[t - 1] : 1 - s.choices[t - 1]!;
        if (s.choices[t] === rule) consistent++;
      }
    });
    const eps = n === 0 ? 1 : Math.min(1, (2 * (n - consistent)) / n);
    params = { model: "wsls", eps: Math.max(1e-6, eps) };
  } else {
    let best: RwParams = { alpha: 0.5, beta: 1 };
    let bestNll = Number.POSITIVE_INFINITY;
    for (const alpha of ALPHA_GRID) {
      for (const beta of BETA_GRID) {
        const v = total({ model: "rw", alpha, beta });
        if (v < bestNll - 1e-12) {
          bestNll = v;
          best = { alpha, beta };
        }
      }
    }
    for (let round = 0; round < 3; round++) {
      const alpha = golden(
        (a) => total({ model: "rw", alpha: a, beta: best.beta }),
        Math.max(0, best.alpha - 0.1),
        Math.min(1, best.alpha + 0.1),
        18,
      );
      const beta = golden(
        (b) => total({ model: "rw", alpha, beta: b }),
        Math.max(0, best.beta - 2.5),
        Math.min(BETA_MAX, best.beta + 2.5),
        18,
      );
      const v = total({ model: "rw", alpha, beta });
      if (v < bestNll) {
        bestNll = v;
        best = { alpha, beta };
      }
    }
    params = { model: "rw", alpha: best.alpha, beta: best.beta };
  }
  const nll = total(params);
  return { model, params, nll, trials, bic: 2 * nll + PARAMETER_COUNT[model] * Math.log(trials) };
}

/** The negative log-likelihood profile over alpha at a fixed beta, to show where alpha is not identified. */
export function alphaProfile(session: Session, beta: number, points = 21): { alpha: number; nll: number }[] {
  return Array.from({ length: points }, (_, i) => {
    const alpha = i / (points - 1);
    return { alpha, nll: negLogLikelihood({ model: "rw", alpha, beta }, session) };
  });
}

export interface RecoveryPoint {
  trueAlpha: number;
  trueBeta: number;
  fitAlpha: number;
  fitBeta: number;
  seed: number;
}

export interface RecoverySummary {
  points: RecoveryPoint[];
  alphaCorrelation: number;
  betaCorrelation: number;
  alphaMeanAbsError: number;
  betaMeanAbsError: number;
  /** Mean error per true setting, to show where recovery fails systematically. */
  bySetting: { trueAlpha: number; trueBeta: number; alphaBias: number; betaBias: number }[];
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return Number.NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? Number.NaN : sxy / Math.sqrt(sxx * syy);
}

/** Simulate with known Rescorla-Wagner parameters, refit, and compare across settings. */
export function parameterRecovery(design: TaskDesign, settings: readonly RwParams[], repetitions: number, seed: number): RecoverySummary {
  validateDesign(design);
  if (settings.length * repetitions > LIMITS.maxRecoveryFits)
    throw new ComputeLimitError(`At most ${LIMITS.maxRecoveryFits} recovery fits run in the browser; reduce the settings or repetitions.`);
  const points: RecoveryPoint[] = [];
  settings.forEach((s, i) => {
    for (let r = 0; r < repetitions; r++) {
      const runSeed = seed + 1000 * i + r;
      const session = simulate({ model: "rw", ...s }, design, runSeed);
      const fit = fitModel("rw", [session]);
      if (fit.params.model !== "rw") continue;
      points.push({ trueAlpha: s.alpha, trueBeta: s.beta, fitAlpha: fit.params.alpha, fitBeta: fit.params.beta, seed: runSeed });
    }
  });
  const bySetting = settings.map((s) => {
    const mine = points.filter((p) => p.trueAlpha === s.alpha && p.trueBeta === s.beta);
    return {
      trueAlpha: s.alpha,
      trueBeta: s.beta,
      alphaBias: mine.reduce((a, p) => a + (p.fitAlpha - p.trueAlpha), 0) / Math.max(1, mine.length),
      betaBias: mine.reduce((a, p) => a + (p.fitBeta - p.trueBeta), 0) / Math.max(1, mine.length),
    };
  });
  return {
    points,
    alphaCorrelation: pearson(
      points.map((p) => p.trueAlpha),
      points.map((p) => p.fitAlpha),
    ),
    betaCorrelation: pearson(
      points.map((p) => p.trueBeta),
      points.map((p) => p.fitBeta),
    ),
    alphaMeanAbsError: points.reduce((a, p) => a + Math.abs(p.fitAlpha - p.trueAlpha), 0) / Math.max(1, points.length),
    betaMeanAbsError: points.reduce((a, p) => a + Math.abs(p.fitBeta - p.trueBeta), 0) / Math.max(1, points.length),
    bySetting,
  };
}

/** Parameters drawn for model recovery; ranges are stated so the learner can question them. */
export const SAMPLING_RANGES = {
  bias: { b: [0.2, 0.8] },
  wsls: { eps: [0.05, 0.4] },
  rw: { alpha: [0.1, 0.9], beta: [1, 10] },
} as const;

export interface SamplingRanges {
  bias: { b: readonly [number, number] };
  wsls: { eps: readonly [number, number] };
  rw: { alpha: readonly [number, number]; beta: readonly [number, number] };
}

function drawParams(model: ModelId, rng: Rng, ranges: SamplingRanges = SAMPLING_RANGES): ModelParams {
  const u = (lo: number, hi: number) => lo + (hi - lo) * rng.next();
  if (model === "bias") return { model, b: u(...ranges.bias.b) };
  if (model === "wsls") return { model, eps: u(...ranges.wsls.eps) };
  return { model, alpha: u(...ranges.rw.alpha), beta: u(...ranges.rw.beta) };
}

export interface ConfusionMatrix {
  /** counts[generating][fitted]: how often data from one model were best fitted (lowest BIC) by each. */
  counts: Record<ModelId, Record<ModelId, number>>;
  datasetsPerModel: number;
  /** P(fitted | generating), row-normalised. */
  probabilities: Record<ModelId, Record<ModelId, number>>;
  /** True when every generating model is recovered as itself more often than as anything else. */
  diagonalDominant: boolean;
}

export function modelRecovery(
  design: TaskDesign,
  datasetsPerModel: number,
  seed: number,
  ranges: SamplingRanges = SAMPLING_RANGES,
): ConfusionMatrix {
  validateDesign(design);
  if (datasetsPerModel > LIMITS.maxDatasetsPerModel)
    throw new ComputeLimitError(`At most ${LIMITS.maxDatasetsPerModel} datasets per model run in the browser.`);
  const counts = Object.fromEntries(
    MODEL_IDS.map((g) => [g, Object.fromEntries(MODEL_IDS.map((f) => [f, 0]))]),
  ) as ConfusionMatrix["counts"];
  MODEL_IDS.forEach((generating, gi) => {
    const rng = mulberry32(seed + 7919 * (gi + 1));
    for (let i = 0; i < datasetsPerModel; i++) {
      const session = simulate(drawParams(generating, rng, ranges), design, seed + 104_729 * (gi + 1) + i);
      const fits = MODEL_IDS.map((m) => fitModel(m, [session]));
      const winner = fits.reduce((a, b) => (b.bic < a.bic ? b : a));
      counts[generating][winner.model]++;
    }
  });
  const probabilities = Object.fromEntries(
    MODEL_IDS.map((g) => [g, Object.fromEntries(MODEL_IDS.map((f) => [f, counts[g][f] / datasetsPerModel]))]),
  ) as ConfusionMatrix["probabilities"];
  const diagonalDominant = MODEL_IDS.every((g) => MODEL_IDS.every((f) => f === g || counts[g][g] > counts[g][f]));
  return { counts, datasetsPerModel, probabilities, diagonalDominant };
}

export type SplitKind = "later_trials" | "unseen_people" | "random_trials";

export const SPLIT_CONTRACT: Record<SplitKind, InformationContract> = {
  later_trials: {
    observed: "Each synthetic participant's choices and rewards on a two-armed bandit.",
    target: "The next choice on each held-out trial.",
    historyInTraining: "The first 70% of each participant's trials; parameters are fitted on those only.",
    historyAtInference: "Every earlier choice and outcome of the same participant, as in the task itself.",
    person: "familiar",
    task: "familiar",
    laterPeriods: true,
    unavailableInRealUse: "Nothing beyond the participant's own past trials is used.",
    baseline: "Biased random responding fitted on the same training trials.",
    untestedClaims:
      "Prediction for a person never observed, for another task, or for real people at all: the data are synthetic and generated by one of the candidate models.",
  },
  unseen_people: {
    observed: "Choices and rewards of several synthetic participants generated with individual parameters.",
    target: "Every choice of a participant left out of the fit.",
    historyInTraining: "All trials of the other participants; one shared parameter set per model.",
    historyAtInference: "The held-out participant's own earlier trials, but none of their data in the fit.",
    person: "unseen",
    task: "familiar",
    laterPeriods: false,
    unavailableInRealUse:
      "None: the fit uses other participants' data and the prediction uses the held-out participant's own earlier trials, both available in real use.",
    baseline: "Biased random responding fitted on the other participants.",
    untestedClaims:
      "Another task, later sessions of the same people, and any population other than the simulated one; real new people would not come from the population that generated the training participants.",
  },
  random_trials: {
    observed: "Each synthetic participant's choices and rewards.",
    target: "Choices on a random 30% of trials.",
    historyInTraining: "A random 70% of trials, including trials that come after held-out ones.",
    historyAtInference: "All earlier trials, and the fit has already seen later ones.",
    person: "familiar",
    task: "familiar",
    laterPeriods: false,
    unavailableInRealUse: "Later trials are used to fit the parameters that predict earlier ones; no real forecast has that information.",
    baseline: "Biased random responding fitted on the same trials.",
    untestedClaims:
      "Any claim about predicting future behaviour or new people. This split is shown to make the leak visible, not as evidence of generalisation.",
  },
};

export interface HeldOutResult {
  split: SplitKind;
  contract: InformationContract;
  /** Mean held-out log-likelihood per trial for each model (higher is better; ln 0.5 is chance). */
  meanLogLik: Record<ModelId, number>;
  heldOutTrials: number;
  /** Indices used for fitting and for testing, per participant, so tests can check the split. */
  folds: { participant: number; trainParticipants: number[]; trainTrials: number[]; testTrials: number[] }[];
}

/**
 * Synthetic participants from one generating model with individually drawn parameters. Pass the
 * case's ranges so that a held-out comparison uses the same kind of participant as that case's
 * recovery checks; the default is the broad region of the informative case.
 */
export function simulateGroup(
  generating: ModelId,
  participants: number,
  design: TaskDesign,
  seed: number,
  ranges: SamplingRanges = SAMPLING_RANGES,
): { params: ModelParams[]; sessions: Session[] } {
  validateDesign(design);
  if (participants < 2) throw new ChoiceLabError("A group needs at least two participants.");
  if (participants > LIMITS.maxParticipants)
    throw new ComputeLimitError(`At most ${LIMITS.maxParticipants} participants run in the browser.`);
  const rng = mulberry32(seed);
  const params = Array.from({ length: participants }, () => drawParams(generating, rng, ranges));
  return { params, sessions: params.map((p, i) => simulate(p, design, seed + 31 * (i + 1))) };
}

export function heldOutComparison(sessions: readonly Session[], split: SplitKind, seed = 1): HeldOutResult {
  if (sessions.length === 0) throw new ChoiceLabError("No sessions to evaluate.");
  const meanLogLik = Object.fromEntries(MODEL_IDS.map((m) => [m, 0])) as Record<ModelId, number>;
  const folds: HeldOutResult["folds"] = [];
  let heldOut = 0;
  if (split === "unseen_people") {
    if (sessions.length < 2) throw new ChoiceLabError("Leaving people out needs at least two participants.");
    for (let held = 0; held < sessions.length; held++) {
      const training = sessions.filter((_, i) => i !== held);
      const test = sessions[held]!;
      folds.push({
        participant: held,
        trainParticipants: sessions.map((_, i) => i).filter((i) => i !== held),
        trainTrials: [],
        testTrials: test.choices.map((_, t) => t),
      });
      for (const m of MODEL_IDS) meanLogLik[m] -= negLogLikelihood(fitModel(m, training).params, test);
      heldOut += test.choices.length;
    }
  } else {
    const rng = mulberry32(seed);
    sessions.forEach((s, si) => {
      const n = s.choices.length;
      const cut = Math.floor(n * 0.7);
      const isTest =
        split === "later_trials"
          ? (t: number) => t >= cut
          : (() => {
              const flags = s.choices.map(() => rng.next() < 0.3);
              return (t: number) => flags[t]!;
            })();
      const trainTrials = s.choices.map((_, t) => t).filter((t) => !isTest(t));
      const testTrials = s.choices.map((_, t) => t).filter((t) => isTest(t));
      folds.push({ participant: si, trainParticipants: [si], trainTrials, testTrials });
      for (const m of MODEL_IDS) {
        const fit = fitModel(m, [s], (_, t) => !isTest(t));
        meanLogLik[m] -= negLogLikelihood(fit.params, s, isTest);
      }
      heldOut += testTrials.length;
    });
  }
  for (const m of MODEL_IDS) meanLogLik[m] /= Math.max(1, heldOut);
  return { split, contract: SPLIT_CONTRACT[split], meanLogLik, heldOutTrials: heldOut, folds };
}

/**
 * The two cases the laboratory offers. They differ in the task design and in the parameter
 * region the synthetic participants come from, and it is the region more than the design that
 * decides whether the models can be told apart: when choices barely depend on learned values
 * (small beta) and the heuristic is very noisy, every model predicts nearly random choice. Model
 * recovery over seeds 1 to 5 (20 datasets per model) recovered Rescorla-Wagner as itself 19 of
 * 100 times as built, 13 with arms 0.2 and 0.8, 42 with 300 trials, and 79 with participants
 * from the informative region. The honest report of the ambiguous case says the evidence is
 * inconclusive and proposes a more informative study. The case notes describe the design and the
 * region only, because the learner predicts the outcome before running anything.
 */
export interface LabCase {
  label: string;
  design: TaskDesign;
  ranges: SamplingRanges;
  recoverySettings: readonly RwParams[];
  /** The generating parameters the laboratory starts from for this case, inside its region. */
  participant: { rw: RwParams; wsls: { eps: number }; bias: { b: number } };
  note: string;
}

export const LAB_CASES: Record<"informative" | "ambiguous", LabCase> = {
  informative: {
    label: "Informative case",
    design: { trials: 300, rewardProbabilities: [0.2, 0.8] },
    ranges: SAMPLING_RANGES,
    recoverySettings: [
      { alpha: 0.1, beta: 1 },
      { alpha: 0.1, beta: 5 },
      { alpha: 0.3, beta: 1 },
      { alpha: 0.3, beta: 5 },
      { alpha: 0.6, beta: 3 },
      { alpha: 0.6, beta: 8 },
      { alpha: 0.9, beta: 3 },
      { alpha: 0.9, beta: 8 },
    ],
    participant: { rw: { alpha: 0.3, beta: 5 }, wsls: { eps: 0.2 }, bias: { b: 0.6 } },
    note: "Many trials, a large difference between the arms, and participants whose choices depend strongly on what they learn.",
  },
  ambiguous: {
    label: "Ambiguous case",
    design: { trials: 60, rewardProbabilities: [0.4, 0.6] },
    ranges: { bias: { b: [0.4, 0.6] }, wsls: { eps: [0.6, 0.95] }, rw: { alpha: [0.1, 0.9], beta: [0.2, 1.5] } },
    recoverySettings: [
      { alpha: 0.2, beta: 0.5 },
      { alpha: 0.5, beta: 0.5 },
      { alpha: 0.8, beta: 0.5 },
      { alpha: 0.2, beta: 1.2 },
      { alpha: 0.5, beta: 1.2 },
      { alpha: 0.8, beta: 1.2 },
    ],
    participant: { rw: { alpha: 0.5, beta: 0.8 }, wsls: { eps: 0.8 }, bias: { b: 0.55 } },
    note: "A short session and nearly equal arms, with participants from a region where choices depend only weakly on learned values (beta at most 1.5) and win-stay lose-shift is followed only loosely (eps from 0.6 to 0.95).",
  },
};

export interface BehaviourSummary {
  /** Proportion of trials after the first that repeat the previous choice, split by the previous reward. */
  repeatAfterReward: number | null;
  repeatAfterNoReward: number | null;
  /** The same with the previous choice held fixed: element 0 is arm 0, element 1 is arm 1. */
  repeatAfterRewardByArm: [number | null, number | null];
  repeatAfterNoRewardByArm: [number | null, number | null];
  /** Proportion of choices of the better arm in the first and in the last ten trials of each session. */
  betterArmFirst10: number;
  betterArmLast10: number;
  sessions: number;
}

/**
 * Model-independent measures of behaviour, computed from choices and rewards alone and pooled
 * over the sessions given. Split by the previous reward alone, the repeat probabilities differ
 * even for a learner who ignores rewards, because rewards come mostly from the better arm; holding
 * the previous choice fixed removes that, which is why both splits are reported.
 */
export function summariseBehaviour(sessions: readonly Session[], design: TaskDesign): BehaviourSummary {
  const better = design.rewardProbabilities[1] >= design.rewardProbabilities[0] ? 1 : 0;
  const tally = () => ({ repeats: 0, trials: 0 });
  const pooled = { reward: tally(), none: tally() };
  const byArm = { reward: [tally(), tally()], none: [tally(), tally()] };
  const first = tally();
  const last = tally();
  for (const s of sessions) {
    const n = s.choices.length;
    for (let t = 0; t < n; t++) {
      const chose = s.choices[t]!;
      if (t < 10) {
        first.trials++;
        if (chose === better) first.repeats++;
      }
      if (t >= n - 10) {
        last.trials++;
        if (chose === better) last.repeats++;
      }
      if (t === 0) continue;
      const previous = s.choices[t - 1]!;
      const which = s.rewards[t - 1] ? "reward" : "none";
      const repeated = chose === previous ? 1 : 0;
      pooled[which].repeats += repeated;
      pooled[which].trials++;
      byArm[which][previous]!.repeats += repeated;
      byArm[which][previous]!.trials++;
    }
  }
  const rate = (x: { repeats: number; trials: number }) => (x.trials ? x.repeats / x.trials : null);
  return {
    repeatAfterReward: rate(pooled.reward),
    repeatAfterNoReward: rate(pooled.none),
    repeatAfterRewardByArm: [rate(byArm.reward[0]!), rate(byArm.reward[1]!)],
    repeatAfterNoRewardByArm: [rate(byArm.none[0]!), rate(byArm.none[1]!)],
    betterArmFirst10: rate(first) ?? 0,
    betterArmLast10: rate(last) ?? 0,
    sessions: sessions.length,
  };
}

/**
 * Validation by simulation: synthetic sessions generated by a fitted model with its fitted
 * parameters, each with its own seed, to compare with the measures of the data it was fitted to.
 */
export function simulateFromFit(fit: Fit, design: TaskDesign, sessions: number, seed: number): Session[] {
  validateDesign(design);
  if (!Number.isInteger(sessions) || sessions < 1) throw new ChoiceLabError("Simulate at least one session.");
  if (sessions > LIMITS.maxParticipants) throw new ComputeLimitError(`At most ${LIMITS.maxParticipants} sessions run in the browser.`);
  return Array.from({ length: sessions }, (_, i) => simulate(fit.params, design, seed + 7919 * (i + 1)));
}

/** The design part of each case, kept for callers that only need the task. */
export const DESIGN_PRESETS = {
  informative: { label: LAB_CASES.informative.label, design: LAB_CASES.informative.design, note: LAB_CASES.informative.note },
  ambiguous: { label: LAB_CASES.ambiguous.label, design: LAB_CASES.ambiguous.design, note: LAB_CASES.ambiguous.note },
};

export const RECOVERY_SETTINGS: readonly RwParams[] = LAB_CASES.informative.recoverySettings;
