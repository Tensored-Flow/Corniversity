import { describe, expect, it } from "vitest";
import {
  assembleReport,
  checkProposal,
  PROJECT_KIND_INFO,
  PROJECT_KINDS,
  type ProposalCheckInput,
  proposalTemplate,
  REPORT_HEADINGS,
  reportTemplate,
  validateProvenance,
} from "./studio";

const simulation = {
  kind: "simulation" as const,
  title: "Synthetic bandit sessions",
  origin: "choice-model-loop laboratory, informative case",
  versionOrDate: "",
  licence: "",
  humanParticipants: "none" as const,
  seed: "7",
  generator: "Rescorla-Wagner, alpha 0.3, beta 4, 200 trials",
};
const base = (over: Partial<ProposalCheckInput> = {}): ProposalCheckInput => ({
  kind: "computational",
  question: "Does a forgetting term change which model is recovered in the ambiguous case?",
  proposal: proposalTemplate("computational"),
  methods: "Fit both models by maximum likelihood and run model recovery over five seeds.",
  sourceCount: 1,
  provenance: [simulation],
  ...over,
});
const status = (checks: ReturnType<typeof checkProposal>, id: string) => checks.find((c) => c.id === id)?.status;

describe("project kinds", () => {
  it("cover conceptual, mathematical, computational, replication and critical-review work", () => {
    expect(PROJECT_KINDS).toEqual(["conceptual", "mathematical", "computational", "replication", "critical_review"]);
    for (const kind of PROJECT_KINDS) expect(PROJECT_KIND_INFO[kind].proposalHeadings).toContain("Question");
  });

  it("ask for provenance only where the work rests on data or a simulation", () => {
    expect(PROJECT_KINDS.filter((k) => PROJECT_KIND_INFO[k].needsProvenance)).toEqual(["computational", "replication"]);
  });

  it("give the report the distinctions the curriculum keeps apart", () => {
    expect(reportTemplate()).toContain("## What the evidence establishes");
    expect(reportTemplate()).toContain("## What remains unsupported");
    expect(REPORT_HEADINGS).toHaveLength(10);
  });
});

describe("structural checks of a proposal", () => {
  it("pass a complete computational proposal", () => {
    const checks = checkProposal(base());
    expect(checks.filter((c) => c.status === "not_met")).toEqual([]);
  });

  it("ask for the question as a real question", () => {
    expect(status(checkProposal(base({ question: "Forgetting." })), "question")).toBe("not_met");
  });

  it("name the missing sections of the proposal's kind", () => {
    const checks = checkProposal(base({ proposal: "## Question\n\n## Limits\n" }));
    expect(checks.find((c) => c.id === "headings")?.message).toMatch(/Observations to explain, Models and their assumptions/);
  });

  it("count only verified sources; a critical review needs two", () => {
    expect(status(checkProposal(base({ sourceCount: 0 })), "sources")).toBe("not_met");
    expect(
      status(checkProposal(base({ kind: "critical_review", proposal: proposalTemplate("critical_review"), sourceCount: 1 })), "sources"),
    ).toBe("not_met");
  });

  it("require complete provenance for computational work, and none for conceptual work", () => {
    expect(status(checkProposal(base({ provenance: [] })), "provenance")).toBe("not_met");
    expect(status(checkProposal(base({ provenance: [{ ...simulation, seed: "" }] })), "provenance")).toBe("not_met");
    expect(
      status(checkProposal(base({ kind: "conceptual", proposal: proposalTemplate("conceptual"), provenance: [] })), "provenance"),
    ).toBeUndefined();
  });

  it("refuse a plan to collect new data from people", () => {
    for (const plan of [
      "We will recruit 30 students.",
      "I plan to survey participants online.",
      "Collect data from volunteers in two sessions.",
    ]) {
      expect(status(checkProposal(base({ methods: plan })), "no-new-participant-data")).toBe("not_met");
    }
    expect(status(checkProposal(base({ methods: "Re-analyse the published open dataset." })), "no-new-participant-data")).toBe("met");
  });
});

describe("provenance", () => {
  it("needs a seed and a generator for a simulation, and a version and licence for a dataset", () => {
    expect(validateProvenance(simulation)).toEqual([]);
    expect(validateProvenance({ ...simulation, seed: null, generator: "" })).toHaveLength(2);
    const dataset = { ...simulation, kind: "existing_dataset" as const, seed: null, generator: null, versionOrDate: "", licence: "" };
    expect(validateProvenance(dataset)).toEqual([
      "Record the version or the date it was retrieved.",
      "Record its licence or terms of use.",
    ]);
  });

  it("accepts data about people only as an already published dataset", () => {
    expect(validateProvenance({ ...simulation, humanParticipants: "existing_published" })).toContain(
      "Data about people can only come from a dataset that is already published.",
    );
    expect(validateProvenance({ ...simulation, humanParticipants: "new" as never })).toContain(
      "The studio does not take new data from people.",
    );
  });
});

describe("the assembled report", () => {
  const report = (body: string | null) =>
    assembleReport({
      title: "Forgetting in the ambiguous case",
      kind: "computational",
      question: base().question,
      body,
      provenance: [simulation],
      artifacts: [{ title: "Confusion matrix, seeds 1–5", kind: "figure" }],
      sources: [{ title: "Ten simple rules", url: "https://example.org/ten-rules" }],
      feedback: [{ version: 2, document: "proposal", mode: "scripted", met: 6, total: 6 }],
      generatedAt: "2026-11-09T12:00:00.000Z",
    });

  it("carries the provenance, artefacts, sources and feedback with the question", () => {
    const text = report("## The question\n\nIt is answered below.");
    expect(text).toContain("**Synthetic bandit sessions** (simulation): choice-model-loop laboratory, informative case; seed 7");
    expect(text).toContain("- Confusion matrix, seeds 1–5 (figure)");
    expect(text).toContain("- Ten simple rules: https://example.org/ten-rules");
    expect(text).toContain("no model read it (scripted demo)");
  });

  it("says plainly when the report is not written yet, rather than inventing one", () => {
    expect(report(null)).toContain("*The report has not been written yet; its headings are:*");
  });
});
