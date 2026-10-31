"use client";
import { analytic, analyticSeries, auditSeries, eulerStableStep, simulateEuler, simulateRk4 } from "@corniversity/core/labs/index";
import { useState } from "react";
import { Badge } from "@/components/ui";
import { LabNote, NumberField, Plot } from "./Plot";

/**
 * A ⇌ B at constant volume: a stated pair of differential equations, solved exactly and
 * numerically. The curves and point readouts are what the learner compares with a derived
 * formula; the lab does not print the equilibrium constant or the relaxation time, which the
 * report asks the learner to compute. Not a laboratory procedure.
 */
export function KineticsLab() {
  const [kf, setKf] = useState(0.3);
  const [kr, setKr] = useState(0.1);
  const [c0, setC0] = useState(1);
  const [tEnd, setTEnd] = useState(20);
  const [tRead, setTRead] = useState(5);
  const [dt, setDt] = useState(1);
  const params = { kf: Math.max(0, kf), kr: Math.max(0, kr), c0: Math.max(0.01, c0) };
  const valid = params.kf + params.kr > 0;
  const series = valid ? analyticSeries(params, Math.max(1, tEnd), 240) : [];
  const readout = valid ? analytic(params, Math.max(0, tRead)) : null;
  const stableStep = valid ? eulerStableStep(params) : null;
  const euler = valid && dt > 0 ? simulateEuler(params, dt, Math.ceil(Math.max(1, tEnd) / dt)) : null;
  const rk4 = valid && dt > 0 ? simulateRk4(params, dt, Math.ceil(Math.max(1, tEnd) / dt)) : null;
  const eulerAudit = euler ? auditSeries(euler.series, params.c0) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <NumberField id="kin-kf" label="k_f (min⁻¹)" value={kf} onChange={setKf} min={0} step={0.05} />
        <NumberField id="kin-kr" label="k_r (min⁻¹)" value={kr} onChange={setKr} min={0} step={0.05} />
        <NumberField id="kin-c0" label="C₀ (M), all A at t = 0" value={c0} onChange={setC0} min={0.01} step={0.1} />
        <NumberField id="kin-tend" label="Run length (min)" value={tEnd} onChange={setTEnd} min={1} step={1} />
      </div>
      {!valid ? <p className="text-sm text-rust">At least one rate constant must be positive.</p> : null}
      <Plot
        title="Model output: [A](t) and [B](t) from the exact solution"
        xLabel="t (min)"
        yLabel="concentration (M)"
        yDomain={[0, params.c0]}
        series={[
          { label: "[A] exact", points: series.map((s) => ({ x: s.t, y: s.a })) },
          { label: "[B] exact", points: series.map((s) => ({ x: s.t, y: s.b })) },
          ...(rk4
            ? [{ label: `[A] RK4, Δt = ${dt}`, points: rk4.map((s) => ({ x: s.t, y: s.a })), dashed: true, color: "var(--moss)" }]
            : []),
          ...(euler
            ? [
                {
                  label: `[A] explicit Euler, Δt = ${dt}`,
                  points: euler.series.map((s) => ({ x: s.t, y: s.a })),
                  dashed: true,
                  color: "var(--rust)",
                },
              ]
            : []),
        ]}
      />
      <div className="flex flex-wrap items-end gap-4">
        <NumberField id="kin-tread" label="Read the model at t (min)" value={tRead} onChange={setTRead} min={0} step={0.5} />
        {readout ? (
          <p className="font-mono text-sm text-ink">
            [A]({tRead}) = {readout.a.toFixed(4)} M · [B]({tRead}) = {readout.b.toFixed(4)} M · [A] + [B] ={" "}
            {(readout.a + readout.b).toFixed(4)} M
          </p>
        ) : null}
      </div>
      <div className="rounded-[var(--radius-panel)] border border-stone bg-paper p-3">
        <h3 className="text-sm font-medium text-ink">Numerical step</h3>
        <div className="mt-2 flex flex-wrap items-end gap-4">
          <NumberField id="kin-dt" label="Δt (min)" value={dt} onChange={setDt} min={0.01} step={0.5} />
          {stableStep !== null ? (
            <p className="text-sm text-ink-2">
              Explicit Euler is stable for Δt below <span className="font-mono">{stableStep.toFixed(3)}</span> min with these rate
              constants.
            </p>
          ) : null}
        </div>
        {euler && eulerAudit ? (
          <p className="mt-2 text-sm text-ink">
            Euler: {eulerAudit.conserved ? "mass conserved" : "mass not conserved"} ·{" "}
            {euler.negativeAt !== null ? (
              <Badge tone="rust">leaves [0, C₀] at t = {euler.negativeAt.toFixed(2)} min: a numerical artefact, not chemistry</Badge>
            ) : (
              <Badge tone="moss">stays within [0, C₀]</Badge>
            )}
            {rk4 ? ` · RK4 at t = ${tRead}: ${rk4[Math.min(rk4.length - 1, Math.round(Math.max(0, tRead) / dt))]?.a.toFixed(4)} M` : ""}
          </p>
        ) : null}
      </div>
      <LabNote>
        Virtual model, not a procedure: nothing here is to be done with real chemicals. The model assumes a well-mixed solution at constant
        volume and temperature, two elementary first-order steps, rate constants fixed during a run and no other reactions. The exact
        solution is the reference; the explicit Euler curve is included only to show what an unstable step produces.
      </LabNote>
    </div>
  );
}
