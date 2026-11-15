import { and, asc, count, desc, eq, gt, lt, max, sql } from "drizzle-orm";
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

export interface CollectionDetail {
  collection: CollectionRow;
  items: { item: CollectionItemRow; work: typeof scholarlyWork.$inferSelect }[];
}

/** A shelf or trail with its papers in order (by position, then when added). */
export async function getCollection(db: DbOrTx, ownerId: string, id: string): Promise<CollectionDetail | null> {
  if (!isUuid(id)) return null;
  const [collection] = await db
    .select()
    .from(libraryCollection)
    .where(and(eq(libraryCollection.id, id), eq(libraryCollection.ownerId, ownerId)))
    .limit(1);
  if (!collection) return null;
  const items = await db
    .select({ item: libraryCollectionItem, work: scholarlyWork })
    .from(libraryCollectionItem)
    .innerJoin(scholarlyWork, eq(scholarlyWork.id, libraryCollectionItem.workId))
    .where(and(eq(libraryCollectionItem.collectionId, collection.id), eq(libraryCollectionItem.ownerId, ownerId)))
    .orderBy(asc(libraryCollectionItem.position), asc(libraryCollectionItem.addedAt));
  return { collection, items };
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

export async function removeFromCollection(db: DbOrTx, ownerId: string, id: string, workId: string): Promise<void> {
  const collection = await requireCollection(db, ownerId, id);
  if (!isUuid(workId)) throw new CollectionError("not_found", "Paper not found.");
  await db
    .delete(libraryCollectionItem)
    .where(
      and(
        eq(libraryCollectionItem.collectionId, collection.id),
        eq(libraryCollectionItem.ownerId, ownerId),
        eq(libraryCollectionItem.workId, workId),
      ),
    );
}

/** Moves a paper one place up or down by swapping it with its neighbour. */
export async function moveInCollection(db: DbOrTx, ownerId: string, id: string, workId: string, direction: "up" | "down"): Promise<void> {
  const collection = await requireCollection(db, ownerId, id);
  if (!isUuid(workId)) throw new CollectionError("not_found", "Paper not found.");
  if (direction !== "up" && direction !== "down") throw new CollectionError("invalid", "Move a paper up or down.");
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`collection:${collection.id}`}, 0))`);
    const [item] = await tx
      .select()
      .from(libraryCollectionItem)
      .where(and(eq(libraryCollectionItem.collectionId, collection.id), eq(libraryCollectionItem.workId, workId)));
    if (!item) throw new CollectionError("not_found", "Paper not found.");
    const [neighbour] = await tx
      .select()
      .from(libraryCollectionItem)
      .where(
        and(
          eq(libraryCollectionItem.collectionId, collection.id),
          direction === "up" ? lt(libraryCollectionItem.position, item.position) : gt(libraryCollectionItem.position, item.position),
        ),
      )
      .orderBy(direction === "up" ? desc(libraryCollectionItem.position) : asc(libraryCollectionItem.position))
      .limit(1);
    if (!neighbour) return;
    await tx
      .update(libraryCollectionItem)
      .set({ position: neighbour.position })
      .where(and(eq(libraryCollectionItem.collectionId, collection.id), eq(libraryCollectionItem.workId, item.workId)));
    await tx
      .update(libraryCollectionItem)
      .set({ position: item.position })
      .where(and(eq(libraryCollectionItem.collectionId, collection.id), eq(libraryCollectionItem.workId, neighbour.workId)));
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

/** The shelves and trails holding a work, for its paper page. */
export async function collectionsForWork(
  db: DbOrTx,
  ownerId: string,
  workId: string,
): Promise<{ id: string; kind: CollectionKind; name: string; reason: string | null }[]> {
  if (!isUuid(workId)) return [];
  return db
    .select({ id: libraryCollection.id, kind: libraryCollection.kind, name: libraryCollection.name, reason: libraryCollectionItem.reason })
    .from(libraryCollectionItem)
    .innerJoin(libraryCollection, eq(libraryCollection.id, libraryCollectionItem.collectionId))
    .where(and(eq(libraryCollectionItem.ownerId, ownerId), eq(libraryCollectionItem.workId, workId)))
    .orderBy(asc(libraryCollection.kind), asc(sql`lower(${libraryCollection.name})`));
}
