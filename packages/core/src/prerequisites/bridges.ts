import { z } from "zod";

/**
 * Concept-level prerequisites keep three things apart:
 *  - the definition: a concept a unit relies on, and rules naming concepts (they exist whether or
 *    not any course teaching them is prepared);
 *  - the learner's evidence about that concept;
 *  - whether a short teaching bridge for the concept is prepared.
 * An unprepared bridge is a content gap; it says nothing about whether the prerequisite exists or
 * whether the learner meets it.
 */

/** A concept bridge as authored in content/bridges/<concept-id>/bridge.json (+ bridge.md). */
export const BridgeSpec = z.object({
  conceptId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  /** One sentence: what the bridge gives a learner who arrives from a lesson. */
  summary: z.string().min(1),
  /** The explanation and worked example live in bridge.md. */
  bodyFile: z.string().default("bridge.md"),
  /** An optional self-check: a question, then guidance shown only after the learner answers. */
  check: z.object({ prompt: z.string().min(1), guidance: z.string().min(1) }).optional(),
  /** Concepts this bridge itself assumes; a learner may follow one of them, at most to the depth cap. */
  assumesConceptIds: z.array(z.string()).default([]),
  /** Registered sources that support it (verified records only); the explanation itself is original. */
  sources: z.array(z.object({ sourceId: z.string().min(1), locatorId: z.string().optional(), note: z.string().min(1) })).default([]),
  origin: z.enum(["original", "adapted_with_attribution"]),
  status: z.enum(["draft", "ready"]),
  /** The author's own checks, shown as such; not independent verification. */
  checks: z
    .array(z.object({ name: z.string().min(1), result: z.enum(["pass", "fail", "needs_review"]), evidence: z.string().min(1) }))
    .default([]),
});
export type BridgeSpec = z.infer<typeof BridgeSpec>;

export type EvidenceStateName = "unassessed" | "introduced" | "practised" | "demonstrated" | "revisit";

/**
 * What a learner's record shows about one concept, honestly:
 * - `supported_by_work`: submitted work exists for it (the state is practised, demonstrated or
 *   revisit, which only assessed or submitted work produces);
 * - `self_reported`: the learner said they know it (unverified);
 * - `not_shown`: nothing yet. Reading, viewing a bridge or seeing a solution never moves a
 *   concept out of `not_shown`.
 */
export type PrerequisiteEvidence = "supported_by_work" | "self_reported" | "not_shown";

export function classifyConceptEvidence(input: { state?: EvidenceStateName | null; selfKnown?: boolean }): PrerequisiteEvidence {
  if (input.state === "practised" || input.state === "demonstrated" || input.state === "revisit") return "supported_by_work";
  if (input.selfKnown) return "self_reported";
  return "not_shown";
}

export interface ConceptPrerequisite {
  conceptId: string;
  title: string;
  description: string;
  evidence: PrerequisiteEvidence;
  bridge: "prepared" | "unprepared";
}

/**
 * The prerequisite concepts of a unit, with evidence and bridge availability kept apart; a concept
 * stays listed whether or not a bridge or a supplying course is prepared. Concepts not yet shown
 * come first, then self-reported ones, then those supported by work.
 */
export function unitPrerequisites(
  conceptIds: readonly string[],
  concepts: ReadonlyMap<string, { title: string; description: string }>,
  evidence: ReadonlyMap<string, PrerequisiteEvidence>,
  preparedBridges: ReadonlySet<string>,
): ConceptPrerequisite[] {
  const order: Record<PrerequisiteEvidence, number> = { not_shown: 0, self_reported: 1, supported_by_work: 2 };
  return [...new Set(conceptIds)]
    .map((conceptId) => {
      const c = concepts.get(conceptId);
      return {
        conceptId,
        title: c?.title ?? conceptId,
        description: c?.description ?? "",
        evidence: evidence.get(conceptId) ?? "not_shown",
        bridge: preparedBridges.has(conceptId) ? ("prepared" as const) : ("unprepared" as const),
      };
    })
    .sort((a, b) => order[a.evidence] - order[b.evidence]);
}

/** How deep bridges may nest from a lesson: the lesson's bridge, and one bridge it assumes. */
export const MAX_BRIDGE_DEPTH = 2;

export type BridgeStep = { ok: true; trail: string[] } | { ok: false; reason: "depth" | "cycle"; trail: string[]; message: string };

/**
 * Opening the bridge for `conceptId` from a trail of bridges already open (outermost first).
 * Refuses a concept already on the trail (a cycle) and anything beyond the depth cap, with a
 * message that sends the learner back instead of deeper; a longer gap is a study route to propose,
 * not a chain of explanations.
 */
export function nextBridgeStep(trail: readonly string[], conceptId: string, maxDepth = MAX_BRIDGE_DEPTH): BridgeStep {
  if (trail.includes(conceptId)) {
    return {
      ok: false,
      reason: "cycle",
      trail: [...trail],
      message: `"${conceptId}" is already open further up this trail. Return to it rather than going round in a circle.`,
    };
  }
  if (trail.length >= maxDepth) {
    return {
      ok: false,
      reason: "depth",
      trail: [...trail],
      message: `Bridges stop ${maxDepth} deep so the lesson stays in reach. If more preparation is needed, ask the director to propose a short study route instead.`,
    };
  }
  return { ok: true, trail: [...trail, conceptId] };
}

export interface PrerequisiteRuleLike {
  id: string;
  strength: "hard" | "soft" | "corequisite";
  alternatives: { label: string; conceptIds: string[]; courseIds: string[] }[];
}

export type RuleStanding =
  | { status: "met_by_work"; alternative: string }
  | { status: "met_by_report"; alternative: string }
  | { status: "not_met"; missing: string[] };

/**
 * Whether a rule is met, by which alternative and on what basis. An alternative is met only by
 * its own concepts (all of them): mathematical evidence never stands in for a biology concept.
 * Work outranks a self-report; course alternatives are listed for the route but are not judged
 * here (completing a course is not a concept's evidence). `missing` names the concepts of the
 * closest concept alternative.
 */
export function ruleStanding(rule: PrerequisiteRuleLike, evidence: ReadonlyMap<string, PrerequisiteEvidence>): RuleStanding {
  const conceptAlts = rule.alternatives.filter((a) => a.conceptIds.length > 0);
  for (const alt of conceptAlts) {
    if (alt.conceptIds.every((c) => evidence.get(c) === "supported_by_work")) return { status: "met_by_work", alternative: alt.label };
  }
  for (const alt of conceptAlts) {
    if (alt.conceptIds.every((c) => evidence.get(c) === "supported_by_work" || evidence.get(c) === "self_reported")) {
      return { status: "met_by_report", alternative: alt.label };
    }
  }
  const closest = [...conceptAlts].sort(
    (a, b) =>
      a.conceptIds.filter((c) => evidence.get(c) === "not_shown" || !evidence.has(c)).length -
      b.conceptIds.filter((c) => evidence.get(c) === "not_shown" || !evidence.has(c)).length,
  )[0];
  return {
    status: "not_met",
    missing: closest
      ? closest.conceptIds.filter((c) => evidence.get(c) !== "supported_by_work" && evidence.get(c) !== "self_reported")
      : [],
  };
}
