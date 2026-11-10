import { VisualSpec, visualGate } from "@corniversity/core/visuals/visual";
import { and, eq, exists, inArray, isNotNull, or, sql } from "drizzle-orm";
import type { BlobStore } from "../blob";
import type { DbOrTx } from "../client";
import { unitExercise } from "../schema/academic";
import { attempt, submissionVersion } from "../schema/learning";
import { locator } from "../schema/library";
import { visualExplanation } from "../schema/visuals";

export class VisualError extends Error {}

type VisualRow = typeof visualExplanation.$inferSelect;

export interface VisualGateView {
  open: boolean;
  /** The exercises that would open it, with their titles, while it is closed. */
  waitingFor: { id: string; title: string }[];
}

/** Draft visuals are never offered; checked and published ones are, with their status shown. */
const OFFERED = ["checked", "published"] as const;

/** The exercises among `ids` this learner has submitted an attempt at or chosen to see the reference reasoning of. */
async function openedExercises(db: DbOrTx, ownerId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ exerciseId: attempt.exerciseId })
    .from(attempt)
    .where(
      and(
        eq(attempt.ownerId, ownerId),
        inArray(attempt.exerciseId, ids),
        or(
          isNotNull(attempt.solutionRevealedAt),
          exists(db.select({ one: sql`1` }).from(submissionVersion).where(eq(submissionVersion.attemptId, attempt.id))),
        ),
      ),
    );
  return new Set(rows.map((r) => r.exerciseId));
}

async function gateFor(db: DbOrTx, ownerId: string, row: VisualRow): Promise<VisualGateView> {
  const gate = visualGate(row.revealsExerciseIds, await openedExercises(db, ownerId, row.revealsExerciseIds));
  if (gate.open) return { open: true, waitingFor: [] };
  const titles = await db
    .select({ id: unitExercise.id, title: unitExercise.title })
    .from(unitExercise)
    .where(inArray(unitExercise.id, gate.waitingFor));
  const byId = new Map(titles.map((t) => [t.id, t.title]));
  return { open: false, waitingFor: gate.waitingFor.map((id) => ({ id, title: byId.get(id) ?? id })) };
}

/** The visual explanations offered with a unit, each with whether it is open to this learner yet. */
export async function listUnitVisuals(db: DbOrTx, ownerId: string, unitId: string) {
  const rows = await db
    .select()
    .from(visualExplanation)
    .where(and(inArray(visualExplanation.status, [...OFFERED]), sql`${visualExplanation.unitIds} @> ${JSON.stringify([unitId])}::jsonb`))
    .orderBy(visualExplanation.title);
  return Promise.all(
    rows.map(async (row) => ({
      slug: row.slug,
      title: row.title,
      status: row.status,
      origin: row.origin,
      hasFilm: row.filmBlobKey !== null,
      gate: await gateFor(db, ownerId, row),
    })),
  );
}

/** One offered visual with its storyboard and gate; null if it does not exist or is a draft. */
export async function getVisualForLearner(db: DbOrTx, ownerId: string, slug: string) {
  const [row] = await db
    .select()
    .from(visualExplanation)
    .where(and(eq(visualExplanation.slug, slug), inArray(visualExplanation.status, [...OFFERED])))
    .limit(1);
  if (!row) return null;
  return { row, spec: VisualSpec.parse(row.spec), gate: await gateFor(db, ownerId, row) };
}

/** The verified locators a visual cites, for its sources list. */
export async function visualSources(db: DbOrTx, locatorIds: string[]) {
  if (locatorIds.length === 0) return [];
  return db.select({ id: locator.id, label: locator.label, payload: locator.payload }).from(locator).where(inArray(locator.id, locatorIds));
}

/** The film's bytes, only for an open visual whose film was recorded from its current storyboard. */
export async function visualFilm(db: DbOrTx, blobs: BlobStore, ownerId: string, slug: string): Promise<{ bytes: Buffer; row: VisualRow }> {
  const found = await getVisualForLearner(db, ownerId, slug);
  if (!found) throw new VisualError("not_found");
  if (!found.gate.open) throw new VisualError("closed");
  if (!found.row.filmBlobKey) throw new VisualError("no_film");
  const bytes = await blobs.get(found.row.filmBlobKey);
  if (!bytes) throw new VisualError("no_film");
  return { bytes, row: found.row };
}
