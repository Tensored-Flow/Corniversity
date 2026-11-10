"use server";
import { ASSESSOR_PROMPT_VERSION, modelLabel, ROLE_CONTRACTS } from "@corniversity/ai";
import { getEnv } from "@corniversity/db/env";
import { teachingUnit } from "@corniversity/db/schema/index";
import { getUnitDetail } from "@corniversity/db/services/catalogue";
import { recordEvidence } from "@corniversity/db/services/evidence";
import { requestPredictAgain } from "@corniversity/db/services/lab-predictions";
import {
  completeSession,
  fileReview,
  getOrCreateAttempt,
  getSession,
  LearningError,
  requestHint,
  revealReference,
  saveDraft,
  startAttempt,
  submitAttempt,
} from "@corniversity/db/services/learning";
import { createEntry } from "@corniversity/db/services/notebook";
import {
  confirmTranscription,
  moveWorkPage,
  PaperWorkError,
  removeWorkPage,
  requestModelTranscription,
  rotateWorkPage,
  saveTranscription,
  submitPaperAttempt,
  withdrawTranscriptionConsent,
} from "@corniversity/db/services/paper-work";
import { resolveProviderState } from "@corniversity/db/services/provider-config";
import { scheduleRevisionForUnit } from "@corniversity/db/services/revision";
import {
  addSessionNote,
  assistanceCounts,
  closeStudySession,
  parseTimestamp,
  pauseSession,
  recordAssistance,
  StudySessionError,
  saveExternalProgress,
  saveReaderAnchor,
} from "@corniversity/db/services/study-session";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { blobs } from "@/lib/blobs";
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
  /** The draft revision after a submission saved the submitted text. */
  revision?: number;
}

const Ids = z.object({ sessionId: z.string().uuid(), exerciseId: z.string().min(1) });

export type DraftResult =
  | { ok: true; status: "saved"; revision: number; savedAt: string }
  | { ok: true; status: "conflict"; revision: number; savedAt: string | null; serverDraft: string }
  | { ok: false; error: string };

/**
 * Saves a draft on top of the revision the editor started from. If another device saved since,
 * nothing is overwritten: the newer draft comes back as a conflict for the learner to resolve.
 */
export async function saveDraftAction(sessionId: string, exerciseId: string, draft: string, baseRevision: number): Promise<DraftResult> {
  const auth = await requireSession();
  const ids = Ids.safeParse({ sessionId, exerciseId });
  if (!ids.success || !Number.isInteger(baseRevision) || baseRevision < 0) return { ok: false, error: "Invalid identifiers." };
  if (!(await getSession(db(), auth.user.id, sessionId))) return { ok: false, error: "Session not found." };
  const attempt = await getOrCreateAttempt(db(), { ownerId: auth.user.id, exerciseId, sessionId });
  const result = await saveDraft(db(), auth.user.id, attempt.id, draft.slice(0, 50_000), { baseRevision });
  if (result.status === "saved") return { ok: true, status: "saved", revision: result.revision, savedAt: result.savedAt.toISOString() };
  if (result.status === "conflict") {
    return {
      ok: true,
      status: "conflict",
      revision: result.revision,
      savedAt: result.savedAt?.toISOString() ?? null,
      serverDraft: result.draftMarkdown,
    };
  }
  return { ok: false, error: "Attempt not found." };
}

export async function requestHintAction(sessionId: string, exerciseId: string): Promise<ActionResult> {
  const auth = await requireSession();
  const ids = Ids.safeParse({ sessionId, exerciseId });
  if (!ids.success) return { ok: false, error: "Invalid identifiers." };
  const attempt = await getOrCreateAttempt(db(), { ownerId: auth.user.id, exerciseId, sessionId });
  const result = await requestHint(db(), auth.user.id, attempt.id);
  if (result.hint) {
    await recordAssistance(db(), { ownerId: auth.user.id, sessionId, attemptId: attempt.id, exerciseId, mode: "hint_ladder" });
  }
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
  // The configuration intended at submission; the worker records what actually assessed it.
  const state = await resolveProviderState(db(), auth.user.id, env);
  const attempt = await getOrCreateAttempt(db(), { ownerId: auth.user.id, exerciseId, sessionId });
  let revision: number | undefined;
  try {
    await db().transaction(async (tx) => {
      const saved = await saveDraft(tx, auth.user.id, attempt.id, text);
      if (saved.status === "saved") revision = saved.revision;
      await submitAttempt(tx, {
        ownerId: auth.user.id,
        attemptId: attempt.id,
        contentMarkdown: text,
        assistanceDisclosed: {
          hintsUsed: attempt.hintsUsed,
          peersConsulted: false,
          externalSources: [],
          help: await assistanceCounts(tx, auth.user.id, attempt.id),
        },
        graderConfig: {
          provider: state.mode === "scripted" ? "fixture" : "anthropic",
          model: state.mode === "scripted" ? "fixture" : state.model,
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
  return { ok: true, revision };
}

export async function revealReferenceAction(sessionId: string, exerciseId: string): Promise<ActionResult> {
  const auth = await requireSession();
  const ids = Ids.safeParse({ sessionId, exerciseId });
  if (!ids.success) return { ok: false, error: "Invalid identifiers." };
  const attempt = await getOrCreateAttempt(db(), { ownerId: auth.user.id, exerciseId, sessionId });
  try {
    const { markdown } = await revealReference(db(), auth.user.id, attempt.id);
    await recordAssistance(db(), { ownerId: auth.user.id, sessionId, attemptId: attempt.id, exerciseId, mode: "reference_reveal" });
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
    await fileReview(db(), {
      ownerId: auth.user.id,
      assessmentRunId: parsed.data.assessmentRunId,
      kind: parsed.data.kind,
      note: parsed.data.note,
    });
  } catch (error) {
    if (error instanceof LearningError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath(`/sessions/${parsed.data.sessionId}`);
  return { ok: true };
}

/**
 * A laboratory records nothing by itself. The learner's interpretation becomes a notebook entry
 * linked to the activity's sources; when the laboratory has no graded report it also counts as
 * practice evidence (never as a demonstration) for the unit's concepts.
 */
export async function recordLabInterpretationAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await requireSession();
  const sessionId = String(formData.get("sessionId") ?? "");
  const text = String(formData.get("interpretation") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/.test(sessionId)) return { ok: false, error: "Invalid session." };
  if (text.length < 40)
    return { ok: false, error: "Say what the model did and why, in a few sentences; a number alone is not an interpretation." };
  const session = await getSession(db(), auth.user.id, sessionId);
  if (!session) return { ok: false, error: "Session not found." };
  const unitDetail = await getUnitDetail(db(), session.unitId);
  const activity = unitDetail?.unit.activities.find((a) => a.id === session.activityId);
  if (!unitDetail || !activity?.labId) return { ok: false, error: "This session has no laboratory." };
  const locators = unitDetail.locators.filter((l) => activity.sourceLocatorIds.includes(l.id));
  await createEntry(db(), auth.user.id, {
    title: /^laboratory/i.test(activity.title) ? activity.title : `Laboratory: ${activity.title}`,
    bodyMarkdown: text.slice(0, 20_000),
    kind: "calculation",
    tags: ["lab", activity.labId, unitDetail.course.id],
    sourceLinks: locators.map((l, i) => ({ tag: `L${i + 1}`, locatorId: l.id, label: l.label })),
    courseId: unitDetail.course.id,
    unitId: unitDetail.unit.id,
  });
  if (activity.exerciseIds.length === 0) {
    await recordEvidence(db(), {
      ownerId: auth.user.id,
      conceptIds: unitDetail.unit.teachesConceptIds,
      activityRef: `activity:${activity.id}`,
      evidenceType: "practice",
      source: "laboratory interpretation written by the learner",
      assistance: "none",
      interpretation: `The learner interpreted the ${activity.labId} laboratory in their own words (${text.length} characters). Practice evidence; not an assessment.`,
    });
  }
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/notebook");
  revalidatePath("/studies");
  return { ok: true };
}

/**
 * Saves the learner's prediction before a laboratory shows its results. It is a notebook note,
 * tagged as a prediction; it records no evidence, because a prediction is not understanding.
 */
export async function recordLabPredictionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await requireSession();
  const sessionId = String(formData.get("sessionId") ?? "");
  const labId = String(formData.get("labId") ?? "");
  const text = String(formData.get("prediction") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/.test(sessionId) || !/^[a-z0-9-]{1,60}$/.test(labId)) return { ok: false, error: "Invalid session." };
  if (text.length < 40) return { ok: false, error: "Write your prediction in a sentence or two: what you expect, and why." };
  const session = await getSession(db(), auth.user.id, sessionId);
  if (!session) return { ok: false, error: "Session not found." };
  const unitDetail = await getUnitDetail(db(), session.unitId);
  const activity = unitDetail?.unit.activities.find((a) => a.id === session.activityId);
  if (!unitDetail || activity?.labId !== labId) return { ok: false, error: "This session has no such laboratory." };
  await createEntry(db(), auth.user.id, {
    title: `Prediction before running: ${activity.title}`,
    bodyMarkdown: text.slice(0, 10_000),
    kind: "note",
    tags: ["lab", "prediction", labId, unitDetail.course.id],
    sourceLinks: [],
    courseId: unitDetail.course.id,
    unitId: unitDetail.unit.id,
  });
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}

/** A deliberate reattempt: the laboratory's results are hidden again until a new prediction is saved. */
export async function predictAgainAction(formData: FormData): Promise<void> {
  const auth = await requireSession();
  const sessionId = String(formData.get("sessionId") ?? "");
  const labId = String(formData.get("labId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(sessionId) || !/^[a-z0-9-]{1,60}$/.test(labId)) return;
  const session = await getSession(db(), auth.user.id, sessionId);
  if (!session) return;
  const unitDetail = await getUnitDetail(db(), session.unitId);
  const activity = unitDetail?.unit.activities.find((a) => a.id === session.activityId);
  if (!unitDetail || activity?.labId !== labId) return;
  await requestPredictAgain(db(), auth.user.id, unitDetail.unit.id, labId);
  revalidatePath(`/sessions/${sessionId}`);
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
    await scheduleRevisionForUnit(db(), auth.user.id, unit.id);
  }
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/campus");
}

async function ownAttempt(sessionId: string, exerciseId: string) {
  const auth = await requireSession();
  const ids = Ids.safeParse({ sessionId, exerciseId });
  if (!ids.success) throw new PaperWorkError("not_found", "Invalid identifiers.");
  if (!(await getSession(db(), auth.user.id, sessionId))) throw new PaperWorkError("not_found", "Session not found.");
  const attempt = await getOrCreateAttempt(db(), { ownerId: auth.user.id, exerciseId, sessionId });
  return { ownerId: auth.user.id, attempt };
}

async function paperAction(sessionId: string, run: () => Promise<void>): Promise<ActionResult> {
  try {
    await run();
  } catch (error) {
    if (error instanceof PaperWorkError || error instanceof LearningError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}

export async function rotatePageAction(sessionId: string, pageId: string, quarterTurns: number): Promise<ActionResult> {
  const auth = await requireSession();
  return paperAction(sessionId, () => rotateWorkPage(db(), auth.user.id, pageId, quarterTurns === -1 ? -1 : 1));
}

export async function movePageAction(sessionId: string, pageId: string, direction: number): Promise<ActionResult> {
  const auth = await requireSession();
  return paperAction(sessionId, () => moveWorkPage(db(), auth.user.id, pageId, direction < 0 ? -1 : 1));
}

export async function removePageAction(sessionId: string, pageId: string): Promise<ActionResult> {
  const auth = await requireSession();
  return paperAction(sessionId, () => removeWorkPage(db(), blobs(), auth.user.id, pageId));
}

export async function saveTranscriptionAction(sessionId: string, exerciseId: string, text: string): Promise<ActionResult> {
  return paperAction(sessionId, async () => {
    const { ownerId, attempt } = await ownAttempt(sessionId, exerciseId);
    await saveTranscription(db(), { ownerId, attemptId: attempt.id, text });
  });
}

export async function confirmTranscriptionAction(sessionId: string, exerciseId: string, text: string): Promise<ActionResult> {
  return paperAction(sessionId, async () => {
    const { ownerId, attempt } = await ownAttempt(sessionId, exerciseId);
    await saveTranscription(db(), { ownerId, attemptId: attempt.id, text });
    await confirmTranscription(db(), ownerId, attempt.id);
  });
}

export async function submitPaperAction(sessionId: string, exerciseId: string): Promise<ActionResult> {
  return paperAction(sessionId, async () => {
    const { ownerId, attempt } = await ownAttempt(sessionId, exerciseId);
    const state = await resolveProviderState(db(), ownerId, getEnv());
    await db().transaction(async (tx) => {
      await submitPaperAttempt(tx, {
        ownerId,
        attemptId: attempt.id,
        graderConfig: {
          provider: state.mode === "scripted" ? "fixture" : "anthropic",
          model: state.mode === "scripted" ? "fixture" : state.model,
          promptVersion: ASSESSOR_PROMPT_VERSION,
          roleVersion: ROLE_CONTRACTS.assessor.version,
        },
      });
    });
  });
}

/** Queues a model transcription of the pages, only with the learner's explicit consent for them. */
export async function requestTranscriptionAction(sessionId: string, exerciseId: string, consent: boolean): Promise<ActionResult> {
  return paperAction(sessionId, async () => {
    const { ownerId, attempt } = await ownAttempt(sessionId, exerciseId);
    const state = await resolveProviderState(db(), ownerId, getEnv());
    if (state.mode !== "live") {
      throw new PaperWorkError(
        "unavailable",
        state.mode === "scripted"
          ? "No transcription model is configured (scripted demo), so nothing can read the photographs. Transcribe them yourself below."
          : `The live model is blocked: ${state.reason}`,
      );
    }
    await requestModelTranscription(db(), {
      ownerId,
      attemptId: attempt.id,
      consent,
      providerLabel: `Anthropic (${modelLabel(state.model)})`,
    });
  });
}

export async function withdrawTranscriptionAction(sessionId: string, exerciseId: string): Promise<ActionResult> {
  return paperAction(sessionId, async () => {
    const { ownerId, attempt } = await ownAttempt(sessionId, exerciseId);
    await withdrawTranscriptionConsent(db(), ownerId, attempt.id);
  });
}

/** Pauses the session where it is and returns to Today. Nothing is graded. */
export async function pauseSessionAction(formData: FormData): Promise<void> {
  const auth = await requireSession();
  const sessionId = String(formData.get("sessionId") ?? "");
  await pauseSession(db(), auth.user.id, sessionId);
  revalidatePath("/campus");
  redirect("/campus?paused=1");
}

export async function saveReaderAnchorAction(sessionId: string, anchor: string): Promise<ActionResult> {
  const auth = await requireSession();
  return { ok: await saveReaderAnchor(db(), auth.user.id, sessionId, anchor) };
}

export async function saveExternalProgressAction(sessionId: string, text: string): Promise<ActionResult> {
  const auth = await requireSession();
  const ok = await saveExternalProgress(db(), auth.user.id, sessionId, text);
  if (ok) revalidatePath(`/sessions/${sessionId}`);
  return ok ? { ok } : { ok, error: "Write how far you got first." };
}

export interface NoteInput {
  kind: "note" | "question";
  body: string;
  selection?: string | null;
  timestamp?: string | null;
  locatorId?: string | null;
  locatorLabel?: string | null;
}

/** A note or question written in the session, anchored to the selection, a source or a lecture moment. */
export async function addSessionNoteAction(sessionId: string, input: NoteInput): Promise<ActionResult> {
  const auth = await requireSession();
  const seconds = input.timestamp ? parseTimestamp(input.timestamp) : null;
  if (input.timestamp && seconds === null) return { ok: false, error: "Write the time as minutes:seconds, for example 12:34." };
  try {
    await addSessionNote(db(), auth.user.id, {
      sessionId,
      kind: input.kind === "question" ? "question" : "note",
      body: input.body,
      locatorLabel: input.locatorLabel ?? undefined,
      anchor:
        seconds !== null
          ? { kind: "timestamp", timestampSec: seconds, locatorId: input.locatorId ?? undefined }
          : input.selection
            ? { kind: "selection", text: input.selection }
            : input.locatorId
              ? { kind: "locator", locatorId: input.locatorId }
              : null,
    });
  } catch (error) {
    if (error instanceof StudySessionError || error instanceof Error) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/notebook");
  return { ok: true };
}

/**
 * Closes the session with the learner's summary: paused and resumable, or finished. Finishing a
 * reading records only that it was read (introduced), exactly as "Mark as read" does.
 */
export async function closeSessionAction(formData: FormData): Promise<void> {
  const auth = await requireSession();
  const sessionId = String(formData.get("sessionId") ?? "");
  const finished = formData.get("finished") === "1";
  const session = await getSession(db(), auth.user.id, sessionId);
  if (!session) redirect("/campus");
  await closeStudySession(db(), auth.user.id, sessionId, { summary: String(formData.get("summary") ?? ""), finished });
  if (finished && session.sessionKind === "lecture") {
    const [unit] = await db().select().from(teachingUnit).where(eq(teachingUnit.id, session.unitId)).limit(1);
    if (unit) {
      await recordEvidence(db(), {
        ownerId: auth.user.id,
        conceptIds: unit.teachesConceptIds,
        activityRef: `activity:${session.activityId}`,
        evidenceType: "reading",
        source: "learner marked the reading complete",
        assistance: "none",
        interpretation: "Reading completed; this introduces the concepts and is not evidence of understanding.",
      });
      await scheduleRevisionForUnit(db(), auth.user.id, unit.id);
    }
  }
  revalidatePath("/campus");
  redirect(finished ? "/campus?finished=1" : "/campus?paused=1");
}

/** A deliberate new attempt (after acceptance), or the mode of a fresh one: practice or self-test. */
export async function startAttemptAction(sessionId: string, exerciseId: string, mode: "practice" | "self_test"): Promise<ActionResult> {
  const auth = await requireSession();
  const ids = Ids.safeParse({ sessionId, exerciseId });
  if (!ids.success || (mode !== "practice" && mode !== "self_test")) return { ok: false, error: "Invalid request." };
  if (!(await getSession(db(), auth.user.id, sessionId))) return { ok: false, error: "Session not found." };
  try {
    await startAttempt(db(), { ownerId: auth.user.id, exerciseId, sessionId, mode });
  } catch (error) {
    if (error instanceof LearningError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}
