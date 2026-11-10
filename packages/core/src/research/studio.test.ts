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
const written = (kind: keyof typeof PROJECT_KIND_INFO) =>
  PROJECT_KIND_INFO[kind].proposalHeadings.map((h) => `## ${h}\n\nA sentence about ${h.toLowerCase()}.\n`).join("\n");

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
    const checks = checkProposal(base({ proposal: written("computational") }));
    expect(checks.filter((c) => c.status !== "met")).toEqual([]);
  });

  it("do not count an untouched template as written: each empty section is named and limits are advised", () => {
    const checks = checkProposal(base());
    expect(checks.find((c) => c.id === "headings")).toMatchObject({
      status: "not_met",
      message:
        "Write something under: Question, Observations to explain, Models and their assumptions, Predictions before running, Evaluation design, Limits.",
    });
    expect(status(checks, "limits")).toBe("advice");
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

  it("refuse a plan to collect new data from people, quoting the sentence", () => {
    for (const plan of [
      "We will recruit 30 students.",
      "I plan to survey participants online.",
      "Collect data from volunteers in two sessions.",
      "- Recruit 30 students for two sessions.",
      "Participants will be recruited online.",
      "Data will be collected from 40 volunteers.",
      "We are going to run an experiment with 12 undergraduate students.",
      "Run an online experiment on Prolific with 50 people.",
      "Ask twenty classmates to rate the stimuli.",
      "Gather new responses from volunteers next week.",
      "Responses will be collected from 30 students.",
    ]) {
      const check = checkProposal(base({ methods: plan })).find((c) => c.id === "no-new-participant-data");
      expect(check?.status, plan).toBe("not_met");
      expect(check?.message).toContain(plan.replace(/^- /, ""));
    }
  });

  it("do not mistake the analysis of existing data about people for collecting it", () => {
    for (const text of [
      "Re-analyse the published open dataset.",
      "We will not recruit anyone; we re-analyse the published open dataset.",
      "Without recruiting anyone, I re-analyse the open data.",
      "Rather than running a study with participants, I re-analyse the published trials.",
      "The original recruitment criteria excluded left-handed participants.",
      "Hedge et al. recruited 47 participants; I use their open data.",
      "The dataset's authors collect data from volunteers across 160 experiments.",
      "No new participants will be recruited.",
      "No data will be collected from people.",
      "I will survey the literature on model recovery.",
      "Re-analyse the published Psych-101 transcripts; the original recruitment was online.",
      "Re-analyse the open data from 2,000 survey respondents (Smith 2020, CC BY).",
      "The original authors were recruiting participants on Prolific; we use their released trial data only.",
    ]) {
      expect(status(checkProposal(base({ methods: text })), "no-new-participant-data"), text).toBe("met");
    }
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

  it("accepts an existing dataset about people used as its licence permits, and nothing new from people", () => {
    const people = {
      kind: "existing_dataset" as const,
      title: "Flanker task trials",
      origin: "Open data deposited with Hedge et al. (2018)",
      versionOrDate: "retrieved 2026-11-09",
      licence: "CC BY 4.0",
      humanParticipants: "existing_published" as const,
      seed: null,
      generator: null,
    };
    expect(validateProvenance(people)).toEqual([]);
    expect(validateProvenance({ ...people, licence: "" })).toEqual(["Record its licence or terms of use."]);
    const replication = checkProposal(
      base({
        kind: "replication",
        proposal: proposalTemplate("replication"),
        methods: "Re-run the published analysis.",
        provenance: [people],
      }),
    );
    expect(status(replication, "provenance")).toBe("met");
    expect(status(replication, "no-new-participant-data")).toBe("met");
    expect(validateProvenance({ ...simulation, humanParticipants: "existing_published" })).toContain(
      "Data about people can only come from an existing dataset whose licence or terms permit the analysis.",
    );
    expect(validateProvenance({ ...people, humanParticipants: "new_from_people" })).toContain(
      "The studio does not take new data from people.",
    );
    expect(validateProvenance({ ...people, licence: "none" })).toEqual([
      "Data about people needs a licence or terms that permit this analysis; record them.",
    ]);
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
      feedback: [
        { version: 2, document: "proposal", outcome: "scripted", met: 6, total: 6 },
        { version: 3, document: "proposal", outcome: "failed", met: 6, total: 6 },
        { version: 4, document: "proposal", outcome: "blocked", met: 6, total: 6 },
      ],
      generatedAt: "2026-11-09T12:00:00.000Z",
    });

  it("carries the provenance, artefacts, sources and feedback with the question", () => {
    const text = report("## The question\n\nIt is answered below.");
    expect(text).toContain("**Synthetic bandit sessions** (simulation): choice-model-loop laboratory, informative case; seed 7");
    expect(text).toContain("- Confusion matrix, seeds 1–5 (figure)");
    expect(text).toContain("- Ten simple rules: https://example.org/ten-rules");
    expect(text).toContain("no model read it (scripted demo)");
    expect(text).toContain(
      "proposal version 3: 6 of 6 structural checks met; a live model was asked, but the run failed and gave no feedback.",
    );
    expect(text).toContain("proposal version 4: 6 of 6 structural checks met; the live model was blocked, so no model read it.");
    expect(text).not.toContain("written feedback from a live model");
  });

  it("says plainly when the report is not written yet, rather than inventing one", () => {
    expect(report(null)).toContain("*The report has not been written yet; its headings are:*");
  });
});
