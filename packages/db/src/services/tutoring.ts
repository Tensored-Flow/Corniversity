import { annotateTurn, type EvidenceRef, formatEvidenceBlocks } from "@corniversity/core/grounding/citations";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { conversation, locator, message, persona, teachingUnit, unitExercise } from "../schema/index";
import { localOnlyAssetsForCourse, permittedPassagesForCourse } from "./library";

export type ConversationRow = typeof conversation.$inferSelect;
export type MessageRow = typeof message.$inferSelect;

/**
 * Evidence for a tutor turn is the unit's verified locators. Where the passage text has been
 * ingested it is included; otherwise the block carries the location only and says so, so the
 * model cannot pretend to have read a page it has not.
 */
export async function buildUnitEvidence(
  db: DbOrTx,
  unitId: string,
  library?: { ownerId: string; courseId: string; query: string },
): Promise<{ prompt: string; refs: EvidenceRef[] }> {
  const [unit] = await db.select().from(teachingUnit).where(eq(teachingUnit.id, unitId)).limit(1);
  if (!unit) return { prompt: "", refs: [] };
  const ids = new Set<string>();
  for (const p of unit.preparation) ids.add(p.locatorId);
  for (const a of unit.activities) for (const l of a.sourceLocatorIds) ids.add(l);
  const locators = ids.size
    ? await db
        .select()
        .from(locator)
        .where(inArray(locator.id, [...ids]))
    : [];
  const ordered = [...ids].map((id) => locators.find((l) => l.id === id)).filter((l): l is typeof locator.$inferSelect => Boolean(l));
  const blocks: { label: string; text: string; locatorId?: string; assetId?: string; passageId?: string; kind?: "passage" | "location" }[] =
    ordered.map((l) => ({
      label: l.label,
      locatorId: l.id,
      kind: "location" as const,
      text: l.note
        ? `Location only (passage text not retrieved). Note: ${l.note}`
        : "Location only (passage text not retrieved). Cite this tag for statements that come from this source location; do not quote text you have not been given.",
    }));

  // The learner's own library: only processed items assigned to this course and permitted for
  // external AI processing contribute passages. Local-only items are named, never read.
  let suffix = "";
  if (library) {
    const passages = await permittedPassagesForCourse(db, library.ownerId, library.courseId, library.query, 4);
    for (const p of passages) {
      const title = p.asset.confirmedTitle ?? p.asset.filename;
      const page = p.printed_label ? `p. ${p.printed_label} (PDF page ${p.physical_index + 1})` : `PDF page ${p.physical_index + 1}`;
      blocks.push({ label: `Your library: ${title}, ${page}`, assetId: p.asset_id, passageId: p.id, text: p.text, kind: "passage" });
    }
    const localOnly = await localOnlyAssetsForCourse(db, library.ownerId, library.courseId);
    if (localOnly.length) {
      const names = localOnly.map((a) => `"${a.confirmedTitle ?? a.candidateMetadata.title ?? a.filename}"`).join(", ");
      suffix = `\n\nNOT AVAILABLE TO YOU: the learner has registered these items as local-only; their contents have never left the learner's device and you have not seen a single page of them: ${names}. If asked about them, say plainly that you cannot inspect them and work from the evidence above instead.`;
    }
  }
  if (blocks.length === 0 && !suffix) return { prompt: "", refs: [] };
  const formatted = formatEvidenceBlocks(blocks);
  return { prompt: formatted.prompt + suffix, refs: formatted.refs };
}

/** The most recent reading-room conversation about a library item (its context names the item). */
export async function latestConversationForAsset(db: DbOrTx, ownerId: string, assetId: string): Promise<ConversationRow | null> {
  const rows = await db
    .select()
    .from(conversation)
    .where(
      and(
        eq(conversation.ownerId, ownerId),
        eq(conversation.purpose, "reading-room"),
        sql`${conversation.context}->'allowedAssetIds' ? ${assetId}`,
      ),
    )
    .orderBy(desc(conversation.createdAt))
    .limit(1);
  return rows[0] ?? null;
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
    allowedAssetIds?: string[];
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
  } else if (!input.allowedAssetIds?.length) {
    // A conversation that belongs to no learning session and no library item (the director's
    // programme talk) continues where it left off instead of starting afresh on every visit.
    const existing = await db
      .select()
      .from(conversation)
      .where(
        and(
          eq(conversation.ownerId, input.ownerId),
          isNull(conversation.learningSessionId),
          eq(conversation.role, input.role),
          eq(conversation.purpose, input.purpose),
          isNull(conversation.closedAt),
        ),
      )
      .orderBy(desc(conversation.createdAt))
      .limit(1);
    if (existing[0]) return existing[0];
  }
  const [created] = await db
    .insert(conversation)
    .values({
      ownerId: input.ownerId,
      learningSessionId: input.learningSessionId ?? null,
      role: input.role,
      personaId: input.personaId ?? null,
      purpose: input.purpose,
      context: {
        unitId: input.unitId,
        exerciseId: input.exerciseId,
        allowedLocatorIds: input.allowedLocatorIds,
        allowedAssetIds: input.allowedAssetIds ?? [],
      },
    })
    .returning();
  if (!created) throw new Error("conversation insert returned nothing");
  return created;
}

export async function getConversation(db: DbOrTx, ownerId: string, id: string): Promise<ConversationRow | null> {
  if (!isUuid(id)) return null;
  const rows = await db
    .select()
    .from(conversation)
    .where(and(eq(conversation.id, id), eq(conversation.ownerId, ownerId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listMessages(db: DbOrTx, conversationId: string): Promise<MessageRow[]> {
  return db.select().from(message).where(eq(message.conversationId, conversationId)).orderBy(asc(message.sequence));
}

export async function appendLearnerMessage(db: DbOrTx, conversationId: string, content: string): Promise<MessageRow> {
  const last = await db
    .select({ sequence: message.sequence })
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(desc(message.sequence))
    .limit(1);
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
  const last = await db
    .select({ sequence: message.sequence })
    .from(message)
    .where(eq(message.conversationId, input.conversationId))
    .orderBy(desc(message.sequence))
    .limit(1);
  const [row] = await db
    .insert(message)
    .values({
      conversationId: input.conversationId,
      sequence: (last[0]?.sequence ?? 0) + 1,
      sender: "persona",
      personaId: input.personaId,
      contentMarkdown: annotated.markdown,
      citations: annotated.citations.map((c) => ({
        tag: c.tag,
        locatorId: c.locatorId,
        assetId: c.assetId,
        passageId: c.passageId,
        label: c.label,
      })),
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
