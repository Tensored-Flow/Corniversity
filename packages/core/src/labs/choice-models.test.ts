import { describe, expect, it } from "vitest";
import {
  alphaProfile,
  ChoiceLabError,
  ComputeLimitError,
  DESIGN_PRESETS,
  fitModel,
  heldOutComparison,
  LAB_CASES,
  modelRecovery,
  negLogLikelihood,
  parameterRecovery,
  RECOVERY_SETTINGS,
  simulate,
  simulateFromFit,
  simulateGroup,
  summariseBehaviour,
} from "./choice-models";

const informative = DESIGN_PRESETS.informative.design;

describe("simulator", () => {
  it("is deterministic in its seed", () => {
    const a = simulate({ model: "rw", alpha: 0.3, beta: 5 }, informative, 42);
    const b = simulate({ model: "rw", alpha: 0.3, beta: 5 }, informative, 42);
    expect(a).toEqual(b);
    expect(simulate({ model: "rw", alpha: 0.3, beta: 5 }, informative, 43)).not.toEqual(a);
  });

  it("matches each model's description: WSLS without noise always stays after a win and shifts after a loss", () => {
    const s = simulate({ model: "wsls", eps: 0 }, informative, 7);
    for (let t = 1; t < s.choices.length; t++) {
      const expected = s.rewards[t - 1] === 1 ? s.choices[t - 1] : 1 - s.choices[t - 1]!;
      expect(s.choices[t]).toBe(expected);
    }
  });

  it("an RW learner with beta = 0 ignores values, and a learning one comes to prefer the better arm", () => {
    const flat = simulate({ model: "rw", alpha: 0.5, beta: 0 }, { trials: 1000, rewardProbabilities: [0.2, 0.8] }, 3);
    const share = flat.choices.reduce((a, c) => a + c, 0) / flat.choices.length;
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.55);
    const learner = simulate({ model: "rw", alpha: 0.3, beta: 8 }, { trials: 1000, rewardProbabilities: [0.2, 0.8] }, 3);
    const late = learner.choices.slice(500);
    expect(late.reduce((a, c) => a + c, 0) / late.length).toBeGreaterThan(0.8);
  });

  it("rewards follow the arm's probability", () => {
    const s = simulate({ model: "bias", b: 1 }, { trials: 1000, rewardProbabilities: [0.2, 0.8] }, 11);
    const rate = s.rewards.reduce((a, r) => a + r, 0) / s.rewards.length;
    expect(rate).toBeGreaterThan(0.75);
    expect(rate).toBeLessThan(0.85);
  });
});

describe("likelihood and fitting", () => {
  it("biased responding at b = 0.5 has negative log-likelihood T ln 2", () => {
    const s = simulate({ model: "rw", alpha: 0.4, beta: 3 }, informative, 5);
    expect(negLogLikelihood({ model: "bias", b: 0.5 }, s)).toBeCloseTo(s.choices.length * Math.log(2), 9);
  });

  it("recovers RW parameters from a long session and stays inside the bounds", () => {
    const s = simulate({ model: "rw", alpha: 0.3, beta: 6 }, { trials: 1000, rewardProbabilities: [0.2, 0.8] }, 21);
    const fit = fitModel("rw", [s]);
    if (fit.params.model !== "rw") throw new Error("wrong model");
    expect(Math.abs(fit.params.alpha - 0.3)).toBeLessThan(0.12);
    expect(Math.abs(fit.params.beta - 6)).toBeLessThan(2);
    expect(fit.params.alpha).toBeGreaterThanOrEqual(0);
    expect(fit.params.alpha).toBeLessThanOrEqual(1);
    expect(fit.params.beta).toBeLessThanOrEqual(20);
    // Deterministic: the same data give the same estimate.
    expect(fitModel("rw", [s])).toEqual(fit);
  });

  it("the WSLS fit is the closed-form maximum: no grid value of eps does better", () => {
    const s = simulate({ model: "wsls", eps: 0.2 }, informative, 9);
    const fit = fitModel("wsls", [s]);
    for (let eps = 0.02; eps <= 1; eps += 0.02) expect(negLogLikelihood({ model: "wsls", eps }, s)).toBeGreaterThanOrEqual(fit.nll - 1e-9);
  });

  it("alpha is not identified when beta is near zero: the profile is flat", () => {
    const s = simulate({ model: "rw", alpha: 0.5, beta: 0.2 }, informative, 13);
    const profile = alphaProfile(s, 0.2);
    const values = profile.map((p) => p.nll);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThan(2);
  });
});

describe("recovery", () => {
  it("parameter recovery is good in the informative design and reported per setting", () => {
    const r = parameterRecovery(informative, RECOVERY_SETTINGS, 2, 100);
    expect(r.points).toHaveLength(RECOVERY_SETTINGS.length * 2);
    expect(r.alphaCorrelation).toBeGreaterThan(0.6);
    expect(r.betaCorrelation).toBeGreaterThan(0.6);
    expect(r.bySetting).toHaveLength(RECOVERY_SETTINGS.length);
  });

  it("model recovery tells the models apart in the informative case", () => {
    const good = modelRecovery(LAB_CASES.informative.design, 12, 200, LAB_CASES.informative.ranges);
    expect(good.diagonalDominant).toBe(true);
    expect(good.probabilities.rw.rw).toBeGreaterThan(0.8);
  });

  it("in the ambiguous case the learning model is usually not recovered, which is the result to explain", () => {
    const poor = modelRecovery(LAB_CASES.ambiguous.design, 30, 200, LAB_CASES.ambiguous.ranges);
    expect(poor.diagonalDominant).toBe(false);
    expect(poor.probabilities.rw.rw).toBeLessThan(0.4);
    const r = parameterRecovery(LAB_CASES.ambiguous.design, LAB_CASES.ambiguous.recoverySettings, 3, 100);
    expect(r.alphaCorrelation).toBeLessThan(0.5);
  });
});

describe("model-independent measures and validation by simulation", () => {
  it("a noiseless win-stay lose-shift player repeats after every reward and never after no reward", () => {
    const m = summariseBehaviour([simulate({ model: "wsls", eps: 0 }, informative, 5)], informative);
    expect(m.repeatAfterReward).toBe(1);
    expect(m.repeatAfterNoReward).toBe(0);
  });

  it("for biased responding the previous reward matters only through the previous choice", () => {
    const design = { trials: 1000, rewardProbabilities: [0.2, 0.8] as [number, number] };
    const m = summariseBehaviour(
      [1, 2, 3, 4].map((seed) => simulate({ model: "bias", b: 0.8 }, design, seed)),
      design,
    );
    // Split by the reward alone the repeat probabilities differ, because rewards come mostly from arm 1;
    expect(m.repeatAfterReward! - m.repeatAfterNoReward!).toBeGreaterThan(0.15);
    // with the previous choice held fixed the reward makes no difference.
    expect(Math.abs(m.repeatAfterRewardByArm[1]! - m.repeatAfterNoRewardByArm[1]!)).toBeLessThan(0.04);
  });

  it("simulations from a fitted model reproduce the measures of the session it was fitted to", () => {
    const session = simulate({ model: "rw", alpha: 0.3, beta: 5 }, informative, 42);
    const fit = fitModel("rw", [session]);
    const own = summariseBehaviour([session], informative);
    const simulated = summariseBehaviour(simulateFromFit(fit, informative, 20, 43), informative);
    expect(Math.abs(simulated.repeatAfterReward! - own.repeatAfterReward!)).toBeLessThan(0.1);
    expect(Math.abs(simulated.repeatAfterNoReward! - own.repeatAfterNoReward!)).toBeLessThan(0.1);
    expect(simulateFromFit(fit, informative, 3, 9)).toEqual(simulateFromFit(fit, informative, 3, 9));
    expect(() => simulateFromFit(fit, informative, 100, 9)).toThrow(ComputeLimitError);
  });

  it("each case starts from a participant inside its own region", () => {
    for (const lab of Object.values(LAB_CASES)) {
      const { rw, wsls, bias } = lab.participant;
      expect(rw.alpha).toBeGreaterThanOrEqual(lab.ranges.rw.alpha[0]);
      expect(rw.alpha).toBeLessThanOrEqual(lab.ranges.rw.alpha[1]);
      expect(rw.beta).toBeGreaterThanOrEqual(lab.ranges.rw.beta[0]);
      expect(rw.beta).toBeLessThanOrEqual(lab.ranges.rw.beta[1]);
      expect(wsls.eps).toBeGreaterThanOrEqual(lab.ranges.wsls.eps[0]);
      expect(wsls.eps).toBeLessThanOrEqual(lab.ranges.wsls.eps[1]);
      expect(bias.b).toBeGreaterThanOrEqual(lab.ranges.bias.b[0]);
      expect(bias.b).toBeLessThanOrEqual(lab.ranges.bias.b[1]);
    }
  });
});

describe("a case's participants come from that case's region", () => {
  it("the held-out group of the ambiguous case is drawn from its low-beta ranges, not the broad default", () => {
    const { ranges, design } = LAB_CASES.ambiguous;
    const group = simulateGroup("rw", 12, design, 42, ranges);
    for (const p of group.params) {
      if (p.model !== "rw") throw new Error("expected RW parameters");
      expect(p.beta).toBeGreaterThanOrEqual(ranges.rw.beta[0]);
      expect(p.beta).toBeLessThanOrEqual(ranges.rw.beta[1]);
      expect(p.alpha).toBeGreaterThanOrEqual(ranges.rw.alpha[0]);
      expect(p.alpha).toBeLessThanOrEqual(ranges.rw.alpha[1]);
    }
    // Without ranges the broad region is used, as before.
    const broad = simulateGroup("rw", 12, design, 42);
    expect(broad.params.some((p) => p.model === "rw" && p.beta > ranges.rw.beta[1])).toBe(true);
  });
});

describe("held-out evaluation respects its split", () => {
  const group = simulateGroup("rw", 6, informative, 300);

  it("later trials: every training trial comes before every held-out trial", () => {
    const r = heldOutComparison(group.sessions, "later_trials");
    for (const f of r.folds) expect(Math.max(...f.trainTrials)).toBeLessThan(Math.min(...f.testTrials));
    // The generating model beats the baseline out of sample.
    expect(r.meanLogLik.rw).toBeGreaterThan(r.meanLogLik.bias);
  });

  it("unseen people: the held-out participant is never in the fit", () => {
    const r = heldOutComparison(group.sessions, "unseen_people");
    for (const f of r.folds) expect(f.trainParticipants).not.toContain(f.participant);
    expect(r.contract.person).toBe("unseen");
  });

  it("the random split is labelled as leaking later information", () => {
    const r = heldOutComparison(group.sessions, "random_trials", 5);
    expect(r.contract.untestedClaims).toMatch(/not as evidence of generalisation/);
    const someLaterInTraining = r.folds.some((f) => f.trainTrials.some((t) => t > Math.min(...f.testTrials)));
    expect(someLaterInTraining).toBe(true);
  });
});

describe("invalid inputs and computation limits", () => {
  it("refuses impossible designs and parameters", () => {
    expect(() => simulate({ model: "rw", alpha: 0.3, beta: 5 }, { trials: 5, rewardProbabilities: [0.2, 0.8] }, 1)).toThrow(ChoiceLabError);
    expect(() => simulate({ model: "rw", alpha: 1.3, beta: 5 }, informative, 1)).toThrow(ChoiceLabError);
    expect(() => simulate({ model: "bias", b: 0.5 }, { trials: 100, rewardProbabilities: [0.2, 1.4] }, 1)).toThrow(ChoiceLabError);
  });

  it("refuses runs beyond the browser budget instead of hanging", () => {
    expect(() => simulate({ model: "bias", b: 0.5 }, { trials: 5000, rewardProbabilities: [0.2, 0.8] }, 1)).toThrow(ComputeLimitError);
    expect(() => parameterRecovery(informative, RECOVERY_SETTINGS, 20, 1)).toThrow(ComputeLimitError);
    expect(() => simulateGroup("rw", 100, informative, 1)).toThrow(ComputeLimitError);
  });
});
