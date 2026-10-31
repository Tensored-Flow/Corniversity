"use client";
import {
  accuracy,
  comparePipelines,
  type Features,
  generateDataset,
  randomSplit,
  selectionOptimism,
  summarise,
  temporalSplit,
  trainLogistic,
  trivialBaselineAccuracy,
} from "@corniversity/core/labs/index";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { LabNote, NumberField } from "./Plot";

/**
 * A synthetic predictive-maintenance dataset with deliberate leaks. The learner can switch
 * each leak on or off and see the test accuracy move; the trivial baseline is the number every
 * configuration must beat. All numbers are invented; no real organisation is described.
 */
export function DataLeakageLab() {
  const [seed, setSeed] = useState(2026);
  const [useTicket, setUseTicket] = useState(true);
  const [standardiseOn, setStandardiseOn] = useState<"all" | "train">("all");
  const [split, setSplit] = useState<"random" | "temporal">("random");
  const records = useMemo(() => generateDataset(seed), [seed]);
  const summary = useMemo(() => summarise(records), [records]);
  const pipelines = useMemo(() => comparePipelines(records), [records]);
  const optimism = useMemo(() => selectionOptimism(records), [records]);
  const custom = useMemo(() => {
    const s = split === "random" ? randomSplit(records) : temporalSplit(records);
    const features: Features = { useTicket, standardiseOn };
    const model = trainLogistic(s, features, { epochs: 200 });
    return { accuracy: accuracy(model, s.test, features), testRows: s.test.length };
  }, [records, useTicket, standardiseOn, split]);
  const baseline = trivialBaselineAccuracy(records);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="slate">Synthetic data</Badge>
        <span className="text-xs text-ink-2">
          {summary.rows} machine-weeks ({summary.machines} machines × {summary.weeks} weeks), label base rate{" "}
          {(summary.baseRate * 100).toFixed(2)}%. Every number is invented.
        </span>
        <NumberField id="dl-seed" label="Seed" value={seed} onChange={setSeed} min={0} />
      </div>
      <table className="w-full max-w-3xl text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
          <tr>
            <th className="py-1 pr-3">Protocol</th>
            <th className="py-1 pr-3">Test accuracy</th>
            <th className="py-1">What it did</th>
          </tr>
        </thead>
        <tbody>
          {pipelines.map((p) => (
            <tr key={p.name} className="border-t border-stone align-top">
              <td className="py-1 pr-3 text-ink">{p.name}</td>
              <td className="py-1 pr-3 font-mono text-ink">{(p.accuracy * 100).toFixed(2)}%</td>
              <td className="py-1 text-ink-2">{p.notes}</td>
            </tr>
          ))}
          <tr className="border-t border-stone align-top">
            <td className="py-1 pr-3 text-ink">selection on the test set</td>
            <td className="py-1 pr-3 font-mono text-ink">
              median {(optimism.median * 100).toFixed(2)}% → best of 30 {(optimism.best * 100).toFixed(2)}%
            </td>
            <td className="py-1 text-ink-2">
              The same honest model evaluated 30 times on noisy test batches with varied thresholds; keeping the best score turns noise into
              apparent skill.
            </td>
          </tr>
        </tbody>
      </table>
      <div className="rounded-[var(--radius-panel)] border border-stone bg-paper p-3">
        <h3 className="text-sm font-medium text-ink">Isolate one leak at a time</h3>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-ink">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useTicket} onChange={(e) => setUseTicket(e.target.checked)} /> use the ticket feature (opened
            after a fault is detected)
          </label>
          <label className="flex items-center gap-2">
            standardise on
            <select
              value={standardiseOn}
              onChange={(e) => setStandardiseOn(e.target.value as "all" | "train")}
              className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
            >
              <option value="all">all rows (leak)</option>
              <option value="train">training rows only</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            split
            <select
              value={split}
              onChange={(e) => setSplit(e.target.value as "random" | "temporal")}
              className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
            >
              <option value="random">random rows (leak)</option>
              <option value="temporal">later weeks held out</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-sm text-ink">
          Test accuracy for this configuration: <span className="font-mono">{(custom.accuracy * 100).toFixed(2)}%</span> on{" "}
          {custom.testRows} rows ·{" "}
          {custom.accuracy > baseline + 0.005 ? (
            <Badge tone="brass">above the trivial baseline</Badge>
          ) : (
            <Badge tone="neutral">not above the trivial baseline</Badge>
          )}
        </p>
      </div>
      <LabNote>
        The model is a logistic regression trained by batch gradient descent, not the exercise's MLP; the leaks behave the same way. The
        trivial baseline is the accuracy of predicting "no failure" everywhere, 1 − base rate; the exercise asks you to compute it for its
        own stated base rate. Standardising on all rows is a mild leak here because the features are nearly stationary; the ticket feature
        is the severe one.
      </LabNote>
    </div>
  );
}
