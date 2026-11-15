import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { user } from "../schema/auth";
import { scholarlyWork } from "../schema/scholarly";
import {
  addToCollection,
  CollectionError,
  collectionsForWork,
  createCollection,
  deleteCollection,
  describeCollection,
  getCollection,
  listCollections,
  moveInCollection,
  removeFromCollection,
  renameCollection,
  setItemReason,
} from "./library-collections";

/** Shelves and trails: names unique per owner and kind, ordered steps with reasons, owner-only. */
const OWNER = "collections-test-owner";
const OTHER = "collections-test-other";
let handle: ReturnType<typeof createDb>;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  await handle.db
    .insert(user)
    .values([
      { id: OWNER, name: "Collections", email: "collections-test@example.test" },
      { id: OTHER, name: "Collections Other", email: "collections-other@example.test" },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await handle.close();
});

async function work(ownerId: string, title: string) {
  const [row] = await handle.db.insert(scholarlyWork).values({ ownerId, title, savedAt: new Date() }).returning();
  return row!;
}

describe("shelves and trails", () => {
  it("creates, renames and describes; names are unique per kind regardless of case", async () => {
    const suffix = randomUUID().slice(0, 6);
    const shelf = await createCollection(handle.db, OWNER, { kind: "shelf", name: `  Thesis   ${suffix} ` });
    expect(shelf.name).toBe(`Thesis ${suffix}`);
    await expect(createCollection(handle.db, OWNER, { kind: "shelf", name: `THESIS ${suffix}` })).rejects.toThrow(
      "You already have a shelf with that name.",
    );
    // A trail may share a shelf's name.
    const trail = await createCollection(handle.db, OWNER, { kind: "trail", name: `Thesis ${suffix}`, description: "A path" });
    expect(trail.description).toBe("A path");
    await expect(renameCollection(handle.db, OWNER, trail.id, `thesis ${suffix}`.toUpperCase())).resolves.toMatchObject({ kind: "trail" });
    await expect(createCollection(handle.db, OWNER, { kind: "shelf", name: "  " })).rejects.toThrow("Give it a name.");
    await expect(createCollection(handle.db, OWNER, { kind: "pile" as "shelf", name: "x" })).rejects.toThrow("Choose a shelf or a trail.");
    expect((await describeCollection(handle.db, OWNER, shelf.id, "  ")).description).toBeNull();
    const listed = await listCollections(handle.db, OWNER, "shelf");
    expect(listed.find((c) => c.id === shelf.id)?.itemCount).toBe(0);
  });

  it("adds papers in order with reasons, moves them and removes them without touching the works", async () => {
    const trail = await createCollection(handle.db, OWNER, { kind: "trail", name: `Path ${randomUUID().slice(0, 6)}` });
    const a = await work(OWNER, "First step");
    const b = await work(OWNER, "Second step");
    const c = await work(OWNER, "Third step");
    expect((await addToCollection(handle.db, OWNER, trail.id, a.id, "Start with the definitions")).added).toBe(true);
    await addToCollection(handle.db, OWNER, trail.id, b.id);
    await addToCollection(handle.db, OWNER, trail.id, c.id, "The main theorem");
    expect((await addToCollection(handle.db, OWNER, trail.id, a.id, "again")).added).toBe(false);
    await setItemReason(handle.db, OWNER, trail.id, b.id, "Builds the tools");
    await moveInCollection(handle.db, OWNER, trail.id, c.id, "up");
    let detail = (await getCollection(handle.db, OWNER, trail.id))!;
    expect(detail.items.map((i) => i.work.title)).toEqual(["First step", "Third step", "Second step"]);
    expect(detail.items.map((i) => i.item.reason)).toEqual(["Start with the definitions", "The main theorem", "Builds the tools"]);
    await moveInCollection(handle.db, OWNER, trail.id, a.id, "up"); // already first: nothing changes
    await removeFromCollection(handle.db, OWNER, trail.id, c.id);
    detail = (await getCollection(handle.db, OWNER, trail.id))!;
    expect(detail.items.map((i) => i.work.title)).toEqual(["First step", "Second step"]);
    expect(await handle.db.select().from(scholarlyWork).where(eq(scholarlyWork.id, c.id))).toHaveLength(1);
    expect(await collectionsForWork(handle.db, OWNER, a.id)).toEqual([
      expect.objectContaining({ id: trail.id, reason: "Start with the definitions" }),
    ]);
    // A merged work's survivor is what gets added.
    const tomb = await work(OWNER, "Merged away");
    await handle.db.update(scholarlyWork).set({ mergedIntoId: c.id }).where(eq(scholarlyWork.id, tomb.id));
    expect((await addToCollection(handle.db, OWNER, trail.id, tomb.id)).item.workId).toBe(c.id);
    await deleteCollection(handle.db, OWNER, trail.id);
    expect(await getCollection(handle.db, OWNER, trail.id)).toBeNull();
    expect(await handle.db.select().from(scholarlyWork).where(eq(scholarlyWork.id, a.id))).toHaveLength(1);
  });

  it("another owner's collections and papers are not found", async () => {
    const shelf = await createCollection(handle.db, OWNER, { kind: "shelf", name: `Private ${randomUUID().slice(0, 6)}` });
    const mine = await work(OWNER, "Mine");
    const theirs = await work(OTHER, "Theirs");
    await addToCollection(handle.db, OWNER, shelf.id, mine.id);
    expect(await getCollection(handle.db, OTHER, shelf.id)).toBeNull();
    expect(await listCollections(handle.db, OTHER)).toEqual([]);
    expect(await collectionsForWork(handle.db, OTHER, mine.id)).toEqual([]);
    for (const attempt of [
      () => renameCollection(handle.db, OTHER, shelf.id, "x"),
      () => describeCollection(handle.db, OTHER, shelf.id, "x"),
      () => deleteCollection(handle.db, OTHER, shelf.id),
      () => addToCollection(handle.db, OTHER, shelf.id, theirs.id),
      () => removeFromCollection(handle.db, OTHER, shelf.id, mine.id),
      () => moveInCollection(handle.db, OTHER, shelf.id, mine.id, "down"),
      () => setItemReason(handle.db, OTHER, shelf.id, mine.id, "x"),
    ]) {
      await expect(attempt()).rejects.toThrow("Shelf or trail not found.");
    }
    // The owner cannot put someone else's paper on their own shelf either.
    await expect(addToCollection(handle.db, OWNER, shelf.id, theirs.id)).rejects.toThrow("Paper not found.");
    await expect(addToCollection(handle.db, OWNER, "not-a-uuid", mine.id)).rejects.toBeInstanceOf(CollectionError);
  });
});
