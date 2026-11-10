import { type PlotSpec, plotGeometry } from "@corniversity/core/visuals/visual";

const STROKES = ["var(--brass)", "var(--slate)", "var(--moss)", "var(--rust)"];
/** Each series also differs by dash pattern, so the plot reads without colour. */
const DASHES = [undefined, "7 4", "2 3", "10 3 2 3"];

/**
 * A plot drawn from the same deterministic samples its numerical checks use. The description is
 * the plot's text equivalent; the legend names each line by its dash as well as its colour.
 */
export function PlotSvg({ plot, description, idPrefix }: { plot: PlotSpec; description: string; idPrefix: string }) {
  const g = plotGeometry(plot);
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;
  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${g.width} ${g.height}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        className="h-auto w-full max-w-[560px] text-ink-2"
      >
        <title id={titleId}>{g.series.map((s) => s.label).join(", ")}</title>
        <desc id={descId}>{description}</desc>
        {g.area ? <path d={g.area} fill="var(--brass-soft)" stroke="none" /> : null}
        {g.yTicks.map((t) => (
          <g key={`y${t.label}`}>
            <line x1={g.frame.left} x2={g.frame.right} y1={t.y} y2={t.y} stroke="var(--stone)" strokeWidth={1} />
            <text x={g.frame.left - 8} y={t.y + 4} textAnchor="end" fontSize={12} fill="currentColor">
              {t.label}
            </text>
          </g>
        ))}
        {g.xTicks.map((t) => (
          <text key={`x${t.label}`} x={t.x} y={g.frame.bottom + 18} textAnchor="middle" fontSize={12} fill="currentColor">
            {t.label}
          </text>
        ))}
        <line x1={g.frame.left} x2={g.frame.right} y1={g.frame.bottom} y2={g.frame.bottom} stroke="var(--ink-3)" />
        <line x1={g.frame.left} x2={g.frame.left} y1={g.frame.top} y2={g.frame.bottom} stroke="var(--ink-3)" />
        {g.guides.map((guide) => (
          <g key={guide.label}>
            <line x1={g.frame.left} x2={g.frame.right} y1={guide.y} y2={guide.y} stroke="var(--rust)" strokeDasharray="4 4" />
            <text x={g.frame.right} y={guide.y - 6} textAnchor="end" fontSize={12} fill="var(--rust)">
              {guide.label}
            </text>
          </g>
        ))}
        {g.series.map((s, i) => (
          <path
            key={s.label}
            d={s.d}
            fill="none"
            stroke={STROKES[i % STROKES.length]}
            strokeDasharray={DASHES[i % DASHES.length]}
            strokeWidth={2.25}
            className="plot-line"
          />
        ))}
        <text x={(g.frame.left + g.frame.right) / 2} y={g.height - 6} textAnchor="middle" fontSize={13} fill="currentColor">
          {g.xLabel}
        </text>
        <text
          x={14}
          y={(g.frame.top + g.frame.bottom) / 2}
          textAnchor="middle"
          fontSize={13}
          fill="currentColor"
          transform={`rotate(-90 14 ${(g.frame.top + g.frame.bottom) / 2})`}
        >
          {g.yLabel}
        </text>
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {g.series.map((s, i) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <svg width="28" height="8" aria-hidden="true">
              <line
                x1="0"
                x2="28"
                y1="4"
                y2="4"
                stroke={STROKES[i % STROKES.length]}
                strokeDasharray={DASHES[i % DASHES.length]}
                strokeWidth="2.25"
              />
            </svg>
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
