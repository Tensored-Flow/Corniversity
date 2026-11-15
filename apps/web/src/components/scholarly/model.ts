import type { ScholarlyRecord } from "@corniversity/db/scholarly/types";
import type { WorkDetail } from "@corniversity/db/services/scholarly-works";

/**
 * What PaperView shows, whether the paper is in the library (a work and its provenance) or not
 * yet (a provider's record, read for the preview). Each value keeps whose report it is and when it
 * was retrieved; nothing is filled in that the source did not give.
 */

export interface Stamp {
  source: string;
  retrievedAt: string | null;
}

export interface PaperIdentifier {
  scheme: string;
  value: string;
  source: string;
  retrievedAt: string | null;
  superseded: boolean;
}

export interface PaperIntegrityNotice {
  type: string;
  source: string;
  concerns: string;
  noticeDoi: string | null;
  date: string | null;
  label: string;
  retrievedAt: string;
}

export interface PaperSummary {
  title: string | null;
  authors: { name: string }[];
  year: number | null;
  date: string | null;
  datePrecision: "day" | "year" | null;
  venue: string | null;
  workType: string | null;
  abstract: { text: string; source: string | null; stamp: Stamp | null } | null;
  identifiers: PaperIdentifier[];
  subjects: { id: string; name: string; level: string }[];
  integrityNotices: PaperIntegrityNotice[];
  /** Per-field provenance (title, authors, date, venue, type, subjects). */
  stamps: Partial<Record<"title" | "authors" | "date" | "venue" | "workType" | "subjects", Stamp>>;
  /** Whether anything shown came from recorded fixture data. */
  fixture: boolean;
  /** "unidentified": an uploaded paper that no provider has described. */
  unidentified: boolean;
}

function noticesOf(notices: readonly ScholarlyRecord["integrityNotices"][number][]): PaperIntegrityNotice[] {
  return notices.map((n) => ({
    type: n.type,
    source: n.source,
    concerns: n.concerns,
    noticeDoi: n.noticeDoi ?? null,
    date: n.date ?? null,
    label: n.label,
    retrievedAt: n.retrievedAt,
  }));
}

/** A provider's record (OpenAlex or Crossref, read for the preview) as PaperView shows it. */
export function paperFromRecord(record: ScholarlyRecord): PaperSummary {
  const stamp = (field: keyof ScholarlyRecord["fieldProvenance"]): Stamp | undefined => {
    const s = record.fieldProvenance[field];
    return s ? { source: s.source, retrievedAt: s.retrievedAt } : undefined;
  };
  const stamps: PaperSummary["stamps"] = {};
  for (const [key, field] of [
    ["title", "title"],
    ["authors", "authors"],
    ["venue", "venue"],
    ["workType", "workType"],
    ["subjects", "subjects"],
  ] as const) {
    const s = stamp(field);
    if (s) stamps[key] = s;
  }
  const date = stamp("publicationDate") ?? stamp("publicationYear");
  if (date) stamps.date = date;
  const abstractStamp = stamp("abstract") ?? null;
  return {
    title: record.title,
    authors: record.authors.map((a) => ({ name: a.name })),
    year: record.publicationYear,
    date: record.publicationDate,
    datePrecision: record.publicationDatePrecision,
    venue: record.venue,
    workType: record.workType,
    abstract: record.abstract ? { text: record.abstract, source: record.abstractSource, stamp: abstractStamp } : null,
    identifiers: record.identifiers.map((ref) => ({
      scheme: ref.scheme,
      value: ref.value,
      source: record.provenance.source,
      retrievedAt: record.provenance.retrievedAt,
      superseded: false,
    })),
    subjects: record.subjects.map((s) => ({ id: s.id, name: s.name, level: s.level })),
    integrityNotices: noticesOf(record.integrityNotices),
    stamps,
    fixture: record.provenance.source === "fixture",
    unidentified: false,
  };
}

/** Whether any of a work's details came from recorded fixture data (it is then labelled *Fixture data*). */
export function workIsFixture(provenance: WorkDetail["work"]["provenance"]): boolean {
  return Object.values(provenance).some((s) => s?.source === "fixture");
}

/** A work in the library (with its per-field provenance and identifiers) as PaperView shows it. */
export function paperFromWork(detail: Pick<WorkDetail, "work" | "identifiers">): PaperSummary {
  const { work } = detail;
  const p = work.provenance;
  const stamp = (field: keyof typeof p): Stamp | undefined => {
    const s = p[field];
    return s ? { source: s.source, retrievedAt: s.retrievedAt } : undefined;
  };
  const stamps: PaperSummary["stamps"] = {};
  for (const key of ["title", "authors", "venue", "workType", "subjects"] as const) {
    const s = stamp(key);
    if (s) stamps[key] = s;
  }
  const date = stamp("publicationDate") ?? stamp("publicationYear");
  if (date) stamps.date = date;
  const fixture = workIsFixture(p) || detail.identifiers.some((i) => i.source === "fixture");
  return {
    title: work.title,
    authors: work.authors.map((a) => ({ name: a.name })),
    year: work.publicationYear,
    date: work.publicationDate,
    datePrecision: work.publicationDatePrecision,
    venue: work.venue,
    workType: work.workType,
    abstract: work.abstract ? { text: work.abstract, source: work.abstractSource, stamp: stamp("abstract") ?? null } : null,
    identifiers: detail.identifiers.map((i) => ({
      scheme: i.scheme,
      value: i.value,
      source: i.source,
      retrievedAt: i.retrievedAt.toISOString(),
      superseded: i.status === "superseded",
    })),
    subjects: work.subjects.map((s) => ({ id: s.id, name: s.name, level: s.level })),
    integrityNotices: noticesOf(work.integrityNotices),
    stamps,
    fixture,
    unidentified: work.metadataStatus === "unidentified",
  };
}

const stampKey = (s: Stamp) => `${s.source}|${(s.retrievedAt ?? "").slice(0, 10)}`;

/** Whether two stamps say the same: the same source on the same day. */
export function sameStamp(a: Stamp | null | undefined, b: Stamp | null | undefined): boolean {
  return Boolean(a && b && stampKey(a) === stampKey(b));
}

/**
 * The stamp most of the paper's details share (said once under them); fields whose stamp differs,
 * such as the owner's edits, keep their own note. Null when no detail has a stamp.
 */
export function commonStamp(paper: Pick<PaperSummary, "stamps" | "abstract">): Stamp | null {
  const stamps = [...Object.values(paper.stamps), paper.abstract?.stamp].filter((s): s is Stamp => Boolean(s));
  const tally = new Map<string, { stamp: Stamp; n: number }>();
  for (const s of stamps) {
    const entry = tally.get(stampKey(s));
    if (entry) entry.n++;
    else tally.set(stampKey(s), { stamp: s, n: 1 });
  }
  let best: { stamp: Stamp; n: number } | null = null;
  for (const entry of tally.values()) if (!best || entry.n > best.n) best = entry;
  return best?.stamp ?? null;
}

/** Subjects worth naming: OpenAlex's field and subfield first, then up to `topics` topics. */
export function namedSubjects(subjects: PaperSummary["subjects"], topics = 3): PaperSummary["subjects"] {
  const rank: Record<string, number> = { field: 0, subfield: 1, topic: 2, domain: 3 };
  const sorted = [...subjects].sort((a, b) => (rank[a.level] ?? 9) - (rank[b.level] ?? 9));
  const out: PaperSummary["subjects"] = [];
  let topicCount = 0;
  for (const s of sorted) {
    if (s.level === "domain") continue;
    if (s.level === "topic" && topicCount++ >= topics) continue;
    out.push(s);
  }
  return out;
}
