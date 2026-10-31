/**
 * Norm comparison on C([0,1]) with the sequence f_n(x) = x^n (Functional Analysis I, unit 1).
 * Analytic values are the reference; the numeric quadrature exists so the learner can see the
 * integral computed, and the tests pin the two together.
 */

export function supNormXn(n: number): number {
  if (n < 0) throw new RangeError("n must be non-negative");
  return 1; // x^n is increasing on [0,1] and equals 1 at x = 1
}

export function l1NormXn(n: number): number {
  if (n < 0) throw new RangeError("n must be non-negative");
  return 1 / (n + 1);
}

export function l2NormXn(n: number): number {
  if (n < 0) throw new RangeError("n must be non-negative");
  return 1 / Math.sqrt(2 * n + 1);
}

/** Composite Simpson's rule on [a, b]; `steps` is rounded up to an even number. */
export function integrate(f: (x: number) => number, a: number, b: number, steps = 1000): number {
  const n = steps % 2 === 0 ? steps : steps + 1;
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += f(a + i * h) * (i % 2 === 0 ? 2 : 4);
  return (sum * h) / 3;
}

/** ‖f‖_p on [0,1] by quadrature; p = Infinity samples the supremum on a fine grid. */
export function pNorm(f: (x: number) => number, p: number, steps = 2000): number {
  if (p === Number.POSITIVE_INFINITY) {
    let max = 0;
    for (let i = 0; i <= steps; i++) max = Math.max(max, Math.abs(f(i / steps)));
    return max;
  }
  return integrate((x) => Math.abs(f(x)) ** p, 0, 1, steps) ** (1 / p);
}

export interface NormRow {
  n: number;
  sup: number;
  l1: number;
  l2: number;
  /** ‖f_n‖_∞ / ‖f_n‖_1 = n + 1: no constant C with ‖f‖_∞ ≤ C‖f‖_1 works for every n. */
  ratioSupL1: number;
}

export function normTable(maxN: number): NormRow[] {
  const rows: NormRow[] = [];
  for (let n = 1; n <= maxN; n++)
    rows.push({ n, sup: supNormXn(n), l1: l1NormXn(n), l2: l2NormXn(n), ratioSupL1: supNormXn(n) / l1NormXn(n) });
  return rows;
}

/** Points of x^n for plotting. */
export function sampleXn(n: number, points = 200): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= points; i++) {
    const x = i / points;
    out.push({ x, y: x ** n });
  }
  return out;
}

/**
 * What the sequence shows: ‖f_n‖_1 → 0 while ‖f_n‖_∞ = 1, so the two norms are not equivalent
 * on C([0,1]); the finite-dimensional theorem does not apply because the x^n are independent.
 */
export function normsEquivalentWitness(maxN: number): { l1TendsToZero: boolean; supConstant: boolean; ratioUnbounded: boolean } {
  const rows = normTable(maxN);
  const last = rows[rows.length - 1]!;
  return {
    l1TendsToZero: last.l1 < 0.05 && rows.every((r, i) => i === 0 || r.l1 < rows[i - 1]!.l1),
    supConstant: rows.every((r) => r.sup === 1),
    ratioUnbounded: last.ratioSupL1 >= maxN,
  };
}
