import type { ArxivId, IdentifierRef } from "@corniversity/core/scholarly/index";
import { getArxivEntries, getArxivNewest, getArxivPdf, getArxivRaw } from "./arxiv";
import type { ProviderCacheStore } from "./cache";
import { getCrossrefWork } from "./crossref";
import { FixtureTransport } from "./fixture-transport";
import {
  getOpenAlexWork,
  type OpenAlexSearchParams,
  type OpenAlexSort,
  openAlexCitedBy,
  openAlexFields,
  openAlexSubfields,
  openAlexWorksByIds,
  searchOpenAlex,
} from "./openalex";
import { LiveTransport, type LiveTransportOptions, type RequestOptions, type ScholarlyTransport } from "./transport";
import type {
  ArxivEntriesResult,
  ArxivListing,
  ArxivRawRecord,
  CrossrefWork,
  OpenAlexBatch,
  OpenAlexList,
  OpenAlexWorkRecord,
  OpenAlexWorkResult,
  TaxonomyEntry,
} from "./types";

/**
 * The provider client services take as a parameter, so tests and journeys use the fixture
 * implementation and production the live one. Every record it returns carries its provenance;
 * fixture-mode records carry `source: "fixture"`. arXiv methods are for the worker only.
 */
export interface ScholarlyClient {
  readonly mode: "live" | "fixture";
  openalexWork(ref: IdentifierRef, options?: RequestOptions): Promise<OpenAlexWorkResult>;
  openalexSearch(params: OpenAlexSearchParams, options?: RequestOptions & { cacheKind?: "search" | "subject_list" }): Promise<OpenAlexList>;
  openalexCitedBy(
    openalexId: string,
    params?: { sort?: OpenAlexSort; page?: number; perPage?: number },
    options?: RequestOptions,
  ): Promise<OpenAlexList>;
  openalexWorksByIds(
    ids: readonly string[],
    cacheKind?: "references" | "related" | "work",
    options?: RequestOptions,
  ): Promise<OpenAlexBatch>;
  /** The first 100 works the record's reference list contains, as OpenAlex matched them. */
  openalexReferences(record: OpenAlexWorkRecord, options?: RequestOptions): Promise<OpenAlexBatch>;
  /** The record's related works (OpenAlex similarity, not citations). */
  openalexRelated(record: OpenAlexWorkRecord, options?: RequestOptions): Promise<OpenAlexBatch>;
  openalexFields(options?: RequestOptions): Promise<TaxonomyEntry[]>;
  openalexSubfields(fieldIds: readonly string[], options?: RequestOptions): Promise<TaxonomyEntry[]>;
  arxivEntries(ids: readonly ArxivId[], options?: RequestOptions): Promise<ArxivEntriesResult>;
  arxivRaw(id: string, options?: RequestOptions): Promise<ArxivRawRecord>;
  arxivNewest(categories: readonly string[], maxResults?: number, options?: RequestOptions): Promise<ArxivListing>;
  arxivPdf(id: string, version: number, maxBytes: number): Promise<Uint8Array>;
  crossrefWork(doi: string, options?: RequestOptions): Promise<CrossrefWork>;
}

export function createScholarlyClient(transport: ScholarlyTransport): ScholarlyClient {
  const emptyBatch = (record: OpenAlexWorkRecord): OpenAlexBatch => ({ provenance: record.provenance, items: [], missing: [] });
  return {
    mode: transport.mode,
    openalexWork: (ref, options) => getOpenAlexWork(transport, ref, options),
    openalexSearch: (params, options) => searchOpenAlex(transport, params, options),
    openalexCitedBy: (id, params, options) => openAlexCitedBy(transport, id, params, options),
    openalexWorksByIds: (ids, cacheKind, options) => openAlexWorksByIds(transport, ids, cacheKind, options),
    openalexReferences: (record, options) =>
      record.referencedOpenAlexIds.length === 0
        ? Promise.resolve(emptyBatch(record))
        : openAlexWorksByIds(transport, record.referencedOpenAlexIds.slice(0, 100), "references", options),
    openalexRelated: (record, options) =>
      record.relatedOpenAlexIds.length === 0
        ? Promise.resolve(emptyBatch(record))
        : openAlexWorksByIds(transport, record.relatedOpenAlexIds.slice(0, 100), "related", options),
    openalexFields: (options) => openAlexFields(transport, options),
    openalexSubfields: (fieldIds, options) => openAlexSubfields(transport, fieldIds, options),
    arxivEntries: (ids, options) => getArxivEntries(transport, ids, options),
    arxivRaw: (id, options) => getArxivRaw(transport, id, options),
    arxivNewest: (categories, maxResults, options) => getArxivNewest(transport, categories, maxResults, options),
    arxivPdf: (id, version, maxBytes) => getArxivPdf(transport, id, version, maxBytes),
    crossrefWork: (doi, options) => getCrossrefWork(transport, doi, options),
  };
}

export function createLiveScholarlyClient(options: LiveTransportOptions = {}): ScholarlyClient {
  return createScholarlyClient(new LiveTransport(options));
}

export function createFixtureScholarlyClient(options: { dir?: string } = {}): ScholarlyClient {
  return createScholarlyClient(new FixtureTransport(options.dir));
}

export interface ScholarlyEnv {
  SCHOLARLY_PROVIDER: "live" | "fixture";
  DEPLOYMENT_MODE?: "local" | "production";
  OPENALEX_API_KEY?: string | undefined;
  CROSSREF_MAILTO?: string | undefined;
}

/**
 * The client the environment selects (`SCHOLARLY_PROVIDER`, default live), with an optional cache for
 * live mode. Fixture data is refused in production here too, not only when the environment loads.
 */
export function scholarlyClientFromEnv(env: ScholarlyEnv, options: { cache?: ProviderCacheStore | null } = {}): ScholarlyClient {
  if (env.SCHOLARLY_PROVIDER === "fixture") {
    if (env.DEPLOYMENT_MODE === "production")
      throw new Error("SCHOLARLY_PROVIDER is 'fixture' (recorded test data); refused in production.");
    return createFixtureScholarlyClient();
  }
  return createLiveScholarlyClient({
    openalexApiKey: env.OPENALEX_API_KEY ?? null,
    crossrefMailto: env.CROSSREF_MAILTO ?? null,
    cache: options.cache ?? null,
  });
}
