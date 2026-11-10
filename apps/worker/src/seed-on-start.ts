import { defaultContentRoot, loadContent } from "@corniversity/content/load";
import { type SeedReport, seedContent } from "@corniversity/content/seed";
import { validateContent } from "@corniversity/content/validate";
import type { BlobStore } from "@corniversity/db/blob";

/**
 * Seeds the institution's content (departments, catalogue, sources, programmes, personas; never
 * learner data) when the deployment asks for it with SEED_CONTENT_ON_START=1, so a fresh database
 * holds the catalogue without a manual step. Seeding is idempotent: unchanged content creates
 * nothing, and changed content creates new course versions while learner records keep theirs.
 * Content with validation errors is not seeded (as `pnpm db:seed` refuses it): the worker keeps
 * running on the content already in the database and says why.
 */
export async function seedContentIfRequested(
  db: Parameters<typeof seedContent>[0],
  flag: string | undefined,
  root: string = defaultContentRoot(),
  blobs?: BlobStore,
): Promise<SeedReport | null> {
  if (flag !== "1") return null;
  const bundle = loadContent(root);
  const errors = validateContent(bundle).issues.filter((i) => i.level === "error");
  if (errors.length > 0) {
    console.error(`[worker] content NOT seeded: ${errors.length} validation errors; the database keeps its previous content`);
    for (const issue of errors.slice(0, 10)) console.error(`[worker]   ${issue.message}`);
    return null;
  }
  return seedContent(db, bundle, { blobs });
}
