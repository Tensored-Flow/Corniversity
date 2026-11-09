import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { user } from "../schema/auth";
import { auditEvent, notebookEntry } from "../schema/index";
import { labRevealState, requestPredictAgain } from "./lab-predictions";
import { createEntry, listEntries } from "./notebook";

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
