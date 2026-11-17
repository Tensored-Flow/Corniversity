import {
  arxivIdFromOpenAlexLocation,
  classifyLicence,
  type IdentifierRef,
  identifiersFromOpenAlex,
  normaliseDoi,
  normaliseIdentifier,
  parseOpenAlexId,
  providerText,
  providerTextOrNull,
  safeExternalUrl,
} from "@corniversity/core/scholarly/index";
import { z } from "zod";
import type { CacheKind } from "./cache";
import { ScholarlyProviderError } from "./errors";
import type { ProviderRequest, ProviderResponse, RequestOptions, ScholarlyTransport } from "./transport";
import type {
  OpenAlexBatch,
  OpenAlexList,
  OpenAlexWorkRecord,
  OpenAlexWorkResult,
  Provenance,
  ScholarlyAuthor,
  ScholarlyLocation,
  ScholarlySubject,
  TaxonomyEntry,
  VersionKind,
} from "./types";

/**
 * OpenAlex adapter: single works by W, DOI, arXiv id, PubMed or PMC id (requested id vs returned
 * id, so merges are visible); filtered searches; cited-by lists (`cites:`); batches of up to 100
 * works by id (references, related works); the field and subfield taxonomy. The API key, when set,
 * travels only as `Authorization: Bearer` (added by the transport). Single lookups by W or DOI are
 * free; lists, searches and arXiv lookups are metered against the daily budget.
 */

const HOST = "api.openalex.org";
const JSON_ACCEPT = "application/json";
export const OPENALEX_MAX_PER_PAGE = 100;
export const OPENALEX_MAX_RESULTS = 10_000;

/** Work types OpenAlex reports (live /work-types, 2026-11-15). */
export const OPENALEX_WORK_TYPES = [
  "article",
  "book",
  "book-chapter",
  "book-review",
  "conference-abstract",
  "conference-paper",
  "data-paper",
  "dataset",
  "dissertation",
  "editorial",
  "erratum",
  "letter",
  "other",
  "paratext",
  "peer-review",
  "preprint",
  "reference-entry",
  "report",
  "retraction",
  "review",
  "software",
  "software-paper",
  "standard",
  "study-registration",
  "supplementary-materials",
] as const;
export type OpenAlexWorkType = (typeof OPENALEX_WORK_TYPES)[number];

/** Fields fetched for list items (cards and imports): no abstract, no reference lists. */
export const OPENALEX_LIST_SELECT = [
  "id",
  "doi",
  "display_name",
  "publication_year",
  "publication_date",
  "ids",
  "type",
  "language",
  "primary_location",
  "best_oa_location",
  "locations",
  "open_access",
  "authorships",
  "primary_topic",
  "cited_by_count",
  "is_retracted",
].join(",");

const Str = z.string().nullish();
const Num = z.number().nullish();
const Ref = z.looseObject({ id: Str, display_name: Str });
const Location = z.looseObject({
  id: Str,
  doi: Str,
  is_oa: z.boolean().nullish(),
  landing_page_url: Str,
  pdf_url: Str,
  source: z.looseObject({ display_name: Str }).nullish(),
  license: Str,
  license_id: Str,
  version: Str,
});
const Topic = z.looseObject({
  id: Str,
  display_name: Str,
  score: Num,
  subfield: Ref.nullish(),
  field: Ref.nullish(),
  domain: Ref.nullish(),
});
const Work = z.looseObject({
  id: z.string(),
  doi: Str,
  title: Str,
  display_name: Str,
  publication_year: z.number().int().nullish(),
  publication_date: Str,
  ids: z.looseObject({ openalex: Str, doi: Str, pmid: Str, pmcid: Str }).nullish(),
  language: Str,
  type: Str,
  authorships: z
    .array(z.looseObject({ author: z.looseObject({ id: Str, display_name: Str, orcid: Str }).nullish(), raw_author_name: Str }))
    .nullish(),
  primary_location: Location.nullish(),
  best_oa_location: Location.nullish(),
  locations: z.array(Location.nullish()).nullish(),
  open_access: z.looseObject({ is_oa: z.boolean().nullish(), oa_status: Str, oa_url: Str }).nullish(),
  primary_topic: Topic.nullish(),
  topics: z.array(Topic).nullish(),
  cited_by_count: Num,
  referenced_works_count: Num,
  referenced_works: z.array(z.string()).nullish(),
  related_works: z.array(z.string()).nullish(),
  is_retracted: z.boolean().nullish(),
  abstract_inverted_index: z.record(z.string(), z.array(z.number().int().min(0))).nullish(),
});
type WorkJson = z.infer<typeof Work>;
const ListMeta = z.looseObject({ count: Num, page: Num, per_page: Num });
const WorkList = z.looseObject({ meta: ListMeta.nullish(), results: z.array(Work) });
const TaxonomyItem = z.looseObject({
  id: z.string(),
  display_name: Str,
  description: Str,
  field: Ref.nullish(),
  domain: Ref.nullish(),
  works_count: Num,
});
const TaxonomyList = z.looseObject({ meta: ListMeta.nullish(), results: z.array(TaxonomyItem) });

export function provenanceOf(response: ProviderResponse, provider: Provenance["provider"]): Provenance {
  return { provider, source: response.fixture ? "fixture" : provider, retrievedAt: response.retrievedAt, stale: response.stale };
}

function parseJson<T>(response: ProviderResponse, schema: z.ZodType<T>): T {
  let data: unknown;
  try {
    data = JSON.parse(response.body);
  } catch {
    throw new ScholarlyProviderError("openalex", "invalid_response", "OpenAlex's response was not valid JSON.");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new ScholarlyProviderError("openalex", "invalid_response", "OpenAlex's response did not have the expected shape.");
  return parsed.data;
}

const MAX_ABSTRACT_POSITIONS = 20_000;

/** Rebuilds an abstract from OpenAlex's inverted index ("abstract as indexed by OpenAlex"). */
export function abstractFromInvertedIndex(index: Record<string, number[]> | null | undefined): string | null {
  if (!index) return null;
  const words: string[] = [];
  let count = 0;
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) {
      if (position >= MAX_ABSTRACT_POSITIONS) continue;
      words[position] = word;
      if (++count > MAX_ABSTRACT_POSITIONS) return null;
    }
  }
  return providerTextOrNull(words.filter((w) => w !== undefined).join(" "));
}

function shortId(url: string | null | undefined, kind: "domains" | "fields" | "subfields"): string | null {
  const match = url ? new RegExp(`^https://openalex\\.org/${kind}/(\\d{1,6})$`).exec(url) : null;
  return match ? match[1]! : null;
}

function topicId(url: string | null | undefined): string | null {
  const match = url ? /^https:\/\/openalex\.org\/(T\d{1,10})$/.exec(url) : null;
  return match ? match[1]! : null;
}

function subjectsOf(work: WorkJson): ScholarlySubject[] {
  const out = new Map<string, ScholarlySubject>();
  const add = (subject: ScholarlySubject | null) => {
    if (subject && !out.has(`${subject.level}:${subject.id}`)) out.set(`${subject.level}:${subject.id}`, subject);
  };
  const primary = work.primary_topic;
  if (primary) {
    const score = primary.score ?? null;
    const named = (id: string | null, name: string | null | undefined, level: ScholarlySubject["level"]) =>
      id && providerText(name) ? { id, name: providerText(name, 200), level, score } : null;
    add(named(shortId(primary.domain?.id, "domains"), primary.domain?.display_name, "domain"));
    add(named(shortId(primary.field?.id, "fields"), primary.field?.display_name, "field"));
    add(named(shortId(primary.subfield?.id, "subfields"), primary.subfield?.display_name, "subfield"));
  }
  for (const topic of [primary, ...(work.topics ?? [])]) {
    const id = topicId(topic?.id);
    if (id && topic && providerText(topic.display_name))
      add({ id, name: providerText(topic.display_name, 200), level: "topic", score: topic.score ?? null });
  }
  return [...out.values()];
}

function versionKind(version: string | null | undefined): VersionKind {
  switch (version) {
    case "submittedVersion":
      return "preprint";
    case "acceptedVersion":
      return "accepted";
    case "publishedVersion":
      return "published";
    default:
      return "unknown";
  }
}

function locationOf(location: z.infer<typeof Location> | null | undefined): ScholarlyLocation | null {
  if (!location) return null;
  const licence = location.license ?? null;
  const classification = classifyLicence(licence, "openalex");
  const version =
    location.version === "submittedVersion" || location.version === "acceptedVersion" || location.version === "publishedVersion"
      ? location.version
      : null;
  return {
    id: providerTextOrNull(location.id, 300),
    isOa: location.is_oa === true,
    landingPageUrl: safeExternalUrl(location.landing_page_url),
    pdfUrl: safeExternalUrl(location.pdf_url),
    sourceName: providerTextOrNull(location.source?.display_name, 500),
    licence: licence ? providerText(licence, 100) : null,
    licenceClass: classification.class,
    licenceName: classification.name,
    version,
    versionKind: versionKind(version),
    arxivId: arxivIdFromOpenAlexLocation(location.id),
  };
}

function orcidOf(value: string | null | undefined): string | undefined {
  const match = value ? /^(?:https?:\/\/orcid\.org\/)?(\d{4}-\d{4}-\d{4}-\d{3}[\dX])$/.exec(value.trim()) : null;
  return match ? match[1] : undefined;
}

function authorId(value: string | null | undefined): string | undefined {
  const match = value ? /^https:\/\/openalex\.org\/(A\d{1,12})$/.exec(value) : null;
  return match ? match[1] : undefined;
}

function publicationDate(work: WorkJson): Pick<OpenAlexWorkRecord, "publicationDate" | "publicationDatePrecision"> {
  const date = work.publication_date ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    // OpenAlex fills unknown days with YYYY-01-01; such dates are kept as the year only.
    if (date.endsWith("-01-01")) return { publicationDate: null, publicationDatePrecision: "year" };
    return { publicationDate: date, publicationDatePrecision: "day" };
  }
  return { publicationDate: null, publicationDatePrecision: work.publication_year ? "year" : null };
}

function workIds(list: readonly string[] | null | undefined): string[] {
  return [...new Set((list ?? []).map((id) => parseOpenAlexId(id)).filter((id): id is string => id !== null))];
}

export function normaliseOpenAlexWork(work: WorkJson, provenance: Provenance): OpenAlexWorkRecord {
  const openalexId = parseOpenAlexId(work.id);
  if (!openalexId) throw new ScholarlyProviderError("openalex", "invalid_response", "OpenAlex returned a work without a valid id.");
  const authors: ScholarlyAuthor[] = [];
  for (const authorship of work.authorships ?? []) {
    const name = providerText(authorship.author?.display_name ?? authorship.raw_author_name, 300);
    if (!name) continue;
    const orcid = orcidOf(authorship.author?.orcid);
    const id = authorId(authorship.author?.id);
    authors.push({ name, ...(orcid ? { orcid } : {}), ...(id ? { openalexId: id } : {}) });
  }
  const workType = work.type && /^[a-z-]{1,40}$/.test(work.type) ? work.type : null;
  return {
    provenance,
    openalexId,
    doi: normaliseDoi(work.doi),
    identifiers: identifiersFromOpenAlex(work),
    title: providerTextOrNull(work.display_name ?? work.title, 2000),
    authors,
    abstract: abstractFromInvertedIndex(work.abstract_inverted_index),
    publicationYear: work.publication_year ?? null,
    ...publicationDate(work),
    venue: providerTextOrNull(work.primary_location?.source?.display_name, 500),
    workType,
    language: work.language && /^[a-z]{2,3}$/.test(work.language) ? work.language : null,
    subjects: subjectsOf(work),
    citedByCount: typeof work.cited_by_count === "number" ? work.cited_by_count : null,
    referencedWorksCount: typeof work.referenced_works_count === "number" ? work.referenced_works_count : null,
    referencedOpenAlexIds: workIds(work.referenced_works),
    relatedOpenAlexIds: workIds(work.related_works),
    isRetracted: work.is_retracted ?? null,
    openAccess: work.open_access
      ? {
          isOa: work.open_access.is_oa === true,
          oaStatus: work.open_access.oa_status && /^[a-z]{1,20}$/.test(work.open_access.oa_status) ? work.open_access.oa_status : null,
          oaUrl: safeExternalUrl(work.open_access.oa_url),
        }
      : null,
    primaryLocation: locationOf(work.primary_location),
    bestOaLocation: locationOf(work.best_oa_location),
    locations: (work.locations ?? []).map(locationOf).filter((l): l is ScholarlyLocation => l !== null),
  };
}

function request(path: string, query: [string, string][], cacheKind: CacheKind): ProviderRequest {
  return { provider: "openalex", host: HOST, path, query, kind: "metadata", cacheKind, accept: JSON_ACCEPT };
}

function invalid(message: string): ScholarlyProviderError {
  return new ScholarlyProviderError("openalex", "invalid_identifier", message);
}

/** The path and requested-id label for a single-work lookup. */
export function workLookup(ref: IdentifierRef): { path: string; requestedId: string } {
  const valid = normaliseIdentifier(ref.scheme, ref.value);
  if (!valid) throw invalid(`Not a valid ${ref.scheme} identifier.`);
  switch (valid.scheme) {
    case "openalex":
      return { path: `/works/${valid.value}`, requestedId: valid.value };
    case "doi":
      return { path: `/works/doi:${encodeURIComponent(valid.value)}`, requestedId: `doi:${valid.value}` };
    case "arxiv":
      return { path: `/works/arxiv:${encodeURIComponent(valid.value)}`, requestedId: `arxiv:${valid.value}` };
    case "pmid":
      return { path: `/works/pmid:${valid.value}`, requestedId: `pmid:${valid.value}` };
    case "pmcid":
      return { path: `/works/pmcid:${valid.value}`, requestedId: `pmcid:${valid.value}` };
  }
}

export async function getOpenAlexWork(
  transport: ScholarlyTransport,
  ref: IdentifierRef,
  options?: RequestOptions,
): Promise<OpenAlexWorkResult> {
  const { path, requestedId } = workLookup(ref);
  const response = await transport.get(request(path, [], "work"), options);
  if (response.status === 404)
    throw new ScholarlyProviderError("openalex", "not_found", "OpenAlex has no work with this identifier.", { status: 404 });
  const record = normaliseOpenAlexWork(parseJson(response, Work), provenanceOf(response, "openalex"));
  return {
    requestedId,
    returnedId: record.openalexId,
    merged: ref.scheme === "openalex" && record.openalexId !== requestedId,
    record,
  };
}

export interface OpenAlexFilters {
  /** OpenAlex field id ("17"), matched on the primary topic. */
  fieldId?: string;
  /** OpenAlex subfield id ("1702"), matched on the primary topic. */
  subfieldId?: string;
  types?: readonly OpenAlexWorkType[];
  publicationYear?: { from?: number; to?: number };
  isOa?: boolean;
  hasAbstract?: boolean;
  isRetracted?: boolean;
  /** Works whose reference lists contain this W (cited by). */
  cites?: string;
  /** Works OpenAlex considers related to this W (similarity). */
  relatedTo?: string;
  language?: string;
  /**
   * Words of author names (`raw_author_name.search`, OpenAlex's byline search): every word must
   * appear among the author names as printed on the work, in any order. Checked by `isOpenAlexAuthorText`.
   */
  author?: string;
}

/** Longest author text sent as `raw_author_name.search`, in characters. */
export const OPENALEX_AUTHOR_MAX_LENGTH = 100;
/** Words of letters (with full stops, apostrophes and hyphens after the first letter), one space apart. */
const AUTHOR_TEXT = /^[\p{L}\p{M}][\p{L}\p{M}.'’-]*(?: [\p{L}\p{M}][\p{L}\p{M}.'’-]*)*$/u;

/** Whether text can be sent as an author filter: nothing in it can end, extend or negate the filter. */
export function isOpenAlexAuthorText(text: string): boolean {
  return [...text].length <= OPENALEX_AUTHOR_MAX_LENGTH && AUTHOR_TEXT.test(text);
}

export type OpenAlexSort = "cited_by_count:desc" | "publication_date:desc" | "relevance_score:desc";

export interface OpenAlexSearchParams {
  /** Words searched in titles, abstracts and full text. */
  search?: string;
  filters?: OpenAlexFilters;
  sort?: OpenAlexSort;
  page?: number;
  perPage?: number;
  /** A random sample of this size (with `seed`), for Surprise me. */
  sample?: number;
  seed?: number;
}

function year(n: number | undefined): string | null {
  if (n === undefined) return null;
  if (!Number.isInteger(n) || n < 1000 || n > 2999) throw invalid("Not a valid publication year.");
  return String(n);
}

/** The `filter` parameter, built only from validated values (no commas or pipes can be injected). */
export function filterParam(filters: OpenAlexFilters): string | null {
  const parts: string[] = [];
  if (filters.fieldId !== undefined) {
    if (!/^\d{1,4}$/.test(filters.fieldId)) throw invalid("Not a valid OpenAlex field id.");
    parts.push(`primary_topic.field.id:${filters.fieldId}`);
  }
  if (filters.subfieldId !== undefined) {
    if (!/^\d{1,6}$/.test(filters.subfieldId)) throw invalid("Not a valid OpenAlex subfield id.");
    parts.push(`primary_topic.subfield.id:${filters.subfieldId}`);
  }
  if (filters.types && filters.types.length > 0) {
    for (const t of filters.types) if (!(OPENALEX_WORK_TYPES as readonly string[]).includes(t)) throw invalid("Not an OpenAlex work type.");
    parts.push(`type:${[...new Set(filters.types)].join("|")}`);
  }
  if (filters.publicationYear) {
    const from = year(filters.publicationYear.from);
    const to = year(filters.publicationYear.to);
    if (from && to) parts.push(from === to ? `publication_year:${from}` : `publication_year:${from}-${to}`);
    else if (from) parts.push(`publication_year:>${Number(from) - 1}`);
    else if (to) parts.push(`publication_year:<${Number(to) + 1}`);
  }
  if (filters.isOa !== undefined) parts.push(`open_access.is_oa:${filters.isOa}`);
  if (filters.hasAbstract !== undefined) parts.push(`has_abstract:${filters.hasAbstract}`);
  if (filters.isRetracted !== undefined) parts.push(`is_retracted:${filters.isRetracted}`);
  if (filters.cites !== undefined) {
    const id = parseOpenAlexId(filters.cites);
    if (!id) throw invalid("Not a valid OpenAlex work id.");
    parts.push(`cites:${id}`);
  }
  if (filters.relatedTo !== undefined) {
    const id = parseOpenAlexId(filters.relatedTo);
    if (!id) throw invalid("Not a valid OpenAlex work id.");
    parts.push(`related_to:${id}`);
  }
  if (filters.language !== undefined) {
    if (!/^[a-z]{2}$/.test(filters.language)) throw invalid("Not a valid language code.");
    parts.push(`language:${filters.language}`);
  }
  if (filters.author !== undefined) {
    if (!isOpenAlexAuthorText(filters.author)) throw invalid("Not a valid author name.");
    parts.push(`raw_author_name.search:${filters.author}`);
  }
  return parts.length > 0 ? parts.join(",") : null;
}

function paging(page = 1, perPage = 25): { page: number; perPage: number } {
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(perPage) || perPage < 1 || perPage > OPENALEX_MAX_PER_PAGE)
    throw invalid("Invalid page or page size.");
  if (page * perPage > OPENALEX_MAX_RESULTS) throw invalid("OpenAlex pages stop at 10,000 results.");
  return { page, perPage };
}

const SORTS: readonly OpenAlexSort[] = ["cited_by_count:desc", "publication_date:desc", "relevance_score:desc"];

export function searchQuery(params: OpenAlexSearchParams): [string, string][] {
  const query: [string, string][] = [];
  const search = params.search ? providerText(params.search, 300) : "";
  if (search) query.push(["search", search]);
  const filter = filterParam(params.filters ?? {});
  if (filter) query.push(["filter", filter]);
  if (params.sort) {
    if (!SORTS.includes(params.sort)) throw invalid("Not a supported sort.");
    query.push(["sort", params.sort]);
  }
  if (params.sample !== undefined) {
    if (!Number.isInteger(params.sample) || params.sample < 1 || params.sample > 100) throw invalid("Invalid sample size.");
    query.push(["sample", String(params.sample)]);
    if (params.seed !== undefined) {
      if (!Number.isInteger(params.seed) || params.seed < 0) throw invalid("Invalid seed.");
      query.push(["seed", String(params.seed)]);
    }
  }
  const { page, perPage } = paging(params.page, params.perPage);
  query.push(["page", String(page)], ["per_page", String(perPage)], ["select", OPENALEX_LIST_SELECT]);
  return query;
}

async function getList(
  transport: ScholarlyTransport,
  query: [string, string][],
  cacheKind: CacheKind,
  options?: RequestOptions,
): Promise<OpenAlexList> {
  const response = await transport.get(request("/works", query, cacheKind), options);
  if (response.status === 404)
    throw new ScholarlyProviderError("openalex", "not_found", "OpenAlex found nothing for this request.", { status: 404 });
  const provenance = provenanceOf(response, "openalex");
  const data = parseJson(response, WorkList);
  return {
    provenance,
    count: typeof data.meta?.count === "number" ? data.meta.count : null,
    page: data.meta?.page ?? Number(query.find(([k]) => k === "page")?.[1] ?? 1),
    perPage: data.meta?.per_page ?? Number(query.find(([k]) => k === "per_page")?.[1] ?? 25),
    items: data.results.map((w) => normaliseOpenAlexWork(w, provenance)),
  };
}

export function searchOpenAlex(
  transport: ScholarlyTransport,
  params: OpenAlexSearchParams,
  options?: RequestOptions & { cacheKind?: "search" | "subject_list" },
): Promise<OpenAlexList> {
  return getList(transport, searchQuery(params), options?.cacheKind ?? "search", options);
}

/** Works whose reference lists contain this work, most cited first by default (citations, as OpenAlex matched them). */
export function openAlexCitedBy(
  transport: ScholarlyTransport,
  openalexId: string,
  params: { sort?: OpenAlexSort; page?: number; perPage?: number } = {},
  options?: RequestOptions,
): Promise<OpenAlexList> {
  const id = parseOpenAlexId(openalexId);
  if (!id) throw invalid("Not a valid OpenAlex work id.");
  return getList(
    transport,
    searchQuery({ ...params, filters: { cites: id }, sort: params.sort ?? "cited_by_count:desc" }),
    "cited_by",
    options,
  );
}

/** Up to 100 works by W in one list call; ids that come back under no item are reported missing. */
export async function openAlexWorksByIds(
  transport: ScholarlyTransport,
  ids: readonly string[],
  cacheKind: "references" | "related" | "work" = "work",
  options?: RequestOptions,
): Promise<OpenAlexBatch> {
  const valid = [...new Set(ids.map((id) => parseOpenAlexId(id)))];
  if (valid.some((id) => id === null)) throw invalid("Not a valid OpenAlex work id.");
  const list = valid as string[];
  if (list.length === 0) throw invalid("No OpenAlex ids given.");
  if (list.length > OPENALEX_MAX_PER_PAGE) throw invalid("At most 100 OpenAlex ids per batch.");
  const query: [string, string][] = [
    ["filter", `openalex:${list.join("|")}`],
    ["per_page", String(OPENALEX_MAX_PER_PAGE)],
    ["select", OPENALEX_LIST_SELECT],
  ];
  const result = await getList(transport, query, cacheKind, options);
  const returned = new Set(result.items.map((w) => w.openalexId));
  return { provenance: result.provenance, items: result.items, missing: list.filter((id) => !returned.has(id)) };
}

function taxonomyEntry(item: z.infer<typeof TaxonomyItem>, level: TaxonomyEntry["level"], provenance: Provenance): TaxonomyEntry | null {
  const kind = level === "field" ? "fields" : level === "subfield" ? "subfields" : "domains";
  const id = shortId(item.id, kind);
  const name = providerTextOrNull(item.display_name, 200);
  if (!id || !name) return null;
  return {
    provenance,
    level,
    id,
    name,
    description: providerTextOrNull(item.description, 1000),
    fieldId: shortId(item.field?.id, "fields"),
    fieldName: providerTextOrNull(item.field?.display_name, 200),
    domainId: shortId(item.domain?.id, "domains"),
    domainName: providerTextOrNull(item.domain?.display_name, 200),
    worksCount: typeof item.works_count === "number" ? item.works_count : null,
  };
}

async function taxonomy(
  transport: ScholarlyTransport,
  path: "/fields" | "/subfields",
  query: [string, string][],
  level: "field" | "subfield",
  options?: RequestOptions,
): Promise<TaxonomyEntry[]> {
  const response = await transport.get(request(path, query, "taxonomy"), options);
  if (response.status === 404)
    throw new ScholarlyProviderError("openalex", "not_found", "OpenAlex has no such taxonomy list.", { status: 404 });
  const provenance = provenanceOf(response, "openalex");
  return parseJson(response, TaxonomyList)
    .results.map((item) => taxonomyEntry(item, level, provenance))
    .filter((e): e is TaxonomyEntry => e !== null);
}

/** Fields have no parent field, so `field` is not selectable on /fields. */
const FIELD_SELECT = "id,display_name,description,domain,works_count";
const SUBFIELD_SELECT = "id,display_name,description,field,domain,works_count";

/** All OpenAlex fields (26 at the time of writing). */
export function openAlexFields(transport: ScholarlyTransport, options?: RequestOptions): Promise<TaxonomyEntry[]> {
  return taxonomy(
    transport,
    "/fields",
    [
      ["per_page", "100"],
      ["select", FIELD_SELECT],
    ],
    "field",
    options,
  );
}

/** The subfields of the given fields. */
export function openAlexSubfields(
  transport: ScholarlyTransport,
  fieldIds: readonly string[],
  options?: RequestOptions,
): Promise<TaxonomyEntry[]> {
  if (fieldIds.length === 0 || fieldIds.length > 26 || fieldIds.some((id) => !/^\d{1,4}$/.test(id)))
    throw invalid("Not valid OpenAlex field ids.");
  return taxonomy(
    transport,
    "/subfields",
    [
      ["filter", `field.id:${[...new Set(fieldIds)].join("|")}`],
      ["per_page", "200"],
      ["select", SUBFIELD_SELECT],
    ],
    "subfield",
    options,
  );
}
