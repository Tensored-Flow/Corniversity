import "server-only";
import { modelLabel } from "@corniversity/ai";
import type { DbOrTx } from "@corniversity/db/client";
import { runProducers } from "@corniversity/db/services/provider-config";

/**
 * Labels stored replies by what actually produced them (a model's name, or "Scripted demo"),
 * from the run each reply was saved with, so a reply keeps its label after the configuration
 * changes.
 */
export async function producerLabels(database: DbOrTx, runIds: (string | null)[]): Promise<(runId: string | null) => string | null> {
  const producers = await runProducers(
    database,
    runIds.filter((id): id is string => Boolean(id)),
  );
  return (runId) => {
    const producer = runId ? producers.get(runId) : undefined;
    return producer ? modelLabel(producer.model) : null;
  };
}
