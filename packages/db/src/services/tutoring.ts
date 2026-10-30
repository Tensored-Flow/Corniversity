import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { annotateTurn, type EvidenceRef, formatEvidenceBlocks } from "@corniversity/core/grounding/citations";
import type { DbOrTx } from "../client";
import { conversation, locator, message, persona, teachingUnit, unitExercise } from "../schema/index";

export type ConversationRow = typeof conversation.$inferSelect;
export type MessageRow = typeof message.$inferSelect;

/**
 * Evidence for a tutor turn is the unit's verified locators. Where the passage text has been
 * ingested it is included; otherwise the block carries the location only and says so, so the
 * model cannot pretend to have read a page it has not.
 */
export async function buildUnitEvidence(db: DbOrTx, unitId: string): Promise<{ prompt: string; refs: EvidenceRef[] }> {
  const [unit] = await db.select().from(teachingUnit).where(eq(teachingUnit.id, unitId)).limit(1);
  if (!unit) return { prompt: "", refs: [] };
  const ids = new Set<string>();
  for (const p of unit.preparation) ids.add(p.locatorId);
  for (const a of unit.activities) for (const l of a.sourceLocatorIds) ids.add(l);
  if (ids.size === 0) return { prompt: "", refs: [] };
  const locators = await db.select().from(locator).where(inArray(locator.id, [...ids]));
  const ordered = [...ids].map((id) => locators.find((l) => l.id === id)).filter((l): l is typeof locator.$inferSelect => Boolean(l));
  return formatEvidenceBlocks(
    ordered.map((l) => ({
      label: l.label,
      locatorId: l.id,
      text: l.note
        ? `Location only (passage text not retrieved). Note: ${l.note}`
        : "Location only (passage text not retrieved). Cite this tag for statements that come from this source location; do not quote text you have not been given.",
    })),
  );
}

export async function getOrCreateConversation(
  db: DbOrTx,
  input: {
    ownerId: string;
    learningSessionId?: string;
    role: string;
    personaId?: string;
    purpose: string;
    unitId?: string;
    exerciseId?: string;
    allowedLocatorIds: string[];
  },
): Promise<ConversationRow> {
  if (input.learningSessionId) {
    const existing = await db
      .select()
      .from(conversation)
      .where(
        and(
          eq(conversation.ownerId, input.ownerId),
          eq(conversation.learningSessionId, input.learningSessionId),
          eq(conversation.role, input.role),
        ),
      )
      .orderBy(desc(conversation.createdAt))
      .limit(1);
    if (existing[0] && !existing[0].closedAt) return existing[0];
  }
  const [created] = await db
    .insert(conversation)
    .values({
      ownerId: input.ownerId,
      learningSessionId: input.learningSessionId ?? null,
      role: input.role,
      personaId: input.personaId ?? null,
      purpose: input.purpose,
      context: { unitId: input.unitId, exerciseId: input.exerciseId, allowedLocatorIds: input.allowedLocatorIds, allowedAssetIds: [] },
    })
    .returning();
  if (!created) throw new Error("conversation insert returned nothing");
  return created;
}

export async function getConversation(db: DbOrTx, ownerId: string, id: string): Promise<ConversationRow | null> {
  const rows = await db.select().from(conversation).where(and(eq(conversation.id, id), eq(conversation.ownerId, ownerId))).limit(1);
  return rows[0] ?? null;
}

export async function listMessages(db: DbOrTx, conversationId: string): Promise<MessageRow[]> {
  return db.select().from(message).where(eq(message.conversationId, conversationId)).orderBy(asc(message.sequence));
}

export async function appendLearnerMessage(db: DbOrTx, conversationId: string, content: string): Promise<MessageRow> {
  const last = await db.select({ sequence: message.sequence }).from(message).where(eq(message.conversationId, conversationId)).orderBy(desc(message.sequence)).limit(1);
  const [row] = await db
    .insert(message)
    .values({ conversationId, sequence: (last[0]?.sequence ?? 0) + 1, sender: "learner", contentMarkdown: content })
    .returning();
  return row!;
}

/** Persists a completed persona turn after validating its citations against the allowed evidence. */
export async function appendPersonaMessage(
  db: DbOrTx,
  input: { conversationId: string; personaId: string | null; rawText: string; allowed: EvidenceRef[]; providerRunId?: string },
): Promise<{ message: MessageRow; unknownTags: string[] }> {
  const annotated = annotateTurn(input.rawText, input.allowed);
  const last = await db.select({ sequence: message.sequence }).from(message).where(eq(message.conversationId, input.conversationId)).orderBy(desc(message.sequence)).limit(1);
  const [row] = await db
    .insert(message)
    .values({
      conversationId: input.conversationId,
      sequence: (last[0]?.sequence ?? 0) + 1,
      sender: "persona",
      personaId: input.personaId,
      contentMarkdown: annotated.markdown,
      citations: annotated.citations.map((c) => ({ tag: c.tag, locatorId: c.locatorId, assetId: c.assetId, passageId: c.passageId, label: c.label })),
      labels: annotated.labels,
      uncitedClaims: annotated.uncitedClaims,
      providerRunId: input.providerRunId ?? null,
    })
    .returning();
  return { message: row!, unknownTags: annotated.unknownTags };
}

export async function getPersona(db: DbOrTx, id: string) {
  const rows = await db.select().from(persona).where(eq(persona.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getExercise(db: DbOrTx, id: string) {
  const rows = await db.select().from(unitExercise).where(eq(unitExercise.id, id)).limit(1);
  return rows[0] ?? null;
}
