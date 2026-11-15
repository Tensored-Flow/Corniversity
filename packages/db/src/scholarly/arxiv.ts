import { type ArxivId, formatArxivId, parseArxivId, providerText, providerTextOrNull } from "@corniversity/core/scholarly/index";
import { ScholarlyProviderError } from "./errors";
import { provenanceOf } from "./openalex";
import { ARXIV_MIN_SPACING_MS, type ProviderRequest, type RequestOptions, type ScholarlyTransport } from "./transport";
import type { ArxivAuthor, ArxivEntriesResult, ArxivEntry, ArxivListing, ArxivRawRecord, Provenance, VersionRecord } from "./types";
import { childElement, childElements, childText, parseXml, textContent, type XmlElement, XmlError } from "./xml";

/**
 * arXiv adapter: the export API (Atom; identity and versions, no licence), OAI-PMH arXivRaw (the
 * version history with dates and withdrawals, and the licence, which belongs to the last version
 * listed in that record), newest submissions per category, and private-copy PDF downloads from
 * export.arxiv.org. Nothing here waits between requests: arXiv allows one request every three
 * seconds across all processes, and the worker's arXiv queue (concurrency 1) spaces its jobs by at
 * least ARXIV_MIN_SPACING_MS. Only the worker calls these functions.
 */
export { ARXIV_MIN_SPACING_MS };

const API_HOST = "export.arxiv.org";
const OAI_HOST = "oaipmh.arxiv.org";
export const ARXIV_MAX_IDS_PER_REQUEST = 20;
export const ARXIV_MAX_LISTING = 50;

function parse(body: string): XmlElement {
  try {
    return parseXml(body);
  } catch (error) {
    const detail = error instanceof XmlError ? "" : " (unexpected parser failure)";
    throw new ScholarlyProviderError("arxiv", "invalid_response", `arXiv's response was not readable XML${detail}.`);
  }
}

function iso(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function entryId(raw: string | null): ArxivId | null {
  const match = raw ? /^https?:\/\/arxiv\.org\/abs\/(.+)$/.exec(raw.trim()) : null;
  return match ? parseArxivId(match[1]) : null;
}

function entryOf(entry: XmlElement, provenance: Provenance): ArxivEntry | null {
  const parsed = entryId(childText(entry, "id"));
  if (!parsed || parsed.version === null) return null;
  const authors: ArxivAuthor[] = childElements(entry, "author")
    .map((a) => ({
      name: providerText(childText(a, "name"), 300),
      affiliations: childElements(a, "affiliation")
        .map((x) => providerText(textContent(x), 500))
        .filter(Boolean),
    }))
    .filter((a) => a.name.length > 0);
  const comment = providerTextOrNull(childText(entry, "comment"), 2000);
  const categories = childElements(entry, "category")
    .map((c) => c.attrs.term ?? "")
    .filter((term) => /^[A-Za-z.-]{2,30}$/.test(term));
  const primary = childElement(entry, "primary_category")?.attrs.term ?? null;
  return {
    provenance,
    id: parsed.id,
    version: parsed.version,
    title: providerTextOrNull(childText(entry, "title"), 2000),
    abstract: providerTextOrNull(childText(entry, "summary")),
    authors,
    published: iso(childText(entry, "published")),
    updated: iso(childText(entry, "updated")),
    primaryCategory: primary && /^[A-Za-z.-]{2,30}$/.test(primary) ? primary : null,
    categories: [...new Set(categories)],
    comment,
    journalRef: providerTextOrNull(childText(entry, "journal_ref"), 1000),
    doi: providerTextOrNull(childText(entry, "doi"), 1000),
    withdrawalHint: comment !== null && /\bwithdrawn\b/i.test(comment),
  };
}

function feedEntries(root: XmlElement, provenance: Provenance): ArxivEntry[] {
  if (root.name !== "feed" && !root.name.endsWith(":feed"))
    throw new ScholarlyProviderError("arxiv", "invalid_response", "arXiv's response was not an Atom feed.");
  return childElements(root, "entry")
    .map((e) => entryOf(e, provenance))
    .filter((e): e is ArxivEntry => e !== null);
}

function apiRequest(query: [string, string][], cacheKind: "arxiv_record" | "arxiv_listing"): ProviderRequest {
  return { provider: "arxiv", host: API_HOST, path: "/api/query", query, kind: "arxiv", cacheKind, accept: "application/atom+xml" };
}

/** Export API entries for the given ids (with or without versions); matched by id, never by order. */
export async function getArxivEntries(
  transport: ScholarlyTransport,
  ids: readonly ArxivId[],
  options?: RequestOptions,
): Promise<ArxivEntriesResult> {
  if (ids.length === 0 || ids.length > ARXIV_MAX_IDS_PER_REQUEST)
    throw new ScholarlyProviderError("arxiv", "invalid_identifier", `Between 1 and ${ARXIV_MAX_IDS_PER_REQUEST} arXiv ids per request.`);
  const wanted = ids.map((ref) => {
    const parsed = parseArxivId(formatArxivId(ref.id, ref.version));
    if (!parsed) throw new ScholarlyProviderError("arxiv", "invalid_identifier", "Not a valid arXiv identifier.");
    return parsed;
  });
  const query: [string, string][] = [
    ["id_list", wanted.map((w) => formatArxivId(w.id, w.version)).join(",")],
    ["max_results", String(wanted.length)],
  ];
  const response = await transport.get(apiRequest(query, "arxiv_record"), options);
  const provenance = provenanceOf(response, "arxiv");
  if (response.status === 404) return { provenance, entries: [], missing: wanted.map((w) => formatArxivId(w.id, w.version)) };
  const entries = feedEntries(parse(response.body), provenance);
  const missing = wanted
    .filter((w) => !entries.some((e) => e.id === w.id && (w.version === null || e.version === w.version)))
    .map((w) => formatArxivId(w.id, w.version));
  return { provenance, entries, missing };
}

const CATEGORY = /^[a-z-]{2,20}(?:\.[A-Za-z-]{2,20}|\.\*)?$/;

/** `cat:a OR cat:b` from validated category terms (`math.*` matches an archive's categories). */
export function arxivCategoryQuery(categories: readonly string[]): string {
  if (categories.length === 0 || categories.length > 20 || categories.some((c) => !CATEGORY.test(c)))
    throw new ScholarlyProviderError("arxiv", "invalid_identifier", "Not valid arXiv categories.");
  return [...new Set(categories)].map((c) => `cat:${c}`).join(" OR ");
}

/** The newest submissions in the given categories (most recent first). */
export async function getArxivNewest(
  transport: ScholarlyTransport,
  categories: readonly string[],
  maxResults = 20,
  options?: RequestOptions,
): Promise<ArxivListing> {
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > ARXIV_MAX_LISTING)
    throw new ScholarlyProviderError("arxiv", "invalid_identifier", `Between 1 and ${ARXIV_MAX_LISTING} results.`);
  const search = arxivCategoryQuery(categories);
  const query: [string, string][] = [
    ["search_query", search],
    ["sortBy", "submittedDate"],
    ["sortOrder", "descending"],
    ["max_results", String(maxResults)],
  ];
  const response = await transport.get(apiRequest(query, "arxiv_listing"), options);
  const provenance = provenanceOf(response, "arxiv");
  if (response.status === 404)
    throw new ScholarlyProviderError("arxiv", "not_found", "arXiv found nothing for this listing.", { status: 404 });
  const root = parse(response.body);
  const total = Number(childText(root, "totalResults"));
  return { provenance, query: search, totalResults: Number.isFinite(total) ? total : null, entries: feedEntries(root, provenance) };
}

/** arXivRaw marks a withdrawal as a version whose size is 0 kb with no source. */
function isWithdrawal(sizeKb: number | null, sourceType: string | null): boolean {
  return sizeKb === 0 && (sourceType === null || sourceType === "I");
}

/** The OAI-PMH arXivRaw record for an id: version history and the licence of the last listed version. */
export async function getArxivRaw(transport: ScholarlyTransport, id: string, options?: RequestOptions): Promise<ArxivRawRecord> {
  const parsedId = parseArxivId(id);
  if (!parsedId) throw new ScholarlyProviderError("arxiv", "invalid_identifier", "Not a valid arXiv identifier.");
  const response = await transport.get(
    {
      provider: "arxiv",
      host: OAI_HOST,
      path: "/oai",
      query: [
        ["verb", "GetRecord"],
        ["identifier", `oai:arXiv.org:${parsedId.id}`],
        ["metadataPrefix", "arXivRaw"],
      ],
      kind: "arxiv",
      cacheKind: "arxiv_record",
      accept: "text/xml",
    },
    options,
  );
  if (response.status === 404)
    throw new ScholarlyProviderError("arxiv", "not_found", "arXiv has no record with this identifier.", { status: 404 });
  return parseArxivRaw(response.body, parsedId.id, provenanceOf(response, "arxiv"));
}

export function parseArxivRaw(body: string, requestedId: string, provenance: Provenance): ArxivRawRecord {
  const root = parse(body);
  if (root.name !== "OAI-PMH")
    throw new ScholarlyProviderError("arxiv", "invalid_response", "arXiv's response was not an OAI-PMH document.");
  const error = childElement(root, "error");
  if (error) {
    const code = error.attrs.code ?? "";
    if (code === "idDoesNotExist" || code === "noRecordsMatch")
      throw new ScholarlyProviderError("arxiv", "not_found", "arXiv has no record with this identifier.");
    throw new ScholarlyProviderError("arxiv", "refused", "arXiv refused the request.");
  }
  const record = childElement(childElement(root, "GetRecord") ?? root, "record");
  const header = record ? childElement(record, "header") : undefined;
  if (!record || !header) throw new ScholarlyProviderError("arxiv", "invalid_response", "arXiv's OAI-PMH response had no record.");
  if (header.attrs.status === "deleted") throw new ScholarlyProviderError("arxiv", "not_found", "arXiv lists this record as deleted.");
  const raw = childElement(childElement(record, "metadata") ?? record, "arXivRaw");
  if (!raw) throw new ScholarlyProviderError("arxiv", "invalid_response", "arXiv's record had no arXivRaw metadata.");
  const id = parseArxivId(childText(raw, "id"));
  if (!id || id.id !== requestedId)
    throw new ScholarlyProviderError("arxiv", "invalid_response", "arXiv returned a record for a different identifier.");

  const licence = childText(raw, "license");
  const listed = childElements(raw, "version");
  const versions: VersionRecord[] = [];
  for (const element of listed) {
    const match = /^v([1-9]\d{0,3})$/.exec(element.attrs.version ?? "");
    if (!match) throw new ScholarlyProviderError("arxiv", "invalid_response", "arXiv listed a version without a valid number.");
    const size = /^(\d{1,7})kb$/i.exec(childText(element, "size") ?? "");
    const sizeKb = size ? Number(size[1]) : null;
    const sourceType = childText(element, "source_type");
    versions.push({
      arxivId: id.id,
      version: Number(match[1]),
      date: iso(childText(element, "date")),
      sizeKb,
      sourceType: sourceType && /^[A-Za-z]{1,4}$/.test(sourceType) ? sourceType : null,
      withdrawn: isWithdrawal(sizeKb, sourceType),
      licence: null,
      licenceSource: null,
      licenceRetrievedAt: null,
    });
  }
  const last = versions[versions.length - 1];
  if (last && licence) {
    last.licence = providerText(licence, 300);
    last.licenceSource = "arxiv-oai";
    last.licenceRetrievedAt = provenance.retrievedAt;
  }
  const categories = (childText(raw, "categories") ?? "").split(/\s+/).filter((c) => /^[A-Za-z.-]{2,30}$/.test(c));
  return {
    provenance,
    id: id.id,
    responseDate: iso(childText(root, "responseDate")),
    datestamp: childText(header, "datestamp"),
    title: providerTextOrNull(childText(raw, "title"), 2000),
    authors: providerTextOrNull(childText(raw, "authors"), 5000),
    categories,
    comments: providerTextOrNull(childText(raw, "comments"), 2000),
    journalRef: providerTextOrNull(childText(raw, "journal-ref"), 1000),
    doi: providerTextOrNull(childText(raw, "doi"), 1000),
    abstract: providerTextOrNull(childText(raw, "abstract")),
    versions,
    licence: licence ? providerText(licence, 300) : null,
    latestVersion: versions.length > 0 ? Math.max(...versions.map((v) => v.version)) : null,
  };
}

/** Downloads a version's PDF from export.arxiv.org (private copies of open-licence versions only). */
export async function getArxivPdf(transport: ScholarlyTransport, id: string, version: number, maxBytes: number): Promise<Uint8Array> {
  const parsed = parseArxivId(formatArxivId(id, version));
  if (!parsed || parsed.version === null) throw new ScholarlyProviderError("arxiv", "invalid_identifier", "Not a valid arXiv version.");
  const path = `/pdf/${formatArxivId(parsed.id, parsed.version).split("/").map(encodeURIComponent).join("/")}`;
  const response = await transport.getPdf({ provider: "arxiv", host: API_HOST, path, maxBytes });
  return response.bytes;
}
