/**
 * The research studio's rules, kept pure so they can be tested: the kinds of project it
 * supports, the headings a proposal and a report use, the structural checks it can make without
 * any model, and how a project's provenance must be recorded. The studio never collects data from
 * people, recruits, contacts anyone, publishes, or imports private data: projects work from
 * published or open materials, simulations and the learner's own reasoning.
 */

export const PROJECT_KINDS = ["conceptual", "mathematical", "computational", "replication", "critical_review"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

export interface ProjectKindInfo {
  label: string;
  description: string;
  proposalHeadings: string[];
  /** Whether the work rests on data or a simulation whose provenance must be recorded. */
  needsProvenance: boolean;
  /** Verified sources the focused shelf needs before the proposal counts as complete. */
  minSources: number;
}

export const PROJECT_KIND_INFO: Record<ProjectKind, ProjectKindInfo> = {
  conceptual: {
    label: "Conceptual analysis",
    description: "Clarify a concept or an argument, the positions on it, and what would bear on it.",
    proposalHeadings: ["Question", "Why it matters", "Positions and their assumptions", "What would count as evidence", "Limits"],
    needsProvenance: false,
    minSources: 1,
  },
  mathematical: {
    label: "Mathematical investigation",
    description: "State a conjecture about a model and prove it, disprove it, or find where it holds.",
    proposalHeadings: ["Question", "Definitions and assumptions", "Conjecture", "Planned approach", "Limits"],
    needsProvenance: false,
    minSources: 1,
  },
  computational: {
    label: "Computational modelling",
    description: "Build and check a model with a simulation or an existing open dataset.",
    proposalHeadings: [
      "Question",
      "Observations to explain",
      "Models and their assumptions",
      "Predictions before running",
      "Evaluation design",
      "Limits",
    ],
    needsProvenance: true,
    minSources: 1,
  },
  replication: {
    label: "Replication or re-analysis",
    description: "Re-run a published analysis on its open materials and compare what you find.",
    proposalHeadings: ["Question", "The original claim", "Analysis plan", "What would count as a successful replication", "Limits"],
    needsProvenance: true,
    minSources: 1,
  },
  critical_review: {
    label: "Critical review",
    description: "Assess what a body of published work establishes, and what it does not.",
    proposalHeadings: ["Question", "Scope of the review", "Claims examined", "Competing explanations", "Limits"],
    needsProvenance: false,
    minSources: 2,
  },
};

/**
 * The report keeps apart what the curriculum asks every piece of modelling to keep apart: the
 * question, what was observed, what was assumed, what the models predicted, the competing
 * explanations, the information available, what the evidence establishes, what remains
 * unsupported, how to reproduce it, and how uncertain it is.
 */
export const REPORT_HEADINGS = [
  "The question",
  "Observations",
  "Assumptions",
  "Model predictions",
  "Competing explanations",
  "Available information",
  "What the evidence establishes",
  "What remains unsupported",
  "Reproducibility",
  "Uncertainty",
] as const;

export function proposalTemplate(kind: ProjectKind): string {
  return PROJECT_KIND_INFO[kind].proposalHeadings.map((h) => `## ${h}\n\n`).join("");
}

export function reportTemplate(): string {
  return REPORT_HEADINGS.map((h) => `## ${h}\n\n`).join("");
}

export const PROVENANCE_KINDS = ["existing_dataset", "simulation", "derived", "literature"] as const;
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export interface ProvenanceInput {
  kind: ProvenanceKind;
  title: string;
  /** A URL or citation for existing material; for a simulation, the laboratory or code that ran it. */
  origin: string;
  versionOrDate: string;
  licence: string;
  /** Only "none" or a dataset already published; the studio never collects data from people. */
  humanParticipants: "none" | "existing_published";
  seed?: string | null;
  generator?: string | null;
}

/** What is missing from a provenance record, as messages; empty when it is complete. */
export function validateProvenance(p: ProvenanceInput): string[] {
  const errors: string[] = [];
  if (p.title.trim().length < 3) errors.push("Give it a title.");
  if (p.origin.trim().length < 3) errors.push("Say where it comes from: a URL or a citation, or for a simulation what ran it.");
  if (p.kind === "existing_dataset" || p.kind === "literature") {
    if (!p.versionOrDate.trim()) errors.push("Record the version or the date it was retrieved.");
    if (!p.licence.trim()) errors.push("Record its licence or terms of use.");
  }
  if (p.kind === "simulation") {
    if (!p.seed?.trim()) errors.push("Record the random seed, so the run can be repeated.");
    if (!p.generator?.trim()) errors.push("Record what generated it and with which settings.");
  }
  if (p.humanParticipants !== "none" && p.humanParticipants !== "existing_published") {
    errors.push("The studio does not take new data from people.");
  }
  if (p.humanParticipants === "existing_published" && p.kind !== "existing_dataset") {
    errors.push("Data about people can only come from a dataset that is already published.");
  }
  return errors;
}

export interface StudioCheck {
  id: string;
  status: "met" | "not_met" | "advice";
  message: string;
}

export interface ProposalCheckInput {
  kind: ProjectKind;
  question: string;
  proposal: string;
  methods: string;
  sourceCount: number;
  provenance: ProvenanceInput[];
}

const NEW_DATA_FROM_PEOPLE =
  /\b(recruit(?:ing|ment)?|survey(?:ing)? (?:participants|people|respondents|students)|interview(?:ing)? (?:participants|people)|collect(?:ing)? (?:new )?data from (?:participants|people|subjects|volunteers)|run(?:ning)? (?:an|a|my|our) (?:experiment|study) (?:with|on) (?:participants|people|subjects|volunteers))\b/i;

const hasHeading = (text: string, heading: string) =>
  new RegExp(`^#{1,6}\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "im").test(text);

/**
 * Structural checks of a proposal: honest feedback that needs no model. They say whether the
 * parts a proposal of this kind needs are present, never whether its reasoning is right.
 */
export function checkProposal(input: ProposalCheckInput): StudioCheck[] {
  const info = PROJECT_KIND_INFO[input.kind];
  const checks: StudioCheck[] = [];
  const question = input.question.trim();
  checks.push(
    question.endsWith("?") && question.split(/\s+/).length >= 6
      ? { id: "question", status: "met", message: "The question is stated as a question." }
      : {
          id: "question",
          status: "not_met",
          message: "State the question as a question, specific enough to be answered (six words or more, ending in a question mark).",
        },
  );
  const missing = info.proposalHeadings.filter((h) => !hasHeading(input.proposal, h));
  checks.push(
    missing.length === 0
      ? { id: "headings", status: "met", message: `Every heading a ${info.label.toLowerCase()} proposal needs is present.` }
      : { id: "headings", status: "not_met", message: `Missing sections: ${missing.join(", ")}.` },
  );
  checks.push(
    input.sourceCount >= info.minSources
      ? {
          id: "sources",
          status: "met",
          message: `${input.sourceCount} verified source${input.sourceCount === 1 ? "" : "s"} on the focused shelf.`,
        }
      : {
          id: "sources",
          status: "not_met",
          message: `Put at least ${info.minSources} verified source${info.minSources === 1 ? "" : "s"} on the focused shelf (leads do not count; they go to the library's list).`,
        },
  );
  if (info.needsProvenance) {
    const incomplete = input.provenance.filter((p) => validateProvenance(p).length > 0);
    checks.push(
      input.provenance.length === 0
        ? { id: "provenance", status: "not_met", message: "Record where the data or the simulation comes from before the work starts." }
        : incomplete.length
          ? {
              id: "provenance",
              status: "not_met",
              message: `Complete the provenance of: ${incomplete.map((p) => p.title || "an untitled record").join(", ")}.`,
            }
          : { id: "provenance", status: "met", message: "Every dataset and simulation has its provenance recorded." },
    );
  }
  checks.push(
    NEW_DATA_FROM_PEOPLE.test(`${input.proposal}\n${input.methods}`)
      ? {
          id: "no-new-participant-data",
          status: "not_met",
          message:
            "The studio does not support collecting new data from people. Use an existing published dataset, a simulation, or the published record.",
        }
      : { id: "no-new-participant-data", status: "met", message: "No new data is to be collected from people." },
  );
  checks.push(
    /what remains unsupported|limits/i.test(input.proposal)
      ? { id: "limits", status: "met", message: "The proposal says where its claims would stop." }
      : { id: "limits", status: "advice", message: "Say in advance what the work could not establish, even if it succeeds." },
  );
  return checks;
}

export interface ReportInput {
  title: string;
  kind: ProjectKind;
  question: string;
  body: string | null;
  provenance: (ProvenanceInput & { id?: string })[];
  artifacts: { title: string; kind: string }[];
  sources: { title: string; url: string }[];
  feedback: { version: number; document: string; mode: "scripted" | "live"; met: number; total: number }[];
  generatedAt: string;
}

/** The report as a portable Markdown document, assembled from the project's own records. */
export function assembleReport(r: ReportInput): string {
  const lines: string[] = [
    `# ${r.title}`,
    "",
    `*${PROJECT_KIND_INFO[r.kind].label} · Corniversity research studio · ${r.generatedAt.slice(0, 10)}*`,
    "",
    `**Question.** ${r.question}`,
    "",
    r.body?.trim() ? r.body.trim() : `*The report has not been written yet; its headings are:*\n\n${reportTemplate()}`,
    "",
    "## Data and simulations",
    "",
  ];
  if (r.provenance.length === 0) lines.push("None recorded.");
  for (const p of r.provenance) {
    const detail = [
      p.origin,
      p.versionOrDate && `version or date: ${p.versionOrDate}`,
      p.licence && `licence: ${p.licence}`,
      p.seed && `seed ${p.seed}`,
      p.generator && `generated by ${p.generator}`,
      p.humanParticipants === "existing_published" ? "an existing published dataset about people" : "no data about people",
    ]
      .filter(Boolean)
      .join("; ");
    lines.push(`- **${p.title}** (${p.kind.replace("_", " ")}): ${detail}.`);
  }
  lines.push("", "## Intermediate artefacts", "");
  if (r.artifacts.length === 0) lines.push("None attached.");
  for (const a of r.artifacts) lines.push(`- ${a.title} (${a.kind})`);
  lines.push("", "## Sources (verified records)", "");
  if (r.sources.length === 0) lines.push("None on the shelf.");
  for (const s of r.sources) lines.push(`- ${s.title}: ${s.url}`);
  lines.push("", "## Feedback received", "");
  if (r.feedback.length === 0) lines.push("None requested.");
  for (const f of r.feedback) {
    lines.push(
      `- ${f.document} version ${f.version}: ${f.met} of ${f.total} structural checks met; ${f.mode === "live" ? "written feedback from a live model" : "no model read it (scripted demo)"}.`,
    );
  }
  lines.push(
    "",
    "---",
    "",
    "Produced in the Corniversity research studio. Nothing in it was collected from people; synthetic data are labelled as such.",
  );
  return lines.join("\n");
}
