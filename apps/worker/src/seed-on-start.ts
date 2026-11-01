import { defaultContentRoot, loadContent } from "@corniversity/content/load";
import { type SeedReport, seedContent } from "@corniversity/content/seed";

/**
 * Seeds the institution's content (departments, catalogue, sources, programmes, personas; never
 * learner data) when the deployment asks for it with SEED_CONTENT_ON_START=1, so a fresh database
 * holds the catalogue without a manual step. Seeding is idempotent: unchanged content creates
 * nothing, and changed content creates new course versions while learner records keep theirs.
 */
export async function seedContentIfRequested(
  db: Parameters<typeof seedContent>[0],
  flag: string | undefined,
  root: string = defaultContentRoot(),
): Promise<SeedReport | null> {
  if (flag !== "1") return null;
  return seedContent(db, loadContent(root));
}
