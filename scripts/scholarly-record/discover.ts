// Discover's recordings (`pnpm library:live-check --record-group discover`): the requests Discover,
// its worker jobs and the Discover journey (tests/e2e/18-discover.spec.ts) make in fixture mode,
// built by the same functions the service uses, so the recorded requests are exactly the ones sent.
// A request already recorded is answered from the fixtures and never re-recorded, so the group can
// be run again to add only what is missing.
//
// arXiv: the newest submissions of the four primary subjects, 3.5 s apart. OpenAlex: the three
// subject lists of mathematics, physics, computer science, artificial intelligence and chemistry;
// the subfields of fields 26, 31, 17 and 16; Surprise me for the default subjects (the first and
// second of the fixture day) and for the journey's subjects; single works of three density-functional
// classics shown in the physics lists, of which the two sharing the most references are the
// journey's saved papers; the related works of the second (Similar to); and the works both cite
// (Cited by 2 or more of your papers). About 45 OpenAlex and 4 arXiv requests in all.
import { citedByLibrary, DEFAULT_SUBJECT_SLUGS, subjectBySlug } from "../../packages/core/src/scholarly/index";
import {
  createFixtureScholarlyClient,
  type OpenAlexList,
  type OpenAlexWorkRecord,
  type ScholarlyClient,
  ScholarlyProviderError,
} from "../../packages/db/src/scholarly/index";
import {
  arxivListingRequest,
  DISCOVER_FIXTURE_DAY,
  similarRequest,
  subjectListRequests,
  surpriseRequest,
} from "../../packages/db/src/services/discover";
import type { RecordGroup } from "./types";

const DAY = DISCOVER_FIXTURE_DAY;
/** The journey changes the default subjects to these (artificial intelligence out, chemistry in). */
export const JOURNEY_SUBJECTS = ["mathematics", "physics", "computer-science", "chemistry"] as const;
const LIST_SUBJECTS = ["mathematics", "physics", "computer-science", "artificial-intelligence", "chemistry"] as const;
const SUBFIELD_FIELDS = ["26", "31", "17", "16"] as const;
/** Saved-paper candidates: rows the Discover page shows (top five), without an arXiv id. */
const CANDIDATES: readonly [slug: string, list: "most_cited" | "earlier_work", position: number][] = [
  ["physics", "earlier_work", 1],
  ["physics", "earlier_work", 5],
  ["physics", "most_cited", 3],
];

const short = (text: string | null) => (text ? (text.length > 60 ? `${text.slice(0, 59)}…` : text) : "(no title)");

const record: RecordGroup = async (live, { check, sleep, arxivGapMs }) => {
  const recorded = createFixtureScholarlyClient();
  /** The recorded answer when there is one, else the live (recording) request. */
  async function once<T>(run: (client: ScholarlyClient) => Promise<T>): Promise<T> {
    try {
      return await run(recorded);
    } catch (error) {
      if (error instanceof ScholarlyProviderError && error.code === "fixture_missing") return run(live);
      throw error;
    }
  }

  // New on arXiv (the worker's listing task), one live request every 3.5 s.
  let lastArxiv = 0;
  for (const slug of DEFAULT_SUBJECT_SLUGS) {
    const listing = arxivListingRequest(subjectBySlug(slug)!);
    if (!listing) continue;
    await check(
      `arXiv newest in ${slug} (${listing.categories.length} categories)`,
      () =>
        once(async (client) => {
          if (client === live) {
            const wait = lastArxiv + arxivGapMs - Date.now();
            if (wait > 0) await sleep(wait);
          }
          try {
            return await client.arxivNewest(listing.categories, listing.maxResults);
          } finally {
            if (client === live) lastArxiv = Date.now();
          }
        }),
      (l) => `${l.entries.length} of ${l.totalResults ?? "?"}; first ${short(l.entries[0]?.title ?? null)}`,
    );
  }

  // Subject lists (worker job requests).
  const lists = new Map<string, OpenAlexList>();
  for (const slug of LIST_SUBJECTS) {
    for (const spec of subjectListRequests(subjectBySlug(slug)!, DAY)) {
      const list = await check(
        `OpenAlex ${spec.list} in ${slug}`,
        () => once((client) => client.openalexSearch(spec.params, { cacheKind: "subject_list" })),
        (l) => `${l.items.length} of ${l.count ?? "?"}; first ${short(l.items[0]?.title ?? null)}`,
      );
      if (list) lists.set(`${slug}:${spec.list}`, list);
    }
  }

  // Subject rooms: subfields from the taxonomy.
  for (const field of SUBFIELD_FIELDS)
    await check(
      `OpenAlex subfields of field ${field}`,
      () => once((client) => client.openalexSubfields([field])),
      (s) => `${s.length} subfields`,
    );

  // Surprise me: the sample, then the single work (the list leaves the abstract out).
  const surprises: [readonly string[], number][] = [
    [DEFAULT_SUBJECT_SLUGS, 1],
    [DEFAULT_SUBJECT_SLUGS, 2],
    [JOURNEY_SUBJECTS, 1],
  ];
  for (const [slugs, n] of surprises) {
    const request = surpriseRequest(slugs, DAY, n);
    if (!request) continue;
    const sample = await check(
      `OpenAlex Surprise me ${n} (${request.field.name}, seed ${request.params.seed})`,
      () => once((client) => client.openalexSearch(request.params, { cacheKind: "search" })),
      (l) => `${l.items.length} of ${l.count ?? "?"}; ${short(l.items[0]?.title ?? null)}`,
    );
    const pick = sample?.items[0];
    if (pick)
      await check(
        `OpenAlex work ${pick.openalexId} (Surprise me ${n})`,
        () => once((client) => client.openalexWork({ scheme: "openalex", value: pick.openalexId })),
        (w) => `abstract ${w.record.abstract ? "present" : "absent"}`,
      );
  }

  // The journey's saved papers.
  const candidates: { label: string; record: OpenAlexWorkRecord }[] = [];
  for (const [slug, list, position] of CANDIDATES) {
    const item = lists.get(`${slug}:${list}`)?.items[position - 1];
    if (!item || item.identifiers.some((r) => r.scheme === "arxiv")) continue;
    const label = `${list} ${slug} #${position}`;
    const full = await check(
      `OpenAlex work ${item.openalexId} (${label})`,
      () => once((client) => client.openalexWork({ scheme: "openalex", value: item.openalexId })),
      (w) => `${w.record.referencedOpenAlexIds.length} references; ${short(w.record.title)}`,
    );
    if (full) candidates.push({ label, record: full.record });
  }
  let best: { a: (typeof candidates)[number]; b: (typeof candidates)[number]; shared: number } | null = null;
  for (let i = 0; i < candidates.length; i++)
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]!;
      const b = candidates[j]!;
      const refs = new Set(a.record.referencedOpenAlexIds);
      const shared = new Set(b.record.referencedOpenAlexIds.filter((id) => refs.has(id))).size;
      if (shared > (best?.shared ?? 0)) best = { a, b, shared };
    }
  if (!best) {
    console.log("NOTE  no two candidates share a reference: Cited by 2 or more of your papers stays empty in the journey");
    return;
  }
  const { a, b } = best;
  console.log(
    `NOTE  the journey saves A = ${a.record.openalexId} "${a.record.title}" (${a.label}), then B = ${b.record.openalexId} "${b.record.title}" (${b.label}); ${best.shared} shared references`,
  );

  // Similar to B (the paper saved last).
  await check(
    `OpenAlex related to ${b.record.openalexId}`,
    () => once((client) => client.openalexSearch(similarRequest(b.record.openalexId), { cacheKind: "search" })),
    (l) => `${l.items.length} of ${l.count ?? "?"}; first ${short(l.items[0]?.title ?? null)}`,
  );

  // Cited by 2 or more of your papers, with A and B saved.
  const entries = citedByLibrary(
    [
      { workId: "A", referencedOpenAlexIds: a.record.referencedOpenAlexIds },
      { workId: "B", referencedOpenAlexIds: b.record.referencedOpenAlexIds },
    ],
    new Set([a.record.openalexId, b.record.openalexId]),
  );
  await check(
    `OpenAlex works cited by both (${entries.length})`,
    () =>
      once((client) =>
        client.openalexWorksByIds(
          entries.map((e) => e.openalexId),
          "work",
        ),
      ),
    (batch) => `${batch.items.length} items, ${batch.missing.length} missing; first ${short(batch.items[0]?.title ?? null)}`,
  );
};

export default record;
