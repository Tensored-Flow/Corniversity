import { and, desc, eq, inArray, isNull, max } from "drizzle-orm";
import type { DbOrTx } from "../client";
import {
  assessmentRun,
  assistanceEvent,
  attempt,
  conversation,
  type HelpMode,
  learningSession,
  message,
  notebookEntry,
  type StudyAnchor,
  submissionVersion,
  teachingUnit,
  transcriptionVersion,
} from "../schema/index";
import { completeSession, getSession, type LearningSessionRow } from "./learning";
import { createEntry } from "./notebook";

/**
 * Continuity of one study session: where the learner was, what is saved and where, and what is
 * left open. Every fact here is read from a record; nothing is summarised by a model, and closing
 * a session never marks a concept understood.
 */

const ANCHOR = /^[a-z0-9][a-z0-9-]{0,119}$/;

export async function pauseSession(db: DbOrTx, ownerId: string, sessionId: string): Promise<void> {
  const session = await getSession(db, ownerId, sessionId);
  if (!session) return;
  await db
    .update(learningSession)
    .set({ state: { ...session.state, pausedAt: new Date().toISOString() }, lastActiveAt: new Date() })
    .where(eq(learningSession.id, sessionId));
}

/** Opening a paused session resumes it; the position and the work are where they were left. */
export async function resumeSession(db: DbOrTx, ownerId: string, sessionId: string): Promise<LearningSessionRow | null> {
  const session = await getSession(db, ownerId, sessionId);
  if (!session) return null;
  const { pausedAt: _paused, ...state } = session.state;
  const [row] = await db
    .update(learningSession)
    .set({ state, lastActiveAt: new Date() })
    .where(eq(learningSession.id, sessionId))
    .returning();
  return row ?? null;
}

/** The lesson heading last in view, so another device opens the reading there. */
export async function saveReaderAnchor(db: DbOrTx, ownerId: string, sessionId: string, anchor: string): Promise<boolean> {
  if (!ANCHOR.test(anchor)) return false;
  const session = await getSession(db, ownerId, sessionId);
  if (!session) return false;
  await db
    .update(learningSession)
    .set({ state: { ...session.state, readerAnchor: anchor }, lastActiveAt: new Date() })
    .where(eq(learningSession.id, sessionId));
  return true;
}

/** How far the learner got in an external reading, in their words; never inferred. */
export async function saveExternalProgress(db: DbOrTx, ownerId: string, sessionId: string, text: string): Promise<boolean> {
  const value = text.trim().slice(0, 300);
  const session = await getSession(db, ownerId, sessionId);
  if (!session || !value) return false;
  await db
    .update(learningSession)
    .set({ state: { ...session.state, externalProgress: { text: value, at: new Date().toISOString() } }, lastActiveAt: new Date() })
    .where(eq(learningSession.id, sessionId));
  return true;
}

export class StudySessionError extends Error {}

/**
 * A note or question written during a session, linked to the unit and to exactly what it points
 * at: a selection of the lesson, a source locator, a moment of an external lecture (typed by the
 * learner), or lines of the attempt.
 */
export async function addSessionNote(
  db: DbOrTx,
  ownerId: string,
  input: { sessionId: string; kind: "note" | "question"; body: string; anchor?: StudyAnchor | null; locatorLabel?: string },
) {
  const session = await getSession(db, ownerId, input.sessionId);
  if (!session) throw new StudySessionError("Session not found.");
  const body = input.body.trim();
  if (body.length < 2) throw new StudySessionError("Write the note first.");
  const [unit] = await db.select().from(teachingUnit).where(eq(teachingUnit.id, session.unitId)).limit(1);
  const anchor = input.anchor ? sanitiseAnchor(input.anchor) : null;
  const where =
    anchor?.kind === "timestamp" && anchor.timestampSec !== undefined
      ? ` at ${formatTimestamp(anchor.timestampSec)}`
      : anchor?.kind === "attempt_lines" && anchor.lines
        ? ` (attempt lines ${anchor.lines[0]}–${anchor.lines[1]})`
        : "";
  const title = `${input.kind === "question" ? "Question" : "Note"}: ${unit?.title ?? "study session"}${where}`;
  const quoted = anchor?.text ? `> ${anchor.text.replace(/\n/g, "\n> ")}\n\n` : "";
  return createEntry(db, ownerId, {
    title,
    bodyMarkdown: `${quoted}${body}`,
    kind: input.kind,
    tags: ["session", input.kind],
    sourceLinks: anchor?.locatorId ? [{ tag: "S1", locatorId: anchor.locatorId, label: input.locatorLabel ?? "source" }] : [],
    unitId: session.unitId,
    learningSessionId: session.id,
    anchor,
  });
}

function sanitiseAnchor(a: StudyAnchor): StudyAnchor {
  const out: StudyAnchor = { kind: a.kind };
  if (a.text) out.text = a.text.slice(0, 2000);
  if (a.unitId) out.unitId = a.unitId.slice(0, 80);
  if (a.locatorId && /^[0-9a-f-]{36}$/.test(a.locatorId)) out.locatorId = a.locatorId;
  if (typeof a.timestampSec === "number" && Number.isFinite(a.timestampSec) && a.timestampSec >= 0)
    out.timestampSec = Math.floor(a.timestampSec);
  if (a.lines?.every((n) => Number.isInteger(n) && n > 0)) out.lines = [Math.min(...a.lines), Math.max(...a.lines)] as [number, number];
  if (a.pageId && /^[0-9a-f-]{36}$/.test(a.pageId)) out.pageId = a.pageId;
  return out;
}

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** Parses "mm:ss" or "h:mm:ss" as typed by the learner. */
export function parseTimestamp(text: string): number | null {
  const parts = text.trim().split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p) && !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n > 59)) return null;
  return nums.reduce((acc, n) => acc * 60 + n, 0);
}

/** Records a help request as provenance. */
export async function recordAssistance(
  db: DbOrTx,
  input: {
    ownerId: string;
    sessionId?: string | null;
    attemptId?: string | null;
    exerciseId?: string | null;
    mode: HelpMode;
    anchor?: StudyAnchor | null;
    providerRunId?: string | null;
  },
): Promise<string> {
  const [row] = await db
    .insert(assistanceEvent)
    .values({
      ownerId: input.ownerId,
      learningSessionId: input.sessionId ?? null,
      attemptId: input.attemptId ?? null,
      exerciseId: input.exerciseId ?? null,
      mode: input.mode,
      anchor: input.anchor ? sanitiseAnchor(input.anchor) : null,
      providerRunId: input.providerRunId ?? null,
    })
    .returning({ id: assistanceEvent.id });
  return row!.id;
}

export async function attachRunToAssistance(db: DbOrTx, assistanceId: string, providerRunId: string): Promise<void> {
  await db.update(assistanceEvent).set({ providerRunId }).where(eq(assistanceEvent.id, assistanceId));
}

/** Help asked for on an attempt, counted by kind, for disclosure with a submission. */
export async function assistanceCounts(db: DbOrTx, ownerId: string, attemptId: string): Promise<Partial<Record<HelpMode, number>>> {
  const rows = await db
    .select({ mode: assistanceEvent.mode })
    .from(assistanceEvent)
    .where(and(eq(assistanceEvent.ownerId, ownerId), eq(assistanceEvent.attemptId, attemptId)));
  const counts: Partial<Record<HelpMode, number>> = {};
  for (const r of rows) counts[r.mode] = (counts[r.mode] ?? 0) + 1;
  return counts;
}

export interface Continuity {
  /** The latest moment something from this session was saved on the server, and what it was. */
  lastDurable: { what: string; at: Date } | null;
  readerAnchor?: string;
  externalProgress?: { text: string; at: string };
  pausedAt?: string;
  notes: number;
  openQuestions: { id: string; title: string }[];
  pendingAssessment: boolean;
  unconfirmedTranscription: boolean;
}

export async function sessionContinuity(
  db: DbOrTx,
  ownerId: string,
  session: LearningSessionRow,
  exerciseIds: string[],
): Promise<Continuity> {
  const candidates: { what: string; at: Date }[] = [];
  const attempts = exerciseIds.length
    ? await db
        .select()
        .from(attempt)
        .where(and(eq(attempt.ownerId, ownerId), inArray(attempt.exerciseId, exerciseIds)))
    : [];
  for (const a of attempts) if (a.draftSavedAt) candidates.push({ what: `your attempt (revision ${a.draftRevision})`, at: a.draftSavedAt });
  const notes = await db
    .select({
      id: notebookEntry.id,
      title: notebookEntry.title,
      kind: notebookEntry.kind,
      resolved: notebookEntry.resolved,
      at: notebookEntry.updatedAt,
    })
    .from(notebookEntry)
    .where(and(eq(notebookEntry.ownerId, ownerId), eq(notebookEntry.learningSessionId, session.id)))
    .orderBy(desc(notebookEntry.updatedAt));
  if (notes[0]) candidates.push({ what: notes[0].kind === "question" ? "a question" : "a note", at: notes[0].at });
  const [lastMessage] = await db
    .select({ at: max(message.createdAt) })
    .from(message)
    .innerJoin(conversation, eq(message.conversationId, conversation.id))
    .where(and(eq(conversation.ownerId, ownerId), eq(conversation.learningSessionId, session.id)));
  if (lastMessage?.at) candidates.push({ what: "the tutor conversation", at: lastMessage.at });
  if (session.state.readerAnchor || session.state.externalProgress)
    candidates.push({ what: "your reading position", at: session.lastActiveAt });

  const attemptIds = attempts.map((a) => a.id);
  let pendingAssessment = false;
  let unconfirmedTranscription = false;
  if (attemptIds.length) {
    const runs = await db
      .select({ status: assessmentRun.status })
      .from(assessmentRun)
      .innerJoin(submissionVersion, eq(assessmentRun.submissionVersionId, submissionVersion.id))
      .where(inArray(submissionVersion.attemptId, attemptIds));
    pendingAssessment = runs.some((r) => r.status === "queued" || r.status === "reviewing");
    const transcriptions = await db
      .select({
        attemptId: transcriptionVersion.attemptId,
        version: transcriptionVersion.version,
        confirmedAt: transcriptionVersion.confirmedAt,
      })
      .from(transcriptionVersion)
      .where(inArray(transcriptionVersion.attemptId, attemptIds))
      .orderBy(desc(transcriptionVersion.version));
    const latest = new Map<string, (typeof transcriptions)[number]>();
    for (const t of transcriptions) if (!latest.has(t.attemptId)) latest.set(t.attemptId, t);
    unconfirmedTranscription = [...latest.values()].some((t) => !t.confirmedAt);
  }
  candidates.sort((a, b) => b.at.getTime() - a.at.getTime());
  return {
    lastDurable: candidates[0] ?? null,
    readerAnchor: session.state.readerAnchor,
    externalProgress: session.state.externalProgress,
    pausedAt: session.state.pausedAt,
    notes: notes.length,
    openQuestions: notes.filter((n) => n.kind === "question" && !n.resolved).map((n) => ({ id: n.id, title: n.title })),
    pendingAssessment,
    unconfirmedTranscription,
  };
}

export interface CloseFacts {
  saved: string[];
  unresolved: string[];
  nextStep: string | null;
}

/** What closing the session would say, from the records alone. */
export async function sessionCloseFacts(
  db: DbOrTx,
  ownerId: string,
  session: LearningSessionRow,
  exerciseIds: string[],
  next: { title: string } | null,
): Promise<CloseFacts> {
  const c = await sessionContinuity(db, ownerId, session, exerciseIds);
  const saved: string[] = [];
  if (c.lastDurable) saved.push(`Last saved on the server: ${c.lastDurable.what}.`);
  if (c.notes)
    saved.push(`${c.notes} note${c.notes === 1 ? "" : "s"} or question${c.notes === 1 ? "" : "s"} from this session in your notebook.`);
  if (c.readerAnchor) saved.push("Your place in the lesson.");
  if (c.externalProgress) saved.push(`Your progress in the external reading: "${c.externalProgress.text}".`);
  const unresolved: string[] = [];
  for (const q of c.openQuestions) unresolved.push(q.title);
  if (c.pendingAssessment) unresolved.push("A submission is still being assessed.");
  if (c.unconfirmedTranscription) unresolved.push("A transcription of your pages is not yet confirmed.");
  const nextStep = c.unconfirmedTranscription
    ? "Confirm the transcription of your pages."
    : c.pendingAssessment
      ? "Read the feedback when it arrives."
      : c.openQuestions[0]
        ? `Return to your question: ${c.openQuestions[0].title}.`
        : next
          ? `Next in the unit: ${next.title}.`
          : null;
  return { saved, unresolved, nextStep };
}

/**
 * Closes the session for now (it stays open and resumable) or as finished. The learner's summary
 * is kept as they wrote it; the facts beside it are computed from records when shown.
 */
export async function closeStudySession(
  db: DbOrTx,
  ownerId: string,
  sessionId: string,
  input: { summary: string; finished: boolean },
): Promise<void> {
  const session = await getSession(db, ownerId, sessionId);
  if (!session) throw new StudySessionError("Session not found.");
  const summary = input.summary.trim().slice(0, 4000) || undefined;
  if (input.finished) {
    await completeSession(db, ownerId, sessionId, summary);
    return;
  }
  await db
    .update(learningSession)
    .set({ state: { ...session.state, summary, pausedAt: new Date().toISOString() }, lastActiveAt: new Date() })
    .where(eq(learningSession.id, sessionId));
}

/** Sessions the learner left paused or open, most recent first: what *Continue* resumes. */
export async function resumableSessions(db: DbOrTx, ownerId: string, limit = 5) {
  return db
    .select()
    .from(learningSession)
    .where(and(eq(learningSession.ownerId, ownerId), eq(learningSession.status, "open"), isNull(learningSession.endedAt)))
    .orderBy(desc(learningSession.lastActiveAt))
    .limit(limit);
}

/** Notes and questions written in this session, newest first. */
export async function sessionNotes(db: DbOrTx, ownerId: string, sessionId: string) {
  return db
    .select()
    .from(notebookEntry)
    .where(and(eq(notebookEntry.ownerId, ownerId), eq(notebookEntry.learningSessionId, sessionId)))
    .orderBy(desc(notebookEntry.createdAt))
    .limit(30);
}
