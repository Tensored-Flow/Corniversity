import { LAB_META, type LabId } from "@corniversity/core/labs/index";
import { Badge, Card, Notice } from "@/components/ui";
import { BayesianConceptLab } from "./BayesianConceptLab";
import { DataLeakageLab } from "./DataLeakageLab";
import { GradientDescentLab } from "./GradientDescentLab";
import { KineticsLab } from "./KineticsLab";
import { NormComparisonLab } from "./NormComparisonLab";
import { SphereMetricLab } from "./SphereMetricLab";
import { TuningFitLab } from "./TuningFitLab";

/**
 * Chooses the laboratory a unit activity names. Each lab is audited application code running
 * in the browser; no learner code is executed and no model is consulted. Unknown ids render an
 * honest notice rather than a placeholder that looks like a lab.
 */
export function LabPanel({ labId, revealFormulas }: { labId: string; revealFormulas: boolean }) {
  const meta = (LAB_META as Record<string, (typeof LAB_META)[LabId] | undefined>)[labId];
  if (!meta) {
    return (
      <Card>
        <Notice tone="neutral" title="Laboratory not available">
          This activity refers to a laboratory ({labId}) that is not implemented in this version. The instructions and exercise remain; the
          simulation itself is missing and nothing is generated in its place.
        </Notice>
      </Card>
    );
  }
  return (
    <Card as="section" aria-labelledby="lab-heading">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="lab-heading" className="text-lg text-ink">
          {meta.title}
        </h2>
        <Badge tone="brass">laboratory</Badge>
        {meta.synthetic ? <Badge tone="slate">synthetic data</Badge> : <Badge tone="neutral">exact model</Badge>}
      </div>
      <p className="mt-1 text-sm text-ink-2">{meta.scope}</p>
      <div className="mt-4">
        {labId === "norm-comparison" ? <NormComparisonLab revealFormulas={revealFormulas} /> : null}
        {labId === "sphere-metric" ? <SphereMetricLab revealFormulas={revealFormulas} /> : null}
        {labId === "kinetics-reversible-first-order" ? <KineticsLab /> : null}
        {labId === "gradient-descent-surface" ? <GradientDescentLab /> : null}
        {labId === "bayesian-concept-learning" ? <BayesianConceptLab /> : null}
        {labId === "neural-tuning-fit" ? <TuningFitLab /> : null}
        {labId === "data-leakage-audit" ? <DataLeakageLab /> : null}
      </div>
    </Card>
  );
}
