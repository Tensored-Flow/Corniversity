import { ScholarlyListsPayload } from "@corniversity/db/jobs";
import type { ScholarlyClient } from "@corniversity/db/scholarly/client";
import {
  discoverClient,
  discoverDay,
  enqueueDailyArxivListings,
  openAlexBrowsingAllowed,
  refreshSubjectLists,
  subjectsToRefresh,
} from "@corniversity/db/services/discover";
import type { HandlerContext } from "./index";
import { reportProgress } from "./job-record";

/**
 * Discover's subject lists (contract §9): Reviews and surveys, Most cited and Earlier work of each
 * subject, fetched from OpenAlex into the provider cache, which pages read. Runs daily for every
 * subject an owner has chosen (and then also queues their arXiv listings on the scholarly-arxiv
 * queue, the only one that calls arXiv) and whenever a page finds a subject's list missing or out of
 * date. A provider failure is recorded per list in the job's result, which the page shows; the job
 * itself completes, and the next refresh tries again.
 */

export interface ScholarlyListsContext extends HandlerContext {
  scholarly?: ScholarlyClient;
  now?: () => Date;
}

export async function scholarlyListsHandler(ctx: ScholarlyListsContext, raw: unknown): Promise<Record<string, unknown>> {
  const payload = ScholarlyListsPayload.parse(raw);
  const client = ctx.scholarly ?? discoverClient(ctx.env, ctx.db);
  const now = ctx.now?.() ?? new Date();
  const day = discoverDay(client, now);
  const subjects = payload.subjects ?? (await subjectsToRefresh(ctx.db));
  await reportProgress(ctx.db, raw, { stage: "fetching", percent: 10, detail: subjects.join(", ") });
  const lists = await refreshSubjectLists(client, subjects, { day, browsing: openAlexBrowsingAllowed(ctx.env) });
  const arxivQueued = payload.arxivListings ? await enqueueDailyArxivListings(ctx.db, subjects, day) : 0;
  await reportProgress(ctx.db, raw, { stage: "done", percent: 100 });
  return { day, subjects, lists, arxivQueued };
}
