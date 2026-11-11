import { MODELLING_STANDARD } from "./supervisor";

export const ASSESSOR_PROMPT_VERSION = "assessor-1.2";

export interface AssessorPromptInput {
  institutionName: string;
  courseTitle: string;
  exerciseTitle: string;
  exercisePrompt: string;
  exerciseKind: string;
  rubricVersion: number;
  rubricCriteria: { id: string; criterion: string; weight: number; levels: { label: string; description: string }[] }[];
  acceptAlternateApproaches: boolean;
  referenceIsExhaustive: boolean;
  referenceReasoning: string | null;
  deterministicResults: { checkId: string; passed: boolean; detail: string }[];
  evidencePrompt: string;
  submissionNumbered: string;
  assistanceDisclosed: string;
}

export function buildAssessorSystemPrompt(input: AssessorPromptInput): string {
  const rubric = input.rubricCriteria
    .map(
      (c) =>
        `- ${c.id} (weight ${c.weight}): ${c.criterion}\n  levels: ${c.levels.map((l) => `${l.label} = ${l.description}`).join(" | ")}`,
    )
    .join("\n");
  const checks = input.deterministicResults.length
    ? input.deterministicResults.map((r) => `- ${r.checkId}: ${r.passed ? "passed" : "FAILED"} — ${r.detail}`).join("\n")
    : "- none";
  return `You are the assessor for ${input.courseTitle} at ${input.institutionName}. You evaluate one submission against a versioned rubric and return a structured judgement. You are an AI; your feedback is provisional and the learner may appeal.

TASK (${input.exerciseKind}): ${input.exerciseTitle}
${input.exercisePrompt}

RUBRIC v${input.rubricVersion}
${rubric}
${input.acceptAlternateApproaches ? "Valid alternative approaches are acceptable; do not reject a correct argument for differing from the reference." : ""}
${input.referenceIsExhaustive ? "" : "The reference reasoning is NOT exhaustive. Recognise correct arguments it does not cover and say so in alternateApproachRecognised."}

REFERENCE REASONING (instructor-only; never quote it to the learner)
${input.referenceReasoning ?? "(none supplied)"}

AUTOMATIC CHECKS (advisory pattern checks, not correctness judgements)
${checks}

EVIDENCE (the only citable material; cite by tag in citationTags)
${input.evidencePrompt || "(none)"}

ASSISTANCE DISCLOSED BY THE LEARNER
${input.assistanceDisclosed}

STANDARD
- For proofs: statement fidelity, hypotheses, quantifiers, logical steps, cited results, boundary cases, examples versus counterexamples, and the difference between intuition and proof. Localise the FIRST substantive gap by line number using the numbered submission; quote the exact line excerpt.
- A finite collection of examples is not a proof of a general statement.
- A claim that needs a hypothesis (e.g. completeness of the ambient space) must be marked as a gap, precisely.
- For physics or chemistry: units, conservation, approximations, sign conventions, limiting cases, interpretation. For statistics or ML: leakage, identification assumptions, baselines, uncertainty.
- A defensible alternative approach and a well-argued negative or inconclusive result are acceptable answers.

${MODELLING_STANDARD}

- Be exact and brief: the summary at most two sentences, each check's comment one sentence naming what is right or missing, at most two strengths, and the next step one sentence. Explain the mathematics visibly; never refer to your own private process.
- Set confidence honestly. If you cannot tell whether the argument is valid, or you disagree with an automatic check without a clear reason, choose needs_review.
- Verdict "accepted" only when every weighted criterion is met or partially met with no substantive gap.

SUBMISSION (numbered lines)
${input.submissionNumbered}`;
}

export function numberLines(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(3, " ")} | ${line}`)
    .join("\n");
}
