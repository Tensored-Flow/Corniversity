export * from "./bayesian-concept";
export * from "./data-leakage";
export * from "./gradient-descent";
export * from "./kinetics";
export * from "./norms";
export * from "./random";
export * from "./sphere-metric";
export * from "./tuning";

/** The laboratories the application knows how to render; unit activities refer to these ids. */
export const LAB_IDS = [
  "norm-comparison",
  "sphere-metric",
  "kinetics-reversible-first-order",
  "gradient-descent-surface",
  "bayesian-concept-learning",
  "neural-tuning-fit",
  "data-leakage-audit",
] as const;
export type LabId = (typeof LAB_IDS)[number];

export const LAB_META: Record<LabId, { title: string; department: string; scope: string; synthetic: boolean }> = {
  "norm-comparison": {
    title: "Two norms on C([0,1])",
    department: "mathematics",
    scope: "Exact values of ‖x^n‖ in the sup, L¹ and L² norms with a quadrature check; what the sequence shows about norm equivalence.",
    synthetic: false,
  },
  "sphere-metric": {
    title: "Metric coefficients on the sphere",
    department: "mathematics",
    scope:
      "Induced metric of S²_R in spherical coordinates and in the graph chart at the pole; Christoffel symbols; the pole as a coordinate singularity. One chart of one surface; nothing beyond S² is claimed.",
    synthetic: false,
  },
  "kinetics-reversible-first-order": {
    title: "Reversible first-order reaction A ⇌ B",
    department: "chemistry",
    scope:
      "A stated pair of differential equations at constant volume: analytic solution, equilibrium constant, relaxation time, and what an unstable explicit step does. A model, not a laboratory procedure.",
    synthetic: false,
  },
  "gradient-descent-surface": {
    title: "Gradient descent on a quadratic",
    department: "computer-science-ai",
    scope: "Exact iteration on ½ wᵀ diag(λ₁,λ₂) w: the convergence threshold 2/λ_max, contraction factors and the optimal step.",
    synthetic: false,
  },
  "bayesian-concept-learning": {
    title: "Bayesian concept learning (number game)",
    department: "cognitive-science",
    scope:
      "Posterior over a hypothesis space under the size principle and hypothesis-averaged generalisation; the comparison profile is synthetic, not human data.",
    synthetic: true,
  },
  "neural-tuning-fit": {
    title: "Fitting a tuning curve to synthetic spike counts",
    department: "neuroscience",
    scope:
      "Poisson counts from a von Mises tuning model; maximum-likelihood fit, a constant-rate baseline, held-out comparison, bootstrap intervals and a failure case. All data are synthetic.",
    synthetic: true,
  },
  "data-leakage-audit": {
    title: "A leak in a tidy pipeline",
    department: "computer-science-ai",
    scope:
      "A synthetic predictive-maintenance dataset with deliberate target, preprocessing, temporal and selection leaks; the trivial baseline against the leaky and honest protocols.",
    synthetic: true,
  },
};
