/**
 * Gradient descent on the quadratic L(w) = ½ wᵀ diag(λ₁, λ₂) w. Everything here is exact:
 * each coordinate obeys w_{t+1} = (1 − ηλ_i) w_t, so convergence for every start holds
 * iff 0 < η < 2/λ_max, and the worst-case contraction per step is ρ(η) = max_i |1 − ηλ_i|.
 */

export function converges(eta: number, lambdas: number[]): boolean {
  const max = Math.max(...lambdas);
  return eta > 0 && eta < 2 / max;
}

export function contractionFactor(eta: number, lambdas: number[]): number {
  return Math.max(...lambdas.map((l) => Math.abs(1 - eta * l)));
}

/** η* = 2/(λ_min + λ_max) balances the two extreme coordinates; ρ* = (κ − 1)/(κ + 1) with κ = λ_max/λ_min. */
export function optimalStep(lambdas: number[]): { eta: number; rho: number; conditionNumber: number } {
  const min = Math.min(...lambdas);
  const max = Math.max(...lambdas);
  return { eta: 2 / (min + max), rho: (max - min) / (max + min), conditionNumber: max / min };
}

/** Number of steps until ‖w‖ shrinks by `factor` in the worst case; Infinity when ρ ≥ 1. */
export function stepsToShrink(eta: number, lambdas: number[], factor: number): number {
  const rho = contractionFactor(eta, lambdas);
  if (rho >= 1) return Number.POSITIVE_INFINITY;
  // ρ^t ≤ factor  ⇔  t ≥ log(factor)/log(ρ); both logarithms are negative for factor < 1, ρ < 1.
  return Math.ceil(Math.log(factor) / Math.log(rho));
}

export function loss(w: number[], lambdas: number[]): number {
  return 0.5 * w.reduce((s, wi, i) => s + lambdas[i]! * wi * wi, 0);
}

export function gradientDescentPath(w0: number[], eta: number, lambdas: number[], steps: number): { w: number[]; loss: number }[] {
  const path = [{ w: [...w0], loss: loss(w0, lambdas) }];
  let w = [...w0];
  for (let t = 0; t < steps; t++) {
    w = w.map((wi, i) => wi - eta * lambdas[i]! * wi);
    path.push({ w: [...w], loss: loss(w, lambdas) });
  }
  return path;
}
