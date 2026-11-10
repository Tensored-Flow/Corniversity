import { and, desc, eq, isNull } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { consentRecord } from "../schema/learner";
import { auditEvent } from "../schema/operations";

/**
 * Dictation uses the browser's own speech recognition. In Chrome and Edge the audio goes to the
 * browser maker's speech service; Corniversity never receives audio, only the text the learner
 * chooses to send. Dictation is offered only after this permission is recorded, and withdrawing
 * it hides the controls again. Reading aloud uses on-device voices only and needs no permission.
 */
export const VOICE_CONSENT_KIND = "voice-dictation-browser";

export async function voiceDictationAllowed(db: DbOrTx, ownerId: string): Promise<boolean> {
  const [latest] = await db
    .select({ granted: consentRecord.granted, revokedAt: consentRecord.revokedAt })
    .from(consentRecord)
    .where(and(eq(consentRecord.userId, ownerId), eq(consentRecord.kind, VOICE_CONSENT_KIND)))
    .orderBy(desc(consentRecord.recordedAt))
    .limit(1);
  return Boolean(latest?.granted && !latest.revokedAt);
}

export async function allowVoiceDictation(db: DbOrTx, ownerId: string): Promise<void> {
  if (await voiceDictationAllowed(db, ownerId)) return;
  await db.insert(consentRecord).values({
    userId: ownerId,
    kind: VOICE_CONSENT_KIND,
    granted: true,
    basis: `Learner agreed on ${new Date().toISOString()} to dictate with the browser's speech recognition, having been told that the browser may send the audio to its maker's speech service and that Corniversity receives only the text they choose to send.`,
  });
  await db
    .insert(auditEvent)
    .values({ ownerId, actor: "learner", action: "voice:allow-dictation", entity: "consent_record", entityId: null });
}

export async function withdrawVoiceDictation(db: DbOrTx, ownerId: string): Promise<void> {
  await db
    .update(consentRecord)
    .set({ revokedAt: new Date() })
    .where(and(eq(consentRecord.userId, ownerId), eq(consentRecord.kind, VOICE_CONSENT_KIND), isNull(consentRecord.revokedAt)));
  await db
    .insert(auditEvent)
    .values({ ownerId, actor: "learner", action: "voice:withdraw-dictation", entity: "consent_record", entityId: null });
}
