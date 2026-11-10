import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "../../test/fixtures";
import { createDb } from "../client";
import { assistanceEvent, conceptBridge, conceptState, learnerConceptOverride, notebookEntry } from "../schema/index";
import { answerBridgeCheck, openBridge, returnFromBridge, unitPrerequisiteView } from "./bridges";
import { startOrResumeSession } from "./learning";

/**
 * Concept bridges against PostgreSQL: a prerequisite stays listed without a prepared bridge,
 * evidence and availability stay apart, opening a bridge is assistance (never evidence), the
 * return path is exact, and trails stop at the cap or at a cycle.
 */
let handle: ReturnType<typeof createDb>;
let fx: Fixture;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  fx = await createFixture(handle.db, "bridge");
});

afterAll(async () => {
  await handle.db.delete(conceptBridge).where(eq(conceptBridge.conceptId, fx.prerequisiteConceptId));
  await fx.cleanup();
  await handle.close();
});

const body = "A bridge body long enough to teach something. ".repeat(12);

describe("prerequisite view", () => {
  it("lists the prerequisite with no bridge prepared, and reports a bridge without changing the evidence", async () => {
    const [before] = await unitPrerequisiteView(handle.db, fx.ownerId, fx.unitId);
    expect(before).toMatchObject({ conceptId: fx.prerequisiteConceptId, evidence: "not_shown", bridge: "unprepared" });
    await handle.db.insert(conceptBridge).values({
      conceptId: fx.prerequisiteConceptId,
      title: "Fixture bridge",
      summary: "test",
      bodyMarkdown: body,
      check: { prompt: "Why?", guidance: "Because." },
      origin: "original",
      status: "ready",
      contentHash: "h",
    });
    const [after] = await unitPrerequisiteView(handle.db, fx.ownerId, fx.unitId);
    expect(after).toMatchObject({ evidence: "not_shown", bridge: "prepared" });
  });

  it("separates a self-report from work, and never counts reading as work", async () => {
    await handle.db
      .insert(learnerConceptOverride)
      .values({ userId: fx.ownerId, conceptId: fx.prerequisiteConceptId, claim: "known", note: "test" });
    expect((await unitPrerequisiteView(handle.db, fx.ownerId, fx.unitId))[0]?.evidence).toBe("self_reported");
    await handle.db.insert(conceptState).values({ ownerId: fx.ownerId, conceptId: fx.prerequisiteConceptId, state: "introduced" });
    expect((await unitPrerequisiteView(handle.db, fx.ownerId, fx.unitId))[0]?.evidence).toBe("self_reported");
    await handle.db.update(conceptState).set({ state: "practised" }).where(eq(conceptState.ownerId, fx.ownerId));
    expect((await unitPrerequisiteView(handle.db, fx.ownerId, fx.unitId))[0]?.evidence).toBe("supported_by_work");
  });
});

describe("visiting a bridge", () => {
  it("records assistance and an exact return, keeps the self-check as a note, and adds no evidence", async () => {
    const { session } = await startOrResumeSession(handle.db, {
      ownerId: fx.ownerId,
      unitId: fx.unitId,
      activityId: fx.tutorialActivityId,
    });
    const path = `/sessions/${session.id}?exercise=${fx.exerciseId}#attempt`;
    const opened = await openBridge(handle.db, {
      ownerId: fx.ownerId,
      conceptId: fx.prerequisiteConceptId,
      trail: [],
      sessionId: session.id,
      returnTo: { path, label: "Prove", exerciseId: fx.exerciseId },
    });
    if (!opened.ok) throw new Error(opened.message);
    expect(opened.trail).toEqual([fx.prerequisiteConceptId]);
    const help = await handle.db.select().from(assistanceEvent).where(eq(assistanceEvent.ownerId, fx.ownerId));
    expect(help.some((h) => h.mode === "bridge_opened")).toBe(true);
    const stateBefore = await handle.db.select().from(conceptState).where(eq(conceptState.ownerId, fx.ownerId));
    await expect(answerBridgeCheck(handle.db, fx.ownerId, opened.visitId, "short")).rejects.toThrow(/at least a sentence/);
    await answerBridgeCheck(handle.db, fx.ownerId, opened.visitId, "Because the limit must exist inside the space.");
    const notes = await handle.db.select().from(notebookEntry).where(eq(notebookEntry.ownerId, fx.ownerId));
    expect(notes.some((n) => n.title.startsWith("Bridge self-check") && n.learningSessionId === session.id)).toBe(true);
    expect(await handle.db.select().from(conceptState).where(eq(conceptState.ownerId, fx.ownerId))).toEqual(stateBefore);
    expect(await returnFromBridge(handle.db, fx.ownerId, opened.visitId)).toBe(path);
    expect(await returnFromBridge(handle.db, "someone-else", opened.visitId)).toBeNull();
  });

  it("refuses a cycle, a third level, an unprepared bridge and a foreign return path", async () => {
    const returnTo = { path: "/sessions/x", label: "x" };
    const cycle = await openBridge(handle.db, {
      ownerId: fx.ownerId,
      conceptId: fx.prerequisiteConceptId,
      trail: [fx.prerequisiteConceptId],
      returnTo,
    });
    expect(cycle).toMatchObject({ ok: false, reason: "cycle" });
    const deep = await openBridge(handle.db, { ownerId: fx.ownerId, conceptId: fx.prerequisiteConceptId, trail: ["a", "b"], returnTo });
    expect(deep).toMatchObject({ ok: false, reason: "depth" });
    const none = await openBridge(handle.db, { ownerId: fx.ownerId, conceptId: fx.conceptId, trail: [], returnTo });
    expect(none).toMatchObject({ ok: false, reason: "unprepared" });
    await expect(
      openBridge(handle.db, {
        ownerId: fx.ownerId,
        conceptId: fx.prerequisiteConceptId,
        trail: [],
        returnTo: { path: "https://evil.example/", label: "x" },
      }),
    ).rejects.toThrow(/Invalid return path/);
  });
});
