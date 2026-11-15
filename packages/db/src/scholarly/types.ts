import type { IdentifierRef, LicenceClass } from "@corniversity/core/scholarly/index";

/**
 * Normalised provider records. Every record names its provider, whether it came from recorded
 * fixtures (`source: "fixture"`), and when the underlying response was retrieved (for a cached
 * response, when it was originally fetched). Text fields have been through `providerText`; URLs
 * through `safeExternalUrl`. Nothing here is verified by opening: it is what a provider reported.
 */

export type ScholarlyProvider = "openalex" | "arxiv" | "crossref";
/** `fixture` marks records read from recorded responses in fixture mode. */
export type ScholarlySource = ScholarlyProvider | "fixture";

export interface Provenance {
  provider: ScholarlyProvider;
  source: ScholarlySource;
  /** ISO time the provider's response was retrieved (recording time for fixtures). */
  retrievedAt: string;
  /** True when served from the provider cache past its lifetime (cache mode "only"). */
  stale: boolean;
}

export interface ScholarlyAuthor {
  name: string;
  orcid?: string;
  openalexId?: string;
}

export interface ScholarlySubject {
  /** OpenAlex short id: domain "3", field "17", subfield "1702", topic "T10028". */
  id: string;
  name: string;
  level: "domain" | "field" | "subfield" | "topic";
  /** The classifier's score for the topic this came from; null when OpenAlex gives none. */
  score: number | null;
}

export type VersionKind = "preprint" | "accepted" | "published" | "unknown";

export interface ScholarlyLocation {
  /** OpenAlex location id (`doi:…`, `pmh:oai:arXiv.org:…`, `pmid:…`), or null. */
  id: string | null;
  isOa: boolean;
  /** https only (safe as a link); null otherwise. */
  landingPageUrl: string | null;
  pdfUrl: string | null;
  sourceName: string | null;
  /** The licence token as OpenAlex reported it for this location (display only). */
  licence: string | null;
  licenceClass: LicenceClass;
  licenceName: string | null;
  /** OpenAlex's `version` value, as reported. */
  version: "submittedVersion" | "acceptedVersion" | "publishedVersion" | null;
  versionKind: VersionKind;
  /** The arXiv id of an arXiv location (no version: OpenAlex does not report one). */
  arxivId: string | null;
}

export interface OpenAlexWorkRecord {
  provenance: Provenance;
  /** The OpenAlex work id (W…) the response carried. */
  openalexId: string;
  /** The work's primary DOI as OpenAlex reports it (for merged works, the published version's). */
  doi: string | null;
  identifiers: IdentifierRef[];
  title: string | null;
  authors: ScholarlyAuthor[];
  /** Rebuilt from `abstract_inverted_index`: "abstract as indexed by OpenAlex". */
  abstract: string | null;
  publicationYear: number | null;
  /** YYYY-MM-DD when OpenAlex gives a full date that is not a YYYY-01-01 placeholder. */
  publicationDate: string | null;
  publicationDatePrecision: "day" | "year" | null;
  /** Venue of the primary location (for merged works, the published version's venue). */
  venue: string | null;
  workType: string | null;
  language: string | null;
  subjects: ScholarlySubject[];
  citedByCount: number | null;
  referencedWorksCount: number | null;
  referencedOpenAlexIds: string[];
  relatedOpenAlexIds: string[];
  /** OpenAlex's own retraction flag (a hint; Crossref notices are the detail). */
  isRetracted: boolean | null;
  openAccess: { isOa: boolean; oaStatus: string | null; oaUrl: string | null } | null;
  primaryLocation: ScholarlyLocation | null;
  bestOaLocation: ScholarlyLocation | null;
  locations: ScholarlyLocation[];
}

export interface OpenAlexWorkResult {
  /** The identifier asked for (`W…`, `doi:…`, `arxiv:…`, `pmid:…`, `pmcid:…`). */
  requestedId: string;
  /** The W the response carried. */
  returnedId: string;
  /** True when a W was requested and a different W came back: OpenAlex merged the record. */
  merged: boolean;
  record: OpenAlexWorkRecord;
}

export interface OpenAlexList {
  provenance: Provenance;
  /** Total matches OpenAlex counted, or null. */
  count: number | null;
  page: number;
  perPage: number;
  items: OpenAlexWorkRecord[];
}

export interface OpenAlexBatch {
  provenance: Provenance;
  items: OpenAlexWorkRecord[];
  /** Requested ids no item carried (merged or deleted records, or works outside OpenAlex's default corpus). */
  missing: string[];
}

export interface TaxonomyEntry {
  provenance: Provenance;
  level: "domain" | "field" | "subfield";
  /** Short id: "17" (field), "1702" (subfield). */
  id: string;
  name: string;
  description: string | null;
  fieldId: string | null;
  fieldName: string | null;
  domainId: string | null;
  domainName: string | null;
  worksCount: number | null;
}

export interface ArxivAuthor {
  name: string;
  affiliations: string[];
}

/** One entry of the arXiv export API (Atom): the version it describes, no licence. */
export interface ArxivEntry {
  provenance: Provenance;
  id: string;
  version: number;
  title: string | null;
  abstract: string | null;
  authors: ArxivAuthor[];
  /** v1 submission time (ISO). */
  published: string | null;
  /** Time of this version (ISO). */
  updated: string | null;
  primaryCategory: string | null;
  categories: string[];
  comment: string | null;
  journalRef: string | null;
  /** DOI(s) the authors supplied for a published version, as given. */
  doi: string | null;
  /** The comment mentions withdrawal: a hint only; arXivRaw's version history decides. */
  withdrawalHint: boolean;
}

export interface ArxivEntriesResult {
  provenance: Provenance;
  entries: ArxivEntry[];
  /** Requested ids (with version when asked) for which no entry came back. */
  missing: string[];
}

export interface ArxivListing {
  provenance: Provenance;
  query: string;
  totalResults: number | null;
  entries: ArxivEntry[];
}

/** One version in an arXivRaw record. */
export interface VersionRecord {
  arxivId: string;
  version: number;
  /** ISO time of the version, from arXivRaw. */
  date: string | null;
  sizeKb: number | null;
  sourceType: string | null;
  /** arXivRaw marks this version as a withdrawal. */
  withdrawn: boolean;
  /** Only on the last version listed in the record: the licence arXiv reported, or null. */
  licence: string | null;
  licenceSource: "arxiv-oai" | null;
  licenceRetrievedAt: string | null;
}

/** An OAI-PMH arXivRaw record: version history, and the licence of the last listed version. */
export interface ArxivRawRecord {
  provenance: Provenance;
  id: string;
  /** OAI-PMH responseDate (arXiv caches these responses; it can be days old). */
  responseDate: string | null;
  datestamp: string | null;
  title: string | null;
  authors: string | null;
  categories: string[];
  comments: string | null;
  journalRef: string | null;
  doi: string | null;
  abstract: string | null;
  /** In the order listed; the licence belongs to the last one. */
  versions: VersionRecord[];
  /** The licence element of the record (applies to the last listed version only), or null. */
  licence: string | null;
  /** The highest version listed. */
  latestVersion: number | null;
}

export type IntegrityNoticeType = "retraction" | "correction" | "expression_of_concern" | "withdrawal";

export interface IntegrityNotice {
  type: IntegrityNoticeType;
  source: "crossref" | "retraction-watch" | "openalex" | "arxiv";
  /** What the notice concerns: a DOI, or an arXiv version (`arXiv:2305.18290v4`). */
  concerns: string;
  noticeDoi?: string;
  /** YYYY-MM-DD. */
  date?: string;
  label: string;
  retrievedAt: string;
}

export interface CrossrefWork {
  provenance: Provenance;
  doi: string;
  title: string | null;
  subtitle: string | null;
  authors: ScholarlyAuthor[];
  containerTitle: string | null;
  publisher: string | null;
  type: string | null;
  issued: { year: number; month: number | null; day: number | null } | null;
  /** Licence entries as Crossref listed them (display only), and the derived classification. */
  licences: { url: string; contentVersion: string | null; start: string | null; delayInDays: number | null }[];
  licence: { class: LicenceClass; name: string | null; url: string | null };
  integrityNotices: IntegrityNotice[];
  /** Abstract as deposited (JATS converted to plain text), or null. */
  abstract: string | null;
  isReferencedByCount: number | null;
  /** Relation types and targets as deposited (has-preprint, is-preprint-of …). */
  relations: { type: string; id: string; idType: string }[];
}

/** The work fields an import writes (scholarly_work columns), each with its own provenance. */
export type ScholarlyField =
  | "title"
  | "authors"
  | "abstract"
  | "publicationYear"
  | "publicationDate"
  | "venue"
  | "workType"
  | "subjects"
  | "referencedOpenAlexIds";

/**
 * A provider-neutral work as one provider reported it: what an import or refresh writes into
 * `scholarly_work` (fields an owner edited are the service's to protect). Built by the mappers in
 * records.ts; nothing in it is inferred beyond the provider's response.
 */
export interface ScholarlyRecord {
  provenance: Provenance;
  identifiers: IdentifierRef[];
  title: string | null;
  authors: ScholarlyAuthor[];
  abstract: string | null;
  abstractSource: "openalex" | "arxiv" | "crossref" | null;
  publicationYear: number | null;
  publicationDate: string | null;
  publicationDatePrecision: "day" | "year" | null;
  venue: string | null;
  /** As the provider reported it; null when it reports none (arXiv reports no type). */
  workType: string | null;
  /** As classified by OpenAlex; empty for other providers. */
  subjects: ScholarlySubject[];
  /** OpenAlex ids in the work's reference list (OpenAlex only), and whether OpenAlex was asked. */
  referencedOpenAlexIds: string[];
  referencesRetrieved: boolean;
  /** Per-field provenance (`scholarly_work.provenance`), for the fields this record carries. */
  fieldProvenance: Partial<Record<ScholarlyField, { source: ScholarlySource; retrievedAt: string }>>;
  integrityNotices: IntegrityNotice[];
  /** arXiv versions with dates, withdrawals and the licence of the last listed one (arXiv only). */
  versions: VersionRecord[];
}
