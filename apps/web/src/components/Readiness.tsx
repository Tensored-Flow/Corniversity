import { Badge } from "./ui";

const LABELS: Record<string, { label: string; tone: "neutral" | "brass" | "moss" | "rust" | "slate"; help: string }> = {
  proposed: {
    label: "Proposed",
    tone: "neutral",
    help: "A course concept. No sources verified and no teaching prepared.",
  },
  source_verified: {
    label: "Source verified",
    tone: "slate",
    help: "A viable source spine and entry requirements have been checked. No syllabus yet.",
  },
  syllabus_ready: {
    label: "Syllabus ready",
    tone: "brass",
    help: "Complete sequence, outcomes, readings and assessment design mapped. Units still being prepared.",
  },
  teaching_ready: {
    label: "Teaching ready",
    tone: "moss",
    help: "Prepared teaching units with exercises and checks exist. See the unit list for how many.",
  },
  resource_blocked: {
    label: "Resource needed",
    tone: "rust",
    help: "Specific material is still needed; a request or an alternative is shown on the course page.",
  },
};

export function ReadinessBadge({ readiness }: { readiness: string }) {
  const meta = LABELS[readiness] ?? LABELS.proposed!;
  return (
    <Badge tone={meta.tone} title={meta.help}>
      {meta.label}
    </Badge>
  );
}

export function readinessHelp(readiness: string): string {
  return (LABELS[readiness] ?? LABELS.proposed!).help;
}

const UNIT_LABELS: Record<string, { label: string; tone: "neutral" | "brass" | "moss" | "rust" }> = {
  draft: { label: "Outline", tone: "neutral" },
  checking: { label: "In review", tone: "brass" },
  ready: { label: "Prepared", tone: "moss" },
  blocked: { label: "Blocked", tone: "rust" },
};

export function UnitStatusBadge({ status }: { status: string }) {
  const meta = UNIT_LABELS[status] ?? UNIT_LABELS.draft!;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
