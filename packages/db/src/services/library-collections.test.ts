import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
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
    // Removal reports the step's reason it deleted, so the page can say so; a paper not there is not removed.
    expect(await removeFromCollection(handle.db, OWNER, trail.id, c.id)).toEqual({ removed: true, reason: "The main theorem" });
    expect(await removeFromCollection(handle.db, OWNER, trail.id, c.id)).toEqual({ removed: false, reason: null });
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

  it("searches and filters within a collection, orders by date added, and keeps each paper's step", async () => {
    const shelf = await createCollection(handle.db, OWNER, { kind: "shelf", name: `View ${randomUUID().slice(0, 6)}` });
    const [a] = await handle.db
      .insert(scholarlyWork)
      .values({ ownerId: OWNER, title: "Banach spaces", authors: [{ name: "Stefan Banach" }], venue: "Fundamenta", savedAt: new Date() })
      .returning();
    const [b] = await handle.db
      .insert(scholarlyWork)
      .values({ ownerId: OWNER, title: "Hilbert spaces", authors: [{ name: "Émile Borel" }], favourite: true, savedAt: new Date() })
      .returning();
    const [c] = await handle.db
      .insert(scholarlyWork)
      .values({ ownerId: OWNER, title: "Operators", publicationYear: 1932, readAt: new Date() })
      .returning();
    for (const w of [a!, b!, c!]) {
      await addToCollection(handle.db, OWNER, shelf.id, w.id);
      await new Promise((r) => setTimeout(r, 5));
    }
    const titles = (d: Awaited<ReturnType<typeof getCollection>>) => d!.items.map((i) => i.work.title);
    const all = await getCollection(handle.db, OWNER, shelf.id);
    expect(titles(all)).toEqual(["Banach spaces", "Hilbert spaces", "Operators"]);
    expect(all!.items.map((i) => i.step)).toEqual([1, 2, 3]);
    expect(all!.total).toBe(3);
    // Words anywhere in the title, an author's name (accents ignored), the venue or the year.
    expect(titles(await getCollection(handle.db, OWNER, shelf.id, { query: "spaces" }))).toEqual(["Banach spaces", "Hilbert spaces"]);
    expect(titles(await getCollection(handle.db, OWNER, shelf.id, { query: "emile" }))).toEqual(["Hilbert spaces"]);
    expect(titles(await getCollection(handle.db, OWNER, shelf.id, { query: "fundamenta banach" }))).toEqual(["Banach spaces"]);
    const filtered = await getCollection(handle.db, OWNER, shelf.id, { query: "1932" });
    expect(filtered!.items.map((i) => [i.work.title, i.step])).toEqual([["Operators", 3]]);
    expect(filtered!.total).toBe(3);
    expect(titles(await getCollection(handle.db, OWNER, shelf.id, { flag: "favourite" }))).toEqual(["Hilbert spaces"]);
    expect(titles(await getCollection(handle.db, OWNER, shelf.id, { flag: "read" }))).toEqual(["Operators"]);
    expect(titles(await getCollection(handle.db, OWNER, shelf.id, { flag: "read_later" }))).toEqual([]);
    // Newest first; the steps still name the collection's own order.
    const added = await getCollection(handle.db, OWNER, shelf.id, { order: "added" });
    expect(added!.items.map((i) => [i.work.title, i.step])).toEqual([
      ["Operators", 3],
      ["Hilbert spaces", 2],
      ["Banach spaces", 1],
    ]);
  });

  it("names a paper's step, previous and next paper in each trail it is on", async () => {
    const trail = await createCollection(handle.db, OWNER, { kind: "trail", name: `Steps ${randomUUID().slice(0, 6)}` });
    const a = await work(OWNER, "Step A");
    const b = await work(OWNER, "Step B");
    const c = await work(OWNER, "Step C");
    for (const w of [a, b, c]) await addToCollection(handle.db, OWNER, trail.id, w.id, `Why ${w.title}`);
    expect(await collectionsForWork(handle.db, OWNER, b.id)).toEqual([
      {
        id: trail.id,
        kind: "trail",
        name: trail.name,
        reason: "Why Step B",
        step: 2,
        steps: 3,
        previous: { workId: a.id, title: "Step A" },
        next: { workId: c.id, title: "Step C" },
      },
    ]);
    const [first] = await collectionsForWork(handle.db, OWNER, a.id);
    expect([first!.step, first!.previous, first!.next?.title]).toEqual([1, null, "Step B"]);
    const [last] = await collectionsForWork(handle.db, OWNER, c.id);
    expect([last!.step, last!.steps, last!.next]).toEqual([3, 3, null]);
  });

  it("moves a paper past a neighbour that shares its position (positions a merge left equal)", async () => {
    const trail = await createCollection(handle.db, OWNER, { kind: "trail", name: `Ties ${randomUUID().slice(0, 6)}` });
    const a = await work(OWNER, "Tie A");
    const b = await work(OWNER, "Tie B");
    const c = await work(OWNER, "Tie C");
    for (const w of [a, b, c]) {
      await addToCollection(handle.db, OWNER, trail.id, w.id);
      await new Promise((r) => setTimeout(r, 5));
    }
    // A and B end up on the same position, as when a merge re-points one item onto another's place.
    await handle.db.execute(sql`update library_collection_item set position = 1 where collection_id = ${trail.id} and work_id = ${b.id}`);
    const order = async () => (await getCollection(handle.db, OWNER, trail.id))!.items.map((i) => i.work.title);
    expect(await order()).toEqual(["Tie A", "Tie B", "Tie C"]);
    await moveInCollection(handle.db, OWNER, trail.id, b.id, "up");
    expect(await order()).toEqual(["Tie B", "Tie A", "Tie C"]);
    await moveInCollection(handle.db, OWNER, trail.id, a.id, "down");
    expect(await order()).toEqual(["Tie B", "Tie C", "Tie A"]);
    await moveInCollection(handle.db, OWNER, trail.id, a.id, "down"); // already last: nothing changes
    expect(await order()).toEqual(["Tie B", "Tie C", "Tie A"]);
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
