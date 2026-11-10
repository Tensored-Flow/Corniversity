/**
 * The research studio's rules, kept pure so they can be tested: the kinds of project it
 * supports, the headings a proposal and a report use, the structural checks it can make without
 * any model, and how a project's provenance must be recorded. The studio never recruits anyone,
 * collects new data from people, contacts anyone, publishes, or imports private data. Projects work
 * from simulations, published or open materials, existing datasets used as their licence or terms
 * permit (data about people included) and the learner's own reasoning.
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
  /**
   * "none"; an existing dataset about people used as its licence or terms permit (stored as
   * "existing_published", its first name); or data the learner collected from people themselves,
   * which can be stated so that it is not filed as "none", and which the studio refuses.
   */
  humanParticipants: "none" | "existing_published" | "new_from_people";
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
  if (
    p.humanParticipants === "existing_published" &&
    /^(?:none|no licen[cs]e|unknown|not stated|n\/?a|all rights reserved)\.?$/i.test(p.licence.trim())
  ) {
    errors.push("Data about people needs a licence or terms that permit this analysis; record them.");
  }
  if (p.humanParticipants === "existing_published" && p.kind !== "existing_dataset") {
    errors.push("Data about people can only come from an existing dataset whose licence or terms permit the analysis.");
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

/** People a plan could collect data from, with an optional count and common qualifiers. */
const COUNT = String.raw`(?:(?:\d[\d,]*|a\s+few|several|some|many|ten|eleven|twelve|fifteen|[a-z]+ty(?:-[a-z]+)?)\s+)?`;
const QUALIFIERS = String.raw`(?:(?:new|more|additional|further|local|online|undergraduate|adult)\s+)*`;
const GROUPS = String.raw`(?:participants|people|subjects|volunteers|students|respondents|children|adults|patients|classmates|friends)\b`;
const PEOPLE = `${COUNT}${QUALIFIERS}${GROUPS}`;
/** What is collected from people. */
const RESPONSES = "(?:data|responses|ratings|answers|judge?ments|measurements|recordings)";
/** Collecting from people, in the active voice. */
const COLLECT = String.raw`(?:recruit\b(?!\s+(?:no\s*one|nobody|anyone)\b)|(?:survey|interview|test)\s+${PEOPLE}|(?:ask|invite|pay)\s+${PEOPLE}\s+to\b|(?:collect|gather|obtain|record)\s+(?:new\s+)?${RESPONSES}\s+from\s+${PEOPLE}|(?:run|conduct)\s+(?:an?|my|our)\s+(?:own\s+)?(?:[\w-]+\s+){0,2}?(?:experiment|study|survey)\b(?:\s+[\w-]+){0,3}?\s+(?:with|on)\s+${PEOPLE})`;
const NOT_NEGATED = String.raw`(?<!\b(?:no|not\s+any)\s+${QUALIFIERS})`;

/**
 * The learner's own plan to collect from people, as opposed to a description of what other
 * researchers did or of what the learner will not do: a first-person intention ("we will recruit
 * 30 students"), a plan step that starts with the action ("Ask twenty classmates to rate…"), or
 * the passive future ("responses will be collected from volunteers") not preceded by "no".
 */
const PLAN_TO_COLLECT = [
  new RegExp(
    String.raw`\b(?:i|we)\s+(?:will|shall|plan\s+to|intend\s+to|aim\s+to|want\s+to|hope\s+to|am\s+going\s+to|are\s+going\s+to)\s+(?:also\s+|then\s+|first\s+)?${COLLECT}`,
    "i",
  ),
  new RegExp(`^${COLLECT}`, "i"),
  new RegExp(
    String.raw`${NOT_NEGATED}\b${COUNT}${QUALIFIERS}${GROUPS}\s+will\s+be\s+(?:recruited|surveyed|interviewed|tested|asked)\b`,
    "i",
  ),
  new RegExp(
    String.raw`${NOT_NEGATED}\b(?:new\s+)?${RESPONSES}\s+will\s+be\s+(?:collected|gathered|obtained|recorded)\s+from\s+${PEOPLE}`,
    "i",
  ),
];

/** The first sentence of `text` that plans to collect new data from people, or null. */
export function planToCollectFromPeople(text: string): string | null {
  for (const fragment of text.split(/(?<=[.!?;])\s+|\n+/)) {
    const sentence = fragment.replace(/^\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)/, "").trim();
    if (sentence && PLAN_TO_COLLECT.some((pattern) => pattern.test(sentence))) return sentence;
  }
  return null;
}

/** The text under each heading of a Markdown document, keyed by the heading in lower case. */
function sectionsOf(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  let heading: string | null = null;
  let lines: string[] = [];
  const close = () => {
    if (heading !== null)
      sections.set(
        heading,
        lines
          .join("\n")
          .replace(/<!--[\s\S]*?-->/g, "")
          .trim(),
      );
  };
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^#{1,6}\s*([^#\s].*?)\s*#*\s*$/.exec(line);
    if (match) {
      close();
      heading = match[1]!.toLowerCase();
      lines = [];
    } else {
      lines.push(line);
    }
  }
  close();
  return sections;
}

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
  // A section counts only when it has text under its heading: an untouched template is not a proposal.
  const written = sectionsOf(input.proposal);
  const missing = info.proposalHeadings.filter((h) => !written.has(h.toLowerCase()));
  const empty = info.proposalHeadings.filter((h) => written.get(h.toLowerCase()) === "");
  checks.push(
    missing.length > 0
      ? { id: "headings", status: "not_met", message: `Missing sections: ${missing.join(", ")}.` }
      : empty.length > 0
        ? { id: "headings", status: "not_met", message: `Write something under: ${empty.join(", ")}.` }
        : { id: "headings", status: "met", message: `Every section a ${info.label.toLowerCase()} proposal needs has text.` },
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
  const plan = planToCollectFromPeople(`${input.proposal}\n${input.methods}`);
  checks.push(
    plan
      ? {
          id: "no-new-participant-data",
          status: "not_met",
          message: `This reads as a plan to collect new data from people: “${plan.length > 160 ? `${plan.slice(0, 157)}…` : plan}” The studio does not support that. A project may analyse an existing dataset that its licence or terms permit, data about people included, or use a simulation or the published record.`,
        }
      : { id: "no-new-participant-data", status: "met", message: "No plan to collect new data from people was found." },
  );
  checks.push(
    (written.get("limits") ?? written.get("what remains unsupported") ?? "") !== ""
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
  /** What answered each request: the structural checks alone, a live model, a live run that failed, or a blocked model. */
  feedback: { version: number; document: string; outcome: "scripted" | "live" | "failed" | "blocked"; met: number; total: number }[];
  generatedAt: string;
}

const FEEDBACK_OUTCOME = {
  scripted: "no model read it (scripted demo)",
  live: "written feedback from a live model",
  failed: "a live model was asked, but the run failed and gave no feedback",
  blocked: "the live model was blocked, so no model read it",
} as const;

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
      p.humanParticipants === "existing_published"
        ? "an existing dataset about people, used as its licence or terms permit"
        : "no data about people",
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
    lines.push(`- ${f.document} version ${f.version}: ${f.met} of ${f.total} structural checks met; ${FEEDBACK_OUTCOME[f.outcome]}.`);
  }
  lines.push(
    "",
    "---",
    "",
    "Produced in the Corniversity research studio, which collects no data from people: data about people comes only from the existing datasets listed above, with their licence or terms, and synthetic data are labelled as such.",
  );
  return lines.join("\n");
}
