"use client";
import {
  christoffel,
  coefficientTable,
  gaussianCurvature,
  graphChartMetric,
  isCoordinateSingular,
  parallelLengthFromEmbedding,
  parallelLengthFromMetric,
  sphereMetric,
} from "@corniversity/core/labs/index";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { LabNote, NumberField, Plot } from "./Plot";

/**
 * Metric coefficients of the round sphere in spherical coordinates and in the graph chart at
 * the pole. Before the derivation is assessed the lab shows lengths measured in the embedding
 * (which any correct formula must reproduce) and the degeneracy at the poles; the closed forms
 * and Christoffel symbols appear afterwards.
 */
export function SphereMetricLab({ revealFormulas }: { revealFormulas: boolean }) {
  const [R, setR] = useState(1);
  const [thetaDeg, setThetaDeg] = useState(60);
  const [gx, setGx] = useState(0.2);
  const [gy, setGy] = useState(0.1);
  const radius = Math.max(0.1, R || 1);
  const theta = (Math.max(0, Math.min(180, thetaDeg)) * Math.PI) / 180;
  const g = useMemo(() => sphereMetric(radius, theta), [radius, theta]);
  const gamma = useMemo(() => christoffel(theta), [theta]);
  const table = useMemo(() => coefficientTable(radius, 18), [radius]);
  const graph = useMemo(() => {
    try {
      return graphChartMetric(radius, gx, gy);
    } catch {
      return null;
    }
  }, [radius, gx, gy]);
  const singular = isCoordinateSingular(theta, 1e-6);
  const metricLength = parallelLengthFromMetric(radius, theta);
  const embeddedLength = parallelLengthFromEmbedding(radius, theta, 2000);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <NumberField id="sphere-R" label="Radius R" value={R} onChange={setR} min={0.1} max={5} step={0.1} />
        <NumberField
          id="sphere-theta"
          label="Colatitude θ (degrees)"
          value={thetaDeg}
          onChange={setThetaDeg}
          min={0}
          max={180}
          step={1}
          hint="θ = 0 is the north pole."
        />
      </div>
      <Plot
        title="Length element along φ: g_φφ(θ) and the chart determinant det g(θ), both from the embedding"
        xLabel="θ (degrees)"
        yLabel="value"
        series={[
          { label: "g_φφ", points: table.map((r) => ({ x: r.thetaDegrees, y: r.gPhiPhi })) },
          { label: "det g", points: table.map((r) => ({ x: r.thetaDegrees, y: r.det })), dashed: true },
        ]}
      />
      <table className="w-full max-w-2xl text-sm">
        <tbody>
          <tr className="border-t border-stone">
            <th className="py-1 pr-3 text-left font-medium text-ink">Length of the parallel θ = {thetaDeg}°, measured in ℝ³</th>
            <td className="py-1 font-mono text-ink">{embeddedLength.toFixed(6)}</td>
          </tr>
          <tr className="border-t border-stone">
            <th className="py-1 pr-3 text-left font-medium text-ink">det g at this θ</th>
            <td className="py-1 font-mono text-ink">
              {g.det.toExponential(3)} {singular ? <Badge tone="rust">zero: the chart degenerates here</Badge> : null}
            </td>
          </tr>
          {revealFormulas ? (
            <>
              <tr className="border-t border-stone">
                <th className="py-1 pr-3 text-left font-medium text-ink">Coefficients</th>
                <td className="py-1 font-mono text-ink">
                  g_θθ = R² = {g.gThetaTheta.toFixed(4)} · g_θφ = 0 · g_φφ = R² sin²θ = {g.gPhiPhi.toFixed(4)}
                </td>
              </tr>
              <tr className="border-t border-stone">
                <th className="py-1 pr-3 text-left font-medium text-ink">Length from the metric ∫√g_φφ dφ = 2πR sin θ</th>
                <td className="py-1 font-mono text-ink">{metricLength.toFixed(6)}</td>
              </tr>
              <tr className="border-t border-stone">
                <th className="py-1 pr-3 text-left font-medium text-ink">Christoffel symbols (independent of R)</th>
                <td className="py-1 font-mono text-ink">
                  Γ^θ_φφ = −sinθ cosθ = {gamma.thetaPhiPhi.toFixed(4)} · Γ^φ_θφ = cotθ ={" "}
                  {gamma.phiThetaPhi === null ? "undefined at the pole" : gamma.phiThetaPhi.toFixed(4)}
                </td>
              </tr>
              <tr className="border-t border-stone">
                <th className="py-1 pr-3 text-left font-medium text-ink">Gaussian curvature 1/R²</th>
                <td className="py-1 font-mono text-ink">{gaussianCurvature(radius).toFixed(4)} at every point, poles included</td>
              </tr>
            </>
          ) : null}
        </tbody>
      </table>
      <div className="rounded-[var(--radius-panel)] border border-stone bg-paper p-3">
        <h3 className="text-sm font-medium text-ink">The pole in another chart</h3>
        <p className="mt-1 text-xs text-ink-2">Graph chart (x, y) ↦ (x, y, √(R² − x² − y²)) over the north pole; the pole is (0, 0).</p>
        <div className="mt-2 flex flex-wrap items-end gap-4">
          <NumberField id="sphere-gx" label="x" value={gx} onChange={setGx} step={0.05} min={-5} max={5} />
          <NumberField id="sphere-gy" label="y" value={gy} onChange={setGy} step={0.05} min={-5} max={5} />
        </div>
        {graph ? (
          <p className="mt-2 font-mono text-sm text-ink">
            g_xx = {graph.gxx.toFixed(4)} · g_xy = {graph.gxy.toFixed(4)} · g_yy = {graph.gyy.toFixed(4)} · det = {graph.det.toFixed(4)}
            {Math.abs(gx) < 1e-9 && Math.abs(gy) < 1e-9 ? " (the identity at the pole)" : ""}
          </p>
        ) : (
          <p className="mt-2 text-sm text-rust">Outside the chart: x² + y² must be less than R².</p>
        )}
      </div>
      <LabNote>
        Scope: one surface, S²_R ⊂ ℝ³, with the induced metric; two charts of it. Numbers computed in ℝ³ are what any correct coordinate
        formula must reproduce. The vanishing of det g at θ = 0, π belongs to the spherical chart: in the graph chart the same points have a
        non-degenerate metric, so the singularity is of the coordinates, not of the sphere. Nothing here concerns geodesics or curvature of
        other surfaces.
        {revealFormulas ? "" : " Closed forms appear once your derivation has been assessed."}
      </LabNote>
    </div>
  );
}
