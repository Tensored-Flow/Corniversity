/**
 * The number game (Tenenbaum): hypotheses are subsets of {1,…,100}; under strong sampling the
 * likelihood of n examples from h is |h|^{−n}·1[X ⊆ h] (the size principle). The lab lets the
 * learner weaken the exponent, add an unnatural hypothesis with its own prior, and watch the
 * generalisation profile P(y ∈ C | X) change. Comparison profiles in the UI are synthetic.
 */

export interface Hypothesis {
  id: string;
  label: string;
  members: ReadonlySet<number>;
  prior: number;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** The four-hypothesis space used in Computational Cognitive Science, unit 2. */
export function lessonHypotheses(): Hypothesis[] {
  const hs = [
    { id: "even", label: "even numbers", members: new Set(range(1, 100).filter((n) => n % 2 === 0)) },
    { id: "mult10", label: "multiples of 10", members: new Set(range(1, 100).filter((n) => n % 10 === 0)) },
    { id: "pow2", label: "powers of two", members: new Set([2, 4, 8, 16, 32, 64]) },
    { id: "50to60", label: "50 to 60", members: new Set(range(50, 60)) },
  ];
  return hs.map((h) => ({ ...h, prior: 1 / hs.length }));
}

/** A richer space for exploration: parity, multiples, powers, squares, and short intervals. */
export function extendedHypotheses(): Hypothesis[] {
  const hs: Omit<Hypothesis, "prior">[] = [
    { id: "even", label: "even numbers", members: new Set(range(1, 100).filter((n) => n % 2 === 0)) },
    { id: "odd", label: "odd numbers", members: new Set(range(1, 100).filter((n) => n % 2 === 1)) },
    { id: "squares", label: "perfect squares", members: new Set(range(1, 10).map((n) => n * n)) },
  ];
  for (const k of [3, 4, 5, 6, 7, 8, 9, 10])
    hs.push({ id: `mult${k}`, label: `multiples of ${k}`, members: new Set(range(1, 100).filter((n) => n % k === 0)) });
  for (const b of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const members = new Set<number>();
    for (let p = b; p <= 100; p *= b) members.add(p);
    hs.push({ id: `pow${b}`, label: `powers of ${b}`, members });
  }
  for (const [a, b] of [
    [1, 10],
    [10, 20],
    [20, 30],
    [30, 40],
    [40, 50],
    [50, 60],
    [60, 70],
    [70, 80],
    [80, 90],
    [90, 100],
    [15, 25],
    [55, 65],
  ] as const) {
    hs.push({ id: `int${a}-${b}`, label: `${a} to ${b}`, members: new Set(range(a, b)) });
  }
  return hs.map((h) => ({ ...h, prior: 1 / hs.length }));
}

export interface InferenceOptions {
  /** Exponent applied to 1/|h| per example: 1 is the size principle; 0 removes it entirely. */
  sizeExponent?: number;
}

export interface PosteriorRow {
  hypothesis: Hypothesis;
  likelihood: number;
  unnormalised: number;
  posterior: number;
}

export function posterior(hypotheses: Hypothesis[], examples: number[], options: InferenceOptions = {}): PosteriorRow[] {
  const exponent = options.sizeExponent ?? 1;
  const rows = hypotheses.map((hypothesis) => {
    const consistent = examples.every((x) => hypothesis.members.has(x));
    const likelihood = consistent ? hypothesis.members.size ** (-exponent * examples.length) : 0;
    return { hypothesis, likelihood, unnormalised: likelihood * hypothesis.prior, posterior: 0 };
  });
  const total = rows.reduce((s, r) => s + r.unnormalised, 0);
  for (const row of rows) row.posterior = total > 0 ? row.unnormalised / total : 0;
  return rows;
}

/** Hypothesis-averaged generalisation: P(y ∈ C | X) = Σ_h P(h | X)·1[y ∈ h]. */
export function generalisation(hypotheses: Hypothesis[], examples: number[], y: number, options: InferenceOptions = {}): number {
  return posterior(hypotheses, examples, options).reduce((s, r) => s + (r.hypothesis.members.has(y) ? r.posterior : 0), 0);
}

export function generalisationProfile(
  hypotheses: Hypothesis[],
  examples: number[],
  options: InferenceOptions = {},
): { y: number; p: number }[] {
  const rows = posterior(hypotheses, examples, options);
  return range(1, 100).map((y) => ({ y, p: rows.reduce((s, r) => s + (r.hypothesis.members.has(y) ? r.posterior : 0), 0) }));
}

/** Adds an arbitrary ("unnatural") hypothesis with a chosen prior mass, renormalising the others. */
export function withExtraHypothesis(
  hypotheses: Hypothesis[],
  extra: { id: string; label: string; members: number[]; priorMass: number },
): Hypothesis[] {
  const mass = Math.min(0.99, Math.max(0, extra.priorMass));
  const scaled = hypotheses.map((h) => ({ ...h, prior: h.prior * (1 - mass) }));
  return [...scaled, { id: extra.id, label: extra.label, members: new Set(extra.members), prior: mass }];
}
