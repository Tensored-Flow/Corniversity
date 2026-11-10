import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { user } from "../schema/auth";
import { auditEvent, notebookEntry } from "../schema/index";
import { labRevealState, requestPredictAgain } from "./lab-predictions";
import { createEntry, deleteEntry, listEntries, NotebookError, updateEntry } from "./notebook";

/**
 * A laboratory's prediction gate against PostgreSQL: results open on a saved prediction and stay
 * open after a restart; a deliberate request to predict again closes them until a newer
 * prediction is saved; earlier predictions are kept as distinct notebook entries.
 */
const OWNER = `lab-owner-${randomUUID()}`;
const UNIT = "COG-260-u01";
const LAB = "choice-model-loop";
let handle: ReturnType<typeof createDb>;

const predict = (text: string) =>
  createEntry(handle.db, OWNER, {
    title: "Prediction before running",
    bodyMarkdown: text,
    kind: "note",
    tags: ["lab", "prediction", LAB],
    unitId: UNIT,
  });

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  await handle.db
    .insert(user)
    .values({ id: OWNER, name: "Lab Test", email: `${OWNER}@example.test` })
    .onConflictDoNothing();
});

afterAll(async () => {
  await handle.db.delete(notebookEntry).where(eq(notebookEntry.ownerId, OWNER));
  await handle.db.delete(auditEvent).where(eq(auditEvent.ownerId, OWNER));
  await handle.db.delete(user).where(eq(user.id, OWNER));
  await handle.close();
});

describe("the prediction gate", () => {
  it("is closed until a prediction is saved, then stays open for a fresh connection", async () => {
    expect((await labRevealState(handle.db, OWNER, UNIT, LAB)).revealed).toBe(false);
    await predict("I expect the learning model to win in the informative case because the arms differ clearly.");
    expect((await labRevealState(handle.db, OWNER, UNIT, LAB)).revealed).toBe(true);
    const restarted = createDb(process.env.DATABASE_URL!, { max: 1 });
    expect((await labRevealState(restarted.db, OWNER, UNIT, LAB)).revealed).toBe(true);
    await restarted.close();
  });

  it("closes again on a deliberate request to predict again, until a newer prediction", async () => {
    await requestPredictAgain(handle.db, OWNER, UNIT, LAB);
    expect((await labRevealState(handle.db, OWNER, UNIT, LAB)).revealed).toBe(false);
    await new Promise((r) => setTimeout(r, 15));
    await predict("With three hundred trials I now expect model recovery to improve for Rescorla-Wagner.");
    const state = await labRevealState(handle.db, OWNER, UNIT, LAB);
    expect(state).toEqual({ revealed: true, predictions: 2 });
  });

  it("keeps every earlier prediction as its own dated notebook entry", async () => {
    const entries = await listEntries(handle.db, OWNER, { unitId: UNIT, tag: "prediction" });
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((e) => e.id)).size).toBe(2);
  });

  it("does not open another laboratory of the same unit", async () => {
    expect((await labRevealState(handle.db, OWNER, UNIT, "planning-transfer")).revealed).toBe(false);
  });
});

describe("a saved prediction", () => {
  it("is a dated record: it cannot be edited or deleted, and no older note can be made into one", async () => {
    // Its own laboratory tag, so the gate tests below still start before any prediction.
    const saved = await createEntry(handle.db, OWNER, {
      title: "Prediction before running",
      bodyMarkdown: "The forgetting term will not change recovery.",
      kind: "note",
      tags: ["lab", "prediction", "lock-test-lab"],
      unitId: UNIT,
    });
    await expect(updateEntry(handle.db, OWNER, saved.id, { bodyMarkdown: "It changed recovery, as I expected." })).rejects.toThrow(
      NotebookError,
    );
    await expect(deleteEntry(handle.db, OWNER, saved.id)).rejects.toThrow(NotebookError);
    const older = await createEntry(handle.db, OWNER, {
      title: "A note",
      bodyMarkdown: "Something.",
      kind: "note",
      tags: ["lab"],
      unitId: UNIT,
    });
    await expect(updateEntry(handle.db, OWNER, older.id, { tags: ["lab", "prediction", LAB] })).rejects.toThrow(NotebookError);
    expect((await listEntries(handle.db, OWNER, { unitId: UNIT, tag: "prediction", limit: 50 })).map((e) => e.id)).toContain(saved.id);
    // An ordinary note is still the learner's to edit and delete.
    await updateEntry(handle.db, OWNER, older.id, { bodyMarkdown: "Something else." });
    await deleteEntry(handle.db, OWNER, older.id);
  });
});
