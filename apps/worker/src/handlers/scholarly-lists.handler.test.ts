import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { subjectBySlug } from "@corniversity/core";
import { createDb } from "@corniversity/db/client";
import { getEnv } from "@corniversity/db/env";
import { QUEUES, ScholarlyListsPayload } from "@corniversity/db/jobs";
import { getBoss, stopBoss } from "@corniversity/db/queue";
import { user } from "@corniversity/db/schema/auth";
import { jobRecord } from "@corniversity/db/schema/operations";
import { PgProviderCache } from "@corniversity/db/scholarly/cache-pg";
import { createScholarlyClient, type ScholarlyClient } from "@corniversity/db/scholarly/client";
import { FixtureTransport } from "@corniversity/db/scholarly/fixture-transport";
import {
  arxivListingRequest,
  DISCOVER_FIXTURE_DAY,
  FixtureCacheTransport,
  type ListOutcome,
  subjectListRequests,
} from "@corniversity/db/services/discover";
import { like } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SUBJECT_LISTS_SCHEDULE, scheduleSubjectLists } from "./index";
import { ArxivGate, scholarlyArxivHandler } from "./scholarly";
import { type ScholarlyListsContext, scholarlyListsHandler } from "./scholarly-lists";

/**
 * The scholarly-lists job (Discover's subject lists) and the arXiv listing it relies on, with the
 * fixture provider (responses recorded once from OpenAlex and arXiv, labelled `fixture`) behind the
 * PostgreSQL provider cache, so what the job writes is what the pages read. A scripted client stands
 * in where no provider may be asked at all (a production server without an OpenAlex key).
 */
const OWNER = `lists-worker-owner-${randomUUID().slice(0, 8)}`;
const FIXTURES = join(__dirname, "../../../../packages/db/src/scholarly/fixtures");
let handle: ReturnType<typeof createDb>;
let client: ScholarlyClient;

function context(overrides: Partial<ScholarlyListsContext> = {}): ScholarlyListsContext {
  return { db: handle.db, env: getEnv(), boss: {} as PgBoss, scholarly: client, ...overrides };
}

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 3 });
  client = createScholarlyClient(new FixtureCacheTransport(new FixtureTransport(FIXTURES), new PgProviderCache(handle.db)));
  await handle.db
    .insert(user)
    .values({ id: OWNER, name: "Lists Worker", email: `${OWNER}@example.test` })
    .onConflictDoNothing();
});

afterAll(async () => {
  await stopBoss();
  await handle.close();
});

describe("scholarly-lists jobs", () => {
  it("fetch a subject's OpenAlex lists into the cache the pages read", async () => {
    const result = await scholarlyListsHandler(context(), {
      idempotencyKey: `lists:${randomUUID()}`,
      ownerId: OWNER,
      task: "subject-lists",
      subjects: ["mathematics"],
    });
    expect(result).toMatchObject({ day: DISCOVER_FIXTURE_DAY, subjects: ["mathematics"], arxivQueued: 0 });
    expect((result.lists as ListOutcome[]).map((l) => [l.list, l.outcome, l.items])).toEqual([
      ["reviews", "fetched", 10],
      ["most_cited", "fetched", 10],
      ["earlier_work", "fetched", 10],
    ]);
    for (const spec of subjectListRequests(subjectBySlug("mathematics")!, DISCOVER_FIXTURE_DAY)) {
      const cached = await client.openalexSearch(spec.params, { cache: "only", cacheKind: "subject_list" });
      expect(cached.provenance).toMatchObject({ source: "fixture", stale: false });
      expect(cached.items).toHaveLength(10);
    }
  });

  it("the daily run covers the chosen and default subjects and queues their arXiv listings once a day", async () => {
    const payload = { ...SUBJECT_LISTS_SCHEDULE.data };
    const first = await scholarlyListsHandler(context(), payload);
    expect(first.subjects).toEqual(expect.arrayContaining(["mathematics", "physics", "computer-science", "artificial-intelligence"]));
    expect((first.lists as ListOutcome[]).filter((l) => l.outcome !== "fetched")).toEqual([]);
    expect(first.arxivQueued).toBe(4);
    const queued = await handle.db
      .select()
      .from(jobRecord)
      .where(like(jobRecord.idempotencyKey, `discover:daily:arxiv:%:${DISCOVER_FIXTURE_DAY}`));
    expect(queued.map((j) => j.queue)).toEqual([
      QUEUES.scholarlyArxiv,
      QUEUES.scholarlyArxiv,
      QUEUES.scholarlyArxiv,
      QUEUES.scholarlyArxiv,
    ]);
    expect(queued.find((j) => j.idempotencyKey.includes(":physics:"))!.payload).toMatchObject({ task: "listing", maxResults: 10 });
    expect((await scholarlyListsHandler(context(), payload)).arxivQueued).toBe(0);
  });

  it("a production server without an OpenAlex key asks OpenAlex nothing and records why", async () => {
    let calls = 0;
    // A scripted test double that counts requests; it must receive none.
    const counting = {
      ...client,
      openalexSearch: async () => {
        calls++;
        throw new Error("must not be called");
      },
    } as ScholarlyClient;
    const result = await scholarlyListsHandler(
      context({
        scholarly: counting,
        env: { ...getEnv(), DEPLOYMENT_MODE: "production", SCHOLARLY_PROVIDER: "live", OPENALEX_API_KEY: undefined },
      }),
      { idempotencyKey: `lists:${randomUUID()}`, task: "subject-lists", subjects: ["chemistry"] },
    );
    expect((result.lists as ListOutcome[]).map((l) => l.outcome)).toEqual(["key_needed", "key_needed", "key_needed"]);
    expect(calls).toBe(0);
  });

  it("an arXiv listing job (scholarly-arxiv) with Discover's client lands in the cache Discover reads", async () => {
    const listing = arxivListingRequest(subjectBySlug("physics")!)!;
    await expect(client.arxivNewest(listing.categories, listing.maxResults, { cache: "only" })).rejects.toMatchObject({
      code: "not_cached",
    });
    const gate = new ArxivGate({ now: () => 0, sleep: async () => {} });
    const result = await scholarlyArxivHandler(
      { db: handle.db, env: getEnv(), boss: {} as PgBoss, scholarly: client, arxivGate: gate },
      { idempotencyKey: `listing:${randomUUID()}`, task: "listing", ...listing },
    );
    expect(result).toMatchObject({ entries: 10 });
    const cached = await client.arxivNewest(listing.categories, listing.maxResults, { cache: "only" });
    expect(cached.provenance).toMatchObject({ provider: "arxiv", source: "fixture" });
    expect(cached.entries).toHaveLength(10);
  });

  it("is scheduled daily under its own key in pg-boss, with a payload the queue accepts", async () => {
    // The real pg-boss: it refuses keys with characters outside its set (a key with ':' stopped the worker).
    const boss = await getBoss();
    await scheduleSubjectLists(boss);
    const schedules = await boss.getSchedules(QUEUES.scholarlyLists);
    const daily = schedules.find((s) => s.key === SUBJECT_LISTS_SCHEDULE.key);
    expect(daily).toMatchObject({ name: QUEUES.scholarlyLists, cron: "20 5 * * *", data: SUBJECT_LISTS_SCHEDULE.data });
    expect(ScholarlyListsPayload.parse(daily!.data)).toMatchObject({ task: "subject-lists", arxivListings: true });
    await boss.unschedule(QUEUES.scholarlyLists, SUBJECT_LISTS_SCHEDULE.key);
  });
});
