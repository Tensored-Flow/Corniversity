import { createHash } from "node:crypto";
import {
  arxivIdFromDoi,
  citedByLibrary,
  citedByLibraryReason,
  DEFAULT_SUBJECT_SLUGS,
  type DiscoverReason,
  discoverSeed,
  EARLIER_WORK_BEFORE_YEAR,
  type IdentifierRef,
  identifiersFromArxiv,
  isArxivDoi,
  isSubjectSlug,
  openAlexSubjectFilter,
  orderSubjects,
  recogniseInput,
  SUBJECTS,
  type SubjectDefinition,
  similarReason,
  subjectBySlug,
  surpriseField,
  surpriseReason,
} from "@corniversity/core";
import { and, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { ARXIV_SINGLETON_KEY, QUEUES, ScholarlyArxivPayload, ScholarlyListsPayload } from "../jobs";
import { enqueue } from "../queue";
import { user } from "../schema/auth";
import {
  course,
  courseVersion,
  enrolment,
  libraryPreference,
  scholarlyIdentifier,
  scholarlyWork,
  source,
  sourceVersion,
} from "../schema/index";
import { jobRecord } from "../schema/operations";
import { cacheTtlMs, canonicalRequest, isFresh, type ProviderCacheStore } from "../scholarly/cache";
import { PgProviderCache, scholarlyClientWithCache } from "../scholarly/cache-pg";
import { createScholarlyClient, type ScholarlyClient, type ScholarlyEnv } from "../scholarly/client";
import { providerName, type ScholarlyErrorCode, ScholarlyProviderError } from "../scholarly/errors";
import { FixtureTransport } from "../scholarly/fixture-transport";
import type { OpenAlexSearchParams } from "../scholarly/openalex";
import type {
  PdfRequest,
  PdfResponse,
  ProviderRequest,
  ProviderResponse,
  RequestOptions,
  ScholarlyTransport,
} from "../scholarly/transport";
import type { ArxivEntry, OpenAlexWorkRecord, Provenance, TaxonomyEntry } from "../scholarly/types";
import { ownerWorkIndex, workIdFor } from "./scholarly-works";

/**
 * Discover (contract docs/RESEARCH_LIBRARY.md §9): the owner's subjects and, per subject, New on
 * arXiv, Reviews and surveys, Most cited and Earlier work; across subjects, works cited by two or
 * more of the owner's papers, works OpenAlex considers similar to the most recently saved paper it
 * has a record of, registry sources of the owner's courses that carry a DOI or arXiv id, and one
 * sampled review from a field outside the owner's subjects.
 *
 * Subject lists come from the provider cache only: the worker fetches them (OpenAlex through the
 * `scholarly-lists` queue, arXiv listings through `scholarly-arxiv`, the only queue that calls
 * arXiv), daily and whenever a page finds a list missing or out of date. The other lists depend on
 * the owner's works and are fetched in the request (pages stream them). Every list is bounded,
 * labelled with its provider and retrieval date (fixture data as fixture data), and every failure
 * is reported as what happened, never as an empty list. No scores, feeds or summaries.
 */

export class DiscoverError extends Error {
  constructor(
    readonly code: "not_found" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "DiscoverError";
  }
}

/** Rows a subject list holds (the cache keeps this many; the subject room shows them all). */
export const SUBJECT_LIST_SIZE = 10;
/** Rows of each subject list on the Discover page itself. */
export const DISCOVER_PAGE_ROWS = 5;
/** Reviews and surveys: published in the last this many calendar years (the current one included). */
export const REVIEW_YEARS = 5;
/** New on arXiv: newest submissions fetched per subject. */
export const ARXIV_LISTING_SIZE = 10;
/** The day fixture mode uses for seeds and year ranges: the day scripts/scholarly-record/discover.ts recorded. */
export const DISCOVER_FIXTURE_DAY = "2026-11-15";
/** Surprise me: how many times "Another" can be asked for in a day. */
export const MAX_SURPRISE = 1000;

// ---------------------------------------------------------------------------------------------
// The client and the day

/** The fixture cache's keys differ from live keys, so recorded and live responses never mix. */
export function fixtureCacheKey(request: Pick<ProviderRequest, "host" | "path" | "query">): string {
  return createHash("sha256")
    .update(`fixture\n${canonicalRequest(request)}`)
    .digest("hex");
}

/**
 * Fixture mode with the provider cache in front, so recorded responses reach pages exactly as live
 * ones do: through a worker job that writes the cache (`refresh`) and pages that read it (`only`),
 * with "Not fetched yet" until the job has run. Everything it returns is marked as fixture data, with
 * the recording time as its retrieval time.
 */
export class FixtureCacheTransport implements ScholarlyTransport {
  readonly mode = "fixture" as const;

  constructor(
    private readonly inner: ScholarlyTransport,
    private readonly cache: ProviderCacheStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async get(request: ProviderRequest, options: RequestOptions = {}): Promise<ProviderResponse> {
    const mode = options.cache ?? "use";
    const key = request.cacheKind ? fixtureCacheKey(request) : null;
    if (mode !== "refresh") {
      const entry = key ? await this.cache.get(key) : null;
      if (entry) {
        const fresh = isFresh(entry, this.now());
        if (fresh || mode === "only")
          return {
            status: entry.status === 404 ? 404 : 200,
            contentType: entry.payload.contentType,
            body: entry.payload.body,
            retrievedAt: entry.fetchedAt.toISOString(),
            fixture: true,
            fromCache: true,
            stale: !fresh,
          };
      }
      if (mode === "only")
        throw new ScholarlyProviderError(request.provider, "not_cached", `Not fetched from ${providerName(request.provider)} yet.`);
    }
    const response = await this.inner.get(request, options);
    const ttl = key && request.cacheKind ? cacheTtlMs(request.cacheKind, response.status) : null;
    if (key && ttl !== null) {
      await this.cache.put({
        key,
        provider: request.provider,
        status: response.status,
        payload: { contentType: response.contentType, body: response.body },
        // The recording time: that is when the provider gave this answer.
        fetchedAt: new Date(response.retrievedAt),
        expiresAt: new Date(this.now().getTime() + ttl),
      });
    }
    return response;
  }

  getPdf(request: PdfRequest): Promise<PdfResponse> {
    return this.inner.getPdf(request);
  }
}

/**
 * The client Discover, its worker jobs and its Save action use: the live client with the PostgreSQL
 * cache, or in fixture mode the recorded responses behind the same cache. Fixture data is refused in
 * production.
 */
export function discoverClient(env: ScholarlyEnv, db: DbOrTx): ScholarlyClient {
  if (env.SCHOLARLY_PROVIDER !== "fixture") return scholarlyClientWithCache(env, db);
  if (env.DEPLOYMENT_MODE === "production") throw new Error("SCHOLARLY_PROVIDER is 'fixture' (recorded test data); refused in production.");
  return createScholarlyClient(new FixtureCacheTransport(new FixtureTransport(), new PgProviderCache(db)));
}

/** The day seeds and year ranges use: today (UTC), or in fixture mode the day the fixtures were recorded. */
export function discoverDay(client: Pick<ScholarlyClient, "mode">, now: Date): string {
  return client.mode === "fixture" ? DISCOVER_FIXTURE_DAY : now.toISOString().slice(0, 10);
}

/**
 * OpenAlex lists and searches are metered; without a key a production server shares a small
 * allowance per IP, so it does not browse (lookups by identifier still work).
 */
export function openAlexBrowsingAllowed(env: Pick<ScholarlyEnv, "SCHOLARLY_PROVIDER" | "DEPLOYMENT_MODE" | "OPENALEX_API_KEY">): boolean {
  return env.SCHOLARLY_PROVIDER === "fixture" || env.DEPLOYMENT_MODE !== "production" || Boolean(env.OPENALEX_API_KEY);
}

// ---------------------------------------------------------------------------------------------
// The owner's subjects (library_preference)

/** The owner's subjects in display order: the four primary subjects until the owner chooses. */
export async function getDiscoverSubjects(db: DbOrTx, ownerId: string): Promise<string[]> {
  const [row] = await db
    .select({ subjects: libraryPreference.subjects })
    .from(libraryPreference)
    .where(eq(libraryPreference.ownerId, ownerId))
    .limit(1);
  const slugs = row ? row.subjects.filter(isSubjectSlug) : [...DEFAULT_SUBJECT_SLUGS];
  return orderSubjects(slugs).map((s) => s.slug);
}

/** Stores the owner's choice (none is a valid choice); anything that is not a listed subject is refused. */
export async function setDiscoverSubjects(db: DbOrTx, ownerId: string, slugs: readonly unknown[]): Promise<string[]> {
  if (slugs.some((s) => !isSubjectSlug(s))) throw new DiscoverError("invalid", "Choose subjects from the list.");
  const ordered = orderSubjects(slugs as string[]).map((s) => s.slug);
  await db
    .insert(libraryPreference)
    .values({ ownerId, subjects: ordered })
    .onConflictDoUpdate({ target: libraryPreference.ownerId, set: { subjects: ordered, updatedAt: new Date() } });
  return ordered;
}

/** Every subject some owner has chosen, plus the defaults while any owner has not chosen (the daily refresh). */
export async function subjectsToRefresh(db: DbOrTx): Promise<string[]> {
  const rows = await db.select({ subjects: libraryPreference.subjects }).from(libraryPreference);
  const [users] = await db.select({ n: count() }).from(user);
  const all = new Set<string>(rows.flatMap((r) => r.subjects.filter(isSubjectSlug)));
  if ((users?.n ?? 0) > rows.length) for (const slug of DEFAULT_SUBJECT_SLUGS) all.add(slug);
  return orderSubjects([...all]).map((s) => s.slug);
}

// ---------------------------------------------------------------------------------------------
// What the lists request (the worker, the pages and the fixture recording share these)

export type SubjectListKind = "reviews" | "most_cited" | "earlier_work";
export const SUBJECT_LIST_KINDS: readonly SubjectListKind[] = ["reviews", "most_cited", "earlier_work"];

/** The publication years Reviews and surveys covers on a day. */
export function reviewYears(day: string): { from: number; to: number } {
  const year = Number(day.slice(0, 4));
  return { from: year - REVIEW_YEARS + 1, to: year };
}

/** The three OpenAlex subject lists, most cited first: reviews of recent years, all works, works before 1990. */
export function subjectListRequests(subject: SubjectDefinition, day: string): { list: SubjectListKind; params: OpenAlexSearchParams }[] {
  const filter = openAlexSubjectFilter(subject);
  const sort = "cited_by_count:desc" as const;
  return [
    {
      list: "reviews",
      params: { filters: { ...filter, types: ["review"], publicationYear: reviewYears(day) }, sort, perPage: SUBJECT_LIST_SIZE },
    },
    { list: "most_cited", params: { filters: filter, sort, perPage: SUBJECT_LIST_SIZE } },
    {
      list: "earlier_work",
      params: { filters: { ...filter, publicationYear: { to: EARLIER_WORK_BEFORE_YEAR - 1 } }, sort, perPage: SUBJECT_LIST_SIZE },
    },
  ];
}

/** New on arXiv for a subject: its categories (primary subjects only), or null. */
export function arxivListingRequest(subject: SubjectDefinition): { categories: string[]; maxResults: number } | null {
  return subject.arxivCategories.length > 0 ? { categories: [...subject.arxivCategories], maxResults: ARXIV_LISTING_SIZE } : null;
}

/** Surprise me: the field (outside the owner's subjects) and OpenAlex's sample for the n-th surprise of a day. */
export function surpriseRequest(
  slugs: readonly string[],
  day: string,
  n: number,
): { field: SubjectDefinition; params: OpenAlexSearchParams } | null {
  const seed = discoverSeed("surprise", day, n);
  const field = surpriseField(slugs, seed);
  if (!field) return null;
  return {
    field,
    params: {
      filters: { fieldId: field.openalex.fieldId, types: ["review"], hasAbstract: true, isOa: true, isRetracted: false },
      sample: 1,
      seed,
      perPage: 1,
    },
  };
}

/** Similar to a saved paper: the works OpenAlex relates to it (similarity, not citation). */
export function similarRequest(openalexId: string): OpenAlexSearchParams {
  return { filters: { relatedTo: openalexId }, perPage: SUBJECT_LIST_SIZE };
}

export interface ListOutcome {
  subject: string;
  list: SubjectListKind;
  outcome: "fetched" | "failed" | "key_needed";
  items?: number;
  code?: ScholarlyErrorCode;
  resetAt?: string | null;
}

/**
 * Fetches the subjects' OpenAlex lists into the cache (the worker's job; the fixture recording runs
 * it with the recording client). A failure is recorded per list and never retried here; once
 * OpenAlex reports its allowance spent, the remaining lists are not requested.
 */
export async function refreshSubjectLists(
  client: ScholarlyClient,
  slugs: readonly string[],
  options: { day: string; browsing: boolean },
): Promise<ListOutcome[]> {
  const outcomes: ListOutcome[] = [];
  let spent: ScholarlyProviderError | null = null;
  for (const subject of orderSubjects(slugs)) {
    for (const spec of subjectListRequests(subject, options.day)) {
      const base = { subject: subject.slug, list: spec.list };
      if (!options.browsing) {
        outcomes.push({ ...base, outcome: "key_needed" });
        continue;
      }
      if (spent) {
        outcomes.push({ ...base, outcome: "failed", code: spent.code, resetAt: spent.resetAt?.toISOString() ?? null });
        continue;
      }
      try {
        const list = await client.openalexSearch(spec.params, { cache: "refresh", cacheKind: "subject_list" });
        outcomes.push({ ...base, outcome: "fetched", items: list.items.length });
      } catch (error) {
        if (!(error instanceof ScholarlyProviderError)) throw error;
        if (error.code === "budget_exhausted") spent = error;
        outcomes.push({ ...base, outcome: "failed", code: error.code, resetAt: error.resetAt?.toISOString() ?? null });
      }
    }
  }
  return outcomes;
}

// ---------------------------------------------------------------------------------------------
// Rows and list states

export interface DiscoverItem {
  /** `scheme:value` of `ref`, unique within a list. */
  key: string;
  /** What Save imports and the preview is found by. */
  ref: { scheme: "openalex" | "arxiv" | "doi"; value: string };
  title: string | null;
  /** The first three authors' names. */
  authors: string[];
  moreAuthors: boolean;
  year: number | null;
  /** OpenAlex's count of works citing this one. */
  citedByCount: number | null;
  /** arXiv: the day of the first version, and its primary category. */
  submitted: string | null;
  primaryCategory: string | null;
  /** OpenAlex's own retraction flag. */
  retracted: boolean;
  /** The owner's work holding any of this row's identifiers (merges followed), or null. */
  workId: string | null;
  /** Why the row is in the list, when the list's own description does not say it (cited by your papers). */
  reason?: DiscoverReason;
}

export type ListFailureCode = ScholarlyErrorCode | "refresh_failed";

/**
 * What became of the refresh job a subject list asked for: queued or running; failed, with what the
 * job reported; finished this hour, so the next job is asked for when the page is opened after
 * `after` (the next hour); or the worker had no OpenAlex key.
 */
export type RefreshView =
  | { state: "queued" }
  | { state: "failed"; code: ListFailureCode; resetAt: string | null }
  | { state: "later"; after: string }
  | { state: "key_needed" };

export type ListView =
  /** `refresh` is set on an out-of-date subject list. */
  | { state: "ready"; items: DiscoverItem[]; provenance: Provenance; total: number | null; refresh?: RefreshView }
  /** Not fetched yet; a refresh job is queued or running. */
  | { state: "pending" }
  /** Not in the cache although this hour's job has finished (the cache dropped it); asked for again after `after`. */
  | { state: "later"; provider: "openalex" | "arxiv"; after: string }
  | { state: "failed"; provider: "openalex" | "arxiv"; code: ListFailureCode; resetAt: string | null }
  | { state: "key_needed" };

type WorkIndex = ReadonlyMap<string, string>;

function firstWork(index: WorkIndex, refs: readonly IdentifierRef[]): string | null {
  for (const ref of refs) {
    const id = workIdFor(index, ref);
    if (id) return id;
  }
  return null;
}

export function itemFromOpenAlex(record: OpenAlexWorkRecord, index: WorkIndex): DiscoverItem {
  return {
    key: `openalex:${record.openalexId}`,
    ref: { scheme: "openalex", value: record.openalexId },
    title: record.title,
    authors: record.authors.slice(0, 3).map((a) => a.name),
    moreAuthors: record.authors.length > 3,
    year: record.publicationYear,
    citedByCount: record.citedByCount,
    submitted: null,
    primaryCategory: null,
    retracted: record.isRetracted === true,
    workId: firstWork(index, record.identifiers),
  };
}

export function itemFromArxiv(entry: ArxivEntry, index: WorkIndex): DiscoverItem {
  const submitted = entry.published && /^\d{4}-\d{2}-\d{2}/.test(entry.published) ? entry.published.slice(0, 10) : null;
  return {
    key: `arxiv:${entry.id}`,
    ref: { scheme: "arxiv", value: entry.id },
    title: entry.title,
    authors: entry.authors.slice(0, 3).map((a) => a.name),
    moreAuthors: entry.authors.length > 3,
    year: submitted ? Number(submitted.slice(0, 4)) : null,
    citedByCount: null,
    submitted,
    primaryCategory: entry.primaryCategory,
    retracted: false,
    workId: firstWork(index, identifiersFromArxiv({ id: entry.id, doi: entry.doi })),
  };
}

function failure(error: unknown, provider: "openalex" | "arxiv"): ListView {
  if (!(error instanceof ScholarlyProviderError)) throw error;
  return { state: "failed", provider, code: error.code, resetAt: error.resetAt?.toISOString() ?? null };
}

// ---------------------------------------------------------------------------------------------
// Refresh jobs a page asks for (owner-scoped job records, at most one per list kind and subject an hour)

type JobRow = typeof jobRecord.$inferSelect;

function hourBucket(now: Date): string {
  return now.toISOString().slice(0, 13);
}

export function listsJobKey(ownerId: string, slug: string, now: Date): string {
  return `discover:${ownerId}:openalex:${slug}:${hourBucket(now)}`;
}

export function arxivJobKey(ownerId: string, slug: string, now: Date): string {
  return `discover:${ownerId}:arxiv:${slug}:${hourBucket(now)}`;
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

async function jobByKey(db: DbOrTx, ownerId: string, key: string): Promise<JobRow | null> {
  const [row] = await db
    .select()
    .from(jobRecord)
    .where(and(eq(jobRecord.idempotencyKey, key), eq(jobRecord.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

/** The job for this key, enqueued now when there is none (a concurrent request enqueuing the same key is fine). */
async function ensureJob(db: DbOrTx, ownerId: string, key: string, enqueueIt: () => Promise<unknown>): Promise<JobRow | null> {
  const existing = await jobByKey(db, ownerId, key);
  if (existing) return existing;
  try {
    await enqueueIt();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  return jobByKey(db, ownerId, key);
}

function requestListsRefresh(db: DbOrTx, ownerId: string, slug: string, now: Date): Promise<JobRow | null> {
  const key = listsJobKey(ownerId, slug, now);
  return ensureJob(db, ownerId, key, () =>
    enqueue(db, {
      queue: QUEUES.scholarlyLists,
      kind: "scholarly-lists",
      payload: ScholarlyListsPayload.parse({ idempotencyKey: key, ownerId, task: "subject-lists", subjects: [slug] }),
    }),
  );
}

function requestArxivListing(db: DbOrTx, ownerId: string, subject: SubjectDefinition, now: Date): Promise<JobRow | null> {
  const listing = arxivListingRequest(subject);
  if (!listing) return Promise.resolve(null);
  const key = arxivJobKey(ownerId, subject.slug, now);
  return ensureJob(db, ownerId, key, () =>
    enqueue(db, {
      queue: QUEUES.scholarlyArxiv,
      kind: "scholarly-arxiv",
      payload: ScholarlyArxivPayload.parse({ idempotencyKey: key, ownerId, task: "listing", ...listing }),
      singletonKey: ARXIV_SINGLETON_KEY,
    }),
  );
}

/** The arXiv listings of the given subjects, queued for the daily refresh (no owner: a system job). */
export async function enqueueDailyArxivListings(db: DbOrTx, slugs: readonly string[], day: string): Promise<number> {
  let queued = 0;
  for (const subject of orderSubjects(slugs)) {
    const listing = arxivListingRequest(subject);
    if (!listing) continue;
    const payload = ScholarlyArxivPayload.parse({
      idempotencyKey: `discover:daily:arxiv:${subject.slug}:${day}`,
      task: "listing",
      ...listing,
    });
    const result = await enqueue(db, { queue: QUEUES.scholarlyArxiv, kind: "scholarly-arxiv", payload, singletonKey: ARXIV_SINGLETON_KEY });
    if (result.created) queued++;
  }
  return queued;
}

function outcomeIn(job: JobRow, slug: string, list: SubjectListKind): ListOutcome | null {
  const lists = (job.result as { lists?: unknown } | null)?.lists;
  if (!Array.isArray(lists)) return null;
  const found = lists.find(
    (l): l is ListOutcome => typeof l === "object" && l !== null && (l as ListOutcome).subject === slug && (l as ListOutcome).list === list,
  );
  return found ?? null;
}

/** The start of the hour after `now`: a page asks for a new refresh job from then (one job per hour). */
function nextHour(now: Date): string {
  return new Date(Math.floor(now.getTime() / 3600_000) * 3600_000 + 3600_000).toISOString();
}

function openAlexVerdict(job: JobRow | null, slug: string, list: SubjectListKind, now: Date): RefreshView {
  if (!job || job.status === "queued" || job.status === "active") return { state: "queued" };
  if (job.status !== "completed") return { state: "failed", code: "refresh_failed", resetAt: null };
  const outcome = outcomeIn(job, slug, list);
  if (outcome?.outcome === "failed") return { state: "failed", code: outcome.code ?? "refresh_failed", resetAt: outcome.resetAt ?? null };
  if (outcome?.outcome === "key_needed") return { state: "key_needed" };
  return { state: "later", after: nextHour(now) };
}

/**
 * The listing job records only its error text, so a failed job in fixture mode (whose only failure is
 * a missing recording) is reported as such, and otherwise as a failed fetch whose details are on the
 * Jobs page.
 */
function arxivVerdict(job: JobRow | null, mode: ScholarlyClient["mode"], now: Date): RefreshView {
  if (!job || job.status === "queued" || job.status === "active") return { state: "queued" };
  if (job.status === "completed") return { state: "later", after: nextHour(now) };
  return { state: "failed", code: mode === "fixture" ? "fixture_missing" : "refresh_failed", resetAt: null };
}

/** What a missing list shows, from what became of the job asked to fetch it. */
function missingView(refresh: RefreshView, provider: "openalex" | "arxiv"): ListView {
  switch (refresh.state) {
    case "queued":
      return { state: "pending" };
    case "later":
      return { state: "later", provider, after: refresh.after };
    case "failed":
      return { state: "failed", provider, code: refresh.code, resetAt: refresh.resetAt };
    case "key_needed":
      return { state: "key_needed" };
  }
}

/** An out-of-date list, with what became of the job asked to refresh it. */
function withRefresh(view: ListView | undefined, refresh: RefreshView): ListView | undefined {
  return view?.state === "ready" ? { ...view, refresh } : view;
}

export interface SubjectLists {
  subject: SubjectDefinition;
  /** Null when the subject has no arXiv categories. */
  newOnArxiv: ListView | null;
  reviews: ListView;
  mostCited: ListView;
  earlierWork: ListView;
  /** The publication years Reviews and surveys covers. */
  reviewYears: { from: number; to: number };
  /** Some list is not fetched yet and its refresh job is queued or running. */
  pending: boolean;
}

/**
 * A subject's four lists from the cache (`limit` rows each). A missing or out-of-date list asks the
 * worker for a refresh (one job per hour); a missing one shows "Not fetched yet" until the job has
 * run, and an out-of-date one keeps its rows. Either then carries what became of the job: its failure
 * as reported, or, when the job finished but the list is still missing or out of date, the hour from
 * which a page asks again.
 */
export async function subjectLists(
  db: DbOrTx,
  ownerId: string,
  client: ScholarlyClient,
  slug: string,
  options: { now: Date; browsing: boolean; limit: number; index?: WorkIndex },
): Promise<SubjectLists> {
  const subject = subjectBySlug(slug);
  if (!subject) throw new DiscoverError("not_found", "Subject not found.");
  const index = options.index ?? (await ownerWorkIndex(db, ownerId));
  const day = discoverDay(client, options.now);
  const views: Partial<Record<SubjectListKind, ListView>> = {};
  const missing: SubjectListKind[] = [];
  const stale: SubjectListKind[] = [];
  for (const spec of subjectListRequests(subject, day)) {
    if (!options.browsing) {
      views[spec.list] = { state: "key_needed" };
      continue;
    }
    try {
      const list = await client.openalexSearch(spec.params, { cache: "only", cacheKind: "subject_list" });
      views[spec.list] = {
        state: "ready",
        items: list.items.slice(0, options.limit).map((r) => itemFromOpenAlex(r, index)),
        provenance: list.provenance,
        total: list.count,
      };
      if (list.provenance.stale) stale.push(spec.list);
    } catch (error) {
      if (error instanceof ScholarlyProviderError && error.code === "not_cached") missing.push(spec.list);
      else views[spec.list] = failure(error, "openalex");
    }
  }
  if (missing.length > 0 || stale.length > 0) {
    const job = await requestListsRefresh(db, ownerId, subject.slug, options.now);
    for (const list of missing) views[list] = missingView(openAlexVerdict(job, subject.slug, list, options.now), "openalex");
    for (const list of stale) views[list] = withRefresh(views[list], openAlexVerdict(job, subject.slug, list, options.now));
  }

  let newOnArxiv: ListView | null = null;
  const listing = arxivListingRequest(subject);
  if (listing) {
    try {
      const result = await client.arxivNewest(listing.categories, listing.maxResults, { cache: "only" });
      newOnArxiv = {
        state: "ready",
        items: result.entries.slice(0, options.limit).map((e) => itemFromArxiv(e, index)),
        provenance: result.provenance,
        total: result.totalResults,
      };
      if (result.provenance.stale)
        newOnArxiv = withRefresh(
          newOnArxiv,
          arxivVerdict(await requestArxivListing(db, ownerId, subject, options.now), client.mode, options.now),
        )!;
    } catch (error) {
      if (error instanceof ScholarlyProviderError && error.code === "not_cached")
        newOnArxiv = missingView(
          arxivVerdict(await requestArxivListing(db, ownerId, subject, options.now), client.mode, options.now),
          "arxiv",
        );
      else newOnArxiv = failure(error, "arxiv");
    }
  }

  const all = [newOnArxiv, views.reviews, views.most_cited, views.earlier_work];
  return {
    subject,
    newOnArxiv,
    reviews: views.reviews!,
    mostCited: views.most_cited!,
    earlierWork: views.earlier_work!,
    reviewYears: reviewYears(day),
    pending: all.some((v) => v?.state === "pending"),
  };
}

// ---------------------------------------------------------------------------------------------
// From your courses (registry sources, read-only; no provider is asked)

export interface CourseSourceItem {
  sourceId: string;
  title: string;
  authors: string[];
  ref: { scheme: "doi" | "arxiv" | "openalex"; value: string };
  courses: { id: string; title: string }[];
  /** When the registry entry was verified by opening, and by whom. */
  verifiedAt: string;
  workId: string | null;
}

function registryRef(url: string): CourseSourceItem["ref"] | null {
  const input = recogniseInput(url);
  if (input.kind === "doi") {
    const arxiv = isArxivDoi(input.doi) ? arxivIdFromDoi(input.doi) : null;
    return arxiv ? { scheme: "arxiv", value: arxiv } : { scheme: "doi", value: input.doi };
  }
  if (input.kind === "arxiv") return { scheme: "arxiv", value: input.id };
  if (input.kind === "openalex") return { scheme: "openalex", value: input.id };
  return null;
}

/**
 * Registry sources of the courses the owner takes (active, paused or completed) whose address carries
 * a DOI or arXiv id, read by parsing only (no address is fetched), by title; bounded to `limit`.
 */
export async function fromYourCourses(
  db: DbOrTx,
  ownerId: string,
  options: { index?: WorkIndex; limit?: number } = {},
): Promise<{ items: CourseSourceItem[]; total: number; courses: number }> {
  const taken = await db
    .select({
      courseId: course.id,
      title: course.title,
      primary: courseVersion.primarySourceIds,
      supplemental: courseVersion.supplementalSourceIds,
    })
    .from(enrolment)
    .innerJoin(courseVersion, eq(courseVersion.id, enrolment.courseVersionId))
    .innerJoin(course, eq(course.id, courseVersion.courseId))
    .where(and(eq(enrolment.ownerId, ownerId), inArray(enrolment.status, ["active", "paused", "completed"])));
  const bySource = new Map<string, { id: string; title: string }[]>();
  for (const row of taken) {
    for (const id of [...row.primary, ...row.supplemental]) {
      const list = bySource.get(id) ?? [];
      if (!list.some((c) => c.id === row.courseId)) list.push({ id: row.courseId, title: row.title });
      bySource.set(id, list);
    }
  }
  const courseCount = new Set(taken.map((t) => t.courseId)).size;
  if (bySource.size === 0) return { items: [], total: 0, courses: courseCount };
  const index = options.index ?? (await ownerWorkIndex(db, ownerId));
  const sources = await db
    .select({ source, versionUrl: sourceVersion.url, verifiedAt: sourceVersion.verifiedAt })
    .from(source)
    .innerJoin(sourceVersion, eq(sourceVersion.id, source.currentVersionId))
    .where(inArray(source.id, [...bySource.keys()]));
  const items: CourseSourceItem[] = [];
  for (const row of sources) {
    const ref = registryRef(row.source.canonicalUrl) ?? registryRef(row.versionUrl);
    if (!ref) continue;
    items.push({
      sourceId: row.source.id,
      title: row.source.title,
      authors: row.source.authors,
      ref,
      courses: (bySource.get(row.source.id) ?? []).sort((a, b) => a.id.localeCompare(b.id)),
      verifiedAt: row.verifiedAt,
      workId: workIdFor(index, ref),
    });
  }
  items.sort((a, b) => a.title.localeCompare(b.title, "en") || a.sourceId.localeCompare(b.sourceId));
  return { items: items.slice(0, options.limit ?? SUBJECT_LIST_SIZE), total: items.length, courses: courseCount };
}

// ---------------------------------------------------------------------------------------------
// Cited by 2 or more of your papers; Similar to a recently saved paper (both fetched in the request)

/**
 * How the request-time lists read OpenAlex: `use` fetches when the cache has nothing fresh; `only`
 * never fetches and answers `not_cached` instead, so a page can render what is cached at once (also
 * without JavaScript) and stream only what still has to be fetched.
 */
export type RequestCache = "use" | "only";
export type NotCached = { state: "not_cached" };

function notCached(error: unknown): boolean {
  return error instanceof ScholarlyProviderError && error.code === "not_cached";
}

export type CitedByView =
  | { state: "empty"; savedPapers: number; withReferences: number }
  | { state: "list"; list: ListView; missing: number }
  | NotCached;

/** Works the owner's saved papers' reference lists (as OpenAlex matched them) share, not in the library. */
export async function citedByYourPapers(
  db: DbOrTx,
  ownerId: string,
  client: ScholarlyClient,
  options: { browsing: boolean; index?: WorkIndex; cache?: RequestCache },
): Promise<CitedByView> {
  const index = options.index ?? (await ownerWorkIndex(db, ownerId));
  const works = await db
    .select({ id: scholarlyWork.id, refs: scholarlyWork.referencedOpenalexIds })
    .from(scholarlyWork)
    .where(and(eq(scholarlyWork.ownerId, ownerId), isNotNull(scholarlyWork.savedAt), isNull(scholarlyWork.mergedIntoId)));
  const inLibrary = new Set([...index.keys()].filter((k) => k.startsWith("openalex:")).map((k) => k.slice("openalex:".length)));
  const entries = citedByLibrary(
    works.map((w) => ({ workId: w.id, referencedOpenAlexIds: w.refs })),
    inLibrary,
  );
  if (entries.length === 0)
    return { state: "empty", savedPapers: works.length, withReferences: works.filter((w) => w.refs.length > 0).length };
  if (!options.browsing) return { state: "list", list: { state: "key_needed" }, missing: 0 };
  try {
    const batch = await client.openalexWorksByIds(
      entries.map((e) => e.openalexId),
      "work",
      { cache: options.cache ?? "use" },
    );
    const byId = new Map(batch.items.map((r) => [r.openalexId, r]));
    const items: DiscoverItem[] = [];
    for (const entry of entries) {
      const record = byId.get(entry.openalexId);
      if (record) items.push({ ...itemFromOpenAlex(record, index), reason: citedByLibraryReason(entry.count) });
    }
    return {
      state: "list",
      list: { state: "ready", items, provenance: batch.provenance, total: entries.length },
      missing: entries.length - items.length,
    };
  } catch (error) {
    if (notCached(error)) return { state: "not_cached" };
    return { state: "list", list: failure(error, "openalex"), missing: 0 };
  }
}

export type SimilarView =
  /** No saved paper has a current OpenAlex identifier; `savedPapers` says whether the owner has saved any. */
  | { state: "empty"; savedPapers: number }
  | { state: "list"; basis: { workId: string; title: string }; reason: DiscoverReason; list: ListView }
  | NotCached;

/**
 * Works OpenAlex considers related to the owner's most recently saved paper that has a current
 * OpenAlex identifier (OpenAlex relates only works it has a record of, so a newer save without one,
 * such as a preprint OpenAlex has not indexed, is passed over).
 */
export async function similarToRecent(
  db: DbOrTx,
  ownerId: string,
  client: ScholarlyClient,
  options: { browsing: boolean; index?: WorkIndex; cache?: RequestCache },
): Promise<SimilarView> {
  const [recent] = await db
    .select({ workId: scholarlyWork.id, title: scholarlyWork.title, openalexId: scholarlyIdentifier.value })
    .from(scholarlyWork)
    .innerJoin(
      scholarlyIdentifier,
      and(
        eq(scholarlyIdentifier.workId, scholarlyWork.id),
        eq(scholarlyIdentifier.ownerId, ownerId),
        eq(scholarlyIdentifier.scheme, "openalex"),
        eq(scholarlyIdentifier.status, "current"),
      ),
    )
    .where(and(eq(scholarlyWork.ownerId, ownerId), isNotNull(scholarlyWork.savedAt), isNull(scholarlyWork.mergedIntoId)))
    .orderBy(desc(scholarlyWork.savedAt), desc(scholarlyIdentifier.value))
    .limit(1);
  if (!recent) {
    const [saved] = await db
      .select({ n: count() })
      .from(scholarlyWork)
      .where(and(eq(scholarlyWork.ownerId, ownerId), isNotNull(scholarlyWork.savedAt), isNull(scholarlyWork.mergedIntoId)));
    return { state: "empty", savedPapers: saved?.n ?? 0 };
  }
  const title = recent.title ?? recent.openalexId;
  const basis = { workId: recent.workId, title };
  const reason = similarReason(title);
  if (!options.browsing) return { state: "list", basis, reason, list: { state: "key_needed" } };
  const index = options.index ?? (await ownerWorkIndex(db, ownerId));
  try {
    const list = await client.openalexSearch(similarRequest(recent.openalexId), { cache: options.cache ?? "use", cacheKind: "search" });
    return {
      state: "list",
      basis,
      reason,
      list: {
        state: "ready",
        items: list.items
          .filter((r) => r.openalexId !== recent.openalexId)
          .slice(0, SUBJECT_LIST_SIZE)
          .map((r) => itemFromOpenAlex(r, index)),
        provenance: list.provenance,
        total: list.count,
      },
    };
  } catch (error) {
    if (notCached(error)) return { state: "not_cached" };
    return { state: "list", basis, reason, list: failure(error, "openalex") };
  }
}

// ---------------------------------------------------------------------------------------------
// Surprise me (fetched in the request, only when asked)

export interface SurprisePick {
  item: DiscoverItem;
  abstract: string | null;
  venue: string | null;
  /** Where OpenAlex says the work is free to read (https only), and that site's host. */
  freeAt: { url: string; host: string } | null;
  provenance: Provenance;
}

export type SurpriseView =
  | { state: "no_field" }
  | { state: "none"; field: SubjectDefinition; reason: DiscoverReason }
  | { state: "pick"; field: SubjectDefinition; reason: DiscoverReason; pick: SurprisePick }
  | { state: "failed"; field: SubjectDefinition | null; view: Extract<ListView, { state: "failed" } | { state: "key_needed" }> }
  | NotCached;

function freeToRead(record: OpenAlexWorkRecord): SurprisePick["freeAt"] {
  const url = record.bestOaLocation?.landingPageUrl ?? record.bestOaLocation?.pdfUrl ?? record.openAccess?.oaUrl ?? null;
  if (!url) return null;
  try {
    return { url, host: new URL(url).hostname };
  } catch {
    return null;
  }
}

/**
 * One review with an abstract, free to read according to OpenAlex, from a field outside the owner's
 * subjects: the field and OpenAlex's sample both follow a seed from the day and `n` (the n-th
 * surprise asked for that day), so a surprise is stable until the owner asks for another.
 */
export async function surprise(
  db: DbOrTx,
  ownerId: string,
  client: ScholarlyClient,
  options: { now: Date; n: number; browsing: boolean; slugs?: readonly string[]; index?: WorkIndex; cache?: RequestCache },
): Promise<SurpriseView> {
  if (!Number.isInteger(options.n) || options.n < 1 || options.n > MAX_SURPRISE)
    throw new DiscoverError("invalid", "Choose a surprise from this page.");
  const slugs = options.slugs ?? (await getDiscoverSubjects(db, ownerId));
  const request = surpriseRequest(slugs, discoverDay(client, options.now), options.n);
  if (!request) return { state: "no_field" };
  const { field } = request;
  const reason = surpriseReason(field.name);
  if (!options.browsing) return { state: "failed", field, view: { state: "key_needed" } };
  try {
    const cache = options.cache ?? "use";
    const sample = await client.openalexSearch(request.params, { cache, cacheKind: "search" });
    const first = sample.items[0];
    if (!first) return { state: "none", field, reason };
    // The list leaves the abstract out; the single lookup has it.
    const full = await client.openalexWork({ scheme: "openalex", value: first.openalexId }, { cache });
    const index = options.index ?? (await ownerWorkIndex(db, ownerId));
    const record = full.record;
    return {
      state: "pick",
      field,
      reason,
      pick: {
        item: itemFromOpenAlex(record, index),
        abstract: record.abstract,
        venue: record.venue,
        freeAt: freeToRead(record),
        provenance: record.provenance,
      },
    };
  } catch (error) {
    if (notCached(error)) return { state: "not_cached" };
    const view = failure(error, "openalex") as Extract<ListView, { state: "failed" }>;
    return { state: "failed", field, view };
  }
}

// ---------------------------------------------------------------------------------------------
// Pages

export interface DiscoverPageView {
  day: string;
  mode: ScholarlyClient["mode"];
  browsing: boolean;
  /** The owner's subjects, in display order. */
  subjects: SubjectDefinition[];
  lists: SubjectLists[];
  fromCourses: Awaited<ReturnType<typeof fromYourCourses>>;
  index: WorkIndex;
  pending: boolean;
}

/** Everything Discover renders from the cache and the database (the per-owner OpenAlex lists stream separately). */
export async function discoverPage(
  db: DbOrTx,
  ownerId: string,
  client: ScholarlyClient,
  options: { now: Date; browsing: boolean },
): Promise<DiscoverPageView> {
  const [chosen, index] = await Promise.all([getDiscoverSubjects(db, ownerId), ownerWorkIndex(db, ownerId)]);
  const subjects = orderSubjects(chosen);
  const lists: SubjectLists[] = [];
  for (const subject of subjects)
    lists.push(await subjectLists(db, ownerId, client, subject.slug, { ...options, limit: DISCOVER_PAGE_ROWS, index }));
  const fromCourses = await fromYourCourses(db, ownerId, { index });
  return {
    day: discoverDay(client, options.now),
    mode: client.mode,
    browsing: options.browsing,
    subjects,
    lists,
    fromCourses,
    index,
    pending: lists.some((l) => l.pending),
  };
}

export type SubfieldsView =
  /** `provenance` is null only when OpenAlex listed no subfield. */
  | { state: "ready"; subfields: TaxonomyEntry[]; provenance: Provenance | null }
  | { state: "subfield"; parent: SubjectDefinition | null }
  | Extract<ListView, { state: "failed" } | { state: "key_needed" }>
  | NotCached;

export interface SubjectRoomView {
  subject: SubjectDefinition;
  chosen: boolean;
  lists: SubjectLists;
}

/** A subject room: whether the subject is one of the owner's, and its lists in full (subfields stream separately). */
export async function subjectRoom(
  db: DbOrTx,
  ownerId: string,
  client: ScholarlyClient,
  slug: string,
  options: { now: Date; browsing: boolean },
): Promise<SubjectRoomView> {
  const subject = subjectBySlug(slug);
  if (!subject) throw new DiscoverError("not_found", "Subject not found.");
  const [chosen, lists] = await Promise.all([
    getDiscoverSubjects(db, ownerId),
    subjectLists(db, ownerId, client, subject.slug, { ...options, limit: SUBJECT_LIST_SIZE }),
  ]);
  return { subject, chosen: chosen.includes(subject.slug), lists };
}

/** A field's subfields from the OpenAlex taxonomy, by name; a subfield subject names its parent field instead. */
export async function subjectSubfields(
  client: ScholarlyClient,
  slug: string,
  options: { browsing: boolean; cache?: RequestCache },
): Promise<SubfieldsView> {
  const subject = subjectBySlug(slug);
  if (!subject) throw new DiscoverError("not_found", "Subject not found.");
  if (subject.openalex.level === "subfield") {
    const parent = SUBJECTS.find((s) => s.openalex.level === "field" && s.openalex.id === subject.openalex.fieldId) ?? null;
    return { state: "subfield", parent };
  }
  if (!options.browsing) return { state: "key_needed" };
  try {
    const subfields = await client.openalexSubfields([subject.openalex.fieldId], { cache: options.cache ?? "use" });
    const sorted = [...subfields].sort((a, b) => a.name.localeCompare(b.name, "en"));
    return { state: "ready", subfields: sorted, provenance: sorted[0]?.provenance ?? null };
  } catch (error) {
    if (notCached(error)) return { state: "not_cached" };
    return failure(error, "openalex") as Extract<ListView, { state: "failed" }>;
  }
}
