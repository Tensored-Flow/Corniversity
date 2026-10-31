"use client";
import { integrate, l1NormXn, l2NormXn, pNorm, sampleXn, supNormXn } from "@corniversity/core/labs/index";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { LabNote, NumberField, Plot } from "./Plot";

/**
 * Two norms on C([0,1]) with f_n(x) = x^n. Before the learner's attempt is accepted the lab
 * shows the graphs and checks the learner's own values against a numerical integral without
 * printing the closed forms; afterwards it shows the exact values and the ratio.
 */
export function NormComparisonLab({ revealFormulas }: { revealFormulas: boolean }) {
  const [n, setN] = useState(5);
  const [supGuess, setSupGuess] = useState<number>(Number.NaN);
  const [l1Guess, setL1Guess] = useState<number>(Number.NaN);
  const nn = Math.max(1, Math.min(80, Math.round(n || 1)));
  const curves = useMemo(() => [1, 2, 5, 10, nn].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b), [nn]);
  const numericL1 = useMemo(() => integrate((x) => x ** nn, 0, 1, 2000), [nn]);
  const numericSup = useMemo(() => pNorm((x) => x ** nn, Number.POSITIVE_INFINITY), [nn]);
  const closeTo = (guess: number, value: number) =>
    Number.isFinite(guess) && Math.abs(guess - value) <= Math.max(1e-6, 0.01 * Math.abs(value));

  return (
    <div className="flex flex-col gap-4">
      <Plot
        title="f_n(x) = x^n on [0,1]"
        xLabel="x"
        yLabel="x^n"
        xDomain={[0, 1]}
        yDomain={[0, 1]}
        series={curves.map((k) => ({ label: `n = ${k}`, points: sampleXn(k, 200) }))}
      />
      <div className="flex flex-wrap items-end gap-4">
        <NumberField id="norm-n" label="n" value={n} onChange={setN} min={1} max={80} hint="The highlighted curve." />
        <NumberField id="norm-sup" label="Your value of ‖f_n‖∞" value={supGuess} onChange={setSupGuess} step={0.001} />
        <NumberField id="norm-l1" label="Your value of ‖f_n‖₁" value={l1Guess} onChange={setL1Guess} step={0.0001} />
      </div>
      <table className="w-full max-w-xl text-sm">
        <tbody>
          <tr className="border-t border-stone">
            <th className="py-1 pr-3 text-left font-medium text-ink">Numerical sup on a 2000-point grid</th>
            <td className="py-1 font-mono text-ink">{numericSup.toFixed(6)}</td>
            <td className="py-1 pl-3">
              {Number.isFinite(supGuess) ? (
                <Badge tone={closeTo(supGuess, numericSup) ? "moss" : "rust"}>
                  {closeTo(supGuess, numericSup) ? "matches" : "differs"}
                </Badge>
              ) : null}
            </td>
          </tr>
          <tr className="border-t border-stone">
            <th className="py-1 pr-3 text-left font-medium text-ink">Numerical ∫₀¹ x^n dx (Simpson, 2000 steps)</th>
            <td className="py-1 font-mono text-ink">{numericL1.toFixed(6)}</td>
            <td className="py-1 pl-3">
              {Number.isFinite(l1Guess) ? (
                <Badge tone={closeTo(l1Guess, numericL1) ? "moss" : "rust"}>{closeTo(l1Guess, numericL1) ? "matches" : "differs"}</Badge>
              ) : null}
            </td>
          </tr>
          {revealFormulas ? (
            <>
              <tr className="border-t border-stone">
                <th className="py-1 pr-3 text-left font-medium text-ink">Exact values</th>
                <td className="py-1 font-mono text-ink" colSpan={2}>
                  ‖f_n‖∞ = {supNormXn(nn)} · ‖f_n‖₁ = 1/(n+1) = {l1NormXn(nn).toFixed(6)} · ‖f_n‖₂ = 1/√(2n+1) = {l2NormXn(nn).toFixed(6)}
                </td>
              </tr>
              <tr className="border-t border-stone">
                <th className="py-1 pr-3 text-left font-medium text-ink">‖f_n‖∞ / ‖f_n‖₁</th>
                <td className="py-1 font-mono text-ink" colSpan={2}>
                  {(supNormXn(nn) / l1NormXn(nn)).toFixed(2)} (= n + 1): no single constant C gives ‖f‖∞ ≤ C‖f‖₁ for every n.
                </td>
              </tr>
            </>
          ) : null}
        </tbody>
      </table>
      <LabNote>
        {revealFormulas
          ? "Exact values are shown because your attempt at the tutorial task has been assessed. The numerical columns use a finite grid and Simpson's rule; they agree with the exact values to the digits shown and are not a proof."
          : "The exact values stay hidden until your attempt at the tutorial task is assessed; use the numerical columns to check your own calculation. A grid supremum and a quadrature are approximations, not a proof: your argument must stand on its own."}
      </LabNote>
    </div>
  );
}
