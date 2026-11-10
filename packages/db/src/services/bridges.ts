import {
  type ConceptPrerequisite,
  classifyConceptEvidence,
  type EvidenceStateName,
  nextBridgeStep,
  type PrerequisiteEvidence,
  unitPrerequisites,
} from "@corniversity/core/prerequisites/bridges";
import { and, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { bridgeVisit, concept, conceptBridge, conceptState, learnerConceptOverride, teachingUnit } from "../schema/index";
import { createEntry } from "./notebook";
import { recordAssistance } from "./study-session";

export type ConceptBridgeRow = typeof conceptBridge.$inferSelect;

/** What the learner's records show about each concept: work, their own report, or nothing yet. */
export async function conceptEvidence(db: DbOrTx, ownerId: string, conceptIds: string[]): Promise<Map<string, PrerequisiteEvidence>> {
  if (conceptIds.length === 0) return new Map();
  const states = await db
    .select({ conceptId: conceptState.conceptId, state: conceptState.state })
    .from(conceptState)
    .where(and(eq(conceptState.ownerId, ownerId), inArray(conceptState.conceptId, conceptIds)));
  const overrides = await db
    .select({ conceptId: learnerConceptOverride.conceptId, claim: learnerConceptOverride.claim })
    .from(learnerConceptOverride)
    .where(and(eq(learnerConceptOverride.userId, ownerId), inArray(learnerConceptOverride.conceptId, conceptIds)));
  const stateOf = new Map(states.map((s) => [s.conceptId, s.state as EvidenceStateName]));
  const known = new Set(overrides.filter((o) => o.claim === "known").map((o) => o.conceptId));
  return new Map(conceptIds.map((id) => [id, classifyConceptEvidence({ state: stateOf.get(id), selfKnown: known.has(id) })]));
}

export async function preparedBridgeIds(db: DbOrTx, conceptIds?: string[]): Promise<Set<string>> {
  const rows = await db
    .select({ conceptId: conceptBridge.conceptId })
    .from(conceptBridge)
    .where(
      conceptIds ? and(eq(conceptBridge.status, "ready"), inArray(conceptBridge.conceptId, conceptIds)) : eq(conceptBridge.status, "ready"),
    );
  return new Set(rows.map((r) => r.conceptId));
}

/** A unit's prerequisite concepts with the learner's evidence and whether a bridge is prepared, kept apart. */
export async function unitPrerequisiteView(db: DbOrTx, ownerId: string, unitId: string): Promise<ConceptPrerequisite[]> {
  const [unit] = await db
    .select({ ids: teachingUnit.prerequisiteConceptIds })
    .from(teachingUnit)
    .where(eq(teachingUnit.id, unitId))
    .limit(1);
  const ids = unit?.ids ?? [];
  return conceptPrerequisiteView(db, ownerId, ids);
}

export async function conceptPrerequisiteView(db: DbOrTx, ownerId: string, ids: string[]): Promise<ConceptPrerequisite[]> {
  if (ids.length === 0) return [];
  const concepts = await db.select().from(concept).where(inArray(concept.id, ids));
  return unitPrerequisites(
    ids,
    new Map(concepts.map((c) => [c.id, { title: c.title, description: c.description }])),
    await conceptEvidence(db, ownerId, ids),
    await preparedBridgeIds(db, ids),
  );
}

export async function getBridge(db: DbOrTx, conceptId: string): Promise<ConceptBridgeRow | null> {
  const [row] = await db.select().from(conceptBridge).where(eq(conceptBridge.conceptId, conceptId)).limit(1);
  return row ?? null;
}

export class BridgeError extends Error {}

/**
 * Opens the bridge for a concept from a lesson (or from another bridge), recording where to
 * return and the trail. Refuses a cycle or a trail deeper than the cap with a message; opening a
 * bridge is assistance, never evidence.
 */
export async function openBridge(
  db: DbOrTx,
  input: {
    ownerId: string;
    conceptId: string;
    trail: string[];
    sessionId?: string | null;
    parentVisitId?: string | null;
    returnTo: { path: string; label: string; exerciseId?: string; anchor?: string };
  },
): Promise<{ ok: true; visitId: string; trail: string[] } | { ok: false; reason: "depth" | "cycle" | "unprepared"; message: string }> {
  const step = nextBridgeStep(input.trail, input.conceptId);
  if (!step.ok) return { ok: false, reason: step.reason, message: step.message };
  const bridge = await getBridge(db, input.conceptId);
  if (!bridge || bridge.status !== "ready") {
    return {
      ok: false,
      reason: "unprepared",
      message:
        "No bridge is prepared for this concept yet. The prerequisite still stands; ask the tutor about it, or the director for a short study route.",
    };
  }
  // Only same-origin, in-app paths can be returned to.
  if (!/^\/(sessions|bridges|courses)\/[\w/?=&%.#-]*$/.test(input.returnTo.path)) throw new BridgeError("Invalid return path.");
  const [visit] = await db
    .insert(bridgeVisit)
    .values({
      ownerId: input.ownerId,
      conceptId: input.conceptId,
      learningSessionId: input.sessionId && isUuid(input.sessionId) ? input.sessionId : null,
      parentVisitId: input.parentVisitId && isUuid(input.parentVisitId) ? input.parentVisitId : null,
      depth: step.trail.length,
      trail: step.trail,
      returnTo: { ...input.returnTo, label: input.returnTo.label.slice(0, 200) },
    })
    .returning({ id: bridgeVisit.id });
  await recordAssistance(db, {
    ownerId: input.ownerId,
    sessionId: input.sessionId ?? null,
    mode: "bridge_opened",
    anchor: { kind: "locator", text: input.conceptId },
  });
  return { ok: true, visitId: visit!.id, trail: step.trail };
}

export async function getVisit(db: DbOrTx, ownerId: string, visitId: string) {
  if (!isUuid(visitId)) return null;
  const [row] = await db
    .select()
    .from(bridgeVisit)
    .where(and(eq(bridgeVisit.id, visitId), eq(bridgeVisit.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

/**
 * Keeps the learner's answer to a bridge's self-check as a note; it is not assessed and records no
 * evidence. The guidance is shown only after an answer is saved.
 */
export async function answerBridgeCheck(db: DbOrTx, ownerId: string, visitId: string, answer: string): Promise<void> {
  const visit = await getVisit(db, ownerId, visitId);
  if (!visit) throw new BridgeError("Visit not found.");
  const text = answer.trim();
  if (text.length < 10) throw new BridgeError("Write an answer of at least a sentence before seeing the guidance.");
  const bridge = await getBridge(db, visit.conceptId);
  await db
    .update(bridgeVisit)
    .set({ checkAnswer: text.slice(0, 10_000) })
    .where(eq(bridgeVisit.id, visit.id));
  await createEntry(db, ownerId, {
    title: `Bridge self-check: ${bridge?.title ?? visit.conceptId}`,
    bodyMarkdown: `${bridge?.check ? `**Question.** ${bridge.check.prompt}\n\n` : ""}**My answer.** ${text}`,
    kind: "note",
    tags: ["bridge", visit.conceptId],
    learningSessionId: visit.learningSessionId,
  });
}

/** Marks the visit returned from; the return path is the one recorded when it was opened. */
export async function returnFromBridge(db: DbOrTx, ownerId: string, visitId: string): Promise<string | null> {
  const visit = await getVisit(db, ownerId, visitId);
  if (!visit) return null;
  if (!visit.returnedAt) await db.update(bridgeVisit).set({ returnedAt: new Date() }).where(eq(bridgeVisit.id, visit.id));
  return visit.returnTo.path;
}
