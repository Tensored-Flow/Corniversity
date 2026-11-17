import { arxivAbsUrl, type IdentifierScheme, isoDay, normaliseIdentifier } from "@corniversity/core";
import type { PaperListKind } from "@corniversity/db/services/paper-lists";

/**
 * Pure wording and links for papers (Find, the preview, the paper page). Provider values arrive
 * here already as plain text (`providerText`); these helpers only arrange them and say whose report
 * each one is. Links are built from validated identifiers, never from provider URLs.
 */

export type DataSource = "openalex" | "arxiv" | "crossref" | "fixture" | "owner";

const SOURCE_NAMES: Record<DataSource, string> = {
  openalex: "OpenAlex",
  arxiv: "arXiv",
  crossref: "Crossref",
  fixture: "fixture data",
  owner: "you",
};

export function sourceName(source: string): string {
  return SOURCE_NAMES[source as DataSource] ?? source;
}

/** "as reported by OpenAlex, retrieved 2026-11-15"; fixture data says so; the owner's own value says "edited by you". */
export function reportedBy(source: string, retrievedAt?: Date | string | null): string {
  const day = isoDay(retrievedAt ?? null);
  if (source === "owner") return day ? `edited by you on ${day}` : "edited by you";
  if (source === "fixture") return day ? `fixture data recorded on ${day}` : "fixture data";
  return `as reported by ${sourceName(source)}${day ? `, retrieved ${day}` : ""}`;
}

/** The one line under a paper's details naming whose report they are ("Details as reported by OpenAlex, retrieved …"). */
export function detailsSentence(source: string, retrievedAt?: Date | string | null): string {
  if (source === "fixture") return `Details: ${reportedBy(source, retrievedAt)}.`;
  return `Details ${reportedBy(source, retrievedAt)}.`;
}

/** "Rafael Rafailov, Archit Sharma, Eric Mitchell et al." (the first `max` names). */
export function authorLine(authors: readonly { name: string }[], max = 3): string {
  const names = authors.map((a) => a.name).filter(Boolean);
  if (names.length === 0) return "";
  return names.length > max ? `${names.slice(0, max).join(", ")} et al.` : names.join(", ");
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A day as "29 May 2023"; a year alone as "2023"; nothing as null. */
export function dateLabel(input: { date: string | null; year: number | null; precision: "day" | "year" | null }): string | null {
  const match = input.date ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date) : null;
  if (match && input.precision !== "year") return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
  if (input.year !== null) return String(input.year);
  return match ? match[1]! : null;
}

/** The date with what is known of it: "29 May 2023" or "2023 (year only)". */
export function dateWithPrecision(input: { date: string | null; year: number | null; precision: "day" | "year" | null }): string | null {
  const label = dateLabel(input);
  if (!label) return null;
  return input.date && input.precision !== "year" ? label : `${label} (year only)`;
}

const ABSTRACT_LABELS: Record<string, string> = {
  openalex: "Abstract as indexed by OpenAlex",
  arxiv: "Abstract from arXiv",
  crossref: "Abstract as deposited with Crossref",
  owner: "Abstract written by you",
};

export function abstractLabel(source: string | null): string {
  return (source && ABSTRACT_LABELS[source]) || "Abstract";
}

/** "Conference paper (as reported)": a provider's type token in words. */
export function typeLabel(workType: string | null): string | null {
  if (!workType) return null;
  const words = workType.replace(/-/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}

const SCHEME_LABELS: Record<IdentifierScheme, string> = { doi: "DOI", arxiv: "arXiv", openalex: "OpenAlex", pmid: "PubMed", pmcid: "PMC" };

export function schemeLabel(scheme: string): string {
  return SCHEME_LABELS[scheme as IdentifierScheme] ?? scheme;
}

const encodePath = (value: string) => value.split("/").map(encodeURIComponent).join("/");

/** The identifier's own page at its registry, built from the validated value (null for anything invalid). */
export function identifierHref(scheme: string, value: string): string | null {
  const ref = normaliseIdentifier(scheme as IdentifierScheme, value);
  if (!ref) return null;
  switch (ref.scheme) {
    case "doi":
      return `https://doi.org/${encodePath(ref.value)}`;
    case "arxiv":
      return arxivAbsUrl(ref.value);
    case "openalex":
      return `https://openalex.org/${ref.value}`;
    case "pmid":
      return `https://pubmed.ncbi.nlm.nih.gov/${ref.value}/`;
    case "pmcid":
      return `https://www.ncbi.nlm.nih.gov/pmc/articles/${ref.value}/`;
  }
}

/** The preview of a paper not in the library (`/library/works/doi|arxiv|openalex/<value>`). */
export function previewHref(scheme: "doi" | "arxiv" | "openalex", value: string): string {
  return `/library/works/${scheme}/${encodePath(value)}`;
}

export function paperHref(workId: string): string {
  return `/library/papers/${workId}`;
}

export function displayIdentifier(scheme: string, value: string): string {
  return scheme === "arxiv" ? `arXiv:${value}` : scheme === "doi" ? `doi:${value}` : value;
}

const INTEGRITY_TYPES: Record<string, string> = {
  retraction: "Retraction",
  correction: "Correction",
  expression_of_concern: "Expression of concern",
  withdrawal: "Withdrawal",
};
const INTEGRITY_SOURCES: Record<string, string> = {
  crossref: "Crossref",
  "retraction-watch": "Retraction Watch (through Crossref)",
  openalex: "OpenAlex",
  arxiv: "arXiv",
};

export function integrityType(type: string): string {
  return INTEGRITY_TYPES[type] ?? type;
}

export function integritySource(source: string): string {
  return INTEGRITY_SOURCES[source] ?? source;
}

const VERSION_WORDS: Record<string, string> = {
  submittedVersion: "submitted version (preprint)",
  acceptedVersion: "accepted manuscript",
  publishedVersion: "published version",
};

/** "PeerJ, published version": where an open copy is and which version OpenAlex says it is. */
export function locationLabel(location: {
  sourceName: string | null;
  landingPageUrl: string | null;
  pdfUrl: string | null;
  version: string | null;
}): string {
  const url = location.pdfUrl ?? location.landingPageUrl;
  let host: string | null = null;
  if (url) {
    try {
      host = new URL(url).hostname;
    } catch {
      host = null;
    }
  }
  const where = location.sourceName ?? host ?? "an open location";
  const version = location.version ? VERSION_WORDS[location.version] : null;
  return version ? `${where}, ${version}` : `${where}, version not reported`;
}

/** "It resets at 2026-11-16 00:00 UTC." for an exhausted allowance, or nothing when the provider gave no time. */
export function resetSentence(resetAt: Date | string | null | undefined): string | null {
  if (!resetAt) return null;
  const date = resetAt instanceof Date ? resetAt : new Date(resetAt);
  return Number.isNaN(date.getTime()) ? null : `It resets at ${date.toISOString().slice(0, 16).replace("T", " ")} UTC.`;
}

/** "1,234". */
export function count(n: number): string {
  return n.toLocaleString("en-GB");
}

/** "1 page", "12 pages", "1,204 pages". */
export function pages(n: number): string {
  return n === 1 ? "1 page" : `${count(n)} pages`;
}

/**
 * What OpenAlex counted for a paper's list, how many records it returned, and how many of them
 * are listed (at most fifty): never presented as complete.
 */
export function listCountSentence(
  kind: PaperListKind,
  list: { total: number | null; returned: number; listed: number; missing: number },
): string {
  const { total, returned, listed, missing } = list;
  const unmatched = missing ? `; ${count(missing)} listed without a record OpenAlex could return` : "";
  const cut = listed < returned ? `; the first ${count(listed)} are listed` : "";
  if (kind === "references") {
    if (!total) return "OpenAlex lists no references for this paper (its reference lists are incomplete for some fields).";
    return `OpenAlex lists ${count(total)} references and returned records for ${count(returned)}${unmatched}${cut}. OpenAlex's reference lists are incomplete for some fields.`;
  }
  if (kind === "cited_by") {
    if (!total) return "OpenAlex records no works citing this paper.";
    return `${count(total)} works cite this paper according to OpenAlex; the ${count(listed)} most cited of them are listed, most cited first.`;
  }
  if (!total) return "OpenAlex lists no related works.";
  return `Similar according to OpenAlex (similarity, not citation): ${count(total)} works, ${count(returned)} with records${unmatched}${cut}.`;
}

/** *Show more* for a list: how many it then shows, of how many there are ("Show more (50 of 77)"). */
export function showMoreLabel(kind: PaperListKind, list: { total: number | null; returned: number; listed: number }): string {
  const available = Math.max(list.listed, kind === "cited_by" ? (list.total ?? list.listed) : list.returned);
  return list.listed < available ? `Show more (${count(list.listed)} of ${count(available)})` : `Show more (all ${count(list.listed)})`;
}

/** Where a rejected file is removed, on the paper page. */
const REMOVE = "Remove this file under Permissions and removal";

/**
 * Why a paper's file was rejected, in the page's own words (the worker's reason, a parser's message,
 * is never shown raw on the paper page), and what can be done next: a PDF longer than the extraction
 * limit or protected by a password is a readable PDF, so only an unreadable one is told to be replaced
 * by "a copy that opens".
 */
export function rejectionText(reason: string | null): { text: string; next: string } {
  if (reason?.startsWith("The PDF could not be parsed")) {
    const pages = /(\d+) pages exceeds the (\d+)-page limit/.exec(reason);
    if (pages)
      return {
        text: `This PDF has ${count(Number(pages[1]))} pages, more than the ${count(Number(pages[2]))} whose text is extracted here, so its text was not extracted.`,
        next: `${REMOVE}; a shorter part of it, such as one chapter, can be attached instead.`,
      };
    if (/No password given|Incorrect Password/i.test(reason))
      return {
        text: "This PDF is protected by a password, so its text was not extracted.",
        next: `${REMOVE}, then attach a copy without a password.`,
      };
    return {
      text: "This file could not be read as a PDF, so its text was not extracted.",
      next: `${REMOVE}, then attach a copy that opens.`,
    };
  }
  if (reason === "stored bytes missing")
    return { text: "This file's stored bytes are missing, so its text could not be extracted.", next: `${REMOVE}, then attach it again.` };
  return { text: "This file could not be processed; the Jobs page has the details.", next: `${REMOVE}, then attach a copy that opens.` };
}

/**
 * What *Read* says under a paper with no file here and no arXiv version, besides its links: that
 * OpenAlex reports no free copy, or, for a paper with no identifier a provider can look up (and so
 * no record, no failure and no publisher link), that where it can be read is not known. Never an
 * empty block.
 */
export function readElsewhereNote(facts: { record: boolean; openCopy: boolean; publisher: boolean; failed: boolean }): string | null {
  if (facts.record && !facts.openCopy) return "OpenAlex reports no free-to-read copy.";
  if (!facts.record && !facts.failed && !facts.publisher)
    return "No file of this paper can be read here, and it has no identifier a provider can look up, so where it can be read is not known.";
  return null;
}

/** A Find page of OpenAlex's results as the page states it. */
export interface ResultsSummary {
  /** The line above the results. */
  line: string;
  /** Past the last page: the page to go back to (the last one OpenAlex's count allows, else the first). */
  goTo: number | null;
}

/**
 * The line above a Find page of OpenAlex's word search: the results shown and OpenAlex's count; past
 * the last page (an edited address, or a count that changed between cached pages), that this page is
 * empty while OpenAlex still counts results, with the page to go back to; and only when OpenAlex
 * counts nothing at all, that it found no papers. Never "no results" for a page past the end.
 */
export function resultsSummary(page: {
  page: number;
  perPage: number;
  lastPage: number;
  count: number | null;
  shown: number;
}): ResultsSummary {
  const first = (page.page - 1) * page.perPage + 1;
  if (page.shown > 0) {
    const last = first + page.shown - 1;
    return {
      line: `Results ${count(first)}–${count(last)}${page.count !== null ? ` of ${count(page.count)}` : ""} according to OpenAlex`,
      goTo: null,
    };
  }
  const pastEnd = (page.count ?? 0) > 0 || (page.count === null && page.page > 1);
  if (!pastEnd) return { line: "OpenAlex found no papers for these words and filters.", goTo: null };
  const back = page.count !== null ? Math.max(1, Math.min(page.lastPage, page.page - 1)) : 1;
  return {
    line: `No results on page ${count(page.page)}${page.count !== null ? `; OpenAlex counts ${count(page.count)} for these words and filters` : ""}.`,
    goTo: back !== page.page ? back : null,
  };
}
