import { z } from "zod";

/**
 * The course-preparation pipeline as role contracts over shared infrastructure: each stage has a
 * role, is deterministic, a model task or the owner's decision, and leaves an inspectable artifact.
 * A stage may only propose; publication is the owner's act, and nothing here enrols anyone.
 */
export const PREPARATION_STAGES = [
  {
    key: "source_inspection",
    role: "librarian",
    kind: "deterministic",
    title: "Inspect the sources",
    description: "Each registered source's edition, licence, access, import permission and verified locators.",
  },
  {
    key: "primary_shelf",
    role: "librarian",
    kind: "deterministic",
    title: "Choose the primary spine and a small shelf",
    description: "One spine and at most three supplements, from verified sources only.",
  },
  {
    key: "concept_mapping",
    role: "convenor",
    kind: "deterministic",
    title: "Map concepts and prerequisites",
    description: "What the course teaches, the prerequisite rules, and which bridges are prepared.",
  },
  {
    key: "syllabus_workload",
    role: "convenor",
    kind: "deterministic",
    title: "Syllabus and workload",
    description: "The units in order, which are prepared, outlined or blocked, and the workload range.",
  },
  {
    key: "resource_requirements",
    role: "librarian",
    kind: "deterministic",
    title: "Exact resource requirements",
    description: "A request for each source the units need but cannot use, with what to obtain and why.",
  },
  {
    key: "unit_authoring",
    role: "convenor",
    kind: "model",
    title: "Author the next units",
    description: "Lesson, exercises, hint ladders, rubrics and reference reasoning for the units in the buffer.",
  },
  {
    key: "checks",
    role: "reviewer",
    kind: "deterministic",
    title: "Evidence and teaching-structure checks",
    description: "Supplied passages, objective coverage, worked examples, problem progression and formatting; not academic verification.",
  },
  {
    key: "publication",
    role: "owner",
    kind: "owner",
    title: "Publication",
    description: "The owner reads each checked draft and publishes it as a new unit version, or rejects it.",
  },
] as const;

export type StageKey = (typeof PREPARATION_STAGES)[number]["key"];
export type StageStatus = "pending" | "running" | "done" | "blocked" | "failed" | "cancelled" | "skipped";

export interface UnitReadiness {
  unitId: string;
  status: "ready" | "draft" | "checking" | "blocked";
  /** A verified locator exists for its preparation. */
  sourced: boolean;
  /** A published preparation (a draft accepted by the owner) supplies it. */
  publishedFromPreparation?: boolean;
}

/** The honest one-line status, populated only from records. */
export function preparationSummary(units: readonly UnitReadiness[], nextSessionsReady: boolean): string {
  const prepared = units.filter((u) => u.status === "ready").length;
  const needSources = units.filter((u) => u.status !== "ready" && !u.sourced).length;
  const parts = [`${units.length} unit${units.length === 1 ? "" : "s"} mapped`, `${prepared} prepared`];
  if (needSources) parts.push(`${needSources} need source access`);
  parts.push(nextSessionsReady ? "your next sessions are ready" : "your next sessions are not prepared yet");
  return `${parts.join("; ")}.`;
}

/** Whether a model stage may start: its worst case must fit what is left of the request's budget. */
export function stageWithinBudget(
  budgetMicros: number,
  spentMicros: number,
  worstCaseMicros: number,
): { ok: true } | { ok: false; reason: string } {
  const left = budgetMicros - spentMicros;
  if (worstCaseMicros <= left) return { ok: true };
  return {
    ok: false,
    reason: `This step could cost up to $${(worstCaseMicros / 1e6).toFixed(2)}, and $${(Math.max(0, left) / 1e6).toFixed(2)} of this preparation's budget is left. Raise the budget or prepare fewer units.`,
  };
}

/** A unit as a model drafts it; the reference reasoning is instructor-only and never shown before publication. */
export const UnitDraftSchema = z.object({
  lessonMarkdown: z.string().min(1),
  objectives: z.array(z.string().min(1)).min(1).max(6),
  /** Further-reading locations. A registered location is not evidence that its text was read. */
  sourceLocatorIds: z.array(z.string()).max(20),
  /** Optional only so saved legacy drafts remain readable. Current checks require these fields. */
  sourcePassageIds: z.array(z.string()).max(12).optional(),
  workedExamples: z
    .array(
      z.object({
        title: z.string().min(1),
        reasoningMarkdown: z.string().min(1),
        objectiveIndexes: z.array(z.number().int().min(0).max(5)).min(1).max(6),
      }),
    )
    .max(4)
    .optional(),
  exercises: z
    .array(
      z.object({
        title: z.string().min(1),
        kind: z.enum(["proof", "calculation", "derivation", "explanation", "conceptual", "model_interpretation"]),
        promptMarkdown: z.string().min(1),
        hintLadder: z.array(z.string().min(1)).min(1).max(6),
        criteria: z
          .array(z.object({ criterion: z.string().min(1), weight: z.number().min(0).max(1) }))
          .min(1)
          .max(8),
        referenceSolution: z.string().min(1),
        stage: z.enum(["worked_example", "independent", "unfamiliar", "counterexample", "synthesis"]),
        objectiveIndexes: z.array(z.number().int().min(0).max(5)).min(1).max(6).optional(),
      }),
    )
    .min(1)
    .max(5),
  misconceptions: z.array(z.object({ claim: z.string().min(1), correction: z.string().min(1) })).max(6),
});
export type UnitDraft = z.infer<typeof UnitDraftSchema>;

export interface DraftCheck {
  name: string;
  result: "pass" | "fail";
  detail: string;
  /** Server-recorded provenance, never accepted from model output. */
  evidence?: { locatorIds: string[]; passageIds: string[]; expectedObjectives: string[] };
}

export function renderDraftLesson(draft: UnitDraft): string {
  const examples = (draft.workedExamples ?? []).map((e) => `## Worked example: ${e.title}\n\n${e.reasoningMarkdown}`);
  return [draft.lessonMarkdown, ...examples].join("\n\n");
}

export interface DraftCheckContext {
  verifiedLocatorIds: ReadonlySet<string>;
  suppliedPassageIds?: ReadonlySet<string>;
  expectedObjectives?: readonly string[];
}

/**
 * Deterministic checks on a draft before the owner sees it: these say whether the draft is
 * well-formed and references supplied text, never whether a passage supports every claim or its mathematics is right, which
 * the owner judges (a model's own review is a further check, not a guarantee).
 */
export function checkUnitDraft(draft: UnitDraft, context: DraftCheckContext): DraftCheck[] {
  const checks: DraftCheck[] = [];
  const visibleLesson = renderDraftLesson(draft);
  const words = visibleLesson.split(/\s+/).filter(Boolean).length;
  checks.push({
    name: "lesson-length",
    result: words >= 600 ? "pass" : "fail",
    detail: `${words} words including worked examples (at least 600; length alone does not establish quality).`,
  });
  const unknown = draft.sourceLocatorIds.filter((id) => !context.verifiedLocatorIds.has(id));
  checks.push({
    name: "verified-sources",
    result: unknown.length === 0 ? "pass" : "fail",
    detail: unknown.length
      ? `Locations not supplied to this run: ${unknown.join(", ")}.`
      : "Further-reading locations are restricted to this run; they are not passage evidence.",
  });
  const supplied = context.suppliedPassageIds ?? new Set<string>();
  const passageIds = draft.sourcePassageIds ?? [];
  const unsupported = passageIds.filter((id) => !supplied.has(id));
  checks.push({
    name: "supplied-source-passages",
    result: passageIds.length > 0 && unsupported.length === 0 ? "pass" : "fail",
    detail:
      passageIds.length === 0
        ? "No supplied passage is cited."
        : unsupported.length
          ? `Passages not supplied to this run: ${unsupported.join(", ")}.`
          : `${passageIds.length} supplied passages cited; claim-by-claim support still needs academic review.`,
    evidence: {
      locatorIds: [...context.verifiedLocatorIds],
      passageIds: [...supplied],
      expectedObjectives: [...(context.expectedObjectives ?? draft.objectives)],
    },
  });
  // Repeated sentences can clear a word-count gate while teaching nothing. This is a bounded
  // heuristic, not a semantic quality score: repeated substantive 12-word runs expose filler.
  const tokens = visibleLesson.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const seen = new Set<string>();
  let repeated = 0;
  for (let i = 0; i + 12 <= tokens.length; i++) {
    const run = tokens.slice(i, i + 12).join(" ");
    if (seen.has(run)) repeated++;
    else seen.add(run);
  }
  const repeatedShare = repeated / Math.max(1, tokens.length - 11);
  checks.push({
    name: "non-repetitive-teaching",
    result: repeatedShare <= 0.2 ? "pass" : "fail",
    detail: `${Math.round(repeatedShare * 100)}% repeated 12-word runs (maximum 20%).`,
  });
  const examples = draft.workedExamples ?? [];
  const validIndexes = (indexes: readonly number[] | undefined) =>
    Boolean(indexes?.length) && indexes!.every((i) => Number.isInteger(i) && i >= 0 && i < draft.objectives.length);
  checks.push({
    name: "worked-reasoning",
    result:
      examples.length > 0 &&
      examples.every((e) => e.reasoningMarkdown.split(/\s+/).filter(Boolean).length >= 80 && validIndexes(e.objectiveIndexes))
        ? "pass"
        : "fail",
    detail:
      "At least one separately recorded worked example must explain its reasoning (80+ words) and identify the objective it teaches; correctness is reviewed separately.",
  });
  const expected = context.expectedObjectives ?? draft.objectives;
  const preserved = expected.length === draft.objectives.length && expected.every((o, i) => o.trim() === draft.objectives[i]?.trim());
  const assessed = new Set(draft.exercises.filter((e) => e.stage !== "worked_example").flatMap((e) => e.objectiveIndexes ?? []));
  const coverage = draft.exercises.every((e) => validIndexes(e.objectiveIndexes)) && draft.objectives.every((_, i) => assessed.has(i));
  checks.push({
    name: "objective-coverage",
    result: preserved && coverage ? "pass" : "fail",
    detail: "Every planned objective must remain and map to an independent exercise; mappings need semantic review.",
  });
  const stages = new Set(draft.exercises.map((e) => e.stage));
  checks.push({
    name: "problem-progression",
    result:
      draft.exercises.length >= 3 &&
      stages.has("independent") &&
      ["unfamiliar", "counterexample", "synthesis"].some((s) => stages.has(s as UnitDraft["exercises"][number]["stage"]))
        ? "pass"
        : "fail",
    detail: "At least three problems, including independent work and unfamiliar transfer, a counterexample or synthesis.",
  });
  const dollars = (visibleLesson.replace(/\\\$/g, "").match(/\$/g) ?? []).length;
  checks.push({
    name: "notation-balanced",
    result: dollars % 2 === 0 ? "pass" : "fail",
    detail: dollars % 2 === 0 ? "Mathematics delimiters balance." : "An unmatched $ delimiter.",
  });
  for (const [i, e] of draft.exercises.entries()) {
    const weight = e.criteria.reduce((s, c) => s + c.weight, 0);
    checks.push({
      name: `exercise-${i + 1}-rubric`,
      result: Math.abs(weight - 1) < 0.01 ? "pass" : "fail",
      detail: `Rubric weights sum to ${weight.toFixed(2)} (must be 1).`,
    });
    const leak = leakRun(e.referenceSolution, [e.promptMarkdown, ...e.hintLadder, visibleLesson]);
    checks.push({
      name: `exercise-${i + 1}-no-leak`,
      result: leak ? "fail" : "pass",
      detail: leak
        ? `The reference solution reappears in learner-facing text: "${leak}".`
        : "The reference solution does not reappear in the prompt, hints or lesson.",
    });
  }
  return checks;
}

/** A run of ten consecutive words of the reference that appears in any learner-facing text. */
function leakRun(reference: string, visible: string[]): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const words = norm(reference).split(" ");
  const haystack = visible.map(norm).join(" \n ");
  for (let i = 0; i + 10 <= words.length; i++) {
    const run = words.slice(i, i + 10).join(" ");
    if (haystack.includes(run)) return run;
  }
  return null;
}
