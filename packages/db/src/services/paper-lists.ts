import {
  arxivIdFromDoi,
  type IdentifierRef,
  identifierKey,
  isArxivDoi,
  normaliseIdentifier,
  openAlexSubjectFilter,
  subjectBySlug,
} from "@corniversity/core";
import { and, eq, isNull } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { scholarlyIdentifier, scholarlyWork } from "../schema/index";
import type { ScholarlyClient } from "../scholarly/client";
import { ScholarlyProviderError } from "../scholarly/errors";
import {
  isOpenAlexAuthorText,
  OPENALEX_MAX_RESULTS,
  OPENALEX_WORK_TYPES,
  type OpenAlexFilters,
  type OpenAlexWorkType,
} from "../scholarly/openalex";
import type { CrossrefWork, OpenAlexWorkRecord, Provenance } from "../scholarly/types";
import { getWorkByIdentifier, ownerWorkIndex, providerFailure, resolveWorkId, ScholarlyError } from "./scholarly-works";

/**
 * What Find papers, the paper preview and the paper page read from OpenAlex and Crossref
 * (contract docs/RESEARCH_LIBRARY.md §2, §5, §9): word and author searches with filters, a paper by identifier
 * before it is saved, a saved paper's OpenAlex record, and its references, cited-by and related
 * lists. Every list item carries the owner's work holding any of its identifiers (the "in your
 * library" marker, from `ownerWorkIndex`). Provider failures become the service's registered
 * sentences (`providerFailure`); nothing here writes the owner's works.
 */

/** Results per Find page. */
export const FIND_PAGE_SIZE = 25;
/** OpenAlex pages stop at 10,000 results. */
export const FIND_MAX_PAGE = Math.floor(OPENALEX_MAX_RESULTS / FIND_PAGE_SIZE);
/** References, cited by and related: shown at first, and at most after *Show more*. */
export const PAPER_LIST_SHORT = 10;
export const PAPER_LIST_MAX = 50;

/** Word searches and OpenAlex lists need a key on the production server; lookups by identifier do not. */
export const OPENALEX_BROWSING_NEEDS_KEY = "OpenAlex browsing needs an API key on this server.";
const QUERY_MISSING = "Type words to search for.";
const PAGE_OUT_OF_RANGE = "OpenAlex pages stop at 10,000 results.";
const YEARS_INVALID = "Give the years as whole numbers between 1000 and 2100, the first no later than the second.";
const TYPE_UNKNOWN = "Choose a type from the list.";
const SUBJECT_UNKNOWN = "Choose a field from the list.";
const AUTHOR_INVALID = "Give the author's name in letters, at most 100 characters.";
const DOI_UNKNOWN_EVERYWHERE = "Neither OpenAlex nor Crossref has a record of this DOI.";

export interface PaperFilters {
  yearFrom?: number;
  yearTo?: number;
  type?: string;
  /** Free to read according to OpenAlex. */
  freeToRead?: boolean;
  /** A subject slug (core subjects.ts): an OpenAlex field or subfield. */
  subject?: string;
  /** Words of author names, each matched among the names printed on the paper (OpenAlex's byline search). */
  author?: string;
}

/** The OpenAlex filters for Find's filters; anything outside the lists is refused before a request. */
export function openAlexFiltersFor(filters: PaperFilters): OpenAlexFilters {
  const out: OpenAlexFilters = {};
  const year = (n: number | undefined) => n === undefined || (Number.isInteger(n) && n >= 1000 && n <= 2100);
  if (
    !year(filters.yearFrom) ||
    !year(filters.yearTo) ||
    (filters.yearFrom !== undefined && filters.yearTo !== undefined && filters.yearFrom > filters.yearTo)
  )
    throw new ScholarlyError("invalid_state", YEARS_INVALID);
  if (filters.yearFrom !== undefined || filters.yearTo !== undefined)
    out.publicationYear = {
      ...(filters.yearFrom !== undefined ? { from: filters.yearFrom } : {}),
      ...(filters.yearTo !== undefined ? { to: filters.yearTo } : {}),
    };
  if (filters.type !== undefined) {
    if (!(OPENALEX_WORK_TYPES as readonly string[]).includes(filters.type)) throw new ScholarlyError("invalid_state", TYPE_UNKNOWN);
    out.types = [filters.type as OpenAlexWorkType];
  }
  if (filters.freeToRead) out.isOa = true;
  if (filters.subject !== undefined) {
    const subject = subjectBySlug(filters.subject);
    if (!subject) throw new ScholarlyError("invalid_state", SUBJECT_UNKNOWN);
    Object.assign(out, openAlexSubjectFilter(subject));
  }
  if (filters.author !== undefined) {
    if (!isOpenAlexAuthorText(filters.author)) throw new ScholarlyError("invalid_state", AUTHOR_INVALID);
    out.author = filters.author;
  }
  return out;
}

/**
 * Whether OpenAlex browsing (word searches and lists, which OpenAlex meters) is refused here: on the
 * production server without OPENALEX_API_KEY the shared keyless allowance is not used for them.
 */
export function openAlexBrowsingRefusal(
  env: { DEPLOYMENT_MODE: "local" | "production"; OPENALEX_API_KEY?: string | undefined },
  client: Pick<ScholarlyClient, "mode">,
): string | null {
  return client.mode === "live" && env.DEPLOYMENT_MODE === "production" && !env.OPENALEX_API_KEY ? OPENALEX_BROWSING_NEEDS_KEY : null;
}

/** A provider record with the owner's work that holds any of its identifiers (null when none does). */
export interface FoundPaper {
  record: OpenAlexWorkRecord;
  workId: string | null;
  /**
   * Whether that work is in the owner's saved papers (false when the owner removed it from the
   * library and kept its files and notes, and when there is no work). Absent means saved.
   */
  saved?: boolean;
}

/** The "in your library" markers: the owner's work for each record, and whether it is saved. */
async function markers(db: DbOrTx, ownerId: string): Promise<{ index: ReadonlyMap<string, string>; unsaved: ReadonlySet<string> }> {
  const [index, rows] = await Promise.all([
    ownerWorkIndex(db, ownerId),
    db
      .select({ id: scholarlyWork.id })
      .from(scholarlyWork)
      .where(and(eq(scholarlyWork.ownerId, ownerId), isNull(scholarlyWork.savedAt), isNull(scholarlyWork.mergedIntoId))),
  ]);
  return { index, unsaved: new Set(rows.map((r) => r.id)) };
}

function marked(
  { index, unsaved }: { index: ReadonlyMap<string, string>; unsaved: ReadonlySet<string> },
  records: readonly OpenAlexWorkRecord[],
): FoundPaper[] {
  return records.map((record) => {
    const workId = record.identifiers.map((ref) => index.get(identifierKey(ref))).find((id) => id !== undefined) ?? null;
    return { record, workId, saved: workId !== null && !unsaved.has(workId) };
  });
}

/** The registered sentence (and reset time) for a provider failure; anything else is re-thrown. */
export function failureOf(error: unknown): { message: string; resetAt: Date | null; code: ScholarlyProviderError["code"] | null } {
  try {
    providerFailure(error);
  } catch (mapped) {
    if (mapped instanceof ScholarlyError)
      return { message: mapped.message, resetAt: mapped.details.resetAt ?? null, code: mapped.details.providerCode ?? null };
    throw mapped;
  }
}

export interface PaperPage {
  provenance: Provenance;
  /** Total matches OpenAlex counted (null when it gave none). */
  count: number | null;
  page: number;
  perPage: number;
  /** The last page Find offers (OpenAlex pages stop at 10,000 results). */
  lastPage: number;
  items: FoundPaper[];
}

/** A Find page of OpenAlex's word search (or an author alone), with the filters and "in your library" markers. */
export async function searchPapers(
  db: DbOrTx,
  ownerId: string,
  client: ScholarlyClient,
  input: { query: string; filters?: PaperFilters; page?: number },
): Promise<PaperPage> {
  const query = input.query.trim().slice(0, 300);
  if (!query && input.filters?.author === undefined) throw new ScholarlyError("invalid_state", QUERY_MISSING);
  const page = input.page ?? 1;
  if (!Number.isInteger(page) || page < 1 || page > FIND_MAX_PAGE) throw new ScholarlyError("invalid_state", PAGE_OUT_OF_RANGE);
  const filters = openAlexFiltersFor(input.filters ?? {});
  let list: Awaited<ReturnType<ScholarlyClient["openalexSearch"]>>;
  try {
    list = await client.openalexSearch(
      { search: query, ...(Object.keys(filters).length ? { filters } : {}), page, perPage: FIND_PAGE_SIZE },
      { cacheKind: "search" },
    );
  } catch (error) {
    providerFailure(error);
  }
  const lastPage =
    list.count === null
      ? page + (list.items.length === FIND_PAGE_SIZE ? 1 : 0)
      : Math.max(1, Math.min(FIND_MAX_PAGE, Math.ceil(list.count / FIND_PAGE_SIZE)));
  return {
    provenance: list.provenance,
    count: list.count,
    page,
    perPage: FIND_PAGE_SIZE,
    lastPage,
    items: marked(await markers(db, ownerId), list.items),
  };
}

export type PaperPreview =
  /** The owner already has this paper (by this identifier or another one the provider reports). */
  | { kind: "owned"; workId: string }
  | { kind: "openalex"; record: OpenAlexWorkRecord; merged: boolean }
  /** OpenAlex has no record of this DOI; Crossref's is shown instead. */
  | { kind: "crossref"; work: CrossrefWork }
  /**
   * An arXiv id OpenAlex did not answer for: `reason` says why (no record, unavailable, not
   * recorded, allowance used up), with the allowance's reset time when OpenAlex gave one.
   */
  | { kind: "arxiv_only"; arxivId: string; reason: string; resetAt: Date | null };

/** The identifier a preview URL names (`doi`, `arxiv` or `openalex`), normalised; an arXiv DOI is its arXiv id. */
export function previewIdentifier(scheme: string, value: string): IdentifierRef {
  if (scheme !== "doi" && scheme !== "arxiv" && scheme !== "openalex")
    throw new ScholarlyError("invalid_identifier", "That identifier is not valid.");
  let ref = normaliseIdentifier(scheme, value);
  if (!ref) throw new ScholarlyError("invalid_identifier", "That identifier is not valid.");
  if (ref.scheme === "arxiv") {
    // A version suffix names one version of the same paper.
    ref = { scheme: "arxiv", value: ref.value };
  } else if (ref.scheme === "doi" && isArxivDoi(ref.value)) {
    const arxiv = arxivIdFromDoi(ref.value);
    if (arxiv) ref = { scheme: "arxiv", value: arxiv };
  }
  return ref;
}

/**
 * A paper before it is saved: the owner's work when they have it; otherwise OpenAlex's record
 * (read through the provider cache), Crossref's record for a DOI OpenAlex lacks, or, for an arXiv id
 * OpenAlex did not answer for, the id alone with the reason (saving it still works: the arXiv record
 * is fetched by the worker).
 */
export async function previewPaper(
  db: DbOrTx,
  ownerId: string,
  client: ScholarlyClient,
  scheme: string,
  value: string,
): Promise<PaperPreview> {
  const ref = previewIdentifier(scheme, value);
  const owned = await getWorkByIdentifier(db, ownerId, ref.scheme, ref.value);
  if (owned) return { kind: "owned", workId: owned.id };
  try {
    const result = await client.openalexWork(ref);
    const index = await ownerWorkIndex(db, ownerId);
    const held = result.record.identifiers.map((r) => index.get(identifierKey(r))).find((id) => id !== undefined);
    if (held) return { kind: "owned", workId: held };
    return { kind: "openalex", record: result.record, merged: result.merged };
  } catch (error) {
    if (!(error instanceof ScholarlyProviderError)) throw error;
    if (ref.scheme === "arxiv") {
      const failure = failureOf(error);
      return { kind: "arxiv_only", arxivId: ref.value, reason: failure.message, resetAt: failure.resetAt };
    }
    if (ref.scheme !== "doi" || error.code !== "not_found") providerFailure(error);
  }
  try {
    return { kind: "crossref", work: await client.crossrefWork(ref.value) };
  } catch (error) {
    if (error instanceof ScholarlyProviderError && error.code === "not_found")
      throw new ScholarlyError("not_found", DOI_UNKNOWN_EVERYWHERE);
    providerFailure(error);
  }
}

/** Which identifier finds a work in OpenAlex: its current W, else a publisher DOI, else its arXiv id, else any DOI. */
export function openAlexLookupFor(identifiers: readonly { scheme: string; value: string; status: string }[]): IdentifierRef | null {
  const current = identifiers.filter((i) => i.status === "current");
  const pick = (scheme: string, test: (v: string) => boolean = () => true) => current.find((i) => i.scheme === scheme && test(i.value));
  const chosen = pick("openalex") ?? pick("doi", (v) => !isArxivDoi(v)) ?? pick("arxiv") ?? pick("doi");
  return chosen ? normaliseIdentifier(chosen.scheme as IdentifierRef["scheme"], chosen.value) : null;
}

export type WorkRecordResult =
  | { record: OpenAlexWorkRecord; failure: null }
  | { record: null; failure: { message: string; resetAt: Date | null } | null };

/**
 * A saved paper's OpenAlex record (cited-by count, locations and the lists), read through the
 * provider cache by the work's own identifier. `failure` is null when the work has no identifier
 * OpenAlex can look up (an unidentified upload).
 */
export async function openAlexRecordForWork(
  db: DbOrTx,
  ownerId: string,
  client: ScholarlyClient,
  workId: string,
): Promise<WorkRecordResult> {
  const id = await resolveWorkId(db, ownerId, workId);
  if (!id) throw new ScholarlyError("not_found", "Paper not found.");
  const identifiers = await db
    .select({ scheme: scholarlyIdentifier.scheme, value: scholarlyIdentifier.value, status: scholarlyIdentifier.status })
    .from(scholarlyIdentifier)
    .where(and(eq(scholarlyIdentifier.ownerId, ownerId), eq(scholarlyIdentifier.workId, id)));
  const ref = openAlexLookupFor(identifiers);
  if (!ref) return { record: null, failure: null };
  try {
    return { record: (await client.openalexWork(ref)).record, failure: null };
  } catch (error) {
    const failure = failureOf(error);
    return { record: null, failure: { message: failure.message, resetAt: failure.resetAt } };
  }
}

export type PaperListKind = "references" | "cited_by" | "related";

export interface PaperList {
  kind: PaperListKind;
  /** At most PAPER_LIST_MAX, in OpenAlex's order (the reference list's order; most cited first for cited by). */
  items: FoundPaper[];
  /**
   * What OpenAlex counts: references in the reference list it matched, works whose reference lists
   * it matched to this one, works it considers related. Null when it gave no count.
   */
  total: number | null;
  /**
   * Records OpenAlex returned for the list, before it is cut to PAPER_LIST_MAX (cited by asks for
   * the 50 most cited only, so there it is at most 50).
   */
  returned: number;
  /** Ids OpenAlex listed for which no record came back (merged, deleted, or outside its default corpus). */
  missing: number;
  provenance: Provenance;
}

function ordered(ids: readonly string[], records: readonly OpenAlexWorkRecord[]): OpenAlexWorkRecord[] {
  const position = new Map(ids.map((id, i) => [id, i]));
  return [...records].sort((a, b) => (position.get(a.openalexId) ?? ids.length) - (position.get(b.openalexId) ?? ids.length));
}

/**
 * One bounded list of a paper's OpenAlex record: its references (as OpenAlex matched them),
 * the works OpenAlex records as citing it, or the works OpenAlex considers related (similarity, not
 * citation). The record must come from this server (`openAlexRecordForWork` or a preview).
 */
export async function paperList(
  db: DbOrTx,
  ownerId: string,
  client: ScholarlyClient,
  record: OpenAlexWorkRecord,
  kind: PaperListKind,
): Promise<PaperList> {
  let items: OpenAlexWorkRecord[];
  let total: number | null;
  let missing = 0;
  let provenance: Provenance = record.provenance;
  try {
    if (kind === "cited_by") {
      const list = await client.openalexCitedBy(record.openalexId, { perPage: PAPER_LIST_MAX });
      items = list.items;
      total = list.count;
      provenance = list.provenance;
    } else {
      const ids = kind === "references" ? record.referencedOpenAlexIds : record.relatedOpenAlexIds;
      const batch = await (kind === "references" ? client.openalexReferences(record) : client.openalexRelated(record));
      items = ordered(ids, batch.items);
      missing = batch.missing.length;
      provenance = batch.provenance;
      total = kind === "references" ? (record.referencedWorksCount ?? ids.length) : ids.length;
    }
  } catch (error) {
    providerFailure(error);
  }
  return {
    kind,
    items: marked(await markers(db, ownerId), items.slice(0, PAPER_LIST_MAX)),
    total,
    returned: items.length,
    missing,
    provenance,
  };
}
