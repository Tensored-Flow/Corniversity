"use client";
import {
  bootstrapTuning,
  compareModels,
  generateBimodalTrials,
  generateTrials,
  meanCounts,
  ORIENTATIONS,
  splitByOrientation,
  splitTrials,
  type Trial,
  TUNING_SPLIT_CONTRACT,
  TUNING_SPLITS,
  type TuningSplitKind,
  tuningRate,
} from "@corniversity/core/labs/index";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { ContractList, LabNote, NumberField, Plot } from "./Plot";

type Split = { train: Trial[]; test: Trial[] };

/**
 * Synthetic spike counts from a von Mises tuning model, a maximum-likelihood fit, a
 * constant-rate baseline, held-out comparisons on new trials or on an orientation absent from
 * training, bootstrap intervals and a failure case. Every screen says the data are synthetic;
 * nothing is a recording.
 */
export function TuningFitLab() {
  const [b, setB] = useState(2);
  const [A, setA] = useState(10);
  const [kappa, setKappa] = useState(2);
  const [thetaPref, setThetaPref] = useState(65);
  const [trialsPer, setTrialsPer] = useState(30);
  const [window_, setWindow] = useState(1);
  const [seed, setSeed] = useState(42);
  const [showTruth, setShowTruth] = useState(false);
  const [dataset, setDataset] = useState<"tuned" | "failure">("tuned");
  const [splitKind, setSplitKind] = useState<TuningSplitKind>("held_out_trials");
  const [heldOutTheta, setHeldOutTheta] = useState(90);
  // Intervals belong to the training trials they were computed from; any change hides them.
  const [bootstrap, setBootstrap] = useState<{ split: Split; intervals: ReturnType<typeof bootstrapTuning> } | null>(null);

  const truth = useMemo(() => ({ b: Math.max(0, b), A: Math.max(0, A), kappa: Math.max(0, kappa), thetaPref }), [b, A, kappa, thetaPref]);
  const trials: Trial[] = useMemo(
    () =>
      dataset === "tuned"
        ? generateTrials(truth, Math.max(2, trialsPer), Math.max(0.1, window_), seed)
        : generateBimodalTrials(Math.max(2, trialsPer), Math.max(0.1, window_), seed),
    [dataset, truth, trialsPer, window_, seed],
  );
  const split: Split = useMemo(
    () => (splitKind === "held_out_trials" ? splitTrials(trials) : splitByOrientation(trials, heldOutTheta)),
    [trials, splitKind, heldOutTheta],
  );
  const result = useMemo(() => compareModels(split.train, split.test, Math.max(0.1, window_)), [split, window_]);
  // A held-out orientation has no training trials, so it has no training mean to plot.
  const means = useMemo(() => meanCounts(split.train).filter((m) => m.n > 0), [split]);
  const curve = Array.from({ length: 73 }, (_, i) => ({ x: i * 2.5, y: tuningRate(result.tuning, i * 2.5) * Math.max(0.1, window_) }));
  const intervals = bootstrap?.split === split ? bootstrap.intervals : null;
  const heldOutLabel = splitKind === "held_out_trials" ? "held-out trials" : `held-out orientation ${heldOutTheta}°`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="slate">Synthetic data</Badge>
        <span className="text-xs text-ink-2">
          Counts are drawn from a stated model with a seed; they are not recordings from any neuron or animal.
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="tf-dataset" className="text-sm font-medium text-ink">
            Dataset
          </label>
          <select
            id="tf-dataset"
            value={dataset}
            onChange={(e) => setDataset(e.target.value as "tuned" | "failure")}
            className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
          >
            <option value="tuned">Synthetic tuned neuron (von Mises)</option>
            <option value="failure">Synthetic failure case (built to break the model)</option>
          </select>
        </div>
        <NumberField id="tf-trials" label="Trials per orientation" value={trialsPer} onChange={setTrialsPer} min={2} max={200} />
        <NumberField id="tf-window" label="Window T (s)" value={window_} onChange={setWindow} min={0.1} step={0.1} />
        <NumberField id="tf-seed" label="Seed" value={seed} onChange={setSeed} min={0} />
      </div>
      {dataset === "tuned" ? (
        <details className="rounded-[var(--radius-panel)] border border-stone bg-paper p-3">
          <summary className="cursor-pointer text-sm text-ink">Generating model parameters (hidden by default)</summary>
          <div className="mt-2 flex flex-wrap items-end gap-4">
            <NumberField id="tf-b" label="b (Hz)" value={b} onChange={setB} min={0} step={0.5} />
            <NumberField id="tf-A" label="A (Hz)" value={A} onChange={setA} min={0} step={0.5} />
            <NumberField id="tf-kappa" label="κ" value={kappa} onChange={setKappa} min={0} step={0.25} />
            <NumberField id="tf-theta" label="θ_pref (°)" value={thetaPref} onChange={setThetaPref} min={0} max={179} />
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={showTruth} onChange={(e) => setShowTruth(e.target.checked)} /> Overlay the generating curve
            </label>
          </div>
        </details>
      ) : null}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex max-w-full flex-col gap-1">
          <label htmlFor="tf-split" className="text-sm font-medium text-ink">
            Evaluation split
          </label>
          <select
            id="tf-split"
            value={splitKind}
            onChange={(e) => setSplitKind(e.target.value as TuningSplitKind)}
            className="max-w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
          >
            {(Object.keys(TUNING_SPLITS) as TuningSplitKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {TUNING_SPLITS[kind].label}
              </option>
            ))}
          </select>
        </div>
        {splitKind === "held_out_orientation" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="tf-held-out-theta" className="text-sm font-medium text-ink">
              Held-out orientation
            </label>
            <select
              id="tf-held-out-theta"
              value={heldOutTheta}
              onChange={(e) => setHeldOutTheta(Number(e.target.value))}
              className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
            >
              {ORIENTATIONS.map((theta) => (
                <option key={theta} value={theta}>
                  {theta}°
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <p className="text-sm text-ink">
        <span className="font-medium">The question this split answers:</span> {TUNING_SPLITS[splitKind].question}
      </p>
      <ContractList contract={TUNING_SPLIT_CONTRACT[splitKind]} />
      <Plot
        title="Training trials: mean count per orientation, the fitted tuning curve and the constant-rate baseline"
        xLabel="orientation (degrees)"
        yLabel="spike count per window"
        xDomain={[0, 180]}
        series={[
          {
            label: "mean count (synthetic training trials)",
            points: means.map((m) => ({ x: m.thetaDegrees, y: m.mean })),
            kind: "points",
            color: "var(--ink)",
          },
          { label: "fitted tuning model", points: curve },
          {
            label: "baseline (constant rate)",
            points: [0, 180].map((x) => ({ x, y: result.baseline.b * Math.max(0.1, window_) })),
            dashed: true,
            color: "var(--slate)",
          },
          ...(showTruth && dataset === "tuned"
            ? [
                {
                  label: "generating curve",
                  points: Array.from({ length: 73 }, (_, i) => ({ x: i * 2.5, y: tuningRate(truth, i * 2.5) * Math.max(0.1, window_) })),
                  dashed: true,
                  color: "var(--moss)",
                },
              ]
            : []),
        ]}
      />
      <table className="w-full max-w-2xl text-sm">
        <tbody>
          <tr className="border-t border-stone">
            <th className="py-1 pr-3 text-left font-medium text-ink">Fitted tuning parameters (training trials)</th>
            <td className="py-1 font-mono text-ink">
              b̂ = {result.tuning.b.toFixed(2)} · Â = {result.tuning.A.toFixed(2)} · κ̂ = {result.tuning.kappa.toFixed(2)} · θ̂_pref ={" "}
              {result.tuning.thetaPref.toFixed(1)}°
            </td>
          </tr>
          <tr className="border-t border-stone">
            <th className="py-1 pr-3 text-left font-medium text-ink">Baseline b̂ = mean count / T</th>
            <td className="py-1 font-mono text-ink">{result.baseline.b.toFixed(3)} Hz</td>
          </tr>
          <tr className="border-t border-stone">
            <th className="py-1 pr-3 text-left font-medium text-ink">Log-likelihood per trial, training</th>
            <td className="py-1 font-mono text-ink">
              tuning {result.trainLogLikPerTrial.tuning.toFixed(3)} · baseline {result.trainLogLikPerTrial.baseline.toFixed(3)}
            </td>
          </tr>
          <tr className="border-t border-stone">
            <th className="py-1 pr-3 text-left font-medium text-ink">
              Log-likelihood per trial, {heldOutLabel} ({split.test.length} trials)
            </th>
            {split.test.length === 0 ? (
              <td className="py-1 text-ink-2">
                No trials are held out: with fewer than four trials per orientation every trial is used for fitting, so there is nothing to
                compare on. Use at least four.
              </td>
            ) : (
              <td className="py-1 font-mono text-ink">
                tuning {result.heldOutLogLikPerTrial.tuning.toFixed(3)} · baseline {result.heldOutLogLikPerTrial.baseline.toFixed(3)} ·{" "}
                {result.heldOutAdvantagePerTrial > 0 ? (
                  <Badge tone="moss">tuning model ahead by {result.heldOutAdvantagePerTrial.toFixed(3)}</Badge>
                ) : (
                  <Badge tone="rust">baseline ahead by {(-result.heldOutAdvantagePerTrial).toFixed(3)}</Badge>
                )}
              </td>
            )}
          </tr>
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setBootstrap({ split, intervals: bootstrapTuning(split.train, Math.max(0.1, window_), 60, seed + 1) })}
          className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-3 py-1.5 text-sm text-ink hover:bg-paper-3"
        >
          Bootstrap the fit (60 resamples)
        </button>
        {intervals ? (
          <p className="font-mono text-xs text-ink">
            95% percentile intervals: θ_pref [{intervals.thetaPref.low.toFixed(1)}, {intervals.thetaPref.high.toFixed(1)}]° · κ [
            {intervals.kappa.low.toFixed(2)}, {intervals.kappa.high.toFixed(2)}] · A [{intervals.A.low.toFixed(2)},{" "}
            {intervals.A.high.toFixed(2)}] · b [{intervals.b.low.toFixed(2)}, {intervals.b.high.toFixed(2)}]
          </p>
        ) : null}
      </div>
      <LabNote>
        Orientations are the eight values {ORIENTATIONS.join("°, ")}°; the fit is a coarse grid followed by coordinate refinement of the
        Poisson log-likelihood, which can stop at a local optimum for the failure case: that is part of what the failure case is for.
        Bootstrap intervals are percentile intervals over resampled training trials, not confidence statements about any real neuron. The
        two splits answer different questions and neither stands in for the other: held-out trials test new trials of orientations the fit
        has seen, and a held-out orientation tests a stimulus absent from training.
      </LabNote>
    </div>
  );
}
