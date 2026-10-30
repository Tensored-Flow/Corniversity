"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ASSESSOR_PROMPT_VERSION, ROLE_CONTRACTS } from "@corniversity/ai";
import { getEnv } from "@corniversity/db/env";
import { recordEvidence } from "@corniversity/db/services/evidence";
import {
  LearningError,
  completeSession,
  fileReview,
  getOrCreateAttempt,
  getSession,
  requestHint,
  revealReference,
  saveDraft,
  submitAttempt,
} from "@corniversity/db/services/learning";
import { resolveProviderConfig } from "@corniversity/db/services/provider-config";
import { teachingUnit } from "@corniversity/db/schema/index";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { requireSession } from "@/lib/session";

export interface ActionResult {
  ok: boolean;
  error?: string;
  hint?: string | null;
  hintIndex?: number;
  hintsTotal?: number;
  html?: string;
}

const Ids = z.object({ sessionId: z.string().uuid(), exerciseId: z.string().min(1) });

export async function saveDraftAction(sessionId: string, exerciseId: string, draft: string): Promise<ActionResult> {
  const auth = await requireSession();
  const ids = Ids.safeParse({ sessionId, exerciseId });
  if (!ids.success) return { ok: false, error: "Invalid identifiers." };
  const attempt = await getOrCreateAttempt(db(), { ownerId: auth.user.id, exerciseId, sessionId });
  await saveDraft(db(), auth.user.id, attempt.id, draft.slice(0, 50_000));
  return { ok: true };
}

export async function requestHintAction(sessionId: string, exerciseId: string): Promise<ActionResult> {
  const auth = await requireSession();
  const ids = Ids.safeParse({ sessionId, exerciseId });
  if (!ids.success) return { ok: false, error: "Invalid identifiers." };
  const attempt = await getOrCreateAttempt(db(), { ownerId: auth.user.id, exerciseId, sessionId });
  const result = await requestHint(db(), auth.user.id, attempt.id);
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, hint: result.hint, hintIndex: result.index, hintsTotal: result.total };
}

export async function submitAttemptAction(sessionId: string, exerciseId: string, content: string): Promise<ActionResult> {
  const auth = await requireSession();
  const ids = Ids.safeParse({ sessionId, exerciseId });
  if (!ids.success) return { ok: false, error: "Invalid identifiers." };
  const text = content.trim();
  if (text.length < 20) return { ok: false, error: "Write your attempt before submitting; a few words are not an attempt." };
  const env = getEnv();
  const config = await resolveProviderConfig(db(), auth.user.id, env);
  const attempt = await getOrCreateAttempt(db(), { ownerId: auth.user.id, exerciseId, sessionId });
  try {
    await db().transaction(async (tx) => {
      await saveDraft(tx, auth.user.id, attempt.id, text);
      await submitAttempt(tx, {
        ownerId: auth.user.id,
        attemptId: attempt.id,
        contentMarkdown: text,
        assistanceDisclosed: { hintsUsed: attempt.hintsUsed, peersConsulted: false, externalSources: [] },
        graderConfig: {
          provider: config.provider,
          model: config.provider === "fixture" ? "fixture" : (config.modelMap.assessor ?? config.defaultModel),
          promptVersion: ASSESSOR_PROMPT_VERSION,
          roleVersion: ROLE_CONTRACTS.assessor.version,
        },
      });
    });
  } catch (error) {
    if (error instanceof LearningError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}

export async function revealReferenceAction(sessionId: string, exerciseId: string): Promise<ActionResult> {
  const auth = await requireSession();
  const ids = Ids.safeParse({ sessionId, exerciseId });
  if (!ids.success) return { ok: false, error: "Invalid identifiers." };
  const attempt = await getOrCreateAttempt(db(), { ownerId: auth.user.id, exerciseId, sessionId });
  try {
    const { markdown } = await revealReference(db(), auth.user.id, attempt.id);
    revalidatePath(`/sessions/${sessionId}`);
    return { ok: true, html: await renderMarkdown(markdown) };
  } catch (error) {
    if (error instanceof LearningError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function fileReviewAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await requireSession();
  const parsed = z
    .object({
      assessmentRunId: z.string().uuid(),
      kind: z.enum(["appeal", "regrade", "learner_challenge"]),
      note: z.string().trim().min(10, "Say what you think the assessor missed (at least 10 characters)."),
      sessionId: z.string().uuid(),
    })
    .safeParse({
      assessmentRunId: formData.get("assessmentRunId"),
      kind: formData.get("kind"),
      note: formData.get("note"),
      sessionId: formData.get("sessionId"),
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  try {
    await fileReview(db(), { ownerId: auth.user.id, assessmentRunId: parsed.data.assessmentRunId, kind: parsed.data.kind, note: parsed.data.note });
  } catch (error) {
    if (error instanceof LearningError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath(`/sessions/${parsed.data.sessionId}`);
  return { ok: true };
}

export async function completeSessionAction(formData: FormData): Promise<void> {
  const auth = await requireSession();
  const sessionId = String(formData.get("sessionId") ?? "");
  const session = await getSession(db(), auth.user.id, sessionId);
  if (!session) return;
  const [unit] = await db().select().from(teachingUnit).where(eq(teachingUnit.id, session.unitId)).limit(1);
  await completeSession(db(), auth.user.id, sessionId);
  if (unit && session.sessionKind === "lecture") {
    await recordEvidence(db(), {
      ownerId: auth.user.id,
      conceptIds: unit.teachesConceptIds,
      activityRef: `activity:${session.activityId}`,
      evidenceType: "reading",
      source: "learner marked the reading complete",
      assistance: "none",
      interpretation: "Reading completed; this introduces the concepts and is not evidence of understanding.",
    });
  }
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/campus");
}
