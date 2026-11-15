/**
 * Scholarly identifiers: parsing and normalisation of DOIs, arXiv ids, OpenAlex work ids, PubMed
 * ids and PMC ids, and recognition of what the owner typed into the Find box. Everything here is
 * string parsing only: no URL is ever fetched, so a pasted link can never make the server request
 * an address of the owner's (or anyone's) choosing.
 *
 * Normal forms (as stored in `scholarly_identifier.value`):
 * - DOI: lower-case, no `doi:` or resolver prefix (`10.7717/peerj.4375`).
 * - arXiv: the id without its version; old-style ids without the optional subject class
 *   (`2305.18290`, `hep-th/9711200`), because arXiv numbers old-style papers uniquely per month and
 *   archive, so `math.GT/0309136` and `math/0309136` are the same paper.
 * - OpenAlex: `W` followed by digits (`W2741809807`).
 * - PubMed: digits (`29456894`); PMC: `PMC` followed by digits (`PMC5815332`).
 */

export type IdentifierScheme = "doi" | "arxiv" | "openalex" | "pmid" | "pmcid";

export interface IdentifierRef {
  scheme: IdentifierScheme;
  value: string;
}

export const MAX_DOI_LENGTH = 300;
/** Longest text the Find box considers at all; anything longer is cut before recognition. */
export const MAX_FIND_INPUT_LENGTH = 2000;
/** Longest search query passed on to a provider. */
export const MAX_SEARCH_QUERY_LENGTH = 300;

const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;
/** C0 and C1 controls, zero-width and bidirectional formatting characters, byte-order mark. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: it matches control characters in order to refuse them
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/;

/** Normalises a DOI (bare, `doi:`-prefixed or a doi.org link) or returns null when it is not one. */
export function normaliseDoi(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let value = raw.trim();
  if (value.length === 0 || value.length > MAX_DOI_LENGTH + 40) return null;
  value = value.replace(/^doi:\s*/i, "");
  value = value.replace(/^(?:https?:\/\/)?(?:dx\.|www\.)?doi\.org\//i, "");
  value = value.toLowerCase();
  if (value.length > MAX_DOI_LENGTH || UNSAFE_CHARS.test(value)) return null;
  return DOI_PATTERN.test(value) ? value : null;
}

/** arXiv registers its own papers' DOIs (10.48550) with DataCite; Crossref has no record of them. */
export function isArxivDoi(doi: string): boolean {
  return doi.startsWith("10.48550/");
}

export interface ArxivId {
  /** Without version; old-style ids without subject class. */
  id: string;
  /** null when the input named no version (the latest, according to arXiv). */
  version: number | null;
}

const NEW_ARXIV = /^(\d{2})(\d{2})\.(\d{4,5})(?:v([1-9]\d{0,3}))?$/;
const OLD_ARXIV = /^([a-z]+(?:-[a-z]+)?)(?:\.([a-z]{2}))?\/(\d{2})(\d{2})(\d{3})(?:v([1-9]\d{0,3}))?$/i;

/**
 * Parses an arXiv identifier: new style `YYMM.NNNN` (April 2007 to December 2014) or `YYMM.NNNNN`
 * (from January 2015), and old style `archive(.SC)?/YYMMNNN` (August 1991 to March 2007), each with
 * an optional `vN` and an optional `arXiv:` prefix.
 */
export function parseArxivId(raw: unknown): ArxivId | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().replace(/^arxiv:\s*/i, "");
  if (value.length === 0 || value.length > 40) return null;
  const modern = NEW_ARXIV.exec(value);
  if (modern) {
    const [, yy, mm, number, version] = modern;
    const month = Number(mm);
    const yymm = Number(`${yy}${mm}`);
    if (month < 1 || month > 12 || yymm < 704) return null;
    if (yymm <= 1412 ? number!.length !== 4 : number!.length !== 5) return null;
    return { id: `${yy}${mm}.${number}`, version: version ? Number(version) : null };
  }
  const old = OLD_ARXIV.exec(value);
  if (old) {
    const [, archive, , yy, mm, number, version] = old;
    const month = Number(mm);
    if (month < 1 || month > 12) return null;
    const year = Number(yy) >= 91 ? 1900 + Number(yy) : 2000 + Number(yy);
    const stamp = year * 100 + month;
    if (stamp < 199108 || stamp > 200703) return null;
    return { id: `${archive!.toLowerCase()}/${yy}${mm}${number}`, version: version ? Number(version) : null };
  }
  return null;
}

export function formatArxivId(id: string, version?: number | null): string {
  return version ? `${id}v${version}` : id;
}

/** The abstract page arXiv asks services to link to. Built from a validated id, never stored. */
export function arxivAbsUrl(id: string, version?: number | null): string {
  return `https://arxiv.org/abs/${formatArxivId(id, version)}`;
}

/** The PDF the owner's browser reads for a linked Document. Built from a validated id, never stored. */
export function arxivPdfUrl(id: string, version: number): string {
  return `https://arxiv.org/pdf/${formatArxivId(id, version)}`;
}

/**
 * The placeholder a linked Document carries in `resource_asset.sha256` (`arxiv:{id}v{n}`): never a
 * real hash, so the unique (owner, sha256) index gives one linked Document per arXiv version.
 */
export function linkedDocumentKey(id: string, version: number): string {
  const parsed = parseArxivId(`${id}v${version}`);
  if (!parsed || parsed.version === null) throw new Error("linkedDocumentKey needs a valid arXiv id and version.");
  return `arxiv:${parsed.id}v${parsed.version}`;
}

/** The inverse of linkedDocumentKey, or null for anything else (for instance a real sha256). */
export function parseLinkedDocumentKey(value: string): { id: string; version: number } | null {
  if (!value.startsWith("arxiv:")) return null;
  const parsed = parseArxivId(value.slice("arxiv:".length));
  return parsed && parsed.version !== null ? { id: parsed.id, version: parsed.version } : null;
}

const OPENALEX_WORK = /^[Ww]([1-9]\d{0,14})$/;

/** `W…` (or its canonical `https://openalex.org/W…` form) to `W…`, or null. */
export function parseOpenAlexId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().replace(/^https?:\/\/openalex\.org\//i, "");
  const match = OPENALEX_WORK.exec(value);
  return match ? `W${match[1]}` : null;
}

/** A PubMed id from `29456894`, `pmid:29456894` or a pubmed.ncbi.nlm.nih.gov link. */
export function normalisePmid(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw
    .trim()
    .replace(/^pmid:\s*/i, "")
    .replace(/^https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\//i, "")
    .replace(/\/$/, "");
  return /^[1-9]\d{0,9}$/.test(value) ? value : null;
}

/** A PMC id from `PMC5815332`, `5815332` or an ncbi.nlm.nih.gov/pmc/articles link. */
export function normalisePmcid(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw
    .trim()
    .replace(/^pmcid:\s*/i, "")
    .replace(/^https?:\/\/(?:www\.)?(?:ncbi\.nlm\.nih\.gov\/pmc\/articles|pmc\.ncbi\.nlm\.nih\.gov\/articles)\//i, "")
    .replace(/\/$/, "");
  const match = /^(?:pmc)?([1-9]\d{0,9})$/i.exec(value);
  return match ? `PMC${match[1]}` : null;
}

export function identifierKey(ref: IdentifierRef): string {
  return `${ref.scheme}:${ref.value}`;
}

/** Validates and normalises one identifier of a known scheme; null when the value is not valid. */
export function normaliseIdentifier(scheme: IdentifierScheme, raw: unknown): IdentifierRef | null {
  switch (scheme) {
    case "doi": {
      const value = normaliseDoi(raw);
      return value ? { scheme, value } : null;
    }
    case "arxiv": {
      const parsed = parseArxivId(raw);
      return parsed ? { scheme, value: parsed.id } : null;
    }
    case "openalex": {
      const value = parseOpenAlexId(raw);
      return value ? { scheme, value } : null;
    }
    case "pmid": {
      const value = normalisePmid(raw);
      return value ? { scheme, value } : null;
    }
    case "pmcid": {
      const value = normalisePmcid(raw);
      return value ? { scheme, value } : null;
    }
  }
}

export type RecognisedInput =
  | { kind: "empty" }
  | { kind: "doi"; doi: string; host: string | null }
  | { kind: "arxiv"; id: string; version: number | null; host: string | null }
  | { kind: "openalex"; id: string; host: string | null }
  /**
   * Words to search titles for. For a link with no identifier in it, `host` names the site (shown
   * to the owner) and `query` holds the words of the link's last path segment, possibly empty.
   * `invalidDoi` marks text shaped like a DOI (`doi:…`, or `10.` with a slash and no spaces) that is
   * not a valid one: it is not searched for as words.
   */
  | { kind: "search"; query: string; host: string | null; invalidDoi?: true };

/**
 * What the Find box was given: a DOI (bare, `doi:`, a doi.org link or any link whose path contains
 * a DOI), an arXiv id or arxiv.org abs/pdf link, an OpenAlex id or openalex.org link, or else words
 * to search for. No URL is fetched.
 */
export function recogniseInput(raw: unknown): RecognisedInput {
  if (typeof raw !== "string") return { kind: "empty" };
  const text = raw.slice(0, MAX_FIND_INPUT_LENGTH).trim();
  if (text.length === 0) return { kind: "empty" };

  if (/^https?:\/\//i.test(text)) {
    const url = parseLink(text);
    return url ? recogniseUrl(url) : { kind: "search", query: searchQuery(text), host: null };
  }
  // Bare identifiers before scheme-less links: `math.GT/0309136` looks like a host and a path.
  if (/^doi:/i.test(text) || text.startsWith("10.")) {
    const doi = normaliseDoi(text);
    if (doi) return { kind: "doi", doi, host: null };
    if (/^doi:/i.test(text) || /^10\.\S*\/\S*$/.test(text))
      return { kind: "search", query: searchQuery(text), host: null, invalidDoi: true };
  }
  const arxiv = parseArxivId(text);
  if (arxiv) return { kind: "arxiv", id: arxiv.id, version: arxiv.version, host: null };
  const openalex = parseOpenAlexId(text);
  if (openalex) return { kind: "openalex", id: openalex, host: null };
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}\//i.test(text)) {
    const url = parseLink(`https://${text}`);
    if (url) return recogniseUrl(url);
  }
  return { kind: "search", query: searchQuery(text), host: null };
}

/** Parses an http(s) link without whitespace; anything else is not a link. */
function parseLink(candidate: string): URL | null {
  if (/\s/.test(candidate)) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function recogniseUrl(url: URL): RecognisedInput {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = safeDecode(url.pathname);

  if (host === "doi.org" || host === "dx.doi.org") {
    const doi = normaliseDoi(path.replace(/^\/+/, ""));
    if (doi) return { kind: "doi", doi, host };
    return { kind: "search", query: "", host };
  }
  if (host === "arxiv.org" || host === "export.arxiv.org") {
    const match = /^\/(?:abs|pdf)\/(.+?)(?:\.pdf)?\/?$/i.exec(path);
    const parsed = match ? parseArxivId(match[1]) : null;
    if (parsed) return { kind: "arxiv", id: parsed.id, version: parsed.version, host };
  }
  if (host === "openalex.org" || host === "api.openalex.org") {
    const match = /^\/(?:works\/)?([Ww]\d+)\/?$/.exec(path);
    const id = match ? parseOpenAlexId(match[1]) : null;
    if (id) return { kind: "openalex", id, host };
  }
  const doiInPath = /(?:^|\/)(10\.\d{4,9}\/.+)$/.exec(path);
  if (doiInPath) {
    const doi = normaliseDoi(stripDoiSuffixes(doiInPath[1]!));
    if (doi) return { kind: "doi", doi, host };
  }
  return { kind: "search", query: slugWords(path), host };
}

/** Removes, in order, a trailing slash, `.pdf`, `.full` and a `vN` after a digit (bioRxiv style). */
function stripDoiSuffixes(value: string): string {
  let out = value.replace(/\/+$/, "");
  out = out.replace(/\.pdf$/i, "");
  out = out.replace(/\.full$/i, "");
  out = out.replace(/(\d)v\d{1,3}$/i, "$1");
  return out.replace(/\/+$/, "");
}

/** The words of a link's last path segment (`/blog/attention-is-all-you-need` → those words). */
function slugWords(path: string): string {
  const segment =
    path
      .split("/")
      .filter((s) => s.length > 0)
      .pop() ?? "";
  const words = segment
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .split(/[-_+.\s]+/)
    .filter((w) => /^[\p{L}][\p{L}\p{N}']*$/u.test(w));
  return words.length >= 2 ? searchQuery(words.join(" ")) : "";
}

function searchQuery(text: string): string {
  const collapsed = text.replace(new RegExp(UNSAFE_CHARS.source, "g"), " ").replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_SEARCH_QUERY_LENGTH) return collapsed;
  const cut = collapsed.slice(0, MAX_SEARCH_QUERY_LENGTH);
  const space = cut.lastIndexOf(" ");
  return space > MAX_SEARCH_QUERY_LENGTH / 2 ? cut.slice(0, space) : cut;
}

/** The shape of an OpenAlex work that carries identifiers (only these fields are read). */
export interface OpenAlexIdentitySource {
  id?: string | null;
  doi?: string | null;
  ids?: { openalex?: string | null; doi?: string | null; pmid?: string | null; pmcid?: string | null } | null;
  primary_location?: OpenAlexLocationIdentity | null;
  best_oa_location?: OpenAlexLocationIdentity | null;
  locations?: (OpenAlexLocationIdentity | null | undefined)[] | null;
}

interface OpenAlexLocationIdentity {
  id?: string | null;
  doi?: string | null;
}

const ARXIV_LOCATION_PREFIX = "pmh:oai:arxiv.org:";
const ARXIV_DOI_PREFIX = "10.48550/arxiv.";

/** The arXiv id inside an arXiv DataCite DOI (`10.48550/arxiv.2305.18290`), or null. */
export function arxivIdFromDoi(doi: string): string | null {
  if (!doi.startsWith(ARXIV_DOI_PREFIX)) return null;
  return parseArxivId(doi.slice(ARXIV_DOI_PREFIX.length))?.id ?? null;
}

/** The arXiv id of an OpenAlex location id (`pmh:oai:arXiv.org:2305.18290`), or null. */
export function arxivIdFromOpenAlexLocation(locationId: string | null | undefined): string | null {
  if (!locationId?.toLowerCase().startsWith(ARXIV_LOCATION_PREFIX)) return null;
  return parseArxivId(locationId.slice(ARXIV_LOCATION_PREFIX.length))?.id ?? null;
}

/**
 * Every identifier an OpenAlex work carries: its W, every DOI (the work's and its locations'),
 * arXiv ids from arXiv DataCite DOIs and from `pmh:oai:arXiv.org:` location ids, PubMed and PMC ids.
 * OpenAlex has no `ids.arxiv`, so the locations are the only place arXiv appears.
 */
export function identifiersFromOpenAlex(work: OpenAlexIdentitySource): IdentifierRef[] {
  const out = new IdentifierSet();
  out.add(normaliseIdentifier("openalex", work.id ?? work.ids?.openalex));
  const locations = [work.primary_location, work.best_oa_location, ...(work.locations ?? [])].filter(
    (l): l is OpenAlexLocationIdentity => !!l,
  );
  const dois = [work.doi, work.ids?.doi, ...locations.map((l) => l.doi), ...locations.map((l) => doiFromLocationId(l.id))];
  for (const raw of dois) {
    const doi = normaliseDoi(raw);
    if (!doi) continue;
    out.add({ scheme: "doi", value: doi });
    const arxiv = arxivIdFromDoi(doi);
    if (arxiv) out.add({ scheme: "arxiv", value: arxiv });
  }
  for (const location of locations) {
    const arxiv = arxivIdFromOpenAlexLocation(location.id);
    if (arxiv) out.add({ scheme: "arxiv", value: arxiv });
  }
  out.add(normaliseIdentifier("pmid", work.ids?.pmid));
  out.add(normaliseIdentifier("pmcid", work.ids?.pmcid));
  return out.sorted();
}

function doiFromLocationId(id: string | null | undefined): string | null {
  return id?.toLowerCase().startsWith("doi:") ? id.slice(4) : null;
}

/** Identifiers of an arXiv record: the id (without version) and any DOI the authors supplied. */
export function identifiersFromArxiv(entry: { id: string; doi?: string | null }): IdentifierRef[] {
  const out = new IdentifierSet();
  out.add(normaliseIdentifier("arxiv", entry.id));
  for (const token of (entry.doi ?? "").split(/[\s,;]+/)) {
    const doi = normaliseDoi(token);
    if (doi) out.add({ scheme: "doi", value: doi });
  }
  return out.sorted();
}

const SCHEME_ORDER: Record<IdentifierScheme, number> = { openalex: 0, doi: 1, arxiv: 2, pmid: 3, pmcid: 4 };

class IdentifierSet {
  private readonly seen = new Map<string, IdentifierRef>();
  add(ref: IdentifierRef | null): void {
    if (ref && !this.seen.has(identifierKey(ref))) this.seen.set(identifierKey(ref), ref);
  }
  sorted(): IdentifierRef[] {
    return [...this.seen.values()].sort((a, b) => SCHEME_ORDER[a.scheme] - SCHEME_ORDER[b.scheme] || compare(a.value, b.value));
  }
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
