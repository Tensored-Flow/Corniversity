import { and, asc, eq, inArray, lte } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { concept, learnerProfile, revisionItem, teachingUnit } from "../schema/index";

export type RevisionRow = typeof revisionItem.$inferSelect;
export type ReviewOutcome = "recalled" | "shaky" | "forgot";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Spaced revision, bounded by the learner's workload. Items are created when a reading is
 * completed (one definition prompt per concept the unit teaches) and never beyond a weekly cap
 * derived from the hours ceiling, so revision cannot become an unmanageable debt. Reviewing an
 * item only reschedules it: recall of a definition is not evidence of understanding and does
 * not touch the evidence record.
 */
export async function weeklyRevisionCap(db: DbOrTx, ownerId: string): Promise<number> {
  const [profile] = await db
    .select({ ceiling: learnerProfile.weeklyHoursCeiling })
    .from(learnerProfile)
    .where(eq(learnerProfile.userId, ownerId))
    .limit(1);
  const hours = profile?.ceiling ?? 8;
  return Math.max(5, Math.min(30, Math.round(hours * 1.5)));
}

export async function scheduleRevisionForUnit(
  db: DbOrTx,
  ownerId: string,
  unitId: string,
  now = new Date(),
): Promise<{ created: number; skippedForCap: number }> {
  const [unit] = await db.select().from(teachingUnit).where(eq(teachingUnit.id, unitId)).limit(1);
  if (!unit || unit.teachesConceptIds.length === 0) return { created: 0, skippedForCap: 0 };
  const concepts = await db.select().from(concept).where(inArray(concept.id, unit.teachesConceptIds));
  const existing = await db
    .select({ conceptId: revisionItem.conceptId, kind: revisionItem.kind })
    .from(revisionItem)
    .where(and(eq(revisionItem.ownerId, ownerId), inArray(revisionItem.conceptId, unit.teachesConceptIds)));
  const cap = await weeklyRevisionCap(db, ownerId);
  const weekAhead = new Date(now.getTime() + 7 * DAY);
  const dueThisWeek = (
    await db
      .select({ id: revisionItem.id })
      .from(revisionItem)
      .where(and(eq(revisionItem.ownerId, ownerId), lte(revisionItem.dueAt, weekAhead)))
  ).length;
  let budget = Math.max(0, cap - dueThisWeek);
  let created = 0;
  let skippedForCap = 0;
  for (const c of concepts) {
    if (existing.some((e) => e.conceptId === c.id && e.kind === "definition")) continue;
    if (budget === 0) {
      skippedForCap += 1;
      continue;
    }
    await db.insert(revisionItem).values({
      ownerId,
      conceptId: c.id,
      kind: "definition",
      prompt: `State the definition of ${c.title} in your own words, then give one example and one non-example.`,
      dueAt: new Date(now.getTime() + 2 * DAY),
      intervalDays: 2,
    });
    budget -= 1;
    created += 1;
  }
  return { created, skippedForCap };
}

export async function dueRevisionItems(
  db: DbOrTx,
  ownerId: string,
  now = new Date(),
  limit = 10,
): Promise<(RevisionRow & { conceptTitle: string })[]> {
  const rows = await db
    .select({ item: revisionItem, title: concept.title })
    .from(revisionItem)
    .innerJoin(concept, eq(concept.id, revisionItem.conceptId))
    .where(and(eq(revisionItem.ownerId, ownerId), lte(revisionItem.dueAt, now)))
    .orderBy(asc(revisionItem.dueAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.item, conceptTitle: r.title }));
}

export async function revisionLoad(
  db: DbOrTx,
  ownerId: string,
  now = new Date(),
): Promise<{ dueNow: number; dueThisWeek: number; total: number; cap: number }> {
  const all = await db.select({ dueAt: revisionItem.dueAt }).from(revisionItem).where(eq(revisionItem.ownerId, ownerId));
  const weekAhead = now.getTime() + 7 * DAY;
  return {
    dueNow: all.filter((r) => r.dueAt.getTime() <= now.getTime()).length,
    dueThisWeek: all.filter((r) => r.dueAt.getTime() <= weekAhead).length,
    total: all.length,
    cap: await weeklyRevisionCap(db, ownerId),
  };
}

/** Recalled doubles the interval (to a 60-day ceiling); shaky keeps it; forgot resets to one day. */
export function nextInterval(current: number, outcome: ReviewOutcome): number {
  if (outcome === "forgot") return 1;
  if (outcome === "shaky") return Math.max(1, current);
  return Math.min(60, Math.max(1, current) * 2);
}

export async function reviewItem(db: DbOrTx, ownerId: string, id: string, outcome: ReviewOutcome, now = new Date()): Promise<void> {
  const [item] = await db
    .select()
    .from(revisionItem)
    .where(and(eq(revisionItem.id, id), eq(revisionItem.ownerId, ownerId)))
    .limit(1);
  if (!item) return;
  const interval = nextInterval(item.intervalDays, outcome);
  await db
    .update(revisionItem)
    .set({ intervalDays: interval, lastReviewedAt: now, dueAt: new Date(now.getTime() + interval * DAY) })
    .where(eq(revisionItem.id, id));
}
