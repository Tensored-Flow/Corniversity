/**
 * The round sphere of radius R in spherical coordinates (θ colatitude from the north pole,
 * φ longitude): g = R² dθ² + R² sin²θ dφ². Scope: this is the induced metric from ℝ³ on one
 * chart; the poles θ = 0, π are coordinate singularities of this chart, not of the sphere, as
 * the graph chart at the pole shows (its metric is the identity there).
 */

export interface MetricComponents {
  gThetaTheta: number;
  gThetaPhi: number;
  gPhiPhi: number;
  det: number;
}

export function sphereMetric(R: number, theta: number): MetricComponents {
  if (R <= 0) throw new RangeError("R must be positive");
  const s = Math.sin(theta);
  const gThetaTheta = R * R;
  const gPhiPhi = R * R * s * s;
  return { gThetaTheta, gThetaPhi: 0, gPhiPhi, det: gThetaTheta * gPhiPhi };
}

/** The chart degenerates (det g = 0) exactly at the poles. */
export function isCoordinateSingular(theta: number, tolerance = 1e-9): boolean {
  return Math.abs(Math.sin(theta)) < tolerance;
}

/** Non-zero Christoffel symbols of the Levi-Civita connection in these coordinates (independent of R). */
export function christoffel(theta: number): { thetaPhiPhi: number; phiThetaPhi: number | null } {
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  return { thetaPhiPhi: -s * c, phiThetaPhi: Math.abs(s) < 1e-12 ? null : c / s };
}

export function gaussianCurvature(R: number): number {
  return 1 / (R * R);
}

/**
 * Graph chart over the north pole: (x, y) ↦ (x, y, √(R² − x² − y²)). Induced metric
 * g_ij = δ_ij + x_i x_j / (R² − x² − y²); at the pole (0,0) it is the identity, so nothing is
 * singular there: the degeneracy of the spherical chart is a property of the chart.
 */
export function graphChartMetric(R: number, x: number, y: number): { gxx: number; gxy: number; gyy: number; det: number } {
  const w = R * R - x * x - y * y;
  if (w <= 0) throw new RangeError("point outside the chart domain");
  const gxx = 1 + (x * x) / w;
  const gxy = (x * y) / w;
  const gyy = 1 + (y * y) / w;
  return { gxx, gxy, gyy, det: gxx * gyy - gxy * gxy };
}

/** Length of the parallel θ = θ0 from the metric: ∫₀^{2π} √(g_φφ) dφ = 2πR sin θ0. */
export function parallelLengthFromMetric(R: number, theta0: number): number {
  return 2 * Math.PI * Math.sqrt(sphereMetric(R, theta0).gPhiPhi);
}

/** The same length computed from the embedding, as a check that the metric is the induced one. */
export function parallelLengthFromEmbedding(R: number, theta0: number, segments = 4000): number {
  const point = (phi: number) =>
    [R * Math.sin(theta0) * Math.cos(phi), R * Math.sin(theta0) * Math.sin(phi), R * Math.cos(theta0)] as const;
  let length = 0;
  let previous = point(0);
  for (let i = 1; i <= segments; i++) {
    const current = point((2 * Math.PI * i) / segments);
    length += Math.hypot(current[0] - previous[0], current[1] - previous[1], current[2] - previous[2]);
    previous = current;
  }
  return length;
}

/** Rows for the lab's coefficient table across colatitudes. */
export function coefficientTable(
  R: number,
  steps = 12,
): { thetaDegrees: number; gPhiPhi: number; det: number; singular: boolean; gammaThetaPhiPhi: number; gammaPhiThetaPhi: number | null }[] {
  const rows = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (Math.PI * i) / steps;
    const g = sphereMetric(R, theta);
    const gamma = christoffel(theta);
    rows.push({
      thetaDegrees: (180 * i) / steps,
      gPhiPhi: g.gPhiPhi,
      det: g.det,
      singular: isCoordinateSingular(theta),
      gammaThetaPhiPhi: gamma.thetaPhiPhi,
      gammaPhiThetaPhi: gamma.phiThetaPhi,
    });
  }
  return rows;
}
