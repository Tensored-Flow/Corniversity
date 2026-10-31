"use client";
import {
  extendedHypotheses,
  generalisationProfile,
  lessonHypotheses,
  mulberry32,
  posterior,
  withExtraHypothesis,
} from "@corniversity/core/labs/index";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { LabNote, NumberField, Plot } from "./Plot";

const parseNumbers = (text: string) => [
  ...new Set(
    text
      .split(/[,\s]+/)
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 100),
  ),
];

/**
 * The number game: posterior over a hypothesis space and hypothesis-averaged generalisation.
 * The learner can weaken the size principle and add an unnatural hypothesis with its own prior.
 * The comparison profile is synthetic and labelled; nothing here is human data.
 */
export function BayesianConceptLab() {
  const [space, setSpace] = useState<"lesson" | "extended">("lesson");
  const [examplesText, setExamplesText] = useState("60");
  const [exponent, setExponent] = useState(1);
  const [extraText, setExtraText] = useState("");
  const [extraPrior, setExtraPrior] = useState(0);
  const [showSynthetic, setShowSynthetic] = useState(false);
  const examples = useMemo(() => parseNumbers(examplesText), [examplesText]);
  const hypotheses = useMemo(() => {
    const base = space === "lesson" ? lessonHypotheses() : extendedHypotheses();
    const members = parseNumbers(extraText);
    return members.length && extraPrior > 0
      ? withExtraHypothesis(base, { id: "unnatural", label: `unnatural set {${members.join(", ")}}`, members, priorMass: extraPrior })
      : base;
  }, [space, extraText, extraPrior]);
  const rows = useMemo(() => posterior(hypotheses, examples, { sizeExponent: exponent }), [hypotheses, examples, exponent]);
  const profile = useMemo(() => generalisationProfile(hypotheses, examples, { sizeExponent: exponent }), [hypotheses, examples, exponent]);
  const synthetic = useMemo(() => {
    const rng = mulberry32(17);
    return profile.map((p) => ({ y: p.y, p: Math.max(0, Math.min(1, 0.85 * p.p + 0.05 + 0.08 * rng.normal())) }));
  }, [profile]);
  const consistent = rows.filter((r) => r.likelihood > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="bc-space" className="text-sm font-medium text-ink">
            Hypothesis space
          </label>
          <select
            id="bc-space"
            value={space}
            onChange={(e) => setSpace(e.target.value as "lesson" | "extended")}
            className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
          >
            <option value="lesson">Lesson: even, multiples of 10, powers of two, 50–60</option>
            <option value="extended">Extended: parity, multiples, powers, squares, intervals</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="bc-examples" className="text-sm font-medium text-ink">
            Examples X (1–100)
          </label>
          <input
            id="bc-examples"
            value={examplesText}
            onChange={(e) => setExamplesText(e.target.value)}
            className="w-56 rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
          />
        </div>
        <NumberField
          id="bc-exponent"
          label="Size-principle exponent"
          value={exponent}
          onChange={setExponent}
          min={0}
          max={2}
          step={0.25}
          hint="1 is |h|⁻ⁿ; 0 removes the size principle."
        />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="bc-extra" className="text-sm font-medium text-ink">
            Unnatural hypothesis (members)
          </label>
          <input
            id="bc-extra"
            value={extraText}
            onChange={(e) => setExtraText(e.target.value)}
            placeholder="e.g. 60, 80, 10, 30, 7"
            className="w-56 rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
          />
        </div>
        <NumberField id="bc-extra-prior" label="Its prior mass" value={extraPrior} onChange={setExtraPrior} min={0} max={0.9} step={0.01} />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={showSynthetic} onChange={(e) => setShowSynthetic(e.target.checked)} /> Show the synthetic
          comparison profile
        </label>
      </div>
      <Plot
        title={`Generalisation P(y ∈ C | X = {${examples.join(", ")}})`}
        xLabel="y"
        yLabel="probability"
        xDomain={[0, 101]}
        yDomain={[0, 1]}
        series={[
          { label: "model", points: profile.map((p) => ({ x: p.y, y: p.p })), kind: "bars" },
          ...(showSynthetic
            ? [
                {
                  label: "synthetic comparison profile (not human data)",
                  points: synthetic.map((p) => ({ x: p.y, y: p.p })),
                  kind: "points" as const,
                  color: "var(--rust)",
                },
              ]
            : []),
        ]}
      />
      <table className="w-full max-w-2xl text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
          <tr>
            <th className="py-1 pr-3">Hypothesis</th>
            <th className="py-1 pr-3">|h|</th>
            <th className="py-1 pr-3">prior</th>
            <th className="py-1 pr-3">likelihood</th>
            <th className="py-1">posterior</th>
          </tr>
        </thead>
        <tbody>
          {(consistent.length ? consistent : rows).map((r) => (
            <tr key={r.hypothesis.id} className="border-t border-stone">
              <td className="py-1 pr-3 text-ink">{r.hypothesis.label}</td>
              <td className="py-1 pr-3 font-mono text-ink-2">{r.hypothesis.members.size}</td>
              <td className="py-1 pr-3 font-mono text-ink-2">{r.hypothesis.prior.toFixed(4)}</td>
              <td className="py-1 pr-3 font-mono text-ink-2">{r.likelihood.toExponential(3)}</td>
              <td className="py-1 font-mono text-ink">{r.posterior.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {consistent.length === 0 && examples.length ? (
        <Badge tone="rust">No hypothesis contains every example: the posterior is undefined under strong sampling.</Badge>
      ) : null}
      <LabNote>
        The comparison profile is generated from the model with seeded noise so the plot has something to compare against; it is synthetic
        and is not a measurement of anyone. The lecture's human data are not reproduced here. Strong sampling and a uniform prior over the
        listed hypotheses are assumptions you should name in your report.
      </LabNote>
    </div>
  );
}
