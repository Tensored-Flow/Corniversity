import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "../../test/fixtures";
import { createDb } from "../client";
import { getAttempt, getOrCreateAttempt, saveDraft } from "./learning";

/**
 * Drafts saved from two devices: a save names the revision it started from, so a stale device
 * cannot overwrite a newer argument; it gets the newer draft back as a conflict instead.
 */
let handle: ReturnType<typeof createDb>;
let fx: Fixture;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  fx = await createFixture(handle.db, "learning");
});

afterAll(async () => {
  await fx.cleanup();
  await handle.close();
});

describe("draft revisions", () => {
  it("saves in order and refuses a stale save without overwriting the newer draft", async () => {
    const a = await getOrCreateAttempt(handle.db, { ownerId: fx.ownerId, exerciseId: fx.exerciseId });
    expect(a.draftRevision).toBe(0);
    // Device A and device B both opened the attempt at revision 0.
    const fromA = await saveDraft(handle.db, fx.ownerId, a.id, "Proof from the laptop, step 1.", { baseRevision: 0 });
    expect(fromA).toMatchObject({ status: "saved", revision: 1 });
    const fromB = await saveDraft(handle.db, fx.ownerId, a.id, "An older line typed on the phone.", { baseRevision: 0 });
    expect(fromB).toMatchObject({ status: "conflict", revision: 1, draftMarkdown: "Proof from the laptop, step 1." });
    expect((await getAttempt(handle.db, fx.ownerId, a.id))?.draftMarkdown).toBe("Proof from the laptop, step 1.");
    // The phone, having seen the newer draft, saves on top of it.
    const resolved = await saveDraft(handle.db, fx.ownerId, a.id, "Proof from the laptop, step 1.\nStep 2 from the phone.", {
      baseRevision: 1,
    });
    expect(resolved).toMatchObject({ status: "saved", revision: 2 });
  });

  it("applies a save without a base revision (submitting) and still advances the revision", async () => {
    const a = await getOrCreateAttempt(handle.db, { ownerId: fx.ownerId, exerciseId: fx.exerciseId });
    const before = a.draftRevision;
    const saved = await saveDraft(handle.db, fx.ownerId, a.id, "Final text as submitted.");
    expect(saved).toMatchObject({ status: "saved", revision: before + 1 });
  });

  it("never saves into someone else's attempt", async () => {
    const a = await getOrCreateAttempt(handle.db, { ownerId: fx.ownerId, exerciseId: fx.exerciseId });
    expect(await saveDraft(handle.db, "someone-else", a.id, "taken over", { baseRevision: a.draftRevision })).toEqual({
      status: "not_found",
    });
  });
});
