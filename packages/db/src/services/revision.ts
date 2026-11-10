import { nextInterval as coreNextInterval, nextReviewSet, startOfWeekUtc } from "@corniversity/core/review/review";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { concept, learnerProfile, revisionItem, teachingUnit } from "../schema/index";

export type RevisionRow = typeof revisionItem.$inferSelect;
export type { ReviewOutcome } from "@corniversity/core/review/review";

import type { ReviewOutcome } from "@corniversity/core/review/review";

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
export const nextInterval = coreNextInterval;

export interface ReviewSettings {
  budgetPerWeek: number;
  paused: boolean;
  restWeekdays: number[];
  /** Which values the learner chose; the rest are defaults. */
  chosen: { budgetPerWeek: boolean; paused: boolean; restWeekdays: boolean };
}

/** The learner's review choices, with the default weekly number (from their hours) where unset. */
export async function reviewSettings(db: DbOrTx, ownerId: string): Promise<ReviewSettings> {
  const [profile] = await db
    .select({ prefs: learnerProfile.reviewPreferences })
    .from(learnerProfile)
    .where(eq(learnerProfile.userId, ownerId))
    .limit(1);
  const prefs = profile?.prefs ?? {};
  return {
    budgetPerWeek: prefs.budgetPerWeek ?? (await weeklyRevisionCap(db, ownerId)),
    paused: prefs.paused ?? false,
    restWeekdays: prefs.restWeekdays ?? [],
    chosen: {
      budgetPerWeek: prefs.budgetPerWeek !== undefined,
      paused: prefs.paused !== undefined,
      restWeekdays: prefs.restWeekdays !== undefined,
    },
  };
}

export class ReviewError extends Error {}

export async function saveReviewSettings(
  db: DbOrTx,
  ownerId: string,
  change: { budgetPerWeek?: number; paused?: boolean; restWeekdays?: number[] },
): Promise<void> {
  const [profile] = await db
    .select({ prefs: learnerProfile.reviewPreferences })
    .from(learnerProfile)
    .where(eq(learnerProfile.userId, ownerId))
    .limit(1);
  if (!profile) throw new ReviewError("Profile not found.");
  const next = { ...profile.prefs };
  if (change.budgetPerWeek !== undefined) {
    if (!Number.isInteger(change.budgetPerWeek) || change.budgetPerWeek < 1 || change.budgetPerWeek > 50) {
      throw new ReviewError("Choose between 1 and 50 review items a week.");
    }
    next.budgetPerWeek = change.budgetPerWeek;
  }
  if (change.paused !== undefined) next.paused = change.paused;
  if (change.restWeekdays !== undefined) {
    if (change.restWeekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) throw new ReviewError("Unknown weekday.");
    next.restWeekdays = [...new Set(change.restWeekdays)].sort();
  }
  await db.update(learnerProfile).set({ reviewPreferences: next }).where(eq(learnerProfile.userId, ownerId));
}

/**
 * The small set to offer now, from the rule in packages/core/src/review: at most five, within the
 * weekly number, none while paused or on a day kept free. Items past their date are not owed.
 */
export async function nextReviewItems(db: DbOrTx, ownerId: string, now = new Date()) {
  const settings = await reviewSettings(db, ownerId);
  const rows = await db
    .select({ item: revisionItem, title: concept.title })
    .from(revisionItem)
    .innerJoin(concept, eq(concept.id, revisionItem.conceptId))
    .where(eq(revisionItem.ownerId, ownerId));
  const weekStart = startOfWeekUtc(now);
  const reviewedThisWeek = rows.filter((r) => r.item.lastReviewedAt && r.item.lastReviewedAt.getTime() >= weekStart.getTime()).length;
  const set = nextReviewSet(
    rows.map((r) => ({ id: r.item.id, dueAt: r.item.dueAt, status: r.item.status, snoozedUntil: r.item.snoozedUntil })),
    { now, budgetPerWeek: settings.budgetPerWeek, reviewedThisWeek, paused: settings.paused, restWeekdays: settings.restWeekdays },
  );
  const byId = new Map(rows.map((r) => [r.item.id, { ...r.item, conceptTitle: r.title }]));
  return { settings, set, items: set.items.map((id) => byId.get(id)!).filter(Boolean), reviewedThisWeek };
}

async function ownedItem(db: DbOrTx, ownerId: string, id: string) {
  const [item] = await db
    .select()
    .from(revisionItem)
    .where(and(eq(revisionItem.id, id), eq(revisionItem.ownerId, ownerId)))
    .limit(1);
  return item ?? null;
}

/** Snooze moves an item out of the way for a few days; archive keeps it but never offers it. */
export async function snoozeItem(db: DbOrTx, ownerId: string, id: string, days: number, now = new Date()): Promise<void> {
  if (!(await ownedItem(db, ownerId, id))) return;
  const d = Math.min(30, Math.max(1, Math.round(days)));
  await db
    .update(revisionItem)
    .set({ snoozedUntil: new Date(now.getTime() + d * DAY) })
    .where(eq(revisionItem.id, id));
}

export async function setItemStatus(db: DbOrTx, ownerId: string, id: string, status: "active" | "archived"): Promise<void> {
  if (!(await ownedItem(db, ownerId, id))) return;
  await db.update(revisionItem).set({ status, snoozedUntil: null }).where(eq(revisionItem.id, id));
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
