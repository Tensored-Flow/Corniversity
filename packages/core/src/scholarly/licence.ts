/**
 * Licence classification for scholarly versions. Exact and table-driven: a value is normalised
 * (scheme, `www.`, trailing slash, `legalcode`/`deed.xx` suffix, query, case) and then looked up as a
 * whole. Nothing is matched by prefix or substring, so `cc-by-nc-nd` can never pass for `cc-by`.
 *
 * Only a licence reported by arXiv OAI-PMH for an exact arXiv version can make a private copy
 * possible (`storageDecision`); OpenAlex and Crossref licences are display-only ("as reported by
 * OpenAlex for this location").
 */

export type LicenceClass = "open" | "open_nc_nd" | "arxiv_nonexclusive" | "restricted" | "unknown";
export type LicenceSource = "arxiv-oai" | "openalex" | "crossref" | "owner";

export interface LicenceClassification {
  class: LicenceClass;
  /** A human name for a recognised licence ("CC BY 4.0"), or null. */
  name: string | null;
}

const UNKNOWN: LicenceClassification = { class: "unknown", name: null };

const CC_TYPES: Record<string, { class: LicenceClass; label: string }> = {
  by: { class: "open", label: "CC BY" },
  "by-sa": { class: "open", label: "CC BY-SA" },
  "by-nc": { class: "open_nc_nd", label: "CC BY-NC" },
  "by-nd": { class: "open_nc_nd", label: "CC BY-ND" },
  "by-nc-sa": { class: "open_nc_nd", label: "CC BY-NC-SA" },
  "by-nc-nd": { class: "open_nc_nd", label: "CC BY-NC-ND" },
  "by-nd-nc": { class: "open_nc_nd", label: "CC BY-ND-NC" },
};
/** Creative Commons licence URLs after normalisation, versions 1.0–4.0, 2.x/3.0 jurisdiction ports. */
const CC_LICENCE = /^creativecommons\.org\/licenses\/([a-z-]+)\/(1\.0|2\.0|2\.1|2\.5|3\.0|4\.0)(?:\/([a-z]{2}|igo))?$/;

/** Whole normalised URLs (no version or port variation) and what they are. */
const EXACT_URLS: Record<string, LicenceClassification> = {
  "creativecommons.org/publicdomain/zero/1.0": { class: "open", name: "CC0 1.0" },
  "creativecommons.org/publicdomain/mark/1.0": { class: "open", name: "Public Domain Mark 1.0" },
  "creativecommons.org/licenses/publicdomain": { class: "open", name: "Creative Commons public domain dedication" },
  "arxiv.org/licenses/nonexclusive-distrib/1.0": {
    class: "arxiv_nonexclusive",
    name: "arXiv non-exclusive licence to distribute",
  },
  "arxiv.org/licenses/assumed-1991-2003": {
    class: "arxiv_nonexclusive",
    name: "arXiv licence assumed for 1991–2003 submissions (no explicit licence)",
  },
};

/** OpenAlex licence tokens (the live /licenses vocabulary, 2026-11-15). */
const OPENALEX_TOKENS: Record<string, LicenceClassification> = {
  "cc-by": { class: "open", name: "CC BY" },
  "cc-by-sa": { class: "open", name: "CC BY-SA" },
  "public-domain": { class: "open", name: "Public domain" },
  "cc-by-nc": { class: "open_nc_nd", name: "CC BY-NC" },
  "cc-by-nd": { class: "open_nc_nd", name: "CC BY-ND" },
  "cc-by-nc-sa": { class: "open_nc_nd", name: "CC BY-NC-SA" },
  "cc-by-nc-nd": { class: "open_nc_nd", name: "CC BY-NC-ND" },
  "publisher-specific-oa": { class: "restricted", name: "Publisher-specific licence" },
  mit: { class: "restricted", name: "MIT (software licence)" },
  "apache-2-0": { class: "restricted", name: "Apache 2.0 (software licence)" },
  "gpl-v2": { class: "restricted", name: "GPL v2 (software licence)" },
  "gpl-v3": { class: "restricted", name: "GPL v3 (software licence)" },
  isc: { class: "restricted", name: "ISC (software licence)" },
  "other-oa": { class: "unknown", name: "Other open-access licence (unspecified)" },
};

/** Normalises a licence URL for exact lookup; null when the value is not URL-like. */
export function normaliseLicenceUrl(value: string): string | null {
  let v = value.trim().toLowerCase();
  if (!/^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\//.test(v)) return null;
  v = v.replace(/^https?:\/\//, "").replace(/^www\./, "");
  v = v.replace(/[?#].*$/, "").replace(/\/+$/, "");
  v = v.replace(/\/(?:legalcode(?:\.[a-z]{2,3}(?:[-_][a-z]{2,4})?)?(?:\.txt)?|deed\.[a-z]{2,3}(?:[-_][a-z]{2,4})?)$/, "");
  return v.replace(/\/+$/, "");
}

function classifyUrl(normalised: string): LicenceClassification | null {
  const exact = EXACT_URLS[normalised];
  if (exact) return exact;
  const cc = CC_LICENCE.exec(normalised);
  if (!cc) return null;
  const [, type, version, port] = cc;
  const known = CC_TYPES[type!];
  if (!known || (port && version === "4.0")) return null;
  return { class: known.class, name: `${known.label} ${version}${port ? ` (${port.toUpperCase()})` : ""}` };
}

function classifyToken(value: string): LicenceClassification | null {
  const token = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/openalex\.org\/licenses\//, "");
  return OPENALEX_TOKENS[token] ?? null;
}

/**
 * Classifies a licence value from a named source. arXiv OAI-PMH gives licence URLs (anything not in
 * the table is unknown); OpenAlex gives tokens; a Crossref licence URL that is not a recognised open
 * licence is the publisher's own (restricted). A missing value is unknown.
 */
export function classifyLicence(value: string | null | undefined, source: LicenceSource): LicenceClassification {
  if (typeof value !== "string" || value.trim().length === 0) return UNKNOWN;
  const normalised = normaliseLicenceUrl(value);
  const url = normalised ? classifyUrl(normalised) : null;
  switch (source) {
    case "arxiv-oai":
      return url ?? UNKNOWN;
    case "openalex":
      return classifyToken(value) ?? url ?? UNKNOWN;
    case "crossref":
      if (!normalised) return UNKNOWN;
      return url ?? { class: "restricted", name: "Publisher licence" };
    case "owner":
      return url ?? classifyToken(value) ?? UNKNOWN;
  }
}

export interface CrossrefLicenceEntry {
  URL?: string | null;
  "content-version"?: string | null;
  "delay-in-days"?: number | null;
  start?: { "date-time"?: string | null } | null;
}

/**
 * The licence Crossref reports for a work, for display only: entries count only for the version of
 * record (`vor`) or accepted manuscript (`am`) once their embargo (start + delay) has passed; TDM and
 * unspecified entries never count. When the counted entries disagree, the licence is unknown.
 */
export function crossrefLicence(
  entries: readonly CrossrefLicenceEntry[] | null | undefined,
  now: Date,
): LicenceClassification & { url: string | null } {
  const applicable: { url: string; classification: LicenceClassification }[] = [];
  for (const entry of entries ?? []) {
    const version = entry["content-version"];
    if (version !== "vor" && version !== "am") continue;
    const start = entry.start?.["date-time"] ? Date.parse(entry.start["date-time"]) : Number.NaN;
    if (!Number.isFinite(start)) continue;
    const delay = typeof entry["delay-in-days"] === "number" && entry["delay-in-days"] > 0 ? entry["delay-in-days"] : 0;
    if (start + delay * 86_400_000 > now.getTime()) continue;
    if (!entry.URL) continue;
    applicable.push({ url: entry.URL, classification: classifyLicence(entry.URL, "crossref") });
  }
  if (applicable.length === 0) return { ...UNKNOWN, url: null };
  // Agreement means the same licence, not merely the same class: CC BY with CC BY-SA, or two
  // different publisher licences, disagree and the result is unknown.
  const first = applicable[0]!;
  const key = (url: string) => normaliseLicenceUrl(url) ?? url;
  const agree = applicable.every((a) => a.classification.class === first.classification.class && key(a.url) === key(first.url));
  return agree ? { ...first.classification, url: first.url } : { ...UNKNOWN, url: null };
}

export interface VersionLicenceFacts {
  arxivId: string | null;
  arxivVersion: number | null;
  licence: string | null;
  licenceSource: LicenceSource | null;
  licenceRetrievedAt: Date | string | null;
  withdrawn?: boolean;
}

export type StorageDecision =
  | { privateCopy: true; licenceClass: "open"; licenceName: string; retrievedOn: string }
  | { privateCopy: false; licenceClass: LicenceClass; reason: string };

/** YYYY-MM-DD (UTC) of a date or ISO string; null when it is not a valid date. */
export function isoDay(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/**
 * Whether Corniversity may keep a private copy of this version: only for an open licence (CC BY,
 * CC BY-SA, CC0, public domain) that arXiv OAI-PMH reported for this exact arXiv version, on a
 * version that is not withdrawn.
 */
export function storageDecision(version: VersionLicenceFacts): StorageDecision {
  const source = version.licenceSource;
  const classification = source ? classifyLicence(version.licence, source) : UNKNOWN;
  const refuse = (reason: string): StorageDecision => ({ privateCopy: false, licenceClass: classification.class, reason });
  // arXiv's administrators also withdraw versions, so the reason does not say who withdrew it.
  if (version.withdrawn) return refuse("This version was withdrawn on arXiv, so Corniversity keeps no copy of it.");
  if (!version.arxivId || !version.arxivVersion)
    return refuse("Private copies are kept only for an exact arXiv version whose licence arXiv reports.");
  if (source === "openalex" || source === "crossref") {
    const provider = source === "openalex" ? "OpenAlex" : "Crossref";
    return refuse(`This licence is as reported by ${provider}; it is shown for information and does not permit a private copy.`);
  }
  if (source !== "arxiv-oai" || !version.licence)
    return refuse("arXiv has not reported a licence for this version, so it stays reference-only.");
  const retrievedOn = isoDay(version.licenceRetrievedAt);
  if (!retrievedOn) return refuse("The licence has no retrieval date, so it cannot be the basis of a private copy.");
  switch (classification.class) {
    case "open":
      return { privateCopy: true, licenceClass: "open", licenceName: classification.name ?? version.licence, retrievedOn };
    case "arxiv_nonexclusive":
      return refuse("arXiv's licence for this version does not permit Corniversity to store a copy; it is read from arxiv.org.");
    case "open_nc_nd":
      return refuse(
        `${classification.name ?? "This licence"} carries non-commercial or no-derivatives terms; Corniversity keeps private copies only under CC BY, CC BY-SA, CC0 or public domain.`,
      );
    default:
      return refuse("This licence is not one Corniversity recognises as open, so the version stays reference-only.");
  }
}

/** How a licence is attributed when shown ("as reported by OpenAlex for this location"). */
export function licenceAttribution(source: LicenceSource, retrievedAt?: Date | string | null): string {
  const day = isoDay(retrievedAt ?? null);
  const on = day ? ` on ${day}` : "";
  switch (source) {
    case "arxiv-oai":
      return `as reported by arXiv OAI-PMH${on}`;
    case "openalex":
      return `as reported by OpenAlex for this location${on}`;
    case "crossref":
      return `as reported by Crossref for the publisher's version${on}`;
    case "owner":
      return "as stated by you";
  }
}
