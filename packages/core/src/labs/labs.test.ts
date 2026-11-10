import { describe, expect, it } from "vitest";
import {
  analytic,
  auditSeries,
  christoffel,
  coefficientTable,
  compareModels,
  comparePipelines,
  contractionFactor,
  converges,
  equilibrium,
  eulerStableStep,
  extendedHypotheses,
  fitBaseline,
  gaussianCurvature,
  generalisation,
  generateBimodalTrials,
  generateDataset,
  generateTrials,
  gradientDescentPath,
  graphChartMetric,
  integrate,
  isCoordinateSingular,
  l1NormXn,
  l2NormXn,
  lessonHypotheses,
  mulberry32,
  normsEquivalentWitness,
  normTable,
  ORIENTATIONS,
  optimalStep,
  parallelLengthFromEmbedding,
  parallelLengthFromMetric,
  pNorm,
  posterior,
  selectionOptimism,
  simulateEuler,
  simulateRk4,
  sphereMetric,
  splitByOrientation,
  splitTrials,
  stepsToShrink,
  summarise,
  supNormXn,
  TUNING_SPLIT_CONTRACT,
  trivialBaselineAccuracy,
  withExtraHypothesis,
} from "./index";

const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe("norm comparison: f_n(x) = x^n on [0,1]", () => {
  it("has sup norm 1, L¹ norm 1/(n+1) and L² norm 1/√(2n+1), confirmed by quadrature", () => {
    for (const n of [1, 2, 5, 10, 50]) {
      expect(supNormXn(n)).toBe(1);
      close(l1NormXn(n), 1 / (n + 1));
      close(l2NormXn(n), 1 / Math.sqrt(2 * n + 1));
      close(
        pNorm((x) => x ** n, 1, 4000),
        l1NormXn(n),
        1e-7,
      );
      close(
        pNorm((x) => x ** n, 2, 4000),
        l2NormXn(n),
        1e-7,
      );
      close(
        pNorm((x) => x ** n, Number.POSITIVE_INFINITY),
        1,
        1e-12,
      );
    }
    close(
      integrate((x) => x * x, 0, 1, 10),
      1 / 3,
      1e-12,
    );
  });
  it("shows the norms are not equivalent: the ratio sup/L¹ equals n+1 and is unbounded", () => {
    const rows = normTable(20);
    expect(rows.map((r) => r.ratioSupL1)).toEqual(rows.map((r) => r.n + 1));
    expect(normsEquivalentWitness(40)).toEqual({ l1TendsToZero: true, supConstant: true, ratioUnbounded: true });
  });
});

describe("sphere metric in spherical coordinates", () => {
  it("has g = R² dθ² + R² sin²θ dφ² with determinant R⁴ sin²θ, zero only at the poles", () => {
    const g = sphereMetric(2, Math.PI / 3);
    close(g.gThetaTheta, 4);
    close(g.gPhiPhi, 4 * 0.75);
    expect(g.gThetaPhi).toBe(0);
    close(g.det, 16 * 0.75);
    expect(isCoordinateSingular(0)).toBe(true);
    expect(isCoordinateSingular(Math.PI)).toBe(true);
    expect(isCoordinateSingular(Math.PI / 2)).toBe(false);
    expect(
      coefficientTable(1, 6)
        .filter((r) => r.singular)
        .map((r) => r.thetaDegrees),
    ).toEqual([0, 180]);
  });
  it("has Christoffel symbols Γ^θ_φφ = −sinθcosθ and Γ^φ_θφ = cotθ, independent of R, and curvature 1/R²", () => {
    const theta = 0.7;
    close(christoffel(theta).thetaPhiPhi, -Math.sin(theta) * Math.cos(theta));
    close(christoffel(theta).phiThetaPhi!, Math.cos(theta) / Math.sin(theta));
    expect(christoffel(0).phiThetaPhi).toBeNull();
    close(gaussianCurvature(3), 1 / 9);
  });
  it("is the induced metric: the length of a parallel agrees with the embedding, and the graph chart is the identity at the pole", () => {
    close(parallelLengthFromMetric(1.5, 1.1), parallelLengthFromEmbedding(1.5, 1.1), 1e-5);
    const atPole = graphChartMetric(2, 0, 0);
    expect(atPole).toEqual({ gxx: 1, gxy: 0, gyy: 1, det: 1 });
    expect(graphChartMetric(2, 0.5, 0.3).det).toBeGreaterThan(1);
  });
});

describe("reversible first-order kinetics A ⇌ B", () => {
  const p = { kf: 0.3, kr: 0.1, c0: 1 };
  it("matches the worked values: [A]eq 0.25, [B]eq 0.75, K = 3, τ = 2.5 min, half-life 1.733 min", () => {
    const eq = equilibrium(p);
    close(eq.aEq, 0.25);
    close(eq.bEq, 0.75);
    close(eq.K!, 3);
    close(eq.tau, 2.5);
    close(eq.halfLife, 2.5 * Math.LN2, 1e-9);
    close(analytic(p, 5).a, 0.25 + 0.75 * Math.exp(-2));
    close(analytic(p, 5).a + analytic(p, 5).b, 1);
  });
  it("conserves mass, keeps concentrations non-negative, and RK4 agrees with the formula", () => {
    const rk4 = simulateRk4(p, 0.1, 200);
    expect(auditSeries(rk4, 1)).toEqual({ conserved: true, nonNegative: true });
    close(rk4[50]!.a, analytic(p, 5).a, 1e-7);
  });
  it("flags the explicit Euler step that produces negative concentrations", () => {
    expect(eulerStableStep(p)).toBe(5);
    const stable = simulateEuler(p, 1, 20);
    expect(stable.negativeAt).toBeNull();
    const unstable = simulateEuler(p, 6, 10);
    expect(unstable.negativeAt).not.toBeNull();
    expect(auditSeries(unstable.series, 1).nonNegative).toBe(false);
  });
  it("doubling both rate constants changes τ but not the equilibrium composition", () => {
    const doubled = equilibrium({ kf: 0.6, kr: 0.2, c0: 1 });
    close(doubled.aEq, 0.25);
    close(doubled.tau, 1.25);
    expect(() => equilibrium({ kf: -1, kr: 0.1, c0: 1 })).toThrow(RangeError);
  });
});

describe("gradient descent on ½ wᵀ diag(1,10) w", () => {
  const lambdas = [1, 10];
  it("converges for every start iff 0 < η < 0.2", () => {
    expect(converges(0.19, lambdas)).toBe(true);
    expect(converges(0.2, lambdas)).toBe(false);
    expect(converges(0.25, lambdas)).toBe(false);
    const path = gradientDescentPath([1, 1], 0.25, lambdas, 20);
    expect(Math.abs(path[20]!.w[1]!)).toBeGreaterThan(1);
  });
  it("has ρ(0.1) = 0.9, ρ(0.18) = 0.82, optimum η* = 2/11 with ρ* = 9/11", () => {
    close(contractionFactor(0.1, lambdas), 0.9);
    close(contractionFactor(0.18, lambdas), 0.82);
    const best = optimalStep(lambdas);
    close(best.eta, 2 / 11);
    close(best.rho, 9 / 11);
    expect(best.conditionNumber).toBe(10);
    expect(stepsToShrink(0.1, lambdas, 1e-3)).toBe(Math.ceil(Math.log(1e3) / Math.log(1 / 0.9)));
    expect(stepsToShrink(0.2, lambdas, 1e-3)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("Bayesian concept learning (number game)", () => {
  it("reproduces the lesson's posterior for X = {60}: 0.0948, 0.4741, 0, 0.4310", () => {
    const rows = posterior(lessonHypotheses(), [60]);
    const by = Object.fromEntries(rows.map((r) => [r.hypothesis.id, r.posterior]));
    close(by.even!, 0.0948, 5e-4);
    close(by.mult10!, 0.4741, 5e-4);
    expect(by.pow2).toBe(0);
    close(by["50to60"]!, 0.431, 5e-4);
    close(generalisation(lessonHypotheses(), [60], 70), by.even! + by.mult10!, 1e-12);
    close(generalisation(lessonHypotheses(), [60], 55), by["50to60"]!, 1e-12);
  });
  it("becomes rule-like after four examples: P(multiples of 10 | {60,80,10,30}) ≈ 0.9984", () => {
    const rows = posterior(lessonHypotheses(), [60, 80, 10, 30]);
    const mult10 = rows.find((r) => r.hypothesis.id === "mult10")!.posterior;
    close(mult10, 0.9984, 5e-4);
    expect(rows.find((r) => r.hypothesis.id === "50to60")!.posterior).toBe(0);
  });
  it("weakening the size principle flattens the posterior, and an unnatural hypothesis can only win with prior mass", () => {
    const weak = posterior(lessonHypotheses(), [60, 80, 10, 30], { sizeExponent: 0.25 });
    expect(weak.find((r) => r.hypothesis.id === "even")!.posterior).toBeGreaterThan(0.1);
    const odd = withExtraHypothesis(lessonHypotheses(), {
      id: "odd-set",
      label: "60, 80, 10, 30 and 7",
      members: [60, 80, 10, 30, 7],
      priorMass: 0.001,
    });
    const rows = posterior(odd, [60, 80, 10, 30]);
    expect(rows.find((r) => r.hypothesis.id === "odd-set")!.posterior).toBeLessThan(0.5);
    expect(generalisation(odd, [60, 80, 10, 30], 7)).toBeGreaterThan(0);
    expect(extendedHypotheses().length).toBeGreaterThan(20);
    expect(Math.abs(extendedHypotheses().reduce((s, h) => s + h.prior, 0) - 1)).toBeLessThan(1e-9);
  });
});

describe("synthetic neural tuning fit", () => {
  const truth = { b: 2, A: 10, kappa: 2, thetaPref: 65 };
  it("is deterministic by seed and recovers the preferred orientation and sharpness from enough trials", () => {
    const a = generateTrials(truth, 30, 1, 42);
    const b = generateTrials(truth, 30, 1, 42);
    expect(a).toEqual(b);
    const { train, test } = splitTrials(a);
    const result = compareModels(train, test, 1);
    const diff = Math.abs(((result.tuning.thetaPref - truth.thetaPref + 90) % 180) - 90);
    expect(diff).toBeLessThan(12);
    expect(result.tuning.kappa).toBeGreaterThan(0.8);
    expect(result.heldOutAdvantagePerTrial).toBeGreaterThan(0);
    close(fitBaseline(train, 1).b, train.reduce((s, t) => s + t.count, 0) / train.length);
  });
  it("holds out new trials of every orientation, never whole orientations", () => {
    const { train, test } = splitTrials(generateTrials(truth, 30, 1, 42));
    for (const theta of ORIENTATIONS) {
      expect(train.filter((t) => t.thetaDegrees === theta).length).toBeGreaterThan(0);
      expect(test.filter((t) => t.thetaDegrees === theta).length).toBe(7);
    }
    expect(train.length + test.length).toBe(30 * ORIENTATIONS.length);
  });
  it("can instead hold out one whole orientation, which then never appears in training", () => {
    const { train, test } = splitByOrientation(generateTrials(truth, 30, 1, 42), 90);
    expect(test).toHaveLength(30);
    expect(test.every((t) => t.thetaDegrees === 90)).toBe(true);
    expect(train.some((t) => t.thetaDegrees === 90)).toBe(false);
    expect(train).toHaveLength(30 * (ORIENTATIONS.length - 1));
  });
  it("labels the two splits as different questions: new trials of a familiar stimulus, or an unseen stimulus", () => {
    expect(TUNING_SPLIT_CONTRACT.held_out_trials.task).toBe("familiar");
    expect(TUNING_SPLIT_CONTRACT.held_out_orientation.task).toBe("unseen");
    expect(TUNING_SPLIT_CONTRACT.held_out_trials.untestedClaims).toMatch(/orientation absent from training/);
    expect(TUNING_SPLIT_CONTRACT.held_out_orientation.untestedClaims).toMatch(/new trials of the sampled orientations/);
  });
  it("does not favour the tuning model out of sample when the neuron is untuned", () => {
    const flat = generateTrials({ b: 6, A: 0, kappa: 1, thetaPref: 0 }, 30, 1, 7);
    const { train, test } = splitTrials(flat);
    const result = compareModels(train, test, 1);
    expect(result.heldOutAdvantagePerTrial).toBeLessThan(0.05);
  });
  it("the bimodal failure dataset defeats a unimodal fit less clearly than the true tuned case", () => {
    const bimodal = generateBimodalTrials(30, 1, 3);
    const { train, test } = splitTrials(bimodal);
    const result = compareModels(train, test, 1);
    const tuned = compareModels(...(Object.values(splitTrials(generateTrials(truth, 30, 1, 42))) as [typeof train, typeof test]), 1);
    expect(result.heldOutAdvantagePerTrial).toBeLessThan(tuned.heldOutAdvantagePerTrial);
    expect(mulberry32(1).poisson(0)).toBe(0);
  });
});

describe("data leakage audit", () => {
  const records = generateDataset(2026);
  it("builds 5,000 machine-weeks with a base rate near 6% and a trivial baseline near 94%", () => {
    const s = summarise(records);
    expect(s.rows).toBe(5000);
    expect(s.machines).toBe(250);
    expect(s.weeks).toBe(20);
    expect(s.baseRate).toBeGreaterThan(0.045);
    expect(s.baseRate).toBeLessThan(0.075);
    close(trivialBaselineAccuracy(records), 1 - s.baseRate);
    expect(generateDataset(2026)).toEqual(records);
  });
  it("the leaky pipeline beats the honest one, which barely beats the baseline", () => {
    const reports = Object.fromEntries(comparePipelines(records).map((r) => [r.name, r.accuracy]));
    expect(reports.leaky!).toBeGreaterThan(0.96);
    expect(reports.leaky!).toBeGreaterThan(reports.honest!);
    expect(reports.honest!).toBeGreaterThanOrEqual(reports.baseline! - 0.02);
    expect(reports.honest!).toBeLessThan(reports.leaky! - 0.01);
  });
  it("selecting the best of many test evaluations is optimistic", () => {
    const { median, best } = selectionOptimism(records);
    expect(best).toBeGreaterThanOrEqual(median);
  });
});

describe("the held-out trials split", () => {
  it("holds out every fourth repetition, so fewer than four trials per orientation leave nothing to test on", () => {
    const trials = (perOrientation: number) =>
      [0, 45, 90].flatMap((thetaDegrees) => Array.from({ length: perOrientation }, () => ({ thetaDegrees, count: 1 })));
    expect(splitTrials(trials(3)).test).toHaveLength(0);
    expect(splitTrials(trials(4)).test).toHaveLength(3);
  });
});
