import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DEFAULT_SUBJECT_SLUGS, discoverSeed, SUBJECTS, subjectBySlug } from "@corniversity/core";
import { and, eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture } from "../../test/fixtures";
import { createDb } from "../client";
import { stopBoss } from "../queue";
import { user } from "../schema/auth";
import { courseVersion, enrolment, scholarlyWork, source, sourceVersion } from "../schema/index";
import { jobRecord } from "../schema/operations";
import { providerCache } from "../schema/scholarly";
import { cacheKey, MemoryProviderCache } from "../scholarly/cache";
import { createScholarlyClient, type ScholarlyClient } from "../scholarly/client";
import { ScholarlyProviderError } from "../scholarly/errors";
import { FixtureTransport } from "../scholarly/fixture-transport";
import type { OpenAlexList } from "../scholarly/types";
import {
  arxivJobKey,
  arxivListingRequest,
  citedByYourPapers,
  DISCOVER_FIXTURE_DAY,
  DiscoverError,
  discoverClient,
  discoverDay,
  discoverPage,
  FixtureCacheTransport,
  fixtureCacheKey,
  fromYourCourses,
  getDiscoverSubjects,
  type ListView,
  listsJobKey,
  openAlexBrowsingAllowed,
  refreshSubjectLists,
  reviewYears,
  setDiscoverSubjects,
  similarToRecent,
  subjectListRequests,
  subjectLists,
  subjectRoom,
  subjectSubfields,
  subjectsToRefresh,
  surprise,
  surpriseRequest,
} from "./discover";
import { importByIdentifier, importFromOpenAlexRecord, ScholarlyError } from "./scholarly-works";

/**
 * Discover against the embedded PostgreSQL with the fixture provider: responses recorded once from
 * OpenAlex and arXiv (scripts/scholarly-record/discover.ts, labelled `fixture`) behind an in-memory
 * provider cache, so lists reach the pages only after a "worker" refresh, as in production. Where a
 * recording cannot show a situation (OpenAlex's allowance spent), a scripted test double built here
 * stands in; neither is a live provider.
 */
const RUN = randomUUID().slice(0, 8);
const OWNER = `discover-owner-${RUN}`;
const OTHER = `discover-other-${RUN}`;
const FIXTURES = join(__dirname, "../scholarly/fixtures");
/** The two density-functional papers the journey saves; they share one reference. */
const LYP = "W2023271753";
const BECKE_1988 = "W2086957099";
let handle: ReturnType<typeof createDb>;

/** The fixture provider behind a fresh in-memory cache, with a clock the test moves. */
function fixtureClient(clock = { now: new Date("2026-11-16T09:00:00Z") }): { client: ScholarlyClient; clock: { now: Date } } {
  const client = createScholarlyClient(
    new FixtureCacheTransport(new FixtureTransport(FIXTURES), new MemoryProviderCache(), () => clock.now),
  );
  return { client, clock };
}

/** Runs what the worker runs for a subject: its OpenAlex lists and its arXiv listing, into the cache. */
async function workerRefresh(client: ScholarlyClient, slug: string): Promise<void> {
  await refreshSubjectLists(client, [slug], { day: DISCOVER_FIXTURE_DAY, browsing: true });
  const listing = arxivListingRequest(subjectBySlug(slug)!);
  if (listing) await client.arxivNewest(listing.categories, listing.maxResults, { cache: "refresh" });
}

function ready(view: ListView | null) {
  expect(view?.state).toBe("ready");
  return view as Extract<ListView, { state: "ready" }>;
}

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 4 });
  await handle.db
    .insert(user)
    .values([
      { id: OWNER, name: "Discover Test", email: `${OWNER}@example.test` },
      { id: OTHER, name: "Discover Other", email: `${OTHER}@example.test` },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await stopBoss();
  await handle.close();
});

describe("the owner's subjects", () => {
  it("defaults to the four primary subjects, stores a choice in display order, and keeps owners apart", async () => {
    expect(await getDiscoverSubjects(handle.db, OWNER)).toEqual([...DEFAULT_SUBJECT_SLUGS]);
    expect(await setDiscoverSubjects(handle.db, OWNER, ["chemistry", "mathematics", "chemistry"])).toEqual(["mathematics", "chemistry"]);
    expect(await getDiscoverSubjects(handle.db, OWNER)).toEqual(["mathematics", "chemistry"]);
    // Another owner's choice is not this owner's.
    expect(await getDiscoverSubjects(handle.db, OTHER)).toEqual([...DEFAULT_SUBJECT_SLUGS]);
    await expect(setDiscoverSubjects(handle.db, OWNER, ["mathematics", "astrology"])).rejects.toThrow(
      new DiscoverError("invalid", "Choose subjects from the list."),
    );
    // None is a choice too.
    expect(await setDiscoverSubjects(handle.db, OWNER, [])).toEqual([]);
    expect(await getDiscoverSubjects(handle.db, OWNER)).toEqual([]);
    await setDiscoverSubjects(handle.db, OWNER, ["chemistry"]);
    // The daily refresh covers every chosen subject, and the defaults while some owner has not chosen.
    const daily = await subjectsToRefresh(handle.db);
    expect(daily).toContain("chemistry");
    for (const slug of DEFAULT_SUBJECT_SLUGS) expect(daily).toContain(slug);
    await setDiscoverSubjects(handle.db, OWNER, [...DEFAULT_SUBJECT_SLUGS]);
  });
});

describe("the requests", () => {
  it("are fixed by the subject and the day; fixture mode uses the recording day", () => {
    const maths = subjectBySlug("mathematics")!;
    expect(subjectListRequests(maths, "2026-11-15").map((r) => r.list)).toEqual(["reviews", "most_cited", "earlier_work"]);
    expect(reviewYears("2026-11-15")).toEqual({ from: 2022, to: 2026 });
    expect(subjectListRequests(maths, "2026-11-15")[2]!.params.filters).toEqual({ fieldId: "26", publicationYear: { to: 1989 } });
    expect(subjectListRequests(subjectBySlug("artificial-intelligence")!, "2026-11-15")[1]!.params.filters).toEqual({ subfieldId: "1702" });
    expect(arxivListingRequest(subjectBySlug("chemistry")!)).toBeNull();
    expect(discoverDay({ mode: "fixture" }, new Date("2030-01-02T03:00:00Z"))).toBe(DISCOVER_FIXTURE_DAY);
    expect(discoverDay({ mode: "live" }, new Date("2030-01-02T03:00:00Z"))).toBe("2030-01-02");
  });

  it("Surprise me picks a field outside the owner's subjects by a seed of the day and the count", () => {
    const first = surpriseRequest(DEFAULT_SUBJECT_SLUGS, "2026-11-15", 1)!;
    expect(first.params.seed).toBe(discoverSeed("surprise", "2026-11-15", 1));
    expect(first.params.filters).toMatchObject({ types: ["review"], hasAbstract: true, isOa: true, isRetracted: false });
    expect(["26", "31", "17"]).not.toContain(first.field.openalex.fieldId);
    expect(surpriseRequest(DEFAULT_SUBJECT_SLUGS, "2026-11-15", 1)).toEqual(first);
    expect(surpriseRequest(DEFAULT_SUBJECT_SLUGS, "2026-11-15", 2)!.params.seed).not.toBe(first.params.seed);
    expect(
      surpriseRequest(
        SUBJECTS.map((s) => s.slug),
        "2026-11-15",
        1,
      ),
    ).toBeNull();
  });

  it("OpenAlex browsing needs a key only on a production server", () => {
    expect(openAlexBrowsingAllowed({ SCHOLARLY_PROVIDER: "live", DEPLOYMENT_MODE: "production" })).toBe(false);
    expect(openAlexBrowsingAllowed({ SCHOLARLY_PROVIDER: "live", DEPLOYMENT_MODE: "production", OPENALEX_API_KEY: "k".repeat(20) })).toBe(
      true,
    );
    expect(openAlexBrowsingAllowed({ SCHOLARLY_PROVIDER: "live", DEPLOYMENT_MODE: "local" })).toBe(true);
    expect(openAlexBrowsingAllowed({ SCHOLARLY_PROVIDER: "fixture", DEPLOYMENT_MODE: "local" })).toBe(true);
  });
});

describe("fixture mode behind the provider cache", () => {
  it("reads nothing until a refresh has stored the recording; then serves it as fixture data, stale after its lifetime", async () => {
    const { client, clock } = fixtureClient();
    const params = subjectListRequests(subjectBySlug("mathematics")!, DISCOVER_FIXTURE_DAY)[1]!.params;
    await expect(client.openalexSearch(params, { cache: "only", cacheKind: "subject_list" })).rejects.toMatchObject({ code: "not_cached" });
    await client.openalexSearch(params, { cache: "refresh", cacheKind: "subject_list" });
    const cached = await client.openalexSearch(params, { cache: "only", cacheKind: "subject_list" });
    expect(cached.provenance).toMatchObject({ source: "fixture", stale: false });
    // The retrieval time is when the provider gave the answer: the recording.
    expect(cached.provenance.retrievedAt.slice(0, 10)).toBe("2026-11-15");
    expect(cached.items[0]!.title).toBe("R: A Language and Environment for Statistical Computing");
    clock.now = new Date(clock.now.getTime() + 25 * 3600_000);
    expect((await client.openalexSearch(params, { cache: "only", cacheKind: "subject_list" })).provenance.stale).toBe(true);
    // A request with no recording stays unavailable, and nothing is stored for it.
    await expect(client.openalexSubfields(["12"], { cache: "use" })).rejects.toMatchObject({ code: "fixture_missing" });
    await expect(client.openalexSubfields(["12"], { cache: "only" })).rejects.toMatchObject({ code: "not_cached" });
  });

  it("keeps recorded and live responses under different keys; refuses fixture data in production", async () => {
    const request = { host: "api.openalex.org", path: "/fields", query: [["per_page", "100"]] as const };
    expect(fixtureCacheKey(request)).not.toBe(cacheKey(request));
    expect(discoverClient({ SCHOLARLY_PROVIDER: "live" }, handle.db).mode).toBe("live");
    expect(() => discoverClient({ SCHOLARLY_PROVIDER: "fixture", DEPLOYMENT_MODE: "production" }, handle.db)).toThrow(
      /refused in production/,
    );
    // The PostgreSQL cache in fixture mode: a refresh writes a row under the fixture key.
    const client = discoverClient({ SCHOLARLY_PROVIDER: "fixture", DEPLOYMENT_MODE: "local" }, handle.db);
    await client.openalexSubfields(["26"], { cache: "refresh" });
    const subfields = await client.openalexSubfields(["26"], { cache: "only" });
    expect(subfields.map((s) => s.name)).toContain("Algebra and Number Theory");
    expect(subfields[0]!.provenance.source).toBe("fixture");
    expect(await handle.db.select({ key: providerCache.key }).from(providerCache)).toEqual(
      expect.arrayContaining([
        {
          key: fixtureCacheKey({
            host: "api.openalex.org",
            path: "/subfields",
            query: [
              ["filter", "field.id:26"],
              ["per_page", "200"],
              ["select", "id,display_name,description,field,domain,works_count"],
            ],
          }),
        },
      ]),
    );
  });
});

describe("subject lists", () => {
  it("say Not fetched yet and ask the worker, then show the recorded lists with their source", async () => {
    const { client, clock } = fixtureClient();
    const now = clock.now;
    const cold = await subjectLists(handle.db, OWNER, client, "mathematics", { now, browsing: true, limit: 5 });
    expect(cold.pending).toBe(true);
    expect([cold.newOnArxiv, cold.reviews, cold.mostCited, cold.earlierWork].map((v) => v?.state)).toEqual([
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    // One OpenAlex job and one arXiv listing job (scholarly-arxiv, the only queue that calls arXiv), owner-scoped.
    const jobs = await handle.db
      .select()
      .from(jobRecord)
      .where(and(eq(jobRecord.ownerId, OWNER), like(jobRecord.idempotencyKey, "discover:%:mathematics:%")));
    expect(jobs.map((j) => [j.queue, j.idempotencyKey]).sort()).toEqual(
      [
        ["scholarly-arxiv", arxivJobKey(OWNER, "mathematics", now)],
        ["scholarly-lists", listsJobKey(OWNER, "mathematics", now)],
      ].sort(),
    );
    expect(jobs.find((j) => j.queue === "scholarly-arxiv")!.payload).toMatchObject({
      task: "listing",
      categories: ["math.*"],
      maxResults: 10,
    });
    // Asking again within the hour adds no job.
    await subjectLists(handle.db, OWNER, client, "mathematics", { now, browsing: true, limit: 5 });
    expect(
      await handle.db
        .select()
        .from(jobRecord)
        .where(and(eq(jobRecord.ownerId, OWNER), like(jobRecord.idempotencyKey, "discover:%:mathematics:%"))),
    ).toHaveLength(2);

    await workerRefresh(client, "mathematics");
    const warm = await subjectLists(handle.db, OWNER, client, "mathematics", { now, browsing: true, limit: 5 });
    expect(warm.pending).toBe(false);
    const mostCited = ready(warm.mostCited);
    expect(mostCited.items).toHaveLength(5);
    expect(mostCited.provenance).toMatchObject({ provider: "openalex", source: "fixture", stale: false });
    expect(mostCited.items[0]).toMatchObject({
      ref: { scheme: "openalex", value: "W2582743722" },
      title: "R: A Language and Environment for Statistical Computing",
      citedByCount: 356000,
      workId: null,
    });
    const earlier = ready(warm.earlierWork);
    expect(earlier.items.every((i) => (i.year ?? 0) < 1990)).toBe(true);
    const arxiv = ready(warm.newOnArxiv);
    expect(arxiv.provenance).toMatchObject({ provider: "arxiv", source: "fixture" });
    expect(arxiv.items[0]!.ref.scheme).toBe("arxiv");
    expect(arxiv.items[0]!.submitted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ready(warm.reviews).items.every((i) => (i.year ?? 0) >= 2022)).toBe(true);
    // The subject room shows the same lists in full.
    const room = await subjectRoom(handle.db, OWNER, client, "mathematics", { now, browsing: true });
    expect(room.chosen).toBe(true);
    expect(ready(room.lists.mostCited).items).toHaveLength(10);
  });

  it("mark rows the owner has (and only that owner) as in the library", async () => {
    const { client, clock } = fixtureClient();
    await workerRefresh(client, "physics");
    const list = (await client.openalexSearch(subjectListRequests(subjectBySlug("physics")!, DISCOVER_FIXTURE_DAY)[1]!.params, {
      cache: "only",
      cacheKind: "subject_list",
    })) as OpenAlexList;
    const imported = await importFromOpenAlexRecord(handle.db, OWNER, list.items[1]!);
    const mine = await subjectLists(handle.db, OWNER, client, "physics", { now: clock.now, browsing: true, limit: 5 });
    expect(ready(mine.mostCited).items[1]!.workId).toBe(imported.workId);
    const theirs = await subjectLists(handle.db, OTHER, client, "physics", { now: clock.now, browsing: true, limit: 5 });
    expect(ready(theirs.mostCited).items[1]!.workId).toBeNull();
  });

  it("a stale list is shown with its date and refreshed in the background", async () => {
    const { client, clock } = fixtureClient();
    await workerRefresh(client, "computer-science");
    clock.now = new Date(clock.now.getTime() + 30 * 3600_000);
    const lists = await subjectLists(handle.db, OWNER, client, "computer-science", { now: clock.now, browsing: true, limit: 5 });
    expect(lists.pending).toBe(false);
    expect(ready(lists.mostCited).provenance.stale).toBe(true);
    expect(ready(lists.mostCited).refresh).toEqual({ state: "queued" });
    expect(ready(lists.newOnArxiv).provenance.stale).toBe(true);
    expect(ready(lists.newOnArxiv).refresh).toEqual({ state: "queued" });
    const keys = (await handle.db.select({ key: jobRecord.idempotencyKey }).from(jobRecord).where(eq(jobRecord.ownerId, OWNER))).map(
      (j) => j.key,
    );
    expect(keys).toEqual(
      expect.arrayContaining([listsJobKey(OWNER, "computer-science", clock.now), arxivJobKey(OWNER, "computer-science", clock.now)]),
    );
  });

  it("an out-of-date list keeps its rows and says when its refresh failed (what the job reported) or has already run", async () => {
    const owner = `discover-stale-${RUN}`;
    await handle.db.insert(user).values({ id: owner, name: "Stale", email: `${owner}@example.test` });
    const { client, clock } = fixtureClient();
    await workerRefresh(client, "physics");
    clock.now = new Date("2026-11-17T15:10:00Z");
    const first = await subjectLists(handle.db, owner, client, "physics", { now: clock.now, browsing: true, limit: 5 });
    expect(ready(first.reviews).refresh).toEqual({ state: "queued" });
    // The hour's refresh ran: OpenAlex refused two lists; the third was fetched, yet the cache still holds the old one.
    const resetAt = "2026-11-18T00:00:00.000Z";
    await handle.db
      .update(jobRecord)
      .set({
        status: "completed",
        result: {
          lists: [
            { subject: "physics", list: "reviews", outcome: "failed", code: "budget_exhausted", resetAt },
            { subject: "physics", list: "most_cited", outcome: "failed", code: "unavailable", resetAt: null },
            { subject: "physics", list: "earlier_work", outcome: "fetched", items: 10 },
          ],
        },
      })
      .where(eq(jobRecord.idempotencyKey, listsJobKey(owner, "physics", clock.now)));
    // The arXiv listing job failed (in fixture mode, a missing recording).
    await handle.db
      .update(jobRecord)
      .set({ status: "failed", error: "No recorded provider response" })
      .where(eq(jobRecord.idempotencyKey, arxivJobKey(owner, "physics", clock.now)));
    const lists = await subjectLists(handle.db, owner, client, "physics", { now: clock.now, browsing: true, limit: 5 });
    expect(lists.pending).toBe(false);
    expect(ready(lists.reviews).items.length).toBeGreaterThan(0);
    expect(ready(lists.reviews).provenance.stale).toBe(true);
    expect(ready(lists.reviews).refresh).toEqual({ state: "failed", code: "budget_exhausted", resetAt });
    expect(ready(lists.mostCited).refresh).toEqual({ state: "failed", code: "unavailable", resetAt: null });
    // Not "refreshing" when nothing is: the next job is asked for from the next hour.
    expect(ready(lists.earlierWork).refresh).toEqual({ state: "later", after: "2026-11-17T16:00:00.000Z" });
    expect(ready(lists.newOnArxiv).refresh).toEqual({ state: "failed", code: "fixture_missing", resetAt: null });
  });

  it("a list this hour's job fetched but the cache no longer holds says when it is asked for again, not Not fetched yet", async () => {
    const owner = `discover-evicted-${RUN}`;
    await handle.db.insert(user).values({ id: owner, name: "Evicted", email: `${owner}@example.test` });
    const { client } = fixtureClient();
    const now = new Date("2026-11-16T14:20:00Z");
    expect((await subjectLists(handle.db, owner, client, "mathematics", { now, browsing: true, limit: 5 })).pending).toBe(true);
    // Both jobs finished, but the cache holds nothing (the daily purge's row cap removed the lists, say).
    await handle.db
      .update(jobRecord)
      .set({
        status: "completed",
        result: {
          lists: ["reviews", "most_cited", "earlier_work"].map((list) => ({ subject: "mathematics", list, outcome: "fetched", items: 10 })),
        },
      })
      .where(eq(jobRecord.idempotencyKey, listsJobKey(owner, "mathematics", now)));
    await handle.db
      .update(jobRecord)
      .set({ status: "completed", result: { entries: 10 } })
      .where(eq(jobRecord.idempotencyKey, arxivJobKey(owner, "mathematics", now)));
    const after = "2026-11-16T15:00:00.000Z";
    const lists = await subjectLists(handle.db, owner, client, "mathematics", { now, browsing: true, limit: 5 });
    expect(lists.mostCited).toEqual({ state: "later", provider: "openalex", after });
    expect(lists.newOnArxiv).toEqual({ state: "later", provider: "arxiv", after });
    // Nothing is fetching, so the page does not keep refreshing itself.
    expect(lists.pending).toBe(false);
    // From the next hour a page asks for a new job.
    const next = new Date("2026-11-16T15:05:00Z");
    const again = await subjectLists(handle.db, owner, client, "mathematics", { now: next, browsing: true, limit: 5 });
    expect(again.mostCited).toEqual({ state: "pending" });
    expect(again.pending).toBe(true);
  });

  it("show what the refresh job reported when it could not fetch a list, never an empty list", async () => {
    const { client } = fixtureClient();
    const now = new Date("2026-11-16T11:00:00Z");
    await subjectLists(handle.db, OWNER, client, "chemistry", { now, browsing: true, limit: 5 });
    const resetAt = "2026-11-17T00:00:00.000Z";
    await handle.db
      .update(jobRecord)
      .set({
        status: "completed",
        result: {
          lists: [
            { subject: "chemistry", list: "reviews", outcome: "failed", code: "budget_exhausted", resetAt },
            { subject: "chemistry", list: "most_cited", outcome: "failed", code: "unavailable", resetAt: null },
            { subject: "chemistry", list: "earlier_work", outcome: "failed", code: "fixture_missing", resetAt: null },
          ],
        },
      })
      .where(eq(jobRecord.idempotencyKey, listsJobKey(OWNER, "chemistry", now)));
    const lists = await subjectLists(handle.db, OWNER, client, "chemistry", { now, browsing: true, limit: 5 });
    expect(lists.newOnArxiv).toBeNull();
    expect(lists.reviews).toEqual({ state: "failed", provider: "openalex", code: "budget_exhausted", resetAt });
    expect(lists.mostCited).toMatchObject({ state: "failed", code: "unavailable" });
    expect(lists.earlierWork).toMatchObject({ state: "failed", code: "fixture_missing" });
    expect(lists.pending).toBe(false);
    // A job that failed outright points to its record.
    await handle.db
      .update(jobRecord)
      .set({ status: "failed" })
      .where(eq(jobRecord.idempotencyKey, listsJobKey(OWNER, "chemistry", now)));
    expect((await subjectLists(handle.db, OWNER, client, "chemistry", { now, browsing: true, limit: 5 })).reviews).toMatchObject({
      state: "failed",
      code: "refresh_failed",
    });
  });

  it("without OpenAlex browsing say a key is needed and ask for no OpenAlex job", async () => {
    const { client } = fixtureClient();
    const now = new Date("2026-11-16T12:00:00Z");
    const lists = await subjectLists(handle.db, OTHER, client, "mathematics", { now, browsing: false, limit: 5 });
    expect([lists.reviews, lists.mostCited, lists.earlierWork]).toEqual([
      { state: "key_needed" },
      { state: "key_needed" },
      { state: "key_needed" },
    ]);
    expect(lists.newOnArxiv?.state).toBe("pending");
    const keys = (await handle.db.select({ key: jobRecord.idempotencyKey }).from(jobRecord).where(eq(jobRecord.ownerId, OTHER))).map(
      (j) => j.key,
    );
    expect(keys).not.toContain(listsJobKey(OTHER, "mathematics", now));
    expect(keys).toContain(arxivJobKey(OTHER, "mathematics", now));
  });

  it("refuses a subject that does not exist", async () => {
    const { client, clock } = fixtureClient();
    await expect(subjectLists(handle.db, OWNER, client, "astrology", { now: clock.now, browsing: true, limit: 5 })).rejects.toThrow(
      "Subject not found.",
    );
    await expect(subjectSubfields(client, "astrology", { browsing: true })).rejects.toThrow("Subject not found.");
  });
});

describe("the worker's refresh", () => {
  it("records each list's outcome; once OpenAlex's allowance is spent it requests nothing more", async () => {
    let calls = 0;
    const resetAt = new Date("2026-11-17T00:00:00Z");
    // A scripted test double: OpenAlex reporting its daily allowance spent.
    const spent = {
      ...fixtureClient().client,
      openalexSearch: async () => {
        calls++;
        throw new ScholarlyProviderError("openalex", "budget_exhausted", "spent", { status: 429, resetAt });
      },
    } as ScholarlyClient;
    const outcomes = await refreshSubjectLists(spent, ["mathematics", "chemistry"], { day: DISCOVER_FIXTURE_DAY, browsing: true });
    expect(calls).toBe(1);
    expect(outcomes).toHaveLength(6);
    expect(outcomes.every((o) => o.outcome === "failed" && o.code === "budget_exhausted" && o.resetAt === resetAt.toISOString())).toBe(
      true,
    );
    const keyless = await refreshSubjectLists(spent, ["mathematics"], { day: DISCOVER_FIXTURE_DAY, browsing: false });
    expect(keyless.map((o) => o.outcome)).toEqual(["key_needed", "key_needed", "key_needed"]);
    expect(calls).toBe(1);
  });
});

describe("across subjects", () => {
  it("Cited by 2 or more of your papers counts the saved papers' references; Similar to follows the most recently saved paper", async () => {
    const owner = `discover-cited-${RUN}`;
    await handle.db.insert(user).values({ id: owner, name: "Cited", email: `${owner}@example.test` });
    const { client } = fixtureClient();
    expect(await citedByYourPapers(handle.db, owner, client, { browsing: true })).toEqual({
      state: "empty",
      savedPapers: 0,
      withReferences: 0,
    });
    expect(await similarToRecent(handle.db, owner, client, { browsing: true })).toEqual({ state: "empty", savedPapers: 0 });

    await importByIdentifier(handle.db, owner, client, { scheme: "openalex", value: LYP });
    const one = await citedByYourPapers(handle.db, owner, client, { browsing: true });
    expect(one).toEqual({ state: "empty", savedPapers: 1, withReferences: 1 });
    const b = await importByIdentifier(handle.db, owner, client, { scheme: "openalex", value: BECKE_1988 });

    const cited = await citedByYourPapers(handle.db, owner, client, { browsing: true });
    expect(cited.state).toBe("list");
    const list = ready((cited as Extract<typeof cited, { state: "list" }>).list);
    expect(list.items.map((i) => i.title)).toEqual(["Roothaan-Hartree-Fock atomic wavefunctions"]);
    expect(list.items[0]!.reason?.text).toBe("Cited by 2 papers in your library");
    expect(list.provenance.source).toBe("fixture");

    const similar = await similarToRecent(handle.db, owner, client, { browsing: true });
    expect(similar.state).toBe("list");
    const view = similar as Extract<typeof similar, { state: "list" }>;
    expect(view.basis).toEqual({
      workId: b.workId,
      title: "Density-functional exchange-energy approximation with correct asymptotic behavior",
    });
    expect(view.reason.text).toMatch(/\(similarity, not a citation\)$/);
    expect(ready(view.list).items.length).toBeGreaterThan(0);
    expect(ready(view.list).items.some((i) => i.ref.value === BECKE_1988)).toBe(false);

    // Another owner has none of this.
    expect(await citedByYourPapers(handle.db, OTHER, client, { browsing: true })).toMatchObject({ state: "empty" });
    expect(await similarToRecent(handle.db, OTHER, client, { browsing: true })).toEqual({ state: "empty", savedPapers: 0 });
    // Without OpenAlex browsing, the lists say a key is needed instead of asking.
    expect(await citedByYourPapers(handle.db, owner, client, { browsing: false })).toEqual({
      state: "list",
      list: { state: "key_needed" },
      missing: 0,
    });
  });

  it("Similar to passes over a newer save OpenAlex has no record of, and says so when no saved paper has one", async () => {
    const owner = `discover-similar-${RUN}`;
    await handle.db.insert(user).values({ id: owner, name: "Similar", email: `${owner}@example.test` });
    const { client } = fixtureClient();
    // A brand-new arXiv submission (OpenAlex has no record of it): saved, but nothing to relate it by.
    const preprint = await importByIdentifier(handle.db, owner, client, { scheme: "arxiv", value: "2611.00001" });
    await handle.db
      .update(scholarlyWork)
      .set({ savedAt: new Date("2026-11-15T00:00:00Z") })
      .where(eq(scholarlyWork.id, preprint.workId));
    expect(await similarToRecent(handle.db, owner, client, { browsing: true })).toEqual({ state: "empty", savedPapers: 1 });
    // An older save OpenAlex knows is the basis, although the preprint was saved after it.
    const lyp = await importByIdentifier(handle.db, owner, client, { scheme: "openalex", value: LYP });
    await handle.db
      .update(scholarlyWork)
      .set({ savedAt: new Date("2026-11-01T00:00:00Z") })
      .where(eq(scholarlyWork.id, lyp.workId));
    const view = await similarToRecent(handle.db, owner, client, { browsing: true });
    expect(view).toMatchObject({ state: "list", basis: { workId: lyp.workId } });
  });

  it("Surprise me shows one sampled review with its abstract; an unrecorded one is unavailable, never empty", async () => {
    const { client, clock } = fixtureClient();
    const first = await surprise(handle.db, OWNER, client, { now: clock.now, n: 1, browsing: true, slugs: DEFAULT_SUBJECT_SLUGS });
    expect(first.state).toBe("pick");
    const pick = first as Extract<typeof first, { state: "pick" }>;
    expect(pick.field.name).toBe("Health Professions");
    expect(pick.reason.text).toContain("outside your subjects");
    expect(pick.pick.abstract).toBeTruthy();
    expect(pick.pick.provenance.source).toBe("fixture");
    expect(pick.pick.item.title).toMatch(/^Laboratory approaches to determining blood culture contamination/);
    const second = await surprise(handle.db, OWNER, client, { now: clock.now, n: 2, browsing: true, slugs: DEFAULT_SUBJECT_SLUGS });
    expect(second).toMatchObject({ state: "pick", field: { name: "Decision Sciences" } });
    expect(await surprise(handle.db, OWNER, client, { now: clock.now, n: 3, browsing: true, slugs: DEFAULT_SUBJECT_SLUGS })).toMatchObject({
      state: "failed",
      view: { state: "failed", code: "fixture_missing" },
    });
    await expect(surprise(handle.db, OWNER, client, { now: clock.now, n: 0, browsing: true })).rejects.toThrow(
      "Choose a surprise from this page.",
    );
  });

  it("From your courses lists registry sources of the courses taken that carry a DOI or arXiv id, by parsing only", async () => {
    const fx = await createFixture(handle.db, "discover");
    const s = randomUUID().slice(0, 6);
    const sources = [
      { id: `src-doi-${s}`, title: "B: a DOI source", canonicalUrl: "https://doi.org/10.1371/journal.pcbi.1002410" },
      { id: `src-arxiv-${s}`, title: "A: an arXiv source", canonicalUrl: "https://arxiv.org/abs/gr-qc/9712019" },
      { id: `src-arxivdoi-${s}`, title: "C: an arXiv DOI", canonicalUrl: "https://doi.org/10.48550/arXiv.2305.18290" },
      { id: `src-web-${s}`, title: "D: a web book", canonicalUrl: "https://example.org/book/" },
    ];
    for (const src of sources) {
      await handle.db.insert(source).values({
        id: src.id,
        title: src.title,
        authors: ["An Author"],
        kind: "paper",
        canonicalUrl: src.canonicalUrl,
        currentVersionId: `${src.id}-v1`,
      });
      await handle.db.insert(sourceVersion).values({
        id: `${src.id}-v1`,
        sourceId: src.id,
        label: "v1",
        url: src.canonicalUrl,
        verifiedAt: "2026-10-01",
        verifiedBy: "test",
        licence: "unknown",
        accessStatus: "open",
      });
    }
    await handle.db
      .update(courseVersion)
      .set({ primarySourceIds: [sources[0]!.id, sources[3]!.id], supplementalSourceIds: [sources[1]!.id, sources[2]!.id] })
      .where(eq(courseVersion.id, fx.courseVersionId));
    const view = await fromYourCourses(handle.db, fx.ownerId);
    expect(view.courses).toBe(1);
    expect(view.items.map((i) => [i.title, i.ref])).toEqual([
      ["A: an arXiv source", { scheme: "arxiv", value: "gr-qc/9712019" }],
      ["B: a DOI source", { scheme: "doi", value: "10.1371/journal.pcbi.1002410" }],
      ["C: an arXiv DOI", { scheme: "arxiv", value: "2305.18290" }],
    ]);
    expect(view.items[0]).toMatchObject({
      courses: [{ id: fx.courseId, title: "Fixture course" }],
      verifiedAt: "2026-10-01",
      workId: null,
    });
    // Another owner takes no course; a withdrawn course no longer counts.
    expect(await fromYourCourses(handle.db, OTHER)).toEqual({ items: [], total: 0, courses: 0 });
    await handle.db.update(enrolment).set({ status: "withdrawn" }).where(eq(enrolment.id, fx.enrolmentId));
    expect(await fromYourCourses(handle.db, fx.ownerId)).toEqual({ items: [], total: 0, courses: 0 });
    await fx.cleanup();
  });

  it("the request-time lists can be read from the cache alone, so a page renders them at once once fetched", async () => {
    const owner = `discover-cache-${RUN}`;
    await handle.db.insert(user).values({ id: owner, name: "Cache", email: `${owner}@example.test` });
    const { client, clock } = fixtureClient();
    await importByIdentifier(handle.db, owner, client, { scheme: "openalex", value: LYP });
    await importByIdentifier(handle.db, owner, client, { scheme: "openalex", value: BECKE_1988 });
    const only = { browsing: true, cache: "only" as const };
    // Nothing fetched yet: "not cached", never an empty list and never a request.
    expect(await citedByYourPapers(handle.db, owner, client, only)).toEqual({ state: "not_cached" });
    expect(await similarToRecent(handle.db, owner, client, only)).toEqual({ state: "not_cached" });
    expect(await surprise(handle.db, owner, client, { ...only, now: clock.now, n: 1, slugs: DEFAULT_SUBJECT_SLUGS })).toEqual({
      state: "not_cached",
    });
    expect(await subjectSubfields(client, "chemistry", only)).toEqual({ state: "not_cached" });
    // Lists with nothing to fetch need no cache.
    expect(await citedByYourPapers(handle.db, OTHER, client, only)).toMatchObject({ state: "empty" });
    // Fetched once (the streamed part of the page), they come from the cache afterwards.
    await citedByYourPapers(handle.db, owner, client, { browsing: true });
    await similarToRecent(handle.db, owner, client, { browsing: true });
    await surprise(handle.db, owner, client, { browsing: true, now: clock.now, n: 1, slugs: DEFAULT_SUBJECT_SLUGS });
    await subjectSubfields(client, "chemistry", { browsing: true });
    expect(await citedByYourPapers(handle.db, owner, client, only)).toMatchObject({ state: "list", list: { state: "ready" } });
    expect(await similarToRecent(handle.db, owner, client, only)).toMatchObject({ state: "list", list: { state: "ready" } });
    expect(await surprise(handle.db, owner, client, { ...only, now: clock.now, n: 1, slugs: DEFAULT_SUBJECT_SLUGS })).toMatchObject({
      state: "pick",
    });
    expect(await subjectSubfields(client, "chemistry", only)).toMatchObject({ state: "ready" });
  });

  it("a subject room names a subfield subject's field and lists a field's subfields from the taxonomy", async () => {
    const { client } = fixtureClient();
    expect(await subjectSubfields(client, "artificial-intelligence", { browsing: true })).toMatchObject({
      state: "subfield",
      parent: { slug: "computer-science" },
    });
    const maths = await subjectSubfields(client, "mathematics", { browsing: true });
    expect(maths.state).toBe("ready");
    expect((maths as Extract<typeof maths, { state: "ready" }>).subfields.map((s) => s.name)).toContain("Statistics and Probability");
    expect(await subjectSubfields(client, "mathematics", { browsing: false })).toEqual({ state: "key_needed" });
    expect(await subjectSubfields(client, "arts-and-humanities", { browsing: true })).toMatchObject({
      state: "failed",
      code: "fixture_missing",
    });
  });

  it("the Discover page reads the owner's subjects, lists and courses together", async () => {
    const { client, clock } = fixtureClient();
    await setDiscoverSubjects(handle.db, OTHER, ["chemistry"]);
    const page = await discoverPage(handle.db, OTHER, client, { now: clock.now, browsing: true });
    expect(page.subjects.map((s) => s.slug)).toEqual(["chemistry"]);
    expect(page.mode).toBe("fixture");
    expect(page.day).toBe(DISCOVER_FIXTURE_DAY);
    expect(page.pending).toBe(true);
    await workerRefresh(client, "chemistry");
    const warm = await discoverPage(handle.db, OTHER, client, { now: clock.now, browsing: true });
    expect(warm.pending).toBe(false);
    expect(ready(warm.lists[0]!.mostCited).items).toHaveLength(5);
  });

  it("import errors from a list's Save reach the owner as the service's own sentences", async () => {
    const { client } = fixtureClient();
    // W1 has no recording: in fixture mode that is "unavailable", never a made-up paper.
    const error = await importByIdentifier(handle.db, OWNER, client, { scheme: "openalex", value: "W1" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ScholarlyError);
    expect(error).toMatchObject({
      message: "No recorded provider response exists for this request (fixture mode), so it is unavailable.",
      details: { providerCode: "fixture_missing" },
    });
  });
});
