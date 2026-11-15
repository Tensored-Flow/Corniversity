/**
 * Builds the reader's document info (info.ts) from the reader loader's rows. Pure: the page calls it
 * on the server and the unit tests call it directly. Identifier links are built only from values that
 * pass core's parsers, so a stored value can never become an arbitrary link.
 */

import { arxivAbsUrl, normaliseDoi, parseArxivId, parseOpenAlexId } from "@corniversity/core/scholarly/identifiers";
import { classifyLicence, isoDay, type LicenceSource, licenceAttribution } from "@corniversity/core/scholarly/licence";
import type { ReaderDocumentInfo, ReaderPaperInfo, ReaderVersionInfo } from "./info";
import { arxivAbstractUrl, arxivPdfUrl } from "./loader";
import { laterVersions } from "./rules";

/** The rows the builder reads (a subset of the reader loader's result). */
export interface DocumentInfoInput {
  asset: { id: string; sha256: string; status: string; pageCount: number | null; filename: string };
  work: {
    id: string;
    title: string | null;
    authors: { name: string }[];
    publicationYear: number | null;
    venue: string | null;
    provenance: Partial<Record<string, { source: string; retrievedAt: string }>>;
  } | null;
  identifiers: { scheme: string; value: string; source: string; status: string }[];
  version: {
    label: string;
    versionDate: Date | null;
    withdrawn: boolean;
    licence: string | null;
    licenceSource: LicenceSource | null;
    licenceRetrievedAt: Date | null;
    source: string;
  } | null;
  arxiv: { id: string; version: number } | null;
  arxivVersions: { version: number; label: string; withdrawn: boolean }[];
}

const SOURCE_NAMES: Record<string, string> = {
  openalex: "OpenAlex",
  arxiv: "arXiv",
  crossref: "Crossref",
  owner: "you",
  fixture: "recorded fixtures",
};

const SCHEME_LABELS: Record<string, string> = { doi: "DOI", arxiv: "arXiv", openalex: "OpenAlex", pmid: "PubMed", pmcid: "PMC" };

/** A link for an identifier, only when its value is the normal form core's parsers give. */
export function identifierHref(scheme: string, value: string): string | null {
  switch (scheme) {
    case "doi": {
      if (normaliseDoi(value) !== value) return null;
      return `https://doi.org/${value.split("/").map(encodeURIComponent).join("/")}`;
    }
    case "arxiv": {
      const parsed = parseArxivId(value);
      return parsed && parsed.version === null && parsed.id === value ? arxivAbsUrl(value) : null;
    }
    case "openalex":
      return parseOpenAlexId(value) === value ? `https://openalex.org/${value}` : null;
    case "pmid":
      return /^\d{1,9}$/.test(value) ? `https://pubmed.ncbi.nlm.nih.gov/${value}/` : null;
    case "pmcid":
      return /^PMC\d{1,9}$/.test(value) ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${value}/` : null;
    default:
      return null;
  }
}

function paperInfo(work: NonNullable<DocumentInfoInput["work"]>, identifiers: DocumentInfoInput["identifiers"]): ReaderPaperInfo {
  const seen = new Set<string>();
  const sources: ReaderPaperInfo["sources"] = [];
  for (const entry of Object.values(work.provenance)) {
    if (!entry) continue;
    const day = isoDay(entry.retrievedAt);
    const name = SOURCE_NAMES[entry.source] ?? entry.source;
    const key = `${name}|${day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ name, day });
  }
  const current = identifiers.filter((i) => i.status === "current");
  return {
    workId: work.id,
    title: work.title,
    authors: work.authors.map((a) => a.name),
    year: work.publicationYear,
    venue: work.venue,
    sources,
    fixture: Object.values(work.provenance).some((p) => p?.source === "fixture") || current.some((i) => i.source === "fixture"),
    identifiers: current.map((i) => ({
      label: SCHEME_LABELS[i.scheme] ?? i.scheme,
      value: i.value,
      href: identifierHref(i.scheme, i.value),
    })),
    href: `/library/papers/${work.id}`,
  };
}

function versionInfo(input: DocumentInfoInput): ReaderVersionInfo | null {
  const version = input.version;
  if (!version) return null;
  const arxiv = input.arxiv;
  const later = arxiv ? laterVersions(arxiv.version, input.arxivVersions) : { newest: null, withdrawn: [] };
  let licence: ReaderVersionInfo["licence"] = null;
  if (version.licence && version.licenceSource) {
    const classified = classifyLicence(version.licence, version.licenceSource);
    licence = {
      name: classified.name ?? version.licence,
      attribution: licenceAttribution(version.licenceSource, version.licenceRetrievedAt),
    };
  }
  return {
    label: version.label,
    date: isoDay(version.versionDate),
    withdrawn: version.withdrawn,
    licence,
    arxiv: arxiv
      ? {
          id: arxiv.id,
          version: arxiv.version,
          display: `${arxiv.id}v${arxiv.version}`,
          absUrl: arxivAbstractUrl(arxiv.id, arxiv.version),
          pdfUrl: arxivPdfUrl(arxiv.id, arxiv.version),
        }
      : null,
    newest: later.newest ? { version: later.newest.version, label: later.newest.label } : null,
    withdrawnLater: later.withdrawn.map((v) => ({ version: v.version, label: v.label })),
  };
}

export function documentInfo(input: DocumentInfoInput): ReaderDocumentInfo {
  return {
    documentKey: input.asset.sha256,
    linked: input.asset.status === "linked_remote",
    pageCount: input.asset.pageCount,
    paper: input.work ? paperInfo(input.work, input.identifiers) : null,
    version: versionInfo(input),
    item: { filename: input.asset.filename, href: `/library/items/${input.asset.id}` },
  };
}
