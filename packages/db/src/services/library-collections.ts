import { and, asc, count, eq, inArray, max, sql } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { type CollectionKind, libraryCollection, libraryCollectionItem, scholarlyWork } from "../schema/index";

/**
 * Shelves and trails (contract §3, §6): one table with a kind. A trail is an ordered shelf whose
 * steps each carry a reason; a shelf's item may carry a note in the same field. Items reference
 * works through a composite key with the owner, so a collection can never hold another owner's
 * paper; removing an item or deleting a collection never deletes a work.
 */

export type CollectionRow = typeof libraryCollection.$inferSelect;
export type CollectionItemRow = typeof libraryCollectionItem.$inferSelect;

export class CollectionError extends Error {
  constructor(
    readonly code: "not_found" | "invalid" | "duplicate",
    message: string,
  ) {
    super(message);
    this.name = "CollectionError";
  }
}

const KINDS: readonly CollectionKind[] = ["shelf", "trail"];
const MAX_NAME = 120;
const MAX_DESCRIPTION = 2000;
const MAX_REASON = 2000;

function cleanName(name: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (!trimmed) throw new CollectionError("invalid", "Give it a name.");
  if (trimmed.length > MAX_NAME) throw new CollectionError("invalid", "Keep the name under 120 characters.");
  return trimmed;
}

function cleanText(value: string | null | undefined, maxLength: number): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

async function requireCollection(db: DbOrTx, ownerId: string, id: string): Promise<CollectionRow> {
  if (!isUuid(id)) throw new CollectionError("not_found", "Shelf or trail not found.");
  const [row] = await db
    .select()
    .from(libraryCollection)
    .where(and(eq(libraryCollection.id, id), eq(libraryCollection.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new CollectionError("not_found", "Shelf or trail not found.");
  return row;
}

/** The work that stands now for this id (a merged work's survivor), or a not-found error. */
async function requireWorkId(db: DbOrTx, ownerId: string, workId: string): Promise<string> {
  if (!isUuid(workId)) throw new CollectionError("not_found", "Paper not found.");
  let current = workId;
  for (let hop = 0; hop < 10; hop++) {
    const [row] = await db
      .select({ id: scholarlyWork.id, mergedIntoId: scholarlyWork.mergedIntoId })
      .from(scholarlyWork)
      .where(and(eq(scholarlyWork.id, current), eq(scholarlyWork.ownerId, ownerId)))
      .limit(1);
    if (!row) break;
    if (!row.mergedIntoId) return row.id;
    current = row.mergedIntoId;
  }
  throw new CollectionError("not_found", "Paper not found.");
}

export async function listCollections(
  db: DbOrTx,
  ownerId: string,
  kind?: CollectionKind,
): Promise<(CollectionRow & { itemCount: number })[]> {
  if (kind !== undefined && !KINDS.includes(kind)) return [];
  const rows = await db
    .select({ collection: libraryCollection, itemCount: count(libraryCollectionItem.workId) })
    .from(libraryCollection)
    .leftJoin(libraryCollectionItem, eq(libraryCollectionItem.collectionId, libraryCollection.id))
    .where(and(eq(libraryCollection.ownerId, ownerId), kind ? eq(libraryCollection.kind, kind) : undefined))
    .groupBy(libraryCollection.id)
    .orderBy(asc(libraryCollection.kind), asc(sql`lower(${libraryCollection.name})`));
  return rows.map((r) => ({ ...r.collection, itemCount: Number(r.itemCount) }));
}

type WorkRow = typeof scholarlyWork.$inferSelect;

export interface CollectionEntry {
  item: CollectionItemRow;
  work: WorkRow;
  /** 1-based place in the collection's own order (a trail's step number), whatever the view shows. */
  step: number;
}

export interface CollectionDetail {
  collection: CollectionRow;
  /** The items the view shows, in its order. */
  items: CollectionEntry[];
  /** How many papers the collection holds (before any search or filter). */
  total: number;
}

/** "position": the collection's own order (the order of adding until the owner moves papers); "added": newest first. */
export type CollectionOrder = "position" | "added";
/** The owner's own marks on a paper. */
export type CollectionFlag = "favourite" | "read_later" | "read";

export interface CollectionView {
  /** Words that must all appear in the title, an author's name, the venue or the year (case and accents ignored). */
  query?: string;
  flag?: CollectionFlag;
  order?: CollectionOrder;
}

const fold = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

/** Whether a work matches the words of a search within a collection (every word, anywhere in its text). */
export function workMatches(work: Pick<WorkRow, "title" | "authors" | "venue" | "publicationYear">, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = fold(
    [work.title ?? "", ...work.authors.map((a) => a.name), work.venue ?? "", work.publicationYear ? String(work.publicationYear) : ""].join(
      " ",
    ),
  );
  return words.every((w) => text.includes(w));
}

function flagged(work: WorkRow, flag: CollectionFlag): boolean {
  return flag === "favourite" ? work.favourite : flag === "read_later" ? work.readLater : work.readAt !== null;
}

/**
 * A shelf or trail with its papers: in its own order (by position, then when added), or newest
 * first, optionally searched and filtered by the owner's flags. Step numbers always count the
 * collection's own order, so a filtered trail still names each paper's step.
 */
export async function getCollection(db: DbOrTx, ownerId: string, id: string, view: CollectionView = {}): Promise<CollectionDetail | null> {
  if (!isUuid(id)) return null;
  const [collection] = await db
    .select()
    .from(libraryCollection)
    .where(and(eq(libraryCollection.id, id), eq(libraryCollection.ownerId, ownerId)))
    .limit(1);
  if (!collection) return null;
  const rows = await db
    .select({ item: libraryCollectionItem, work: scholarlyWork })
    .from(libraryCollectionItem)
    .innerJoin(scholarlyWork, eq(scholarlyWork.id, libraryCollectionItem.workId))
    .where(and(eq(libraryCollectionItem.collectionId, collection.id), eq(libraryCollectionItem.ownerId, ownerId)))
    .orderBy(asc(libraryCollectionItem.position), asc(libraryCollectionItem.addedAt), asc(libraryCollectionItem.workId));
  const query = view.query?.trim().slice(0, 300) ?? "";
  let items = rows
    .map((r, index) => ({ ...r, step: index + 1 }))
    .filter((r) => (!query || workMatches(r.work, query)) && (!view.flag || flagged(r.work, view.flag)));
  if (view.order === "added") items = [...items].sort((a, b) => b.item.addedAt.getTime() - a.item.addedAt.getTime() || b.step - a.step);
  return { collection, items, total: rows.length };
}

export async function createCollection(
  db: DbOrTx,
  ownerId: string,
  input: { kind: CollectionKind; name: string; description?: string | null },
): Promise<CollectionRow> {
  if (!KINDS.includes(input.kind)) throw new CollectionError("invalid", "Choose a shelf or a trail.");
  const name = cleanName(input.name);
  try {
    const [row] = await db
      .insert(libraryCollection)
      .values({ ownerId, kind: input.kind, name, description: cleanText(input.description, MAX_DESCRIPTION) })
      .returning();
    return row!;
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName(input.kind);
    throw error;
  }
}

function duplicateName(kind: CollectionKind): CollectionError {
  return kind === "shelf"
    ? new CollectionError("duplicate", "You already have a shelf with that name.")
    : new CollectionError("duplicate", "You already have a trail with that name.");
}

export async function renameCollection(db: DbOrTx, ownerId: string, id: string, name: string): Promise<CollectionRow> {
  const collection = await requireCollection(db, ownerId, id);
  const clean = cleanName(name);
  try {
    const [row] = await db.update(libraryCollection).set({ name: clean }).where(eq(libraryCollection.id, collection.id)).returning();
    return row!;
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName(collection.kind);
    throw error;
  }
}

export async function describeCollection(db: DbOrTx, ownerId: string, id: string, description: string | null): Promise<CollectionRow> {
  const collection = await requireCollection(db, ownerId, id);
  const [row] = await db
    .update(libraryCollection)
    .set({ description: cleanText(description, MAX_DESCRIPTION) })
    .where(eq(libraryCollection.id, collection.id))
    .returning();
  return row!;
}

/** Deletes the shelf or trail and its items; the papers stay in the library. */
export async function deleteCollection(db: DbOrTx, ownerId: string, id: string): Promise<void> {
  const collection = await requireCollection(db, ownerId, id);
  await db.delete(libraryCollection).where(eq(libraryCollection.id, collection.id));
}

/** Adds a paper at the end (a trail's next step). Adding a paper already there changes nothing. */
export async function addToCollection(
  db: DbOrTx,
  ownerId: string,
  id: string,
  workId: string,
  reason?: string | null,
): Promise<{ added: boolean; item: CollectionItemRow }> {
  const collection = await requireCollection(db, ownerId, id);
  const work = await requireWorkId(db, ownerId, workId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`collection:${collection.id}`}, 0))`);
    const [last] = await tx
      .select({ position: max(libraryCollectionItem.position) })
      .from(libraryCollectionItem)
      .where(eq(libraryCollectionItem.collectionId, collection.id));
    const inserted = await tx
      .insert(libraryCollectionItem)
      .values({
        collectionId: collection.id,
        ownerId,
        workId: work,
        position: (last?.position ?? 0) + 1,
        reason: cleanText(reason, MAX_REASON),
      })
      .onConflictDoNothing()
      .returning();
    if (inserted[0]) {
      await tx.update(libraryCollection).set({ updatedAt: new Date() }).where(eq(libraryCollection.id, collection.id));
      return { added: true, item: inserted[0] };
    }
    const [existing] = await tx
      .select()
      .from(libraryCollectionItem)
      .where(and(eq(libraryCollectionItem.collectionId, collection.id), eq(libraryCollectionItem.workId, work)));
    return { added: false, item: existing! };
  });
}

/**
 * Takes a paper off a collection. The paper, its annotations, notebook entries and files are never
 * touched; the item's own note (a trail step's reason) goes with it, and is returned as `reason` so
 * the caller can say so. `removed` is false when the paper was not in the collection.
 */
export async function removeFromCollection(
  db: DbOrTx,
  ownerId: string,
  id: string,
  workId: string,
): Promise<{ removed: boolean; reason: string | null }> {
  const collection = await requireCollection(db, ownerId, id);
  if (!isUuid(workId)) throw new CollectionError("not_found", "Paper not found.");
  const [row] = await db
    .delete(libraryCollectionItem)
    .where(
      and(
        eq(libraryCollectionItem.collectionId, collection.id),
        eq(libraryCollectionItem.ownerId, ownerId),
        eq(libraryCollectionItem.workId, workId),
      ),
    )
    .returning({ reason: libraryCollectionItem.reason });
  return { removed: Boolean(row), reason: row?.reason ?? null };
}

/**
 * Moves a paper one place up or down in the order the collection shows (position, then when added).
 * The items are renumbered 1…n in that order with the two swapped, so positions a merge made equal
 * cannot make a move skip a paper or do nothing.
 */
export async function moveInCollection(db: DbOrTx, ownerId: string, id: string, workId: string, direction: "up" | "down"): Promise<void> {
  const collection = await requireCollection(db, ownerId, id);
  if (!isUuid(workId)) throw new CollectionError("not_found", "Paper not found.");
  if (direction !== "up" && direction !== "down") throw new CollectionError("invalid", "Move a paper up or down.");
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`collection:${collection.id}`}, 0))`);
    const items = await tx
      .select({ workId: libraryCollectionItem.workId, position: libraryCollectionItem.position })
      .from(libraryCollectionItem)
      .where(eq(libraryCollectionItem.collectionId, collection.id))
      .orderBy(asc(libraryCollectionItem.position), asc(libraryCollectionItem.addedAt), asc(libraryCollectionItem.workId));
    const index = items.findIndex((i) => i.workId === workId);
    if (index < 0) throw new CollectionError("not_found", "Paper not found.");
    const other = direction === "up" ? index - 1 : index + 1;
    if (other < 0 || other >= items.length) return;
    const order = items.map((i) => i.workId);
    [order[index], order[other]] = [order[other]!, order[index]!];
    for (const [i, id] of order.entries()) {
      if (items.find((item) => item.workId === id)!.position === i + 1) continue;
      await tx
        .update(libraryCollectionItem)
        .set({ position: i + 1 })
        .where(and(eq(libraryCollectionItem.collectionId, collection.id), eq(libraryCollectionItem.workId, id)));
    }
  });
}

/** A trail step's "why" (or a shelf item's note); empty clears it. */
export async function setItemReason(db: DbOrTx, ownerId: string, id: string, workId: string, reason: string | null): Promise<void> {
  const collection = await requireCollection(db, ownerId, id);
  if (!isUuid(workId)) throw new CollectionError("not_found", "Paper not found.");
  const updated = await db
    .update(libraryCollectionItem)
    .set({ reason: cleanText(reason, MAX_REASON) })
    .where(
      and(
        eq(libraryCollectionItem.collectionId, collection.id),
        eq(libraryCollectionItem.ownerId, ownerId),
        eq(libraryCollectionItem.workId, workId),
      ),
    )
    .returning({ workId: libraryCollectionItem.workId });
  if (updated.length === 0) throw new CollectionError("not_found", "Paper not found.");
}

export interface CollectionMembership {
  id: string;
  kind: CollectionKind;
  name: string;
  reason: string | null;
  /** The paper's place in the collection's order (a trail's step), and how many papers it holds. */
  step: number;
  steps: number;
  /** The papers before and after it in that order (a trail's previous and next step). */
  previous: { workId: string; title: string | null } | null;
  next: { workId: string; title: string | null } | null;
}

/** The shelves and trails holding a work, for its paper page, each with the paper's step and its neighbours. */
export async function collectionsForWork(db: DbOrTx, ownerId: string, workId: string): Promise<CollectionMembership[]> {
  if (!isUuid(workId)) return [];
  const memberships = await db
    .select({ id: libraryCollection.id, kind: libraryCollection.kind, name: libraryCollection.name, reason: libraryCollectionItem.reason })
    .from(libraryCollectionItem)
    .innerJoin(libraryCollection, eq(libraryCollection.id, libraryCollectionItem.collectionId))
    .where(and(eq(libraryCollectionItem.ownerId, ownerId), eq(libraryCollectionItem.workId, workId)))
    .orderBy(asc(libraryCollection.kind), asc(sql`lower(${libraryCollection.name})`));
  if (memberships.length === 0) return [];
  const items = await db
    .select({ collectionId: libraryCollectionItem.collectionId, workId: libraryCollectionItem.workId, title: scholarlyWork.title })
    .from(libraryCollectionItem)
    .innerJoin(scholarlyWork, eq(scholarlyWork.id, libraryCollectionItem.workId))
    .where(
      and(
        eq(libraryCollectionItem.ownerId, ownerId),
        inArray(
          libraryCollectionItem.collectionId,
          memberships.map((m) => m.id),
        ),
      ),
    )
    .orderBy(asc(libraryCollectionItem.position), asc(libraryCollectionItem.addedAt), asc(libraryCollectionItem.workId));
  return memberships.map((m) => {
    const order = items.filter((i) => i.collectionId === m.id);
    const index = order.findIndex((i) => i.workId === workId);
    const neighbour = (i: number) => (order[i] ? { workId: order[i]!.workId, title: order[i]!.title } : null);
    return { ...m, step: index + 1, steps: order.length, previous: neighbour(index - 1), next: neighbour(index + 1) };
  });
}
