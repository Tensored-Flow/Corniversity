import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "../../test/fixtures";
import { createDb } from "../client";
import { stopBoss } from "../queue";
import { getOrCreateAttempt, getSession, saveDraft, startOrResumeSession } from "./learning";
import {
  addSessionNote,
  assistanceCounts,
  closeStudySession,
  parseTimestamp,
  pauseSession,
  recordAssistance,
  resumeSession,
  StudySessionError,
  saveExternalProgress,
  saveReaderAnchor,
  sessionCloseFacts,
  sessionContinuity,
} from "./study-session";

/**
 * Continuity of a study session against PostgreSQL: the position, the notes, the questions and
 * the work survive a pause and a second device, and the close reports only recorded facts.
 */
let handle: ReturnType<typeof createDb>;
let fx: Fixture;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  fx = await createFixture(handle.db, "session");
});

afterAll(async () => {
  await fx.cleanup();
  await stopBoss();
  await handle.close();
});

describe("a reading session", () => {
  it("keeps the reading position on the server, so a second device opens at the same heading", async () => {
    const { session } = await startOrResumeSession(handle.db, { ownerId: fx.ownerId, unitId: fx.unitId, activityId: fx.readingActivityId });
    expect(await saveReaderAnchor(handle.db, fx.ownerId, session.id, "completeness-of-c-x")).toBe(true);
    expect(await saveReaderAnchor(handle.db, fx.ownerId, session.id, "<script>")).toBe(false);
    expect(await saveReaderAnchor(handle.db, "someone-else", session.id, "intro")).toBe(false);
    // The "second device" is simply a fresh read of the same session.
    const again = await startOrResumeSession(handle.db, { ownerId: fx.ownerId, unitId: fx.unitId, activityId: fx.readingActivityId });
    expect(again.created).toBe(false);
    expect((await getSession(handle.db, fx.ownerId, session.id))?.state.readerAnchor).toBe("completeness-of-c-x");
  });

  it("pauses and resumes without losing the position", async () => {
    const { session } = await startOrResumeSession(handle.db, { ownerId: fx.ownerId, unitId: fx.unitId, activityId: fx.readingActivityId });
    await pauseSession(handle.db, fx.ownerId, session.id);
    expect((await getSession(handle.db, fx.ownerId, session.id))?.state.pausedAt).toBeTruthy();
    const resumed = await resumeSession(handle.db, fx.ownerId, session.id);
    expect(resumed?.state.pausedAt).toBeUndefined();
    expect(resumed?.state.readerAnchor).toBe("completeness-of-c-x");
  });

  it("records manual progress in an external reading in the learner's words, never inferred", async () => {
    const { session } = await startOrResumeSession(handle.db, { ownerId: fx.ownerId, unitId: fx.unitId, activityId: fx.readingActivityId });
    expect(await saveExternalProgress(handle.db, fx.ownerId, session.id, "Read to §2.3, Example 2.7")).toBe(true);
    expect((await getSession(handle.db, fx.ownerId, session.id))?.state.externalProgress?.text).toBe("Read to §2.3, Example 2.7");
  });
});

describe("notes, questions and the close", () => {
  it("links a timestamp note and a selection question to the session, and the close lists the open question", async () => {
    const { session } = await startOrResumeSession(handle.db, { ownerId: fx.ownerId, unitId: fx.unitId, activityId: fx.readingActivityId });
    const note = await addSessionNote(handle.db, fx.ownerId, {
      sessionId: session.id,
      kind: "note",
      body: "The lecturer proves completeness by an ε/3 argument here.",
      anchor: { kind: "timestamp", timestampSec: parseTimestamp("12:34")! },
    });
    expect(note.title).toContain("at 12:34");
    expect(note.learningSessionId).toBe(session.id);
    const question = await addSessionNote(handle.db, fx.ownerId, {
      sessionId: session.id,
      kind: "question",
      body: "Why is completeness needed here and not just closedness?",
      anchor: { kind: "selection", text: "A complete normed space is a Banach space." },
    });
    expect(question.bodyMarkdown).toMatch(/^> A complete normed space is a Banach space\./);
    await expect(addSessionNote(handle.db, "someone-else", { sessionId: session.id, kind: "note", body: "intrusion" })).rejects.toThrow(
      StudySessionError,
    );
    const continuity = await sessionContinuity(handle.db, fx.ownerId, session, []);
    expect(continuity.openQuestions.map((q) => q.id)).toContain(question.id);
    expect(continuity.lastDurable).not.toBeNull();
    const facts = await sessionCloseFacts(handle.db, fx.ownerId, session, [], { title: "Prove" });
    expect(facts.unresolved).toContain(question.title);
    expect(facts.nextStep).toMatch(/^Return to your question/);
  });

  it("closes for now (still resumable) or as finished, keeping the learner's own summary", async () => {
    const { session } = await startOrResumeSession(handle.db, { ownerId: fx.ownerId, unitId: fx.unitId, activityId: fx.readingActivityId });
    await closeStudySession(handle.db, fx.ownerId, session.id, { summary: "Read to the proof of Theorem 16.", finished: false });
    const paused = await getSession(handle.db, fx.ownerId, session.id);
    expect(paused).toMatchObject({ status: "open" });
    expect(paused?.state.summary).toBe("Read to the proof of Theorem 16.");
    await closeStudySession(handle.db, fx.ownerId, session.id, { summary: "Finished the reading.", finished: true });
    expect(await getSession(handle.db, fx.ownerId, session.id)).toMatchObject({ status: "completed" });
  });
});

describe("work and help in a tutorial session", () => {
  it("reports the attempt as the last durable point and counts help by kind", async () => {
    const { session } = await startOrResumeSession(handle.db, {
      ownerId: fx.ownerId,
      unitId: fx.unitId,
      activityId: fx.tutorialActivityId,
    });
    const a = await getOrCreateAttempt(handle.db, { ownerId: fx.ownerId, exerciseId: fx.exerciseId, sessionId: session.id });
    await saveDraft(handle.db, fx.ownerId, a.id, "Let ε > 0 be given.", { baseRevision: a.draftRevision });
    await recordAssistance(handle.db, {
      ownerId: fx.ownerId,
      sessionId: session.id,
      attemptId: a.id,
      exerciseId: fx.exerciseId,
      mode: "small_hint",
    });
    await recordAssistance(handle.db, {
      ownerId: fx.ownerId,
      sessionId: session.id,
      attemptId: a.id,
      exerciseId: fx.exerciseId,
      mode: "check_step",
      anchor: { kind: "attempt_lines", lines: [1, 1] },
    });
    expect(await assistanceCounts(handle.db, fx.ownerId, a.id)).toEqual({ small_hint: 1, check_step: 1 });
    const continuity = await sessionContinuity(handle.db, fx.ownerId, session, [fx.exerciseId]);
    expect(continuity.lastDurable?.what).toMatch(/your attempt \(revision \d+\)/);
  });

  it("parses typed timestamps and refuses nonsense", () => {
    expect(parseTimestamp("1:05")).toBe(65);
    expect(parseTimestamp("1:02:03")).toBe(3723);
    expect(parseTimestamp("12:75")).toBeNull();
    expect(parseTimestamp("soon")).toBeNull();
  });
});
