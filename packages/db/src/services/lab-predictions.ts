import { predictionRevealed } from "@corniversity/core/labs/prediction";
import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { auditEvent } from "../schema/index";
import { listEntries } from "./notebook";

const labEntity = (unitId: string, labId: string) => `${unitId}:${labId}`;

/**
 * Whether a laboratory's results are shown to the learner (see `predictionRevealed`): its
 * predictions are the notebook entries tagged with the laboratory, and each deliberate request to
 * predict again is an audit event, so both survive reloads, sessions and restarts.
 */
export async function labRevealState(
  db: DbOrTx,
  ownerId: string,
  unitId: string,
  labId: string,
): Promise<{ revealed: boolean; predictions: number }> {
  const predictions = (await listEntries(db, ownerId, { unitId, tag: "prediction", limit: 200 })).filter((e) => e.tags.includes(labId));
  const resets = await db
    .select({ at: auditEvent.createdAt })
    .from(auditEvent)
    .where(
      and(eq(auditEvent.ownerId, ownerId), eq(auditEvent.action, "lab:predict-again"), eq(auditEvent.entityId, labEntity(unitId, labId))),
    );
  return {
    revealed: predictionRevealed(
      predictions.map((p) => p.createdAt),
      resets.map((r) => r.at),
    ),
    predictions: predictions.length,
  };
}

/** Hides the laboratory's results until a new prediction is saved; earlier predictions are kept. */
export async function requestPredictAgain(db: DbOrTx, ownerId: string, unitId: string, labId: string): Promise<void> {
  await db.insert(auditEvent).values({
    ownerId,
    actor: "learner",
    action: "lab:predict-again",
    entity: "lab",
    entityId: labEntity(unitId, labId),
    details: { unitId, labId },
  });
}
