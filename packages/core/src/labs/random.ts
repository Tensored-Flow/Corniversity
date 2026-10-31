/**
 * Small deterministic random source for the laboratories. Every synthetic dataset is generated
 * from a seed so that a lab run, a test and a learner's report all refer to the same numbers.
 */
export interface Rng {
  next(): number; // uniform in [0, 1)
  normal(): number;
  poisson(mean: number): number;
  pick<T>(items: readonly T[]): T;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    // Box–Muller; the uniform is kept away from 0 so the logarithm is finite.
    const u = Math.max(next(), 1e-12);
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const poisson = (mean: number) => {
    if (mean <= 0) return 0;
    if (mean > 60) return Math.max(0, Math.round(mean + Math.sqrt(mean) * normal()));
    // Knuth's method, exact for moderate means.
    const limit = Math.exp(-mean);
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= next();
    } while (p > limit);
    return k - 1;
  };
  return { next, normal, poisson, pick: (items) => items[Math.floor(next() * items.length)]! };
}
