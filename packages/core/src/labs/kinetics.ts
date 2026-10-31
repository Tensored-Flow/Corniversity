/**
 * Reversible first-order reaction A ⇌ B at constant volume and temperature:
 *   d[A]/dt = −k_f [A] + k_r [B],  d[B]/dt = k_f [A] − k_r [B],  [A] + [B] = C₀.
 * A model, not a laboratory procedure. The analytic solution is the reference; the explicit
 * Euler scheme is kept only to show what an unstable step does (negative concentrations), and
 * the fourth-order Runge–Kutta integrator exists so the learner can compare a numerical solver
 * with the formula.
 */

export interface KineticsParams {
  kf: number;
  kr: number;
  c0: number;
  a0?: number; // defaults to c0 (all A at t = 0)
}

function check(p: KineticsParams): Required<KineticsParams> {
  if (p.kf < 0 || p.kr < 0) throw new RangeError("rate constants must be non-negative");
  if (p.c0 <= 0) throw new RangeError("total concentration must be positive");
  if (p.kf + p.kr === 0) throw new RangeError("at least one rate constant must be positive");
  const a0 = p.a0 ?? p.c0;
  if (a0 < 0 || a0 > p.c0) throw new RangeError("[A]₀ must lie between 0 and C₀");
  return { kf: p.kf, kr: p.kr, c0: p.c0, a0 };
}

export function equilibrium(p: KineticsParams): { aEq: number; bEq: number; K: number | null; tau: number; halfLife: number } {
  const { kf, kr, c0 } = check(p);
  const aEq = (kr / (kf + kr)) * c0;
  const bEq = c0 - aEq;
  return { aEq, bEq, K: kr > 0 ? kf / kr : null, tau: 1 / (kf + kr), halfLife: Math.LN2 / (kf + kr) };
}

/** [A](t) = [A]_eq + ([A]₀ − [A]_eq) e^{−t/τ}; [B] = C₀ − [A]. */
export function analytic(p: KineticsParams, t: number): { a: number; b: number } {
  const { c0, a0 } = check(p);
  const { aEq, tau } = equilibrium(p);
  const a = aEq + (a0 - aEq) * Math.exp(-t / tau);
  return { a, b: c0 - a };
}

export function analyticSeries(p: KineticsParams, tEnd: number, points = 200): { t: number; a: number; b: number }[] {
  const out = [];
  for (let i = 0; i <= points; i++) {
    const t = (tEnd * i) / points;
    out.push({ t, ...analytic(p, t) });
  }
  return out;
}

/** Explicit Euler is stable only for dt < 2/(k_f + k_r); beyond it the iterate overshoots and can go negative. */
export function eulerStableStep(p: KineticsParams): number {
  const { kf, kr } = check(p);
  return 2 / (kf + kr);
}

export function simulateEuler(
  p: KineticsParams,
  dt: number,
  steps: number,
): { series: { t: number; a: number; b: number }[]; negativeAt: number | null } {
  const { kf, kr, c0, a0 } = check(p);
  if (dt <= 0) throw new RangeError("dt must be positive");
  const series = [{ t: 0, a: a0, b: c0 - a0 }];
  let a = a0;
  let negativeAt: number | null = null;
  for (let i = 1; i <= steps; i++) {
    const b = c0 - a;
    a = a + dt * (-kf * a + kr * b);
    const t = i * dt;
    if (negativeAt === null && (a < 0 || a > c0)) negativeAt = t;
    series.push({ t, a, b: c0 - a });
  }
  return { series, negativeAt };
}

/** Classical RK4 on the reduced equation d[A]/dt = −(k_f + k_r)[A] + k_r C₀. */
export function simulateRk4(p: KineticsParams, dt: number, steps: number): { t: number; a: number; b: number }[] {
  const { kf, kr, c0, a0 } = check(p);
  if (dt <= 0) throw new RangeError("dt must be positive");
  const f = (a: number) => -(kf + kr) * a + kr * c0;
  const series = [{ t: 0, a: a0, b: c0 - a0 }];
  let a = a0;
  for (let i = 1; i <= steps; i++) {
    const k1 = f(a);
    const k2 = f(a + (dt / 2) * k1);
    const k3 = f(a + (dt / 2) * k2);
    const k4 = f(a + dt * k3);
    a += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    series.push({ t: i * dt, a, b: c0 - a });
  }
  return series;
}

/** Conservation and non-negativity audit of any series, for the lab's self-check panel. */
export function auditSeries(
  series: { a: number; b: number }[],
  c0: number,
  tolerance = 1e-9,
): { conserved: boolean; nonNegative: boolean } {
  return {
    conserved: series.every((s) => Math.abs(s.a + s.b - c0) <= tolerance),
    nonNegative: series.every((s) => s.a >= -tolerance && s.b >= -tolerance),
  };
}
