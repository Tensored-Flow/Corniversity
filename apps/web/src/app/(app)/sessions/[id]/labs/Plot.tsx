"use client";
import type { InformationContract } from "@corniversity/core/labs/index";
import { Fragment } from "react";

export interface Series {
  label: string;
  points: { x: number; y: number }[];
  color?: string; // a CSS colour, normally a design token such as var(--brass)
  kind?: "line" | "points" | "bars";
  dashed?: boolean;
}

interface Props {
  series: Series[];
  width?: number;
  height?: number;
  xLabel: string;
  yLabel: string;
  xDomain?: [number, number];
  yDomain?: [number, number];
  title?: string;
}

const PALETTE = ["var(--brass)", "var(--slate)", "var(--moss)", "var(--rust)", "var(--ink-3)"];

function ticks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) return [min];
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) out.push(Number(t.toFixed(10)));
  return out;
}

const format = (v: number) =>
  Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(1) : Number(v.toFixed(3)).toString();

const valueText = (v: number) => (Number.isFinite(v) ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : "n/a");

/**
 * A small dependency-free SVG chart for the laboratories. Static lines, points and bars with
 * labelled axes; colours come from the design tokens so it reads in both registers. It is a
 * figure, not an interactive widget: the controls live beside it, and every value it shows is
 * also listed under Values beneath it, for screen readers and for the learner's report.
 */
export function Plot({ series, width = 560, height = 300, xLabel, yLabel, xDomain, yDomain, title }: Props) {
  const margin = { top: 16, right: 16, bottom: 44, left: 56 };
  const all = series.flatMap((s) => s.points).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const [xMin, xMax] = xDomain ?? [Math.min(0, ...xs), Math.max(...xs, 1)];
  const [yMinRaw, yMaxRaw] = yDomain ?? [Math.min(0, ...ys), Math.max(...ys, 1e-9)];
  const yPad = (yMaxRaw - yMinRaw) * 0.05 || 1;
  const yMin = yDomain ? yMinRaw : yMinRaw - (yMinRaw < 0 ? yPad : 0);
  const yMax = yDomain ? yMaxRaw : yMaxRaw + yPad;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const sx = (x: number) => margin.left + ((x - xMin) / (xMax - xMin || 1)) * innerW;
  const sy = (y: number) => margin.top + innerH - ((y - yMin) / (yMax - yMin || 1)) * innerH;
  const xTicks = ticks(xMin, xMax);
  const yTicks = ticks(yMin, yMax);
  const zeroY = yMin <= 0 && yMax >= 0 ? sy(0) : sy(yMin);

  return (
    <figure className="w-full overflow-x-auto">
      {title ? <figcaption className="mb-1 text-xs text-ink-2">{title}</figcaption> : null}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title ?? "Chart"}: ${yLabel} against ${xLabel}`}
        className="h-auto w-full max-w-[640px] text-[10px]"
      >
        <rect x={margin.left} y={margin.top} width={innerW} height={innerH} fill="var(--paper-2)" stroke="var(--stone)" />
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={margin.left} x2={margin.left + innerW} y1={sy(t)} y2={sy(t)} stroke="var(--stone)" strokeDasharray="2 3" />
            <text x={margin.left - 6} y={sy(t) + 3} textAnchor="end" fill="var(--ink-3)">
              {format(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={margin.top + innerH} y2={margin.top + innerH + 4} stroke="var(--ink-3)" />
            <text x={sx(t)} y={margin.top + innerH + 14} textAnchor="middle" fill="var(--ink-3)">
              {format(t)}
            </text>
          </g>
        ))}
        <line x1={margin.left} x2={margin.left + innerW} y1={zeroY} y2={zeroY} stroke="var(--ink-3)" />
        <text x={margin.left + innerW / 2} y={height - 8} textAnchor="middle" fill="var(--ink-2)">
          {xLabel}
        </text>
        <text transform={`translate(12 ${margin.top + innerH / 2}) rotate(-90)`} textAnchor="middle" fill="var(--ink-2)">
          {yLabel}
        </text>
        {series.map((s, i) => {
          const color = s.color ?? PALETTE[i % PALETTE.length]!;
          const pts = s.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
          if (s.kind === "bars") {
            const w = Math.max(2, (innerW / Math.max(1, pts.length)) * 0.7);
            return (
              <g key={s.label}>
                {pts.map((p) => (
                  <rect
                    key={`${s.label}-${p.x}`}
                    x={sx(p.x) - w / 2}
                    y={Math.min(sy(p.y), zeroY)}
                    width={w}
                    height={Math.abs(zeroY - sy(p.y))}
                    fill={color}
                    opacity={0.75}
                  />
                ))}
              </g>
            );
          }
          if (s.kind === "points") {
            return (
              <g key={s.label}>
                {pts.map((p) => (
                  <circle key={`${s.label}-${p.x}-${p.y}`} cx={sx(p.x)} cy={sy(p.y)} r={3} fill={color} />
                ))}
              </g>
            );
          }
          const d = pts
            .map(
              (p, j) =>
                `${j === 0 ? "M" : "L"}${sx(p.x).toFixed(1)} ${Math.max(margin.top - 2, Math.min(margin.top + innerH + 2, sy(p.y))).toFixed(1)}`,
            )
            .join(" ");
          return <path key={s.label} d={d} fill="none" stroke={color} strokeWidth={1.8} strokeDasharray={s.dashed ? "6 4" : undefined} />;
        })}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-3 text-xs text-ink-2">
        {series.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-2 w-4"
              style={{ background: s.color ?? PALETTE[i % PALETTE.length], opacity: s.kind === "bars" ? 0.75 : 1 }}
            />
            {s.label}
          </li>
        ))}
      </ul>
      <details className="mt-1 text-xs text-ink-2">
        <summary className="cursor-pointer">Values</summary>
        <section
          className="mt-1 max-h-48 overflow-auto rounded-[var(--radius-control)] border border-stone"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the list scrolls and must be reachable by keyboard (axe: scrollable-region-focusable)
          tabIndex={0}
          aria-label={`Values: ${title ?? "chart"}`}
        >
          {series.map((s) => (
            <table key={s.label} className="w-full text-left">
              <caption className="px-2 pt-1 text-left text-ink-3">{s.label}</caption>
              <thead>
                <tr>
                  <th scope="col" className="px-2 py-0.5 font-medium">
                    {xLabel}
                  </th>
                  <th scope="col" className="px-2 py-0.5 font-medium">
                    {yLabel}
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {s.points.map((p, j) => (
                  <tr key={`${s.label}-${j}`} className="border-t border-stone">
                    <td className="px-2">{valueText(p.x)}</td>
                    <td className="px-2">{valueText(p.y)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </section>
      </details>
    </figure>
  );
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
      />
      {hint ? <span className="text-xs text-ink-3">{hint}</span> : null}
    </div>
  );
}

export function LabNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[var(--radius-panel)] border border-stone bg-paper-3/60 px-3 py-2 text-xs text-ink-2">{children}</p>;
}

/** A split's information contract, shown before any number it qualifies. */
export function ContractList({ contract }: { contract: InformationContract }) {
  const rows: [string, string][] = [
    ["Observed", contract.observed],
    ["Prediction target", contract.target],
    ["History in training", contract.historyInTraining],
    ["History at inference", contract.historyAtInference],
    ["Person", contract.person === "not_applicable" ? "not applicable" : contract.person],
    ["Task", contract.task],
    ["Later time periods", contract.laterPeriods ? "yes" : "no"],
    ["Unavailable in real use", contract.unavailableInRealUse],
    ["Simplest baseline", contract.baseline],
    ["Claims not tested", contract.untestedClaims],
  ];
  return (
    <dl className="grid gap-x-4 gap-y-1 rounded-[var(--radius-panel)] border border-stone bg-paper p-3 text-xs sm:grid-cols-[14rem_1fr]">
      {rows.map(([term, detail]) => (
        <Fragment key={term}>
          <dt className="font-medium text-ink">{term}</dt>
          <dd className="text-ink-2">{detail}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
