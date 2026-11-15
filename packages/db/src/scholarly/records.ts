import { identifiersFromArxiv } from "@corniversity/core/scholarly/index";
import type {
  ArxivEntry,
  ArxivRawRecord,
  CrossrefWork,
  IntegrityNotice,
  OpenAlexWorkRecord,
  Provenance,
  ScholarlyField,
  ScholarlyRecord,
} from "./types";

/**
 * Maps each provider's normalised response to a ScholarlyRecord. Each field's provenance names the
 * provider (or `fixture`) and the retrieval time of the response it came from. Nothing is inferred:
 * a field the provider does not report stays null or empty.
 */

function provenanceFor(record: Omit<ScholarlyRecord, "fieldProvenance">, provenance: Provenance): ScholarlyRecord["fieldProvenance"] {
  const stamp = { source: provenance.source, retrievedAt: provenance.retrievedAt };
  const present: Record<ScholarlyField, boolean> = {
    title: record.title !== null,
    authors: record.authors.length > 0,
    abstract: record.abstract !== null,
    publicationYear: record.publicationYear !== null,
    publicationDate: record.publicationDate !== null,
    venue: record.venue !== null,
    workType: record.workType !== null,
    subjects: record.subjects.length > 0,
    referencedOpenAlexIds: record.referencesRetrieved,
  };
  const out: ScholarlyRecord["fieldProvenance"] = {};
  for (const field of Object.keys(present) as ScholarlyField[]) if (present[field]) out[field] = stamp;
  return out;
}

function withProvenance(record: Omit<ScholarlyRecord, "fieldProvenance">): ScholarlyRecord {
  return { ...record, fieldProvenance: provenanceFor(record, record.provenance) };
}

/**
 * From an OpenAlex work. OpenAlex's own retraction flag becomes a notice from source `openalex`
 * (a hint; Crossref notices carry the detail). OpenAlex arXiv locations add the arXiv identifier only:
 * versions come from arXiv.
 */
export function scholarlyRecordFromOpenAlex(work: OpenAlexWorkRecord): ScholarlyRecord {
  const notices: IntegrityNotice[] = work.isRetracted
    ? [
        {
          type: "retraction",
          source: "openalex",
          concerns: work.doi ?? work.openalexId,
          label: "OpenAlex marks this work as retracted",
          retrievedAt: work.provenance.retrievedAt,
        },
      ]
    : [];
  return withProvenance({
    provenance: work.provenance,
    identifiers: work.identifiers,
    title: work.title,
    authors: work.authors,
    abstract: work.abstract,
    abstractSource: work.abstract ? "openalex" : null,
    publicationYear: work.publicationYear,
    publicationDate: work.publicationDate,
    publicationDatePrecision: work.publicationDatePrecision,
    venue: work.venue,
    workType: work.workType,
    subjects: work.subjects,
    referencedOpenAlexIds: work.referencedOpenAlexIds,
    // List items carry no reference list (it is not selected), so only full records count as retrieved.
    referencesRetrieved: work.referencedWorksCount !== null,
    integrityNotices: notices,
    versions: [],
  });
}

/**
 * From an arXiv export API entry and, when fetched, its OAI-PMH arXivRaw record (versions, the licence
 * of the last listed version, withdrawals). Dates are arXiv's: the year and day of v1.
 */
export function scholarlyRecordFromArxiv(entry: ArxivEntry, raw?: ArxivRawRecord | null): ScholarlyRecord {
  if (raw && raw.id !== entry.id) throw new Error("The arXivRaw record belongs to a different paper.");
  const published = entry.published ? new Date(entry.published) : null;
  const versions = raw?.versions ?? [];
  const notices: IntegrityNotice[] = versions
    .filter((v) => v.withdrawn)
    .map((v) => ({
      type: "withdrawal" as const,
      source: "arxiv" as const,
      concerns: `arXiv:${v.arxivId}v${v.version}`,
      ...(v.date ? { date: v.date.slice(0, 10) } : {}),
      label: "Withdrawn on arXiv",
      retrievedAt: raw!.provenance.retrievedAt,
    }));
  return withProvenance({
    provenance: entry.provenance,
    identifiers: identifiersFromArxiv({ id: entry.id, doi: entry.doi }),
    title: entry.title,
    authors: entry.authors.map((a) => ({ name: a.name })),
    abstract: entry.abstract,
    abstractSource: entry.abstract ? "arxiv" : null,
    publicationYear: published ? published.getUTCFullYear() : null,
    publicationDate: published ? published.toISOString().slice(0, 10) : null,
    publicationDatePrecision: published ? "day" : null,
    venue: null,
    workType: null,
    subjects: [],
    referencedOpenAlexIds: [],
    referencesRetrieved: false,
    integrityNotices: notices,
    versions,
  });
}

/** From a Crossref work: a full issued date has day precision; a partial one gives the year only. */
export function scholarlyRecordFromCrossref(work: CrossrefWork): ScholarlyRecord {
  const issued = work.issued;
  const fullDate =
    issued?.month && issued.day
      ? `${String(issued.year).padStart(4, "0")}-${String(issued.month).padStart(2, "0")}-${String(issued.day).padStart(2, "0")}`
      : null;
  const title = work.title && work.subtitle ? `${work.title}: ${work.subtitle}` : work.title;
  return withProvenance({
    provenance: work.provenance,
    identifiers: [{ scheme: "doi", value: work.doi }],
    title,
    authors: work.authors,
    abstract: work.abstract,
    abstractSource: work.abstract ? "crossref" : null,
    publicationYear: issued?.year ?? null,
    publicationDate: fullDate,
    publicationDatePrecision: fullDate ? "day" : issued ? "year" : null,
    venue: work.containerTitle,
    workType: work.type,
    subjects: [],
    referencedOpenAlexIds: [],
    referencesRetrieved: false,
    integrityNotices: work.integrityNotices,
    versions: [],
  });
}
