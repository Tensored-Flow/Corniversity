import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DbOrTx } from "../client";
import {
  discussion,
  discussionTurn,
  learnerProfile,
  learningSession,
  peerMembership,
  persona,
  personaMemory,
  society,
  teachingUnit,
  unitExercise,
} from "../schema/index";

export type SocietyRow = typeof society.$inferSelect;
export type PersonaRow = typeof persona.$inferSelect;
export type DiscussionRow = typeof discussion.$inferSelect;
export type TurnRow = typeof discussionTurn.$inferSelect;
export type MemoryRow = typeof personaMemory.$inferSelect;

export class CommunityError extends Error {
  constructor(
    readonly code: "social_layer_off" | "closed" | "not_found" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "CommunityError";
  }
}

/**
 * The social layer: societies with a faculty chair, optional labelled AI classmates, and bounded
 * discussions that stay within material the learner has actually opened. Nothing is generated
 * while the learner is away; every turn is a response to a turn the learner just made.
 */
export async function listSocieties(db: DbOrTx): Promise<(SocietyRow & { chair: PersonaRow | null })[]> {
  const rows = await db
    .select({ society, chair: persona })
    .from(society)
    .leftJoin(persona, eq(society.chairPersonaId, persona.id))
    .orderBy(asc(society.title));
  return rows.map((r) => ({ ...r.society, chair: r.chair }));
}

export async function listPeers(db: DbOrTx, ownerId: string): Promise<{ persona: PersonaRow; enabled: boolean; muted: boolean }[]> {
  const peers = await db.select().from(persona).where(eq(persona.isPeer, true)).orderBy(asc(persona.name));
  const memberships = await db.select().from(peerMembership).where(eq(peerMembership.ownerId, ownerId));
  return peers.map((p) => {
    const m = memberships.find((x) => x.personaId === p.id);
    return { persona: p, enabled: m?.enabled ?? true, muted: m?.muted ?? false };
  });
}

export async function setPeerMembership(
  db: DbOrTx,
  ownerId: string,
  personaId: string,
  patch: { enabled?: boolean; muted?: boolean },
): Promise<void> {
  const [existing] = await db
    .select()
    .from(peerMembership)
    .where(and(eq(peerMembership.ownerId, ownerId), eq(peerMembership.personaId, personaId)))
    .limit(1);
  const next = { enabled: patch.enabled ?? existing?.enabled ?? true, muted: patch.muted ?? existing?.muted ?? false };
  await db
    .insert(peerMembership)
    .values({ ownerId, personaId, ...next })
    .onConflictDoUpdate({ target: [peerMembership.ownerId, peerMembership.personaId], set: next });
}

/** Material the learner has opened: units with any learning session, their locators and exercises. */
export async function releasedMaterial(
  db: DbOrTx,
  ownerId: string,
): Promise<{ unitIds: string[]; unitTitles: string[]; locatorIds: string[]; exerciseIds: string[] }> {
  const sessions = await db.select({ unitId: learningSession.unitId }).from(learningSession).where(eq(learningSession.ownerId, ownerId));
  const unitIds = [...new Set(sessions.map((s) => s.unitId))];
  if (unitIds.length === 0) return { unitIds: [], unitTitles: [], locatorIds: [], exerciseIds: [] };
  const units = await db.select().from(teachingUnit).where(inArray(teachingUnit.id, unitIds));
  const exercises = await db.select({ id: unitExercise.id }).from(unitExercise).where(inArray(unitExercise.unitId, unitIds));
  const locatorIds = new Set<string>();
  for (const u of units) {
    for (const p of u.preparation) locatorIds.add(p.locatorId);
    for (const a of u.activities) for (const l of a.sourceLocatorIds) locatorIds.add(l);
  }
  return { unitIds, unitTitles: units.map((u) => u.title), locatorIds: [...locatorIds], exerciseIds: exercises.map((e) => e.id) };
}

export async function socialLayerEnabled(db: DbOrTx, ownerId: string): Promise<boolean> {
  const [profile] = await db
    .select({ enabled: learnerProfile.socialLayerEnabled, immersion: learnerProfile.immersion })
    .from(learnerProfile)
    .where(eq(learnerProfile.userId, ownerId))
    .limit(1);
  return Boolean(profile?.enabled) && profile?.immersion !== "quiet";
}

/**
 * Opens a bounded discussion. Office hours with faculty are always available; anything with AI
 * classmates needs the social layer on. Muted peers are never added. Released material is
 * fixed at opening so a discussion cannot drift into units opened later.
 */
export async function openDiscussion(
  db: DbOrTx,
  ownerId: string,
  input: {
    kind: DiscussionRow["kind"];
    title: string;
    societyId?: string;
    chairPersonaId: string;
    peerPersonaIds?: string[];
    maxRounds?: number;
    learningSessionId?: string;
  },
): Promise<DiscussionRow> {
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new CommunityError("invalid", "Give the discussion a title: the question or passage you want to talk about.");
  const social = await socialLayerEnabled(db, ownerId);
  const peers = (await listPeers(db, ownerId)).filter((p) => p.enabled && !p.muted && (input.peerPersonaIds ?? []).includes(p.persona.id));
  if (input.kind !== "office_hours" && !social && peers.length > 0) {
    throw new CommunityError(
      "social_layer_off",
      "The social layer is off (or you are in quiet mode), so AI classmates do not join. Office hours with faculty remain available.",
    );
  }
  const released = await releasedMaterial(db, ownerId);
  const [row] = await db
    .insert(discussion)
    .values({
      ownerId,
      kind: input.kind,
      title,
      societyId: input.societyId ?? null,
      learningSessionId: input.learningSessionId ?? null,
      participantPersonaIds: [input.chairPersonaId, ...(social ? peers.map((p) => p.persona.id) : [])],
      maxRounds: Math.max(1, Math.min(6, input.maxRounds ?? 3)),
      releasedMaterial: { unitIds: released.unitIds, locatorIds: released.locatorIds, exerciseIds: released.exerciseIds },
    })
    .returning();
  return row!;
}

export async function getDiscussion(db: DbOrTx, ownerId: string, id: string): Promise<DiscussionRow | null> {
  const rows = await db
    .select()
    .from(discussion)
    .where(and(eq(discussion.id, id), eq(discussion.ownerId, ownerId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listDiscussions(db: DbOrTx, ownerId: string, limit = 30): Promise<DiscussionRow[]> {
  return db.select().from(discussion).where(eq(discussion.ownerId, ownerId)).orderBy(desc(discussion.createdAt)).limit(limit);
}

export async function listTurns(db: DbOrTx, discussionId: string): Promise<TurnRow[]> {
  return db.select().from(discussionTurn).where(eq(discussionTurn.discussionId, discussionId)).orderBy(asc(discussionTurn.sequence));
}

export async function appendTurn(
  db: DbOrTx,
  discussionId: string,
  speaker: string,
  contentMarkdown: string,
  labels: string[] = [],
  providerRunId?: string,
): Promise<TurnRow> {
  const last = await db
    .select({ sequence: discussionTurn.sequence })
    .from(discussionTurn)
    .where(eq(discussionTurn.discussionId, discussionId))
    .orderBy(desc(discussionTurn.sequence))
    .limit(1);
  const [row] = await db
    .insert(discussionTurn)
    .values({
      discussionId,
      sequence: (last[0]?.sequence ?? 0) + 1,
      speaker,
      contentMarkdown,
      labels,
      providerRunId: providerRunId ?? null,
    })
    .returning();
  return row!;
}

/** Counts a completed round; closes the discussion at the limit. Returns whether it is now closed. */
export async function completeRound(db: DbOrTx, discussionId: string): Promise<{ roundsUsed: number; closed: boolean }> {
  const [row] = await db.select().from(discussion).where(eq(discussion.id, discussionId)).limit(1);
  if (!row) throw new CommunityError("not_found", "Discussion not found.");
  const roundsUsed = row.roundsUsed + 1;
  const closed = roundsUsed >= row.maxRounds;
  await db
    .update(discussion)
    .set({ roundsUsed, status: closed ? "closed" : row.status, closedAt: closed ? new Date() : row.closedAt })
    .where(eq(discussion.id, discussionId));
  return { roundsUsed, closed };
}

export async function setDiscussionStatus(db: DbOrTx, ownerId: string, id: string, status: "closed" | "muted"): Promise<void> {
  await db
    .update(discussion)
    .set({ status, closedAt: new Date() })
    .where(and(eq(discussion.id, id), eq(discussion.ownerId, ownerId)));
}

export async function getPersonas(db: DbOrTx, ids: string[]): Promise<PersonaRow[]> {
  if (ids.length === 0) return [];
  return db.select().from(persona).where(inArray(persona.id, ids));
}

// ---------------------------------------------------------------------------------------------
// Persona memory: inspectable and deletable; social memory is separate from academic memory.

export async function listPersonaMemory(db: DbOrTx, ownerId: string, personaId?: string): Promise<(MemoryRow & { personaName: string })[]> {
  const conditions = [eq(personaMemory.ownerId, ownerId), isNull(personaMemory.deletedAt)];
  if (personaId) conditions.push(eq(personaMemory.personaId, personaId));
  const rows = await db
    .select({ memory: personaMemory, name: persona.name })
    .from(personaMemory)
    .innerJoin(persona, eq(persona.id, personaMemory.personaId))
    .where(and(...conditions))
    .orderBy(desc(personaMemory.createdAt));
  return rows.map((r) => ({ ...r.memory, personaName: r.name }));
}

export async function recordPersonaMemory(
  db: DbOrTx,
  ownerId: string,
  personaId: string,
  kind: MemoryRow["kind"],
  content: string,
  provenance: string,
): Promise<void> {
  await db
    .insert(personaMemory)
    .values({ ownerId, personaId, kind, content: content.slice(0, 2000), provenance: provenance.slice(0, 300) });
}

export async function deletePersonaMemory(db: DbOrTx, ownerId: string, id: string): Promise<void> {
  await db
    .update(personaMemory)
    .set({ deletedAt: new Date() })
    .where(and(eq(personaMemory.id, id), eq(personaMemory.ownerId, ownerId)));
}

export async function purgePersonaMemory(db: DbOrTx, ownerId: string, kind?: MemoryRow["kind"]): Promise<number> {
  const conditions = [eq(personaMemory.ownerId, ownerId)];
  if (kind) conditions.push(eq(personaMemory.kind, kind));
  const deleted = await db
    .delete(personaMemory)
    .where(and(...conditions))
    .returning({ id: personaMemory.id });
  return deleted.length;
}
