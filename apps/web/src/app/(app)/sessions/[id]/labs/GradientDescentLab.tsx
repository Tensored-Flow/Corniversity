"use client";
import { contractionFactor, converges, gradientDescentPath, loss } from "@corniversity/core/labs/index";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { LabNote, NumberField, Plot } from "./Plot";

/** Gradient descent on ½ wᵀ diag(λ₁, λ₂) w: the path, the loss, and the per-coordinate factor |1 − ηλ_i|. */
export function GradientDescentLab() {
  const [l1, setL1] = useState(1);
  const [l2, setL2] = useState(10);
  const [eta, setEta] = useState(0.1);
  const [w1, setW1] = useState(1);
  const [w2, setW2] = useState(1);
  const [steps, setSteps] = useState(30);
  const lambdas = [Math.max(1e-6, l1), Math.max(1e-6, l2)];
  const path = useMemo(
    () => gradientDescentPath([w1, w2], eta, lambdas, Math.max(1, Math.min(500, Math.round(steps)))),
    [w1, w2, eta, lambdas[0], lambdas[1], steps],
  );
  const ok = converges(eta, lambdas);
  const rho = contractionFactor(eta, lambdas);
  const last = path[path.length - 1]!;
  const contourRadius = Math.max(Math.abs(w1), Math.abs(w2), 1) * 1.2;
  const ellipse = (level: number) =>
    Array.from({ length: 121 }, (_, i) => {
      const t = (2 * Math.PI * i) / 120;
      return { x: Math.sqrt((2 * level) / lambdas[0]!) * Math.cos(t), y: Math.sqrt((2 * level) / lambdas[1]!) * Math.sin(t) };
    });
  const levels = [0.1, 0.4, 1].map((f) => f * loss([contourRadius, contourRadius], lambdas));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <NumberField id="gd-l1" label="λ₁" value={l1} onChange={setL1} min={0.01} step={0.5} />
        <NumberField id="gd-l2" label="λ₂" value={l2} onChange={setL2} min={0.01} step={0.5} />
        <NumberField id="gd-eta" label="η (step size)" value={eta} onChange={setEta} min={0} step={0.01} />
        <NumberField id="gd-w1" label="w₁(0)" value={w1} onChange={setW1} step={0.5} />
        <NumberField id="gd-w2" label="w₂(0)" value={w2} onChange={setW2} step={0.5} />
        <NumberField id="gd-steps" label="Steps" value={steps} onChange={setSteps} min={1} max={500} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Plot
          title="Level sets of L and the iterate path (w₁ horizontal, w₂ vertical)"
          xLabel="w₁"
          yLabel="w₂"
          xDomain={[-contourRadius * 1.6, contourRadius * 1.6]}
          yDomain={[-contourRadius * 1.6, contourRadius * 1.6]}
          series={[
            ...levels.map((lv, i) => ({
              label: i === 0 ? "level sets" : `level ${i + 1}`,
              points: ellipse(lv),
              color: "var(--ink-3)",
              dashed: true,
            })),
            { label: "iterates", points: path.map((p) => ({ x: p.w[0]!, y: p.w[1]! })) },
            { label: "iterate points", points: path.map((p) => ({ x: p.w[0]!, y: p.w[1]! })), kind: "points", color: "var(--rust)" },
          ]}
        />
        <Plot
          title="Loss per step (log₁₀)"
          xLabel="step"
          yLabel="log₁₀ L"
          series={[{ label: "log₁₀ L(w_t)", points: path.map((p, t) => ({ x: t, y: Math.log10(Math.max(1e-300, p.loss)) })) }]}
        />
      </div>
      <table className="w-full max-w-2xl text-sm">
        <tbody>
          <tr className="border-t border-stone">
            <th className="py-1 pr-3 text-left font-medium text-ink">Per-coordinate factors |1 − ηλᵢ|</th>
            <td className="py-1 font-mono text-ink">
              {lambdas.map((l) => Math.abs(1 - eta * l).toFixed(4)).join(" · ")} → worst case {rho.toFixed(4)}
            </td>
          </tr>
          <tr className="border-t border-stone">
            <th className="py-1 pr-3 text-left font-medium text-ink">Behaviour from this start</th>
            <td className="py-1 text-ink">
              {ok ? <Badge tone="moss">contracting</Badge> : <Badge tone="rust">not contracting in every coordinate</Badge>} · ‖w‖ after{" "}
              {path.length - 1} steps: <span className="font-mono">{Math.hypot(...last.w).toExponential(3)}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <LabNote>
        Exact arithmetic on a quadratic: nothing is sampled or approximated except floating point. The factors shown are what your proof of
        the convergence condition must explain; the lab does not state the condition for you.
      </LabNote>
    </div>
  );
}
