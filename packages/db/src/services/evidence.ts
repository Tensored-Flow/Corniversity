import { and, desc, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { concept, conceptState, evidenceEvent, misconceptionRecord } from "../schema/index";

export type EvidenceState = "unassessed" | "introduced" | "practised" | "demonstrated" | "revisit";

/**
 * Evidence states are derived from concrete events and never from time spent. The rules are
 * deliberately simple and visible:
 *  - reading or an introduced lecture → at least `introduced`
 *  - a submitted attempt (any verdict) → at least `practised`
 *  - an accepted attempt with no solution reveal and at most one hint → `demonstrated`
 *  - a later revision_requested on a concept already demonstrated → `revisit`
 */
export function nextState(current: EvidenceState, event: { type: string; verdict?: string; assisted?: boolean }): EvidenceState {
  const order: EvidenceState[] = ["unassessed", "introduced", "practised", "demonstrated"];
  const atLeast = (s: EvidenceState) => (order.indexOf(s) > order.indexOf(current) || current === "revisit" ? s : current);
  switch (event.type) {
    case "reading":
      return current === "revisit" ? "revisit" : atLeast("introduced");
    case "solution_revealed":
      return current === "unassessed" ? "introduced" : current;
    case "assessment":
      if (event.verdict === "accepted" && !event.assisted) return "demonstrated";
      if (event.verdict === "accepted" && event.assisted) return current === "demonstrated" ? "demonstrated" : "practised";
      if (event.verdict === "revision_requested") return current === "demonstrated" ? "revisit" : atLeast("practised");
      return atLeast("practised");
    case "explain_back":
      return event.verdict === "accepted" ? "demonstrated" : atLeast("practised");
    default:
      return current;
  }
}

export async function recordEvidence(
  db: DbOrTx,
  input: {
    ownerId: string;
    conceptIds: string[];
    activityRef: string;
    submissionVersionId?: string;
    evidenceType: "self_report" | "practice" | "assessment" | "explain_back" | "reading" | "solution_revealed";
    source: string;
    assistance: string;
    interpretation: string;
    verdict?: string;
    assisted?: boolean;
    reviewStatus?: "provisional" | "reviewed" | "disputed";
  },
): Promise<void> {
  if (input.conceptIds.length === 0) return;
  const existing = await db
    .select()
    .from(conceptState)
    .where(and(eq(conceptState.ownerId, input.ownerId), inArray(conceptState.conceptId, input.conceptIds)));
  for (const conceptId of input.conceptIds) {
    const [event] = await db
      .insert(evidenceEvent)
      .values({
        ownerId: input.ownerId,
        conceptId,
        activityRef: input.activityRef,
        submissionVersionId: input.submissionVersionId ?? null,
        evidenceType: input.evidenceType,
        source: input.source,
        assistance: input.assistance,
        interpretation: input.interpretation,
        reviewStatus: input.reviewStatus ?? "provisional",
      })
      .returning({ id: evidenceEvent.id });
    const current = existing.find((s) => s.conceptId === conceptId);
    const state = nextState((current?.state as EvidenceState) ?? "unassessed", {
      type: input.evidenceType,
      verdict: input.verdict,
      assisted: input.assisted,
    });
    const evidenceIds = [...(current?.evidenceIds ?? []), event!.id].slice(-50);
    await db
      .insert(conceptState)
      .values({ ownerId: input.ownerId, conceptId, state, evidenceIds })
      .onConflictDoUpdate({ target: [conceptState.ownerId, conceptState.conceptId], set: { state, evidenceIds } });
  }
}

export async function getConceptStates(db: DbOrTx, ownerId: string, conceptIds?: string[]) {
  const rows = await db
    .select({ state: conceptState, concept })
    .from(conceptState)
    .innerJoin(concept, eq(conceptState.conceptId, concept.id))
    .where(conceptIds ? and(eq(conceptState.ownerId, ownerId), inArray(conceptState.conceptId, conceptIds)) : eq(conceptState.ownerId, ownerId));
  return rows;
}

export async function listEvidence(db: DbOrTx, ownerId: string, conceptId?: string, limit = 50) {
  return db
    .select()
    .from(evidenceEvent)
    .where(conceptId ? and(eq(evidenceEvent.ownerId, ownerId), eq(evidenceEvent.conceptId, conceptId)) : eq(evidenceEvent.ownerId, ownerId))
    .orderBy(desc(evidenceEvent.observedAt))
    .limit(limit);
}

export async function recordMisconception(
  db: DbOrTx,
  input: { ownerId: string; conceptId: string; claim: string; evidenceIds: string[] },
): Promise<void> {
  await db.insert(misconceptionRecord).values(input);
}

export async function clearMisconceptionsFor(db: DbOrTx, ownerId: string, conceptId: string): Promise<void> {
  await db
    .update(misconceptionRecord)
    .set({ status: "cleared", clearedAt: new Date() })
    .where(and(eq(misconceptionRecord.ownerId, ownerId), eq(misconceptionRecord.conceptId, conceptId), eq(misconceptionRecord.status, "active")));
}
