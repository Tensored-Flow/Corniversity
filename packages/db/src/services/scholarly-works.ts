import {
  arxivAbsUrl,
  arxivIdFromDoi,
  checkDrift,
  type IdentifierRef,
  type IdentifierScheme,
  identifierKey,
  identifierLockKeys,
  isArxivDoi,
  linkedDocumentKey,
  normaliseIdentifier,
  type PermissionGrant,
  parseArxivId,
  privateCopyPermissions,
  type RecognisedInput,
  recogniseInput,
  resolveIdentifiers,
  safeExternalUrl,
  titlesSuggestDuplicate,
  type VersionLicenceFacts,
} from "@corniversity/core";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, like, or, type SQL, sql } from "drizzle-orm";
import type { BlobStore } from "../blob";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { ARXIV_SINGLETON_KEY, QUEUES, ScholarlyArxivPayload, ScholarlyRefreshPayload } from "../jobs";
import { enqueue } from "../queue";
import {
  annotation,
  auditEvent,
  libraryCollectionItem,
  notebookEntry,
  processingPermission,
  readingProgress,
  resourceAsset,
  scholarlyIdentifier,
  scholarlyVersion,
  scholarlyWork,
  type WorkFieldSource,
  type WorkProvenance,
} from "../schema/index";
import { jobRecord } from "../schema/operations";
import type { ScholarlyClient } from "../scholarly/client";
import { ScholarlyProviderError } from "../scholarly/errors";
import { scholarlyRecordFromArxiv, scholarlyRecordFromCrossref, scholarlyRecordFromOpenAlex } from "../scholarly/records";
import type {
  ArxivEntry,
  ArxivRawRecord,
  IntegrityNotice,
  OpenAlexWorkRecord,
  OpenAlexWorkResult,
  ScholarlyField,
  ScholarlyRecord,
} from "../scholarly/types";
import {
  type AssetRow,
  confirmDocumentFromWork,
  FILE_IN_LIBRARY_AS_OTHER_ITEM,
  getAsset,
  getPermissions,
  LibraryError,
  type ProcessingAction,
  placeDocumentBytes,
  requestIngestion,
  sha256,
  validateUpload,
} from "./library";

/**
 * The research library's works (contract docs/RESEARCH_LIBRARY.md §3, §5, §6): importing papers by
 * identifier with the identifier-resolution rule, arXiv records applied by the worker, reading an
 * arXiv version through a linked Document, private copies, attaching the owner's copy, owner edits,
 * flags, merges and complete deletion. Every function takes the owner, validates ids before any
 * query and finds nothing that belongs to someone else. Provider calls happen outside transactions
 * and take the client as a parameter, so tests and journeys use the fixture provider.
 */

export type WorkRow = typeof scholarlyWork.$inferSelect;
export type IdentifierRow = typeof scholarlyIdentifier.$inferSelect;
export type VersionRow = typeof scholarlyVersion.$inferSelect;

export class ScholarlyError extends Error {
  constructor(
    readonly code: "not_found" | "invalid_identifier" | "invalid_state" | "refused" | "conflict" | "provider",
    message: string,
    readonly details: { workId?: string; providerCode?: ScholarlyProviderError["code"]; resetAt?: Date | null } = {},
  ) {
    super(message);
    this.name = "ScholarlyError";
  }
}

/**
 * Turns a provider failure into the service's own sentence (registered in the notices allowlist);
 * the provider's message is never shown. Anything else is re-thrown unchanged.
 */
export function providerFailure(error: unknown): never {
  if (!(error instanceof ScholarlyProviderError)) throw error;
  const details = { providerCode: error.code, resetAt: error.resetAt };
  switch (error.code) {
    case "not_found":
      if (error.provider === "arxiv") throw new ScholarlyError("not_found", "arXiv has no record of this identifier.", details);
      if (error.provider === "crossref") throw new ScholarlyError("not_found", "Crossref has no record of this DOI.", details);
      throw new ScholarlyError("not_found", "OpenAlex has no record of this identifier.", details);
    case "invalid_identifier":
      throw new ScholarlyError("invalid_identifier", "That identifier is not valid.", details);
    case "rate_limited":
      throw new ScholarlyError("provider", "The provider is limiting requests just now. Nothing was changed; try again later.", details);
    case "budget_exhausted":
      throw new ScholarlyError(
        "provider",
        "OpenAlex's daily allowance for this server is used up. Nothing was changed; lookups work again after it resets.",
        details,
      );
    case "unavailable":
      throw new ScholarlyError("provider", "The provider could not be reached just now. Nothing was changed; try again later.", details);
    case "fixture_missing":
      throw new ScholarlyError(
        "provider",
        "No recorded provider response exists for this request (fixture mode), so it is unavailable.",
        details,
      );
    case "not_cached":
      throw new ScholarlyError("provider", "Not fetched from the provider yet.", details);
    default:
      throw new ScholarlyError("provider", "The provider's answer could not be used. Nothing was changed.", details);
  }
}

// ---------------------------------------------------------------------------------------------
// Looking works up

/** Follows `merged_into_id` to the work that stands now (null when the id is not the owner's work). */
export async function resolveWorkId(db: DbOrTx, ownerId: string, workId: string): Promise<string | null> {
  if (!isUuid(workId)) return null;
  let current = workId;
  for (let hop = 0; hop < 10; hop++) {
    const [row] = await db
      .select({ id: scholarlyWork.id, mergedIntoId: scholarlyWork.mergedIntoId })
      .from(scholarlyWork)
      .where(and(eq(scholarlyWork.id, current), eq(scholarlyWork.ownerId, ownerId)))
      .limit(1);
    if (!row) return null;
    if (!row.mergedIntoId) return row.id;
    current = row.mergedIntoId;
  }
  return null;
}

async function requireWork(db: DbOrTx, ownerId: string, workId: string): Promise<WorkRow> {
  const id = await resolveWorkId(db, ownerId, workId);
  if (!id) throw new ScholarlyError("not_found", "Paper not found.");
  const [row] = await db
    .select()
    .from(scholarlyWork)
    .where(and(eq(scholarlyWork.id, id), eq(scholarlyWork.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new ScholarlyError("not_found", "Paper not found.");
  return row;
}

/** The paper a Document is a file of (merges followed), or null for a Document of no paper. */
export async function workIdForDocument(db: DbOrTx, ownerId: string, assetId: string): Promise<string | null> {
  if (!isUuid(assetId)) return null;
  const [row] = await db
    .select({ workId: scholarlyVersion.workId })
    .from(resourceAsset)
    .innerJoin(scholarlyVersion, eq(scholarlyVersion.id, resourceAsset.scholarlyVersionId))
    .where(and(eq(resourceAsset.id, assetId), eq(resourceAsset.ownerId, ownerId)))
    .limit(1);
  return row ? resolveWorkId(db, ownerId, row.workId) : null;
}

/** The owner's work holding this identifier (merges followed), or null. */
export async function getWorkByIdentifier(db: DbOrTx, ownerId: string, scheme: IdentifierScheme, value: string): Promise<WorkRow | null> {
  const ref = normaliseIdentifier(scheme, value);
  if (!ref) return null;
  const [row] = await db
    .select({ workId: scholarlyIdentifier.workId })
    .from(scholarlyIdentifier)
    .where(
      and(eq(scholarlyIdentifier.ownerId, ownerId), eq(scholarlyIdentifier.scheme, ref.scheme), eq(scholarlyIdentifier.value, ref.value)),
    )
    .limit(1);
  if (!row) return null;
  const id = await resolveWorkId(db, ownerId, row.workId);
  if (!id) return null;
  const [work] = await db.select().from(scholarlyWork).where(eq(scholarlyWork.id, id)).limit(1);
  return work ?? null;
}

/**
 * Every identifier the owner's works hold (current and superseded W ids, every DOI, arXiv id,
 * PubMed and PMC id) mapped to the work that stands now. Every "in your library" marker uses it;
 * nothing matches by OpenAlex id alone.
 */
export async function ownerWorkIndex(db: DbOrTx, ownerId: string): Promise<Map<string, string>> {
  const [identifiers, works] = await Promise.all([
    db
      .select({ scheme: scholarlyIdentifier.scheme, value: scholarlyIdentifier.value, workId: scholarlyIdentifier.workId })
      .from(scholarlyIdentifier)
      .where(eq(scholarlyIdentifier.ownerId, ownerId)),
    db
      .select({ id: scholarlyWork.id, mergedIntoId: scholarlyWork.mergedIntoId })
      .from(scholarlyWork)
      .where(and(eq(scholarlyWork.ownerId, ownerId), isNotNull(scholarlyWork.mergedIntoId))),
  ]);
  const merged = new Map(works.map((w) => [w.id, w.mergedIntoId!]));
  const final = (id: string) => {
    let current = id;
    for (let hop = 0; hop < 10 && merged.has(current); hop++) current = merged.get(current)!;
    return current;
  };
  return new Map(identifiers.map((i) => [identifierKey(i), final(i.workId)]));
}

/** The work an identifier belongs to in an index from `ownerWorkIndex`, or null. */
export function workIdFor(index: ReadonlyMap<string, string>, ref: IdentifierRef): string | null {
  return index.get(identifierKey(ref)) ?? null;
}

export type ResolvedInput =
  | { kind: "empty" }
  | { kind: "search"; query: string; host: string | null }
  | { kind: "identifier"; ref: IdentifierRef; arxivVersion: number | null; host: string | null; workId: string | null };

/**
 * What the find box holds: a DOI, arXiv id or OpenAlex id (taken out of a URL by parsing only; no
 * URL is fetched) with the owner's work holding it, or words to search for. An arXiv DataCite DOI
 * is read as its arXiv id.
 */
export async function resolveInput(db: DbOrTx, ownerId: string, raw: unknown): Promise<ResolvedInput> {
  const input: RecognisedInput = recogniseInput(raw);
  if (input.kind === "empty") return { kind: "empty" };
  if (input.kind === "search") return { kind: "search", query: input.query, host: input.host };
  let ref: IdentifierRef;
  let arxivVersion: number | null = null;
  if (input.kind === "doi") {
    const arxiv = isArxivDoi(input.doi) ? arxivIdFromDoi(input.doi) : null;
    ref = arxiv ? { scheme: "arxiv", value: arxiv } : { scheme: "doi", value: input.doi };
  } else if (input.kind === "arxiv") {
    ref = { scheme: "arxiv", value: input.id };
    arxivVersion = input.version;
  } else {
    ref = { scheme: "openalex", value: input.id };
  }
  const work = await getWorkByIdentifier(db, ownerId, ref.scheme, ref.value);
  return { kind: "identifier", ref, arxivVersion, host: input.host, workId: work?.id ?? null };
}

// ---------------------------------------------------------------------------------------------
// Importing: the identifier-resolution rule (contract §5)

export interface ImportResult {
  workId: string;
  created: boolean;
  /** Other works holding some of the incoming identifiers, recorded for the owner to review. */
  possibleDuplicates: string[];
  /** Whether an arXiv record job was queued for this work. */
  arxivQueued: boolean;
}

interface UpsertInput {
  record: ScholarlyRecord;
  /** Identifiers that find the work but are not added (the W that was asked for before a merge). */
  lookup?: IdentifierRef[];
  /** Identifiers to mark superseded on the resolved work (an OpenAlex W that was merged away). */
  supersede?: IdentifierRef[];
  /** `fill`: provider values only fill empty fields; `refresh`: they replace earlier provider values. */
  mode: "fill" | "refresh";
  save: boolean;
  /** Source recorded on identifiers the record did not come with (the owner's input). */
  identifierSource?: WorkFieldSource;
  /** When no work holds any incoming identifier, attach to this work instead of creating one. */
  preferWorkId?: string;
  /**
   * The work this record was fetched for (a refresh): it is the one updated, whatever other works
   * hold; identifiers another work holds stay there and are recorded as a possible duplicate.
   */
  targetWorkId?: string;
  enqueueArxiv: boolean;
  /** Runs in the same transaction with the resolved work (versions of an arXiv record). */
  afterWrite?: (tx: DbOrTx, workId: string) => Promise<void>;
  markIntegrityChecked?: boolean;
  /** The record holds only identifiers the owner gave: it speaks for no provider's notices. */
  ownerInput?: boolean;
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

function dedupeRefs(refs: readonly IdentifierRef[]): IdentifierRef[] {
  return [...new Map(refs.map((r) => [identifierKey(r), r])).values()];
}

function refTuples(refs: readonly IdentifierRef[]): SQL {
  return sql.join(
    refs.map((r) => sql`(${r.scheme}, ${r.value})`),
    sql`, `,
  );
}

/** The work locked for writing turned out to be merged meanwhile (an owner merge committed first). */
class WorkMergedMeanwhile extends Error {}

/**
 * Fetching and normalising happen before this runs. In one short transaction: an advisory lock per
 * incoming identifier (sorted), the works holding any of them (merges followed), then create, or
 * attach to the work holding the strongest identifier (arXiv > DOI > W), adding the identifiers it
 * lacks and leaving those another work holds (recorded as a possible duplicate; never merged, never
 * a failure). A unique violation (a concurrent writer outside the locks) retries the step once; a
 * work that an owner merge turned into a tombstone while this waited for its row lock retries the
 * resolve step, so nothing is ever written onto a tombstone.
 */
async function upsertWork(db: DbOrTx, ownerId: string, input: UpsertInput): Promise<ImportResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.transaction((tx) => resolveAndWrite(tx, ownerId, input));
    } catch (error) {
      const retry = error instanceof WorkMergedMeanwhile ? attempt < 3 : attempt === 0 && isUniqueViolation(error);
      if (retry) continue;
      if (error instanceof WorkMergedMeanwhile)
        throw new ScholarlyError("conflict", "The paper changed while it was being updated; try again.");
      throw error;
    }
  }
}

async function resolveAndWrite(tx: DbOrTx, ownerId: string, input: UpsertInput): Promise<ImportResult> {
  const refs = dedupeRefs(input.record.identifiers);
  const lookup = dedupeRefs([...(input.lookup ?? []), ...(input.supersede ?? [])]);
  const all = dedupeRefs([...refs, ...lookup]);
  for (const key of identifierLockKeys(all)) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`scholarly:${ownerId}:${key}`}, 0))`);
  }
  const holders = all.length
    ? await tx
        .select({ scheme: scholarlyIdentifier.scheme, value: scholarlyIdentifier.value, workId: scholarlyIdentifier.workId })
        .from(scholarlyIdentifier)
        .where(
          and(
            eq(scholarlyIdentifier.ownerId, ownerId),
            sql`(${scholarlyIdentifier.scheme}, ${scholarlyIdentifier.value}) in (${refTuples(all)})`,
          ),
        )
    : [];
  const finalHolders = [];
  for (const h of holders) {
    const id = await resolveWorkId(tx, ownerId, h.workId);
    if (id) finalHolders.push({ scheme: h.scheme, value: h.value, workId: id });
  }
  const resolution = resolveIdentifiers(all, finalHolders);
  const lookupOnly = new Set(lookup.filter((r) => !refs.some((x) => identifierKey(x) === identifierKey(r))).map(identifierKey));
  // An identifier the owner typed is the owner's, not a provider's report, until a provider's
  // record carries it (then it is upgraded below).
  const sourceOf = (ref: IdentifierRef): WorkFieldSource =>
    !input.ownerInput && input.record.identifiers.some((r) => identifierKey(r) === identifierKey(ref))
      ? input.record.provenance.source
      : (input.identifierSource ?? "owner");
  const retrievedAt = new Date(input.record.provenance.retrievedAt);
  const now = new Date();

  let workId: string;
  let created = false;
  let toInsert: IdentifierRef[];
  let possibleDuplicates: string[] = [];
  let skipped: IdentifierRef[] = resolution.action === "attach" ? resolution.skipped : [];
  if (input.targetWorkId) {
    const id = await resolveWorkId(tx, ownerId, input.targetWorkId);
    if (!id) throw new ScholarlyError("not_found", "Paper not found.");
    workId = id;
    const heldBy = new Map(finalHolders.map((h) => [identifierKey(h), h.workId]));
    toInsert = refs.filter((r) => !heldBy.has(identifierKey(r)) && !lookupOnly.has(identifierKey(r)));
    skipped = refs.filter((r) => (heldBy.get(identifierKey(r)) ?? id) !== id);
    possibleDuplicates = [...new Set(skipped.map((r) => heldBy.get(identifierKey(r))!))].sort();
  } else if (resolution.action === "create" && input.preferWorkId) {
    const id = await resolveWorkId(tx, ownerId, input.preferWorkId);
    if (!id) throw new ScholarlyError("not_found", "Paper not found.");
    workId = id;
    toInsert = refs;
  } else if (resolution.action === "create") {
    const [row] = await tx
      .insert(scholarlyWork)
      .values({
        ownerId,
        ...workFieldsFromRecord(input.record),
        metadataStatus: "resolved",
        savedAt: input.save ? now : null,
        integrityCheckedAt: input.markIntegrityChecked ? now : null,
      })
      .returning({ id: scholarlyWork.id });
    workId = row!.id;
    created = true;
    toInsert = refs;
  } else {
    workId = resolution.workId;
    toInsert = resolution.insert.filter((r) => !lookupOnly.has(identifierKey(r)));
    possibleDuplicates = resolution.possibleDuplicates;
  }

  if (!created) {
    const [work] = await tx
      .select()
      .from(scholarlyWork)
      .where(and(eq(scholarlyWork.id, workId), eq(scholarlyWork.ownerId, ownerId)))
      .for("update");
    if (!work) throw new ScholarlyError("not_found", "Paper not found.");
    // An owner merge committed while this waited for the row lock: resolve again (to the survivor).
    if (work.mergedIntoId) throw new WorkMergedMeanwhile();
    const patch = mergeRecordIntoWork(work, input.record, input.mode, !input.ownerInput);
    if (input.save && !work.savedAt) patch.savedAt = now;
    if (input.markIntegrityChecked) patch.integrityCheckedAt = now;
    if (Object.keys(patch).length) await tx.update(scholarlyWork).set(patch).where(eq(scholarlyWork.id, workId));
  }
  if (toInsert.length) {
    await tx
      .insert(scholarlyIdentifier)
      .values(
        toInsert.map((r) => ({
          ownerId,
          workId,
          scheme: r.scheme,
          value: r.value,
          source: sourceOf(r),
          retrievedAt,
          status: "current" as const,
        })),
      )
      .onConflictDoNothing();
  }
  // A provider's record now carries identifiers the owner typed: they become that provider's report.
  const reported = input.ownerInput ? [] : refs.filter((r) => !skipped.some((s) => identifierKey(s) === identifierKey(r)));
  if (reported.length) {
    await tx
      .update(scholarlyIdentifier)
      .set({ source: input.record.provenance.source, retrievedAt })
      .where(
        and(
          eq(scholarlyIdentifier.ownerId, ownerId),
          eq(scholarlyIdentifier.workId, workId),
          eq(scholarlyIdentifier.source, "owner"),
          sql`(${scholarlyIdentifier.scheme}, ${scholarlyIdentifier.value}) in (${refTuples(reported)})`,
        ),
      );
  }
  // A W returned again is current, even if an earlier refresh had marked it superseded.
  const currentW = refs.filter((r) => r.scheme === "openalex");
  if (currentW.length) {
    await tx
      .update(scholarlyIdentifier)
      .set({ status: "current" })
      .where(
        and(
          eq(scholarlyIdentifier.ownerId, ownerId),
          eq(scholarlyIdentifier.workId, workId),
          sql`(${scholarlyIdentifier.scheme}, ${scholarlyIdentifier.value}) in (${refTuples(currentW)})`,
        ),
      );
  }
  const supersede = (input.supersede ?? []).filter((r) => !currentW.some((w) => w.value === r.value));
  if (supersede.length) {
    await tx
      .update(scholarlyIdentifier)
      .set({ status: "superseded" })
      .where(
        and(
          eq(scholarlyIdentifier.ownerId, ownerId),
          eq(scholarlyIdentifier.workId, workId),
          sql`(${scholarlyIdentifier.scheme}, ${scholarlyIdentifier.value}) in (${refTuples(supersede)})`,
        ),
      );
  }
  if (possibleDuplicates.length) {
    await tx.insert(auditEvent).values({
      ownerId,
      actor: "system",
      action: "scholarly:possible-duplicate",
      entity: "scholarly_work",
      entityId: workId,
      details: {
        others: possibleDuplicates,
        skipped: skipped.map(identifierKey),
      },
    });
  }
  if (input.afterWrite) await input.afterWrite(tx, workId);
  let arxivQueued = false;
  if (input.enqueueArxiv) {
    // Only arXiv ids this work holds: one another work holds is that work's to resolve.
    const held = refs.filter((r) => r.scheme === "arxiv" && !skipped.some((s) => identifierKey(s) === identifierKey(r)));
    for (const ref of held) {
      const [existing] = await tx
        .select({ n: count() })
        .from(scholarlyVersion)
        .where(and(eq(scholarlyVersion.ownerId, ownerId), eq(scholarlyVersion.arxivId, ref.value)));
      if (existing && existing.n > 0) continue;
      if (await enqueueArxivRecord(tx, ownerId, workId, ref.value)) arxivQueued = true;
    }
  }
  return { workId, created, possibleDuplicates, arxivQueued };
}

const WORK_FIELDS: readonly ScholarlyField[] = [
  "title",
  "authors",
  "abstract",
  "publicationYear",
  "publicationDate",
  "venue",
  "workType",
  "subjects",
  "referencedOpenAlexIds",
];

function workFieldsFromRecord(record: ScholarlyRecord): Partial<typeof scholarlyWork.$inferInsert> {
  return {
    title: record.title,
    authors: record.authors,
    abstract: record.abstract,
    abstractSource: record.abstract ? record.abstractSource : null,
    publicationYear: record.publicationYear,
    publicationDate: record.publicationDate,
    publicationDatePrecision: record.publicationDate ? "day" : record.publicationYear ? "year" : null,
    venue: record.venue,
    workType: record.workType,
    subjects: record.subjects,
    referencedOpenalexIds: record.referencesRetrieved ? record.referencedOpenAlexIds : [],
    referencesRetrievedAt: record.referencesRetrieved ? new Date(record.provenance.retrievedAt) : null,
    provenance: record.fieldProvenance,
    integrityNotices: record.integrityNotices,
  };
}

function present(record: ScholarlyRecord, field: ScholarlyField): boolean {
  return Boolean(record.fieldProvenance[field]);
}

function emptyOnWork(work: WorkRow, field: ScholarlyField): boolean {
  switch (field) {
    case "title":
      return !work.title;
    case "authors":
      return work.authors.length === 0;
    case "abstract":
      return !work.abstract;
    case "publicationYear":
      return work.publicationYear === null;
    case "publicationDate":
      return work.publicationDate === null;
    case "venue":
      return !work.venue;
    case "workType":
      return !work.workType;
    case "subjects":
      return work.subjects.length === 0;
    case "referencedOpenAlexIds":
      return work.referencesRetrievedAt === null;
  }
}

/** Which notice sources a record speaks for (its notices replace earlier ones from those sources). */
function noticeSources(record: ScholarlyRecord): IntegrityNotice["source"][] {
  switch (record.provenance.provider) {
    case "openalex":
      return ["openalex"];
    case "arxiv":
      return ["arxiv"];
    case "crossref":
      return ["crossref", "retraction-watch"];
  }
}

function mergeNotices(
  existing: IntegrityNotice[],
  incoming: IntegrityNotice[],
  replaced: IntegrityNotice["source"][],
  concerns?: Set<string>,
) {
  const kept = existing.filter((n) => !replaced.includes(n.source) || (concerns !== undefined && !concerns.has(n.concerns)));
  const seen = new Set(kept.map((n) => `${n.type}|${n.source}|${n.concerns}|${n.noticeDoi ?? ""}`));
  for (const n of incoming) {
    const key = `${n.type}|${n.source}|${n.concerns}|${n.noticeDoi ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      kept.push(n);
    }
  }
  return kept;
}

/**
 * A record's values for a work that exists. Fields the owner edited are never touched; `fill` only
 * fills empty fields; `refresh` replaces provider values. Integrity notices are always the
 * provider's latest statement for the sources it speaks for (never editable by the owner).
 */
function mergeRecordIntoWork(
  work: WorkRow,
  record: ScholarlyRecord,
  mode: "fill" | "refresh",
  replaceNotices = true,
): Partial<typeof scholarlyWork.$inferInsert> {
  const edited = new Set(work.ownerEditedFields);
  const patch: Partial<typeof scholarlyWork.$inferInsert> = {};
  const provenance: WorkProvenance = { ...work.provenance };
  let changed = false;
  for (const field of WORK_FIELDS) {
    if (edited.has(field) || !present(record, field)) continue;
    if (mode === "fill" && !emptyOnWork(work, field)) continue;
    switch (field) {
      case "title":
        patch.title = record.title;
        break;
      case "authors":
        patch.authors = record.authors;
        break;
      case "abstract":
        patch.abstract = record.abstract;
        patch.abstractSource = record.abstractSource;
        break;
      case "publicationYear":
        patch.publicationYear = record.publicationYear;
        if (!record.publicationDate && !edited.has("publicationDate") && (mode === "refresh" || work.publicationDate === null)) {
          patch.publicationDate = null;
          patch.publicationDatePrecision = "year";
        }
        break;
      case "publicationDate":
        patch.publicationDate = record.publicationDate;
        patch.publicationDatePrecision = "day";
        break;
      case "venue":
        patch.venue = record.venue;
        break;
      case "workType":
        patch.workType = record.workType;
        break;
      case "subjects":
        patch.subjects = record.subjects;
        break;
      case "referencedOpenAlexIds":
        patch.referencedOpenalexIds = record.referencedOpenAlexIds;
        patch.referencesRetrievedAt = new Date(record.provenance.retrievedAt);
        break;
    }
    const stamp = record.fieldProvenance[field];
    if (stamp) provenance[field] = stamp;
    changed = true;
  }
  if (changed) patch.provenance = provenance;
  if (record.title && work.metadataStatus === "unidentified") patch.metadataStatus = "resolved";
  if (replaceNotices) {
    const notices = mergeNotices(work.integrityNotices, record.integrityNotices, noticeSources(record));
    if (JSON.stringify(notices) !== JSON.stringify(work.integrityNotices)) patch.integrityNotices = notices;
  }
  return patch;
}

async function enqueueArxivRecord(db: DbOrTx, ownerId: string, workId: string, arxivId: string): Promise<boolean> {
  const bucket = new Date().toISOString().slice(0, 13);
  const payload = ScholarlyArxivPayload.parse({
    idempotencyKey: `scholarly-arxiv:record:${workId}:${arxivId}:${bucket}`,
    ownerId,
    task: "record",
    workId,
    arxivId,
  });
  const result = await enqueue(db, { queue: QUEUES.scholarlyArxiv, kind: "scholarly-arxiv", payload, singletonKey: ARXIV_SINGLETON_KEY });
  return result.created;
}

/**
 * Asks the worker for a work's arXiv record (versions, licences, withdrawals) when it has an arXiv
 * identifier. Web requests never call arXiv themselves.
 */
export async function requestArxivRecord(db: DbOrTx, ownerId: string, workId: string): Promise<{ queued: boolean }> {
  const work = await requireWork(db, ownerId, workId);
  const ids = await db
    .select({ value: scholarlyIdentifier.value })
    .from(scholarlyIdentifier)
    .where(and(eq(scholarlyIdentifier.ownerId, ownerId), eq(scholarlyIdentifier.workId, work.id), eq(scholarlyIdentifier.scheme, "arxiv")));
  let queued = false;
  for (const { value } of ids) if (await enqueueArxivRecord(db, ownerId, work.id, value)) queued = true;
  return { queued };
}

/**
 * The record of an import that only has the identifier the owner typed. Its provenance stamps
 * nothing: `ownerInput` makes every identifier's source `owner` and replaces no notices; the
 * retrieval time is when the owner gave it.
 */
function ownerInputRecord(refs: IdentifierRef[], client: ScholarlyClient): ScholarlyRecord {
  return {
    provenance: {
      provider: "arxiv",
      source: client.mode === "fixture" ? "fixture" : "arxiv",
      retrievedAt: new Date().toISOString(),
      stale: false,
    },
    title: null,
    authors: [],
    abstract: null,
    abstractSource: null,
    publicationYear: null,
    publicationDate: null,
    publicationDatePrecision: null,
    venue: null,
    workType: null,
    subjects: [],
    referencedOpenAlexIds: [],
    referencesRetrieved: false,
    fieldProvenance: {},
    integrityNotices: [],
    versions: [],
    identifiers: refs,
  };
}

/**
 * Imports a paper by identifier (DOI, arXiv id, OpenAlex W, PubMed or PMC id). OpenAlex is asked
 * first; a DOI OpenAlex does not know is looked up in Crossref. An arXiv import creates the work at
 * once from the parsed id (and OpenAlex's record when it has one); its versions, licences and
 * withdrawals arrive through the worker's arXiv job. Saving is the default.
 */
export async function importByIdentifier(
  db: DbOrTx,
  ownerId: string,
  client: ScholarlyClient,
  ref: { scheme: IdentifierScheme; value: string },
  options: { save?: boolean } = {},
): Promise<ImportResult> {
  let normal = normaliseIdentifier(ref.scheme, ref.value);
  if (!normal) throw new ScholarlyError("invalid_identifier", "That identifier is not valid.");
  if (normal.scheme === "doi" && isArxivDoi(normal.value)) {
    const arxiv = arxivIdFromDoi(normal.value);
    if (arxiv) normal = { scheme: "arxiv", value: arxiv };
  }
  const save = options.save ?? true;
  if (normal.scheme === "arxiv") {
    let result: OpenAlexWorkResult | null = null;
    try {
      result = await client.openalexWork(normal);
    } catch (error) {
      // OpenAlex not knowing the paper (or being unreachable) does not stop an arXiv import: the
      // work is created from the id the owner gave, and the arXiv job fills it in.
      if (!(error instanceof ScholarlyProviderError)) throw error;
    }
    if (result) {
      const record = scholarlyRecordFromOpenAlex(result.record);
      // OpenAlex resolved this arXiv id to the record, so the association is OpenAlex's report.
      record.identifiers = dedupeRefs([...record.identifiers, normal]);
      return upsertWork(db, ownerId, { record, mode: "fill", save, enqueueArxiv: true });
    }
    return upsertWork(db, ownerId, {
      record: ownerInputRecord([normal], client),
      mode: "fill",
      save,
      enqueueArxiv: true,
      identifierSource: "owner",
      ownerInput: true,
    });
  }
  let result: OpenAlexWorkResult | null = null;
  try {
    result = await client.openalexWork(normal);
  } catch (error) {
    if (!(error instanceof ScholarlyProviderError && error.code === "not_found" && normal.scheme === "doi")) providerFailure(error);
  }
  if (result) return importOpenAlexResult(db, ownerId, result, save);
  let crossref: Awaited<ReturnType<ScholarlyClient["crossrefWork"]>>;
  try {
    crossref = await client.crossrefWork(normal.value);
  } catch (error) {
    providerFailure(error);
  }
  return upsertWork(db, ownerId, {
    record: scholarlyRecordFromCrossref(crossref),
    mode: "fill",
    save,
    enqueueArxiv: true,
    markIntegrityChecked: true,
  });
}

async function importOpenAlexResult(db: DbOrTx, ownerId: string, result: OpenAlexWorkResult, save: boolean): Promise<ImportResult> {
  const record = scholarlyRecordFromOpenAlex(result.record);
  const requested = result.merged ? normaliseIdentifier("openalex", result.requestedId) : null;
  return upsertWork(db, ownerId, {
    record,
    mode: "fill",
    save,
    enqueueArxiv: true,
    supersede: requested ? [requested] : [],
  });
}

/**
 * Saves a work from an OpenAlex record this server fetched itself (a preview or a list item read
 * from the provider client or its cache). The record's identifiers and provenance are written as
 * OpenAlex's report, so it must never come from the browser: a web action receives only a W id and
 * calls `importByIdentifier` (which reads the cache first).
 */
export async function importFromOpenAlexRecord(
  db: DbOrTx,
  ownerId: string,
  record: OpenAlexWorkRecord,
  options: { save?: boolean } = {},
): Promise<ImportResult> {
  return importOpenAlexResult(
    db,
    ownerId,
    { requestedId: record.openalexId, returnedId: record.openalexId, merged: false, record },
    options.save ?? true,
  );
}

/** A ScholarlyRecord from an arXivRaw record alone (no export-API entry): versions and what it reports. */
function recordFromRaw(raw: ArxivRawRecord): ScholarlyRecord {
  const notices: IntegrityNotice[] = raw.versions
    .filter((v) => v.withdrawn)
    .map((v) => ({
      type: "withdrawal" as const,
      source: "arxiv" as const,
      concerns: `arXiv:${v.arxivId}v${v.version}`,
      ...(v.date ? { date: v.date.slice(0, 10) } : {}),
      label: "Withdrawn on arXiv",
      retrievedAt: raw.provenance.retrievedAt,
    }));
  const stamp = { source: raw.provenance.source, retrievedAt: raw.provenance.retrievedAt };
  return {
    provenance: raw.provenance,
    identifiers: dedupeRefs([
      { scheme: "arxiv", value: raw.id },
      ...(normaliseIdentifier("doi", raw.doi) ? [normaliseIdentifier("doi", raw.doi)!] : []),
    ]),
    title: raw.title,
    authors: [],
    abstract: raw.abstract,
    abstractSource: raw.abstract ? "arxiv" : null,
    publicationYear: null,
    publicationDate: null,
    publicationDatePrecision: null,
    venue: null,
    workType: null,
    subjects: [],
    referencedOpenAlexIds: [],
    referencesRetrieved: false,
    fieldProvenance: { ...(raw.title ? { title: stamp } : {}), ...(raw.abstract ? { abstract: stamp } : {}) },
    integrityNotices: notices,
    versions: raw.versions,
  };
}

/**
 * The worker's arXiv job result for a work: fills empty fields (never owner edits), adds the arXiv
 * identifier (and any DOI the authors gave) through the resolution rule, writes every listed
 * version (date, withdrawal) and the licence of the version that is current in this record, once:
 * a version's licence is never overwritten later. Versions go to the work holding the arXiv
 * identifier, so a version with an arXiv id always has that identifier on its work.
 */
export async function applyArxivRecord(
  db: DbOrTx,
  ownerId: string,
  input: { workId: string; arxivId: string; entry: ArxivEntry | null; raw: ArxivRawRecord | null },
): Promise<{ workId: string; versions: number; possibleDuplicates: string[] }> {
  const parsed = parseArxivId(input.arxivId);
  if (!parsed || parsed.version !== null || parsed.id !== input.arxivId)
    throw new ScholarlyError("invalid_identifier", "That identifier is not valid.");
  const work = await requireWork(db, ownerId, input.workId);
  if (!input.entry && !input.raw) throw new ScholarlyError("not_found", "arXiv has no record of this identifier.");
  if ((input.entry && input.entry.id !== parsed.id) || (input.raw && input.raw.id !== parsed.id))
    throw new ScholarlyError("invalid_state", "The arXiv record belongs to a different paper.");
  const record = input.entry ? scholarlyRecordFromArxiv(input.entry, input.raw) : recordFromRaw(input.raw!);
  if (!record.identifiers.some((r) => r.scheme === "arxiv")) record.identifiers.push({ scheme: "arxiv", value: parsed.id });
  // arXivRaw (OAI-PMH) can lag behind the export API for a new submission. Without it, only the
  // version the API entry describes is recorded (no licence: that comes from arXivRaw alone), and
  // none when the entry hints at a withdrawal; a later refresh fills in the rest.
  const entry = input.entry;
  const versions =
    record.versions.length > 0 || !entry || input.raw || entry.withdrawalHint
      ? record.versions
      : [
          {
            arxivId: parsed.id,
            version: entry.version,
            date: entry.updated,
            sizeKb: null,
            sourceType: null,
            withdrawn: false,
            licence: null,
            licenceSource: null,
            licenceRetrievedAt: null,
          },
        ];
  // Only arXivRaw states each version's withdrawal; an entry-only record never un-withdraws one.
  const withdrawnUpdate = input.raw ? sql`excluded.withdrawn` : sql`scholarly_version.withdrawn or excluded.withdrawn`;
  const result = await upsertWork(db, ownerId, {
    record,
    mode: "fill",
    save: false,
    enqueueArxiv: false,
    preferWorkId: work.id,
    afterWrite: async (tx, workId) => {
      for (const v of versions) {
        const licence = v.licence ?? null;
        await tx.execute(sql`
          insert into scholarly_version
            (owner_id, work_id, kind, label, arxiv_id, arxiv_version, version_date, landing_url,
             licence, licence_url, licence_source, licence_retrieved_at, withdrawn, source)
          values (${ownerId}, ${workId}, 'preprint', ${`arXiv v${v.version}`}, ${v.arxivId}, ${v.version},
                  ${v.date ? new Date(v.date).toISOString() : null}::timestamptz, ${arxivAbsUrl(v.arxivId, v.version)},
                  ${licence}, ${licence ? safeExternalUrl(licence, "display") : null},
                  ${licence ? v.licenceSource : null}, ${licence && v.licenceRetrievedAt ? new Date(v.licenceRetrievedAt).toISOString() : null}::timestamptz,
                  ${v.withdrawn}, ${record.provenance.source})
          on conflict (owner_id, arxiv_id, arxiv_version) where arxiv_id is not null do update set
            version_date = coalesce(excluded.version_date, scholarly_version.version_date),
            withdrawn = ${withdrawnUpdate},
            licence = case when scholarly_version.licence_source is null then excluded.licence else scholarly_version.licence end,
            licence_url = case when scholarly_version.licence_source is null then excluded.licence_url else scholarly_version.licence_url end,
            licence_retrieved_at = case when scholarly_version.licence_source is null then excluded.licence_retrieved_at else scholarly_version.licence_retrieved_at end,
            licence_source = coalesce(scholarly_version.licence_source, excluded.licence_source),
            updated_at = now()`);
      }
    },
  });
  return { workId: result.workId, versions: versions.length, possibleDuplicates: result.possibleDuplicates };
}

// ---------------------------------------------------------------------------------------------
// Flags, edits, reading the work

export async function saveWork(db: DbOrTx, ownerId: string, workId: string): Promise<void> {
  const work = await requireWork(db, ownerId, workId);
  await db
    .update(scholarlyWork)
    .set({ savedAt: sql`coalesce(${scholarlyWork.savedAt}, now())` })
    .where(eq(scholarlyWork.id, work.id));
}

/** *Remove from library*: clears `saved_at`; the work, its notes and Documents stay. */
export async function unsaveWork(db: DbOrTx, ownerId: string, workId: string): Promise<void> {
  const work = await requireWork(db, ownerId, workId);
  await db.update(scholarlyWork).set({ savedAt: null }).where(eq(scholarlyWork.id, work.id));
}

export async function setWorkFlags(
  db: DbOrTx,
  ownerId: string,
  workId: string,
  flags: { favourite?: boolean; readLater?: boolean; read?: boolean },
): Promise<WorkRow> {
  const work = await requireWork(db, ownerId, workId);
  const patch: Partial<typeof scholarlyWork.$inferInsert> = {};
  if (flags.favourite !== undefined) patch.favourite = flags.favourite;
  if (flags.readLater !== undefined) patch.readLater = flags.readLater;
  if (flags.read !== undefined) patch.readAt = flags.read ? (work.readAt ?? new Date()) : null;
  if (Object.keys(patch).length === 0) return work;
  const [row] = await db.update(scholarlyWork).set(patch).where(eq(scholarlyWork.id, work.id)).returning();
  return row!;
}

export interface WorkEdit {
  title?: string;
  authors?: string[];
  abstract?: string | null;
  publicationYear?: number | null;
  venue?: string | null;
  workType?: string | null;
}

/** The owner's corrections; each edited field is recorded in `owner_edited_fields` so no refresh overwrites it. */
export async function editWorkFields(db: DbOrTx, ownerId: string, workId: string, edit: WorkEdit): Promise<WorkRow> {
  const work = await requireWork(db, ownerId, workId);
  const patch: Partial<typeof scholarlyWork.$inferInsert> = {};
  const fields = new Set<ScholarlyField>(work.ownerEditedFields);
  const stamp = { source: "owner" as const, retrievedAt: new Date().toISOString() };
  const provenance: WorkProvenance = { ...work.provenance };
  const mark = (field: ScholarlyField) => {
    fields.add(field);
    provenance[field] = stamp;
  };
  const text = (value: string | null | undefined, max: number) => {
    const trimmed = value?.trim() ?? "";
    return trimmed ? trimmed.slice(0, max) : null;
  };
  if (edit.title !== undefined) {
    const title = text(edit.title, 500);
    if (!title) throw new ScholarlyError("invalid_state", "Give the paper a title.");
    patch.title = title;
    mark("title");
  }
  if (edit.authors !== undefined) {
    patch.authors = edit.authors
      .map((name) => name.trim().slice(0, 300))
      .filter(Boolean)
      .slice(0, 500)
      .map((name) => ({ name }));
    mark("authors");
  }
  if (edit.abstract !== undefined) {
    patch.abstract = text(edit.abstract, 20_000);
    patch.abstractSource = patch.abstract ? "owner" : null;
    mark("abstract");
  }
  if (edit.publicationYear !== undefined) {
    if (
      edit.publicationYear !== null &&
      (!Number.isInteger(edit.publicationYear) || edit.publicationYear < 1000 || edit.publicationYear > 2100)
    )
      throw new ScholarlyError("invalid_state", "The year must be a whole number between 1000 and 2100.");
    patch.publicationYear = edit.publicationYear;
    patch.publicationDate = null;
    patch.publicationDatePrecision = edit.publicationYear === null ? null : "year";
    mark("publicationYear");
    mark("publicationDate");
  }
  if (edit.venue !== undefined) {
    patch.venue = text(edit.venue, 500);
    mark("venue");
  }
  if (edit.workType !== undefined) {
    patch.workType = text(edit.workType, 100);
    mark("workType");
  }
  if (Object.keys(patch).length === 0) return work;
  patch.ownerEditedFields = [...fields];
  patch.provenance = provenance;
  const [row] = await db.update(scholarlyWork).set(patch).where(eq(scholarlyWork.id, work.id)).returning();
  await db.insert(auditEvent).values({
    ownerId,
    actor: "learner",
    action: "scholarly:edit",
    entity: "scholarly_work",
    entityId: work.id,
    details: { fields: Object.keys(patch).filter((k) => k !== "provenance" && k !== "ownerEditedFields") },
  });
  return row!;
}

export interface WorkDocument {
  asset: AssetRow;
  version: VersionRow | null;
  permissions: Record<ProcessingAction, { status: "unknown" | "allowed" | "denied"; basis?: string }>;
}

export interface WorkDetail {
  work: WorkRow;
  identifiers: IdentifierRow[];
  versions: VersionRow[];
  documents: WorkDocument[];
  integrityNotices: IntegrityNotice[];
  /** The latest arXiv job for this work (the paper page says *Fetching the arXiv record* while it runs). */
  arxivJob: { status: string; error: string | null; createdAt: Date } | null;
  /** The latest private-copy and extraction job of each live Document (the page refreshes while one runs). */
  documentJobs: DocumentJob[];
}

export interface DocumentJob {
  assetId: string;
  kind: "private_copy" | "extraction";
  status: string;
  error: string | null;
  createdAt: Date;
}

/**
 * A work with its identifiers, versions, Documents (with their permissions) and integrity notices.
 * For a merged work (a tombstone) `work.mergedIntoId` names the work to show instead.
 */
export async function getWork(db: DbOrTx, ownerId: string, workId: string): Promise<WorkDetail | null> {
  if (!isUuid(workId)) return null;
  const [work] = await db
    .select()
    .from(scholarlyWork)
    .where(and(eq(scholarlyWork.id, workId), eq(scholarlyWork.ownerId, ownerId)))
    .limit(1);
  if (!work) return null;
  const [identifiers, versions, job] = await Promise.all([
    db
      .select()
      .from(scholarlyIdentifier)
      .where(and(eq(scholarlyIdentifier.ownerId, ownerId), eq(scholarlyIdentifier.workId, work.id)))
      .orderBy(asc(scholarlyIdentifier.scheme), asc(scholarlyIdentifier.value)),
    db
      .select()
      .from(scholarlyVersion)
      .where(and(eq(scholarlyVersion.ownerId, ownerId), eq(scholarlyVersion.workId, work.id)))
      .orderBy(asc(scholarlyVersion.arxivId), asc(scholarlyVersion.arxivVersion), asc(scholarlyVersion.createdAt)),
    db
      .select({ status: jobRecord.status, error: jobRecord.error, createdAt: jobRecord.createdAt })
      .from(jobRecord)
      .where(
        and(eq(jobRecord.ownerId, ownerId), eq(jobRecord.queue, QUEUES.scholarlyArxiv), sql`${jobRecord.payload}->>'workId' = ${work.id}`),
      )
      .orderBy(desc(jobRecord.createdAt))
      .limit(1),
  ]);
  const assets = versions.length
    ? await db
        .select()
        .from(resourceAsset)
        .where(
          and(
            eq(resourceAsset.ownerId, ownerId),
            isNull(resourceAsset.deletedAt),
            inArray(
              resourceAsset.scholarlyVersionId,
              versions.map((v) => v.id),
            ),
          ),
        )
        .orderBy(asc(resourceAsset.createdAt))
    : [];
  const documents: WorkDocument[] = [];
  for (const asset of assets) {
    documents.push({
      asset,
      version: versions.find((v) => v.id === asset.scholarlyVersionId) ?? null,
      permissions: await getPermissions(db, ownerId, asset.id),
    });
  }
  const jobs = assets.length
    ? await db
        .select({
          assetId: sql<string>`${jobRecord.payload}->>'assetId'`,
          queue: jobRecord.queue,
          task: sql<string | null>`${jobRecord.payload}->>'task'`,
          status: jobRecord.status,
          error: jobRecord.error,
          createdAt: jobRecord.createdAt,
        })
        .from(jobRecord)
        .where(
          and(
            eq(jobRecord.ownerId, ownerId),
            inArray(jobRecord.queue, [QUEUES.scholarlyArxiv, QUEUES.ingestAsset]),
            sql`${jobRecord.payload}->>'assetId' in (${sql.join(
              assets.map((a) => sql`${a.id}`),
              sql`, `,
            )})`,
          ),
        )
        .orderBy(desc(jobRecord.createdAt))
    : [];
  const documentJobs: DocumentJob[] = [];
  for (const j of jobs) {
    const kind = j.queue === QUEUES.ingestAsset ? "extraction" : j.task === "private-copy" ? "private_copy" : null;
    if (!kind || documentJobs.some((d) => d.assetId === j.assetId && d.kind === kind)) continue;
    documentJobs.push({ assetId: j.assetId, kind, status: j.status, error: j.error, createdAt: j.createdAt });
  }
  return { work, identifiers, versions, documents, integrityNotices: work.integrityNotices, arxivJob: job[0] ?? null, documentJobs };
}

/**
 * What *Delete this paper and its notes* would remove for this exact id (merges are not followed,
 * as in `deleteWorkCompletely`): the Documents (and how many hold stored bytes), their annotations,
 * and the paper notes that stay in the notebook without the link. Null for another owner's id.
 */
export async function workDeletionSummary(
  db: DbOrTx,
  ownerId: string,
  workId: string,
): Promise<{ documents: number; storedCopies: number; annotations: number; notebookEntries: number; collections: number } | null> {
  if (!isUuid(workId)) return null;
  const [work] = await db
    .select({ id: scholarlyWork.id })
    .from(scholarlyWork)
    .where(and(eq(scholarlyWork.id, workId), eq(scholarlyWork.ownerId, ownerId)))
    .limit(1);
  if (!work) return null;
  const rows = await db.execute(sql`
    with works as (
      select id from scholarly_work where owner_id = ${ownerId} and (id = ${work.id} or merged_into_id = ${work.id})
    ), docs as (
      select a.id, a.storage_key from resource_asset a
      join scholarly_version v on v.id = a.scholarly_version_id and v.owner_id = a.owner_id
      where a.owner_id = ${ownerId} and v.work_id in (select id from works)
    )
    select
      (select count(*)::int from docs) as documents,
      (select count(*)::int from docs where storage_key is not null) as stored,
      (select count(*)::int from annotation where owner_id = ${ownerId} and asset_id in (select id from docs)) as annotations,
      (select count(*)::int from notebook_entry where owner_id = ${ownerId} and scholarly_work_id in (select id from works)) as notes,
      (select count(*)::int from library_collection_item where owner_id = ${ownerId} and work_id in (select id from works)) as collections`);
  const r = rows.rows[0] as { documents: number; stored: number; annotations: number; notes: number; collections: number };
  return {
    documents: r.documents,
    storedCopies: r.stored,
    annotations: r.annotations,
    notebookEntries: r.notes,
    collections: r.collections,
  };
}

export type WorkListView = "saved" | "read_later" | "favourites" | "read" | "recent";

export interface WorkListItem {
  work: WorkRow;
  /** When one of the work's Documents was last opened (the *recent* view). */
  lastOpenedAt: Date | null;
}

/**
 * The owner's papers by view: all saved, read later, favourites, read (each among saved papers),
 * or recently opened (from `reading_progress.last_opened_at` of the work's Documents). Merged works
 * never appear.
 */
export async function listWorks(
  db: DbOrTx,
  ownerId: string,
  view: WorkListView,
  options: { limit?: number; offset?: number } = {},
): Promise<WorkListItem[]> {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 50), 1), 200);
  const offset = Math.max(Math.trunc(options.offset ?? 0), 0);
  const base = [eq(scholarlyWork.ownerId, ownerId), isNull(scholarlyWork.mergedIntoId)];
  if (view === "recent") {
    const opened = sql<Date>`max(${readingProgress.lastOpenedAt})`;
    const rows = await db
      .select({ work: scholarlyWork, lastOpenedAt: opened })
      .from(scholarlyWork)
      .innerJoin(scholarlyVersion, eq(scholarlyVersion.workId, scholarlyWork.id))
      .innerJoin(resourceAsset, and(eq(resourceAsset.scholarlyVersionId, scholarlyVersion.id), isNull(resourceAsset.deletedAt)))
      .innerJoin(readingProgress, and(eq(readingProgress.assetId, resourceAsset.id), eq(readingProgress.ownerId, ownerId)))
      .where(and(...base, isNotNull(readingProgress.lastOpenedAt)))
      .groupBy(scholarlyWork.id)
      .orderBy(desc(opened))
      .limit(limit)
      .offset(offset);
    return rows.map((r) => ({ work: r.work, lastOpenedAt: r.lastOpenedAt ? new Date(r.lastOpenedAt) : null }));
  }
  const filter =
    view === "read_later"
      ? eq(scholarlyWork.readLater, true)
      : view === "favourites"
        ? eq(scholarlyWork.favourite, true)
        : view === "read"
          ? isNotNull(scholarlyWork.readAt)
          : undefined;
  const order = view === "read" ? desc(scholarlyWork.readAt) : desc(scholarlyWork.savedAt);
  const rows = await db
    .select()
    .from(scholarlyWork)
    .where(and(...base, isNotNull(scholarlyWork.savedAt), filter))
    .orderBy(order, desc(scholarlyWork.id))
    .limit(limit)
    .offset(offset);
  return rows.map((work) => ({ work, lastOpenedAt: null }));
}

/** Filters for a search of the owner's own works (each as reported on the work). */
export interface LibrarySearchFilters {
  yearFrom?: number;
  yearTo?: number;
  /** The work type as reported (`article`, `preprint` …). */
  type?: string;
  /** An OpenAlex field or subfield id among the work's subjects (as classified by OpenAlex). */
  fieldId?: string;
  subfieldId?: string;
}

/**
 * Full-text search over the owner's works (title, abstract, author names), best match first, with
 * optional filters on the year, the type and the OpenAlex field or subfield, and offset paging.
 */
export async function searchMyLibrary(
  db: DbOrTx,
  ownerId: string,
  query: string,
  options: { limit?: number; offset?: number } & LibrarySearchFilters = {},
): Promise<{ work: WorkRow; rank: number }[]> {
  const q = query.trim().slice(0, 300);
  if (!q) return [];
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 25), 1), 100);
  const offset = Math.min(Math.max(Math.trunc(options.offset ?? 0), 0), 10_000);
  const year = (n: number | undefined) => (n !== undefined && Number.isInteger(n) ? n : undefined);
  const from = year(options.yearFrom);
  const to = year(options.yearTo);
  const subject = (id: string | undefined, level: "field" | "subfield") =>
    id !== undefined && /^\d{1,6}$/.test(id) ? sql`${scholarlyWork.subjects} @> ${JSON.stringify([{ id, level }])}::jsonb` : undefined;
  const rank = sql<number>`ts_rank(${scholarlyWork.tsv}, websearch_to_tsquery('english', ${q}))`;
  const rows = await db
    .select({ work: scholarlyWork, rank })
    .from(scholarlyWork)
    .where(
      and(
        eq(scholarlyWork.ownerId, ownerId),
        isNull(scholarlyWork.mergedIntoId),
        sql`${scholarlyWork.tsv} @@ websearch_to_tsquery('english', ${q})`,
        from !== undefined ? sql`${scholarlyWork.publicationYear} >= ${from}` : undefined,
        to !== undefined ? sql`${scholarlyWork.publicationYear} <= ${to}` : undefined,
        options.type ? eq(scholarlyWork.workType, options.type.slice(0, 100)) : undefined,
        subject(options.fieldId, "field"),
        subject(options.subfieldId, "subfield"),
      ),
    )
    .orderBy(desc(rank), desc(scholarlyWork.savedAt), desc(scholarlyWork.id))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({ work: r.work, rank: Number(r.rank) }));
}

// ---------------------------------------------------------------------------------------------
// Documents: linked arXiv versions, observed hashes, private copies, attaching the owner's copy

async function lockVersionDocument(tx: DbOrTx, versionId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`scholarly-document:${versionId}`}, 0))`);
}

/**
 * The Document for an arXiv version: the version's existing Document (a stored copy first), or a
 * new linked one (`linked_remote`, no bytes, `sha256` = `arxiv:{id}v{n}`), inserted ON CONFLICT DO
 * NOTHING and read back. Withdrawn versions are refused; a version arXiv has not reported yet
 * cannot be opened. Linking records no permissions.
 */
export async function openArxivVersion(db: DbOrTx, ownerId: string, workId: string, arxivId: string, version: number): Promise<AssetRow> {
  const parsed = parseArxivId(arxivId);
  if (!parsed || parsed.version !== null || parsed.id !== arxivId || !Number.isInteger(version) || version < 1)
    throw new ScholarlyError("invalid_identifier", "That identifier is not valid.");
  const work = await requireWork(db, ownerId, workId);
  const [row] = await db
    .select()
    .from(scholarlyVersion)
    .where(and(eq(scholarlyVersion.ownerId, ownerId), eq(scholarlyVersion.arxivId, parsed.id), eq(scholarlyVersion.arxivVersion, version)))
    .limit(1);
  if (!row)
    throw new ScholarlyError("invalid_state", "The arXiv record of this paper has not been fetched yet, so this version cannot be opened.");
  if (row.workId !== work.id) throw new ScholarlyError("not_found", "Paper not found.");
  if (row.withdrawn) throw new ScholarlyError("refused", "This arXiv version was withdrawn, so it is not opened here.");
  const key = linkedDocumentKey(parsed.id, version);
  return db.transaction(async (tx) => {
    await lockVersionDocument(tx, row.id);
    const [existing] = await tx
      .select()
      .from(resourceAsset)
      .where(and(eq(resourceAsset.ownerId, ownerId), eq(resourceAsset.scholarlyVersionId, row.id), isNull(resourceAsset.deletedAt)))
      .orderBy(sql`case when ${resourceAsset.storageKey} is not null then 0 else 1 end`, asc(resourceAsset.createdAt))
      .limit(1);
    if (existing) return existing;
    const inserted = await tx
      .insert(resourceAsset)
      .values({
        ownerId,
        filename: `${parsed.id.replace("/", "_")}v${version}.pdf`,
        mediaType: "application/pdf",
        sizeBytes: 0,
        sha256: key,
        storageKey: null,
        status: "linked_remote",
        origin: "arxiv_link",
        localOnly: false,
        scholarlyVersionId: row.id,
        confirmedTitle: work.title,
        confirmedAuthors: work.authors.map((a) => a.name),
      })
      .onConflictDoNothing()
      .returning();
    if (inserted[0]) {
      await tx.insert(auditEvent).values({
        ownerId,
        actor: "learner",
        action: "asset:link",
        entity: "resource_asset",
        entityId: inserted[0].id,
        details: { arxiv: `${parsed.id}v${version}`, workId: work.id },
      });
      return inserted[0];
    }
    const [again] = await tx
      .select()
      .from(resourceAsset)
      .where(and(eq(resourceAsset.ownerId, ownerId), eq(resourceAsset.sha256, key)))
      .limit(1);
    if (!again || again.scholarlyVersionId !== row.id)
      throw new ScholarlyError("invalid_state", "This paper's file could not be linked; try again.");
    return again;
  });
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

async function requireLinked(db: DbOrTx, ownerId: string, assetId: string): Promise<AssetRow> {
  const asset = await getAsset(db, ownerId, assetId);
  if (!asset) throw new LibraryError("not_found", "Asset not found.");
  if (asset.status !== "linked_remote")
    throw new ScholarlyError("invalid_state", "Only a paper read from arxiv.org reports what the browser received.");
  return asset;
}

/**
 * Records the sha256 of the bytes the owner's browser received for a linked Document (a drift
 * detector, not an identity): the first observation is kept; the same hash again is `same`; a
 * different hash is `changed` and is not stored until the owner accepts it (`acceptNewFile`).
 */
export async function recordObservedHash(
  db: DbOrTx,
  ownerId: string,
  assetId: string,
  observed: { sha256: string; pageCount?: number },
): Promise<{ status: "first" | "same" | "changed"; previous: string | null }> {
  if (!SHA256_HEX.test(observed.sha256)) throw new ScholarlyError("invalid_state", "The reported file hash is not valid.");
  const asset = await requireLinked(db, ownerId, assetId);
  const pageCount =
    observed.pageCount !== undefined && Number.isInteger(observed.pageCount) && observed.pageCount > 0 && observed.pageCount <= 100_000
      ? observed.pageCount
      : null;
  if (asset.observedSha256 && asset.observedSha256 !== observed.sha256) return { status: "changed", previous: asset.observedSha256 };
  await db
    .update(resourceAsset)
    .set({
      observedSha256: observed.sha256,
      observedAt: new Date(),
      ...(asset.pageCount === null && pageCount ? { pageCount } : {}),
    })
    .where(eq(resourceAsset.id, asset.id));
  return { status: asset.observedSha256 ? "same" : "first", previous: asset.observedSha256 };
}

/**
 * The owner keeps their notes on arXiv's changed file: accepted only when the page count (when
 * known) and the page view of every annotated page are unchanged; then the new hash is stored and
 * the anchored annotations are drawable again, each taking the Document's key (notes made on an
 * earlier stored copy included). Otherwise they are marked for repair.
 */
export async function acceptNewFile(
  db: DbOrTx,
  ownerId: string,
  assetId: string,
  input: { observedSha256: string; pageCount: number; pageViews: [number, number][] },
): Promise<{ accepted: boolean; problems: string[] }> {
  if (!SHA256_HEX.test(input.observedSha256)) throw new ScholarlyError("invalid_state", "The reported file hash is not valid.");
  if (
    !Number.isInteger(input.pageCount) ||
    input.pageCount < 1 ||
    input.pageCount > 100_000 ||
    !Array.isArray(input.pageViews) ||
    input.pageViews.length > 100_000 ||
    input.pageViews.some((v) => !Array.isArray(v) || v.length !== 2 || !v.every((n) => Number.isFinite(n) && n > 0))
  )
    throw new ScholarlyError("invalid_state", "The reported page geometry is not valid.");
  const asset = await requireLinked(db, ownerId, assetId);
  const anchored = await db
    .select({ id: annotation.id, anchor: annotation.anchor })
    .from(annotation)
    .where(and(eq(annotation.ownerId, ownerId), eq(annotation.assetId, asset.id), isNotNull(annotation.anchor)));
  const drift = checkDrift({
    anchors: anchored.map((a) => ({ pageIndex: a.anchor!.pageIndex, pageView: a.anchor!.pageView })),
    pageCount: input.pageCount,
    pageViews: input.pageViews,
    previousPageCount: asset.pageCount,
  });
  const keep = sql`"annotation"."updated_at"`;
  return db.transaction(async (tx) => {
    if (drift.geometryMatches) {
      await tx
        .update(resourceAsset)
        .set({ observedSha256: input.observedSha256, observedAt: new Date(), pageCount: input.pageCount })
        .where(eq(resourceAsset.id, asset.id));
      if (anchored.length)
        await tx
          .update(annotation)
          .set({
            mappingStatus: "resolved",
            anchor: sql`jsonb_set(${annotation.anchor}, '{documentSha256}', to_jsonb(${asset.sha256}::text))`,
            updatedAt: keep,
          })
          .where(
            inArray(
              annotation.id,
              anchored.map((a) => a.id),
            ),
          );
    } else if (anchored.length) {
      await tx
        .update(annotation)
        .set({ mappingStatus: "needs_repair", updatedAt: keep })
        .where(
          inArray(
            annotation.id,
            anchored.map((a) => a.id),
          ),
        );
    }
    await tx.insert(auditEvent).values({
      ownerId,
      actor: "learner",
      action: drift.geometryMatches ? "asset:accept-new-file" : "asset:new-file-differs",
      entity: "resource_asset",
      entityId: asset.id,
      details: { previous: asset.observedSha256, next: input.observedSha256, problems: drift.problems },
    });
    return { accepted: drift.geometryMatches, problems: drift.problems };
  });
}

function versionFacts(version: VersionRow): VersionLicenceFacts {
  return {
    arxivId: version.arxivId,
    arxivVersion: version.arxivVersion,
    licence: version.licence,
    licenceSource: version.licenceSource,
    licenceRetrievedAt: version.licenceRetrievedAt,
    withdrawn: version.withdrawn,
  };
}

async function documentVersion(db: DbOrTx, asset: AssetRow): Promise<VersionRow> {
  if (!asset.scholarlyVersionId) throw new ScholarlyError("invalid_state", "This file is not a version of a paper.");
  const [version] = await db
    .select()
    .from(scholarlyVersion)
    .where(and(eq(scholarlyVersion.id, asset.scholarlyVersionId), eq(scholarlyVersion.ownerId, asset.ownerId)))
    .limit(1);
  if (!version) throw new ScholarlyError("invalid_state", "This file is not a version of a paper.");
  return version;
}

const PRIVATE_COPY_IN_LIBRARY =
  "arXiv's file for this version is already in your library as another item. Delete that item first, then keep the private copy; its notes come with it.";

/**
 * Asks the worker to keep a private copy of a linked arXiv Document. Refused (with the reason)
 * unless arXiv OAI-PMH reported an open licence for that exact version, and refused before any job
 * when the file the owner's browser received from arXiv (`observed_sha256`) is already another
 * live item of the library (the job could not store it; deleting that item first lets it fold in).
 */
export async function requestPrivateCopy(db: DbOrTx, ownerId: string, assetId: string): Promise<{ queued: boolean; reason?: string }> {
  const asset = await getAsset(db, ownerId, assetId);
  if (!asset) throw new LibraryError("not_found", "Asset not found.");
  if (asset.status !== "linked_remote") return { queued: false, reason: "This paper's file is already stored here." };
  const version = await documentVersion(db, asset);
  const decision = privateCopyPermissions(versionFacts(version));
  if (!decision.ok) return { queued: false, reason: decision.reason };
  if (asset.observedSha256) {
    const [same] = await db
      .select({ id: resourceAsset.id })
      .from(resourceAsset)
      .where(and(eq(resourceAsset.ownerId, ownerId), eq(resourceAsset.sha256, asset.observedSha256), isNull(resourceAsset.deletedAt)))
      .limit(1);
    if (same) return { queued: false, reason: PRIVATE_COPY_IN_LIBRARY };
  }
  const base = `scholarly-arxiv:private-copy:${asset.id}`;
  const [prior] = await db
    .select({ n: count() })
    .from(jobRecord)
    .where(like(jobRecord.idempotencyKey, `${base}%`));
  const payload = ScholarlyArxivPayload.parse({
    idempotencyKey: prior && prior.n > 0 ? `${base}#r${prior.n}` : base,
    ownerId,
    task: "private-copy",
    assetId: asset.id,
  });
  const result = await enqueue(db, { queue: QUEUES.scholarlyArxiv, kind: "scholarly-arxiv", payload, singletonKey: ARXIV_SINGLETON_KEY });
  return result.created ? { queued: true } : { queued: false, reason: "A job for this file already exists; see the jobs page." };
}

async function recordGrants(tx: DbOrTx, ownerId: string, assetId: string, grants: readonly PermissionGrant[]): Promise<void> {
  for (const grant of grants) {
    await tx
      .update(processingPermission)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(processingPermission.ownerId, ownerId),
          eq(processingPermission.assetId, assetId),
          eq(processingPermission.action, grant.action),
          isNull(processingPermission.revokedAt),
        ),
      );
    await tx.insert(processingPermission).values({ ownerId, assetId, action: grant.action, status: grant.status, basis: grant.basis });
    await tx.insert(auditEvent).values({
      ownerId,
      actor: "system",
      action: `permission:${grant.action}:${grant.status}`,
      entity: "resource_asset",
      entityId: assetId,
      details: { basis: grant.basis },
    });
  }
}

/**
 * The worker's private copy of an openly licensed arXiv version: fetches
 * https://export.arxiv.org/pdf/{id}v{n} (fixed host, no redirects, 90 s, streaming size cap), then
 * promotes the linked Document in place (same id; annotations, position and permissions kept),
 * records local reading, extraction and private storage as allowed with the licence arXiv reported
 * as the basis (sharing denied), confirms the metadata from the work and queues extraction.
 * `runArxiv` spaces the request on the worker's arXiv queue.
 */
export async function keepPrivateCopy(
  db: DbOrTx,
  blobs: BlobStore,
  client: ScholarlyClient,
  input: { ownerId: string; assetId: string; maxBytes: number; runArxiv?: <T>(request: () => Promise<T>) => Promise<T> },
): Promise<{ assetId: string; outcome: "promoted" | "finished" | "already_stored"; queued: boolean }> {
  const asset = await getAsset(db, input.ownerId, input.assetId);
  if (!asset) throw new LibraryError("not_found", "Asset not found.");
  const version = await documentVersion(db, asset);
  const decision = privateCopyPermissions(versionFacts(version));
  if (!decision.ok) throw new ScholarlyError("refused", decision.reason);
  const finish = async (outcome: "promoted" | "finished") => {
    await db.transaction(async (tx) => {
      await recordGrants(tx, input.ownerId, asset.id, decision.grants);
      await confirmDocumentFromWork(tx, input.ownerId, asset.id);
    });
    const queued = await requestIngestion(db, input.ownerId, asset.id);
    return { assetId: asset.id, outcome, queued: queued.queued };
  };
  if (asset.status !== "linked_remote") {
    // A retry after the bytes arrived but before the grants were recorded finishes the job.
    if (asset.storageKey && asset.status === "quarantined" && asset.origin === "scholarly_import") return finish("finished");
    return { assetId: asset.id, outcome: "already_stored", queued: false };
  }
  const run = input.runArxiv ?? (<T>(request: () => Promise<T>) => request());
  let bytes: Uint8Array;
  try {
    bytes = await run(() => client.arxivPdf(version.arxivId!, version.arxivVersion!, input.maxBytes));
  } catch (error) {
    providerFailure(error);
  }
  try {
    await placeDocumentBytes(db, blobs, {
      ownerId: input.ownerId,
      filename: asset.filename,
      mediaType: "application/pdf",
      data: Buffer.from(bytes),
      origin: "scholarly_import",
      maxBytes: input.maxBytes,
      promoteAssetId: asset.id,
      actor: "system",
    });
  } catch (error) {
    // The same bytes are another live item: say so in the private copy's own words.
    if (error instanceof LibraryError && error.message === FILE_IN_LIBRARY_AS_OTHER_ITEM)
      throw new ScholarlyError("conflict", PRIVATE_COPY_IN_LIBRARY);
    throw error;
  }
  return finish("promoted");
}

/** The paper a version belongs to now (merges followed), or null. */
async function workOfVersion(db: DbOrTx, ownerId: string, versionId: string): Promise<string | null> {
  const [version] = await db
    .select({ workId: scholarlyVersion.workId })
    .from(scholarlyVersion)
    .where(and(eq(scholarlyVersion.id, versionId), eq(scholarlyVersion.ownerId, ownerId)))
    .limit(1);
  return version ? resolveWorkId(db, ownerId, version.workId) : null;
}

/** The attach rule for bytes a live item of the owner's library already holds (contract §3). */
async function attachRuleFor(db: DbOrTx, ownerId: string, workId: string, existing: AssetRow): Promise<"adopt" | "reuse"> {
  if (!existing.scholarlyVersionId) return "adopt";
  const holder = await workOfVersion(db, ownerId, existing.scholarlyVersionId);
  if (holder === workId) return "reuse";
  throw new ScholarlyError("conflict", "This file is already attached to another paper in your library.", { workId: holder ?? undefined });
}

const VERSION_HAS_FILE = "This version already has a stored file in your library. Remove that copy first if this file should replace it.";
const PAPER_FILE_PDF_ONLY = "A paper's file must be a PDF; nothing was stored.";

/**
 * A paper's file is a PDF (the reader opens PDFs; the Files list takes Markdown and plain text):
 * anything not named or typed as one is refused before validation, which then checks the signature.
 */
function requirePdfUpload(input: { data: Buffer; mediaType: string; filename: string; maxBytes: number }): void {
  const type = input.mediaType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!input.filename.toLowerCase().endsWith(".pdf") && type !== "application/pdf")
    throw new ScholarlyError("refused", PAPER_FILE_PDF_ONLY);
  const { mediaType } = validateUpload(input.data, input.mediaType, input.filename, input.maxBytes);
  if (mediaType !== "application/pdf") throw new ScholarlyError("refused", PAPER_FILE_PDF_ONLY);
}

async function createOwnerCopyVersion(tx: DbOrTx, ownerId: string, workId: string): Promise<string> {
  const [row] = await tx
    .insert(scholarlyVersion)
    .values({ ownerId, workId, kind: "unknown", label: "Your copy", source: "owner" })
    .returning({ id: scholarlyVersion.id });
  return row!.id;
}

/**
 * The owner attaches their own copy to a paper. A version has at most one live Document: with a
 * linked arXiv Document, that Document is promoted in place; a version whose file is already
 * stored refuses other bytes (remove that copy first). Bytes already in the library: a live asset
 * with no version is adopted (bound to the version, or to a new "Your copy" version), or refused
 * with an instruction when the version's linked Document would become a second Document; one bound
 * to this paper is reused; one bound to another paper is refused. A soft-deleted row is no longer
 * attached anywhere: it is revived for this paper (or folded into the linked Document). A new file
 * becomes a "Your copy" version's Document. The metadata is the work's, confirmed at once;
 * processing still needs the owner's permissions.
 */
export async function attachUploadToWork(
  db: DbOrTx,
  blobs: BlobStore,
  input: { ownerId: string; workId: string; versionId?: string; filename: string; mediaType: string; data: Buffer; maxBytes: number },
): Promise<{ asset: AssetRow; outcome: "stored" | "promoted" | "adopted" | "reused" | "revived" }> {
  const work = await requireWork(db, input.ownerId, input.workId);
  let version: VersionRow | null = null;
  if (input.versionId !== undefined) {
    if (!isUuid(input.versionId)) throw new ScholarlyError("not_found", "Version not found.");
    const [row] = await db
      .select()
      .from(scholarlyVersion)
      .where(
        and(eq(scholarlyVersion.id, input.versionId), eq(scholarlyVersion.ownerId, input.ownerId), eq(scholarlyVersion.workId, work.id)),
      )
      .limit(1);
    if (!row) throw new ScholarlyError("not_found", "Version not found.");
    version = row;
  }
  return attachBytes(db, blobs, { ...input, workId: work.id, version });
}

async function attachBytes(
  db: DbOrTx,
  blobs: BlobStore,
  input: {
    ownerId: string;
    workId: string;
    version: VersionRow | null;
    filename: string;
    mediaType: string;
    data: Buffer;
    maxBytes: number;
  },
): Promise<{ asset: AssetRow; outcome: "stored" | "promoted" | "adopted" | "reused" | "revived" }> {
  requirePdfUpload(input);
  const hash = sha256(input.data);
  const [existing] = await db
    .select()
    .from(resourceAsset)
    .where(and(eq(resourceAsset.ownerId, input.ownerId), eq(resourceAsset.sha256, hash)))
    .limit(1);
  // The version's own live Document: linked → promoted in place; stored → other bytes are refused.
  const versionDoc = input.version
    ? (
        await db
          .select()
          .from(resourceAsset)
          .where(
            and(
              eq(resourceAsset.ownerId, input.ownerId),
              eq(resourceAsset.scholarlyVersionId, input.version.id),
              isNull(resourceAsset.deletedAt),
            ),
          )
          .orderBy(asc(resourceAsset.createdAt))
          .limit(1)
      )[0]
    : undefined;
  const linked = versionDoc?.status === "linked_remote" ? versionDoc : undefined;
  if (existing && !existing.deletedAt) {
    const rule = await attachRuleFor(db, input.ownerId, input.workId, existing);
    if (rule === "reuse") {
      // A paper's file revived through the plain upload is confirmed from its work here.
      const asset = existing.status === "quarantined" ? await confirmDocumentFromWork(db, input.ownerId, existing.id) : existing;
      return { asset, outcome: "reused" };
    }
    // Two Documents for one version would split its notes; the owner decides instead.
    if (linked) throw new LibraryError("duplicate", FILE_IN_LIBRARY_AS_OTHER_ITEM);
    if (versionDoc) throw new ScholarlyError("conflict", VERSION_HAS_FILE);
    if (existing.storageKey) {
      // Adopt: bind the existing file to this paper (annotations and position carry over).
      return db.transaction(async (tx) => {
        const versionId = input.version?.id ?? (await createOwnerCopyVersion(tx, input.ownerId, input.workId));
        const [row] = await tx
          .update(resourceAsset)
          .set({ scholarlyVersionId: versionId })
          .where(and(eq(resourceAsset.id, existing.id), isNull(resourceAsset.scholarlyVersionId)))
          .returning();
        if (!row) throw new ScholarlyError("invalid_state", "The file changed while it was being attached; nothing was changed.");
        await tx.insert(auditEvent).values({
          ownerId: input.ownerId,
          actor: "learner",
          action: "asset:adopt",
          entity: "resource_asset",
          entityId: row.id,
          details: { workId: input.workId, versionId },
        });
        // Now a paper's file, it is described by the work (the item form no longer edits it).
        return { asset: await confirmDocumentFromWork(tx, input.ownerId, row.id), outcome: "adopted" as const };
      });
    }
  }
  if (versionDoc && !linked) throw new ScholarlyError("conflict", VERSION_HAS_FILE);
  // New bytes, or bytes of a soft-deleted row (revived, or folded into the linked Document): one
  // transaction binds them to the paper.
  let placedKey: string | null = null;
  try {
    return await db.transaction(async (tx) => {
      const placed = await placeDocumentBytes(tx, blobs, {
        ownerId: input.ownerId,
        filename: input.filename,
        mediaType: input.mediaType,
        data: input.data,
        origin: "scholarly_upload",
        maxBytes: input.maxBytes,
        promoteAssetId: linked?.id,
      });
      // A live item took these bytes after the checks above: the rules for it were not applied.
      if (placed.outcome === "duplicate")
        throw new ScholarlyError("invalid_state", "The file changed while it was being attached; nothing was changed.");
      placedKey = placed.asset.storageKey;
      let asset = placed.asset;
      // A revived row bound to another paper's version (its file had been deleted there) now
      // belongs to this paper.
      const boundHere = asset.scholarlyVersionId
        ? (await workOfVersion(tx, input.ownerId, asset.scholarlyVersionId)) === input.workId
        : false;
      if (!boundHere) {
        const versionId = input.version?.id ?? (await createOwnerCopyVersion(tx, input.ownerId, input.workId));
        const [row] = await tx
          .update(resourceAsset)
          // A rebound revived row drops the other paper's description before taking this one's.
          .set({ scholarlyVersionId: versionId, ...(asset.scholarlyVersionId ? { confirmedTitle: null, confirmedAuthors: null } : {}) })
          .where(eq(resourceAsset.id, asset.id))
          .returning();
        if (asset.scholarlyVersionId)
          await tx.insert(auditEvent).values({
            ownerId: input.ownerId,
            actor: "learner",
            action: "asset:adopt",
            entity: "resource_asset",
            entityId: asset.id,
            details: { workId: input.workId, versionId, previousVersionId: asset.scholarlyVersionId },
          });
        asset = row!;
      }
      const fresh = await confirmDocumentFromWork(tx, input.ownerId, asset.id);
      const outcome = placed.outcome === "promoted" ? "promoted" : placed.outcome === "revived" ? "revived" : "stored";
      return { asset: fresh, outcome };
    });
  } catch (error) {
    if (placedKey) await blobs.delete(placedKey).catch(() => undefined);
    throw error;
  }
}

/**
 * An uploaded PDF that is not identified yet becomes its own paper (`metadata_status`
 * `unidentified`, saved) with a "Your copy" version, so it can be read, annotated and later merged
 * into the identified paper. Bytes already attached to a paper (a live file) are refused; a file
 * deleted from another paper is revived for the new one.
 */
export async function createWorkFromUpload(
  db: DbOrTx,
  blobs: BlobStore,
  input: { ownerId: string; filename: string; mediaType: string; data: Buffer; maxBytes: number; title?: string },
): Promise<{ workId: string; asset: AssetRow; outcome: "stored" | "adopted" | "revived" }> {
  requirePdfUpload(input);
  const hash = sha256(input.data);
  const [existing] = await db
    .select()
    .from(resourceAsset)
    .where(and(eq(resourceAsset.ownerId, input.ownerId), eq(resourceAsset.sha256, hash)))
    .limit(1);
  if (existing?.scholarlyVersionId && !existing.deletedAt) {
    const holder = await workOfVersion(db, input.ownerId, existing.scholarlyVersionId);
    throw new ScholarlyError("conflict", "This file is already attached to another paper in your library.", {
      workId: holder ?? undefined,
    });
  }
  const title = input.title?.trim().slice(0, 500) || null;
  return db.transaction(async (tx) => {
    const now = new Date();
    const [work] = await tx
      .insert(scholarlyWork)
      .values({
        ownerId: input.ownerId,
        title,
        metadataStatus: "unidentified",
        savedAt: now,
        provenance: title ? { title: { source: "owner", retrievedAt: now.toISOString() } } : {},
        ownerEditedFields: title ? ["title"] : [],
      })
      .returning();
    const versionId = await createOwnerCopyVersion(tx, input.ownerId, work!.id);
    const [version] = await tx.select().from(scholarlyVersion).where(eq(scholarlyVersion.id, versionId));
    const attached = await attachBytes(tx, blobs, { ...input, workId: work!.id, version: version! });
    if (attached.outcome === "promoted" || attached.outcome === "reused")
      throw new ScholarlyError("invalid_state", "The file changed while it was being attached; nothing was changed.");
    return { workId: work!.id, asset: attached.asset, outcome: attached.outcome };
  });
}

/**
 * Works that may be the same paper as this one: those recorded when an import found incoming
 * identifiers held by two works, and those with a near-identical title (a suggestion only).
 */
export async function possibleDuplicates(
  db: DbOrTx,
  ownerId: string,
  workId: string,
): Promise<{ workId: string; title: string | null; reason: "shared_identifier" | "similar_title" }[]> {
  const work = await requireWork(db, ownerId, workId);
  const events = await db
    .select({ entityId: auditEvent.entityId, details: auditEvent.details })
    .from(auditEvent)
    .where(
      and(
        eq(auditEvent.ownerId, ownerId),
        eq(auditEvent.action, "scholarly:possible-duplicate"),
        or(eq(auditEvent.entityId, work.id), sql`${auditEvent.details}->'others' ? ${work.id}`),
      ),
    );
  const shared = new Set<string>();
  for (const e of events) {
    const others = ((e.details as { others?: string[] }).others ?? []).filter((id) => isUuid(id));
    for (const id of [e.entityId ?? "", ...others]) {
      if (!isUuid(id)) continue;
      const final = await resolveWorkId(db, ownerId, id);
      if (final && final !== work.id) shared.add(final);
    }
  }
  const candidates = await db
    .select({ id: scholarlyWork.id, title: scholarlyWork.title, year: scholarlyWork.publicationYear })
    .from(scholarlyWork)
    .where(and(eq(scholarlyWork.ownerId, ownerId), isNull(scholarlyWork.mergedIntoId)))
    .limit(5000);
  const out: { workId: string; title: string | null; reason: "shared_identifier" | "similar_title" }[] = [];
  for (const c of candidates) {
    if (c.id === work.id) continue;
    if (shared.has(c.id)) out.push({ workId: c.id, title: c.title, reason: "shared_identifier" });
    else if (titlesSuggestDuplicate({ title: work.title, year: work.publicationYear }, { title: c.title, year: c.year }))
      out.push({ workId: c.id, title: c.title, reason: "similar_title" });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Merging, refreshing, deleting

/**
 * The owner merges work B into work A, in one transaction: both rows locked (FOR UPDATE); B's
 * identifiers, versions (and so its Documents) and paper notes move to A; shelf and trail items
 * move with ON CONFLICT DO NOTHING (B's item is dropped where A is already there, and recorded; its
 * reason fills A's item when A's has none);
 * flags combine (earliest saved_at, favourite and read-later OR-ed, latest read_at); A's own edits
 * win, B's edits fill fields A did not edit, provider values fill A's empty fields; integrity
 * notices are united. B becomes a tombstone (`merged_into_id = A`) and the full mapping goes to
 * the audit trail so a wrong merge can be reversed by hand.
 */
export async function mergeWorks(db: DbOrTx, ownerId: string, keepId: string, mergeId: string): Promise<{ workId: string }> {
  if (!isUuid(keepId) || !isUuid(mergeId)) throw new ScholarlyError("not_found", "Paper not found.");
  if (keepId === mergeId) throw new ScholarlyError("invalid_state", "A paper cannot be merged into itself.");
  return db.transaction(async (tx) => {
    const locked = await tx
      .select()
      .from(scholarlyWork)
      .where(and(eq(scholarlyWork.ownerId, ownerId), inArray(scholarlyWork.id, [keepId, mergeId])))
      .orderBy(asc(scholarlyWork.id))
      .for("update");
    const a = locked.find((w) => w.id === keepId);
    const b = locked.find((w) => w.id === mergeId);
    if (!a || !b) throw new ScholarlyError("not_found", "Paper not found.");
    if (a.mergedIntoId || b.mergedIntoId) throw new ScholarlyError("invalid_state", "One of these papers was already merged into another.");

    const identifiers = await tx
      .update(scholarlyIdentifier)
      .set({ workId: a.id })
      .where(and(eq(scholarlyIdentifier.ownerId, ownerId), eq(scholarlyIdentifier.workId, b.id)))
      .returning({ id: scholarlyIdentifier.id, scheme: scholarlyIdentifier.scheme, value: scholarlyIdentifier.value });
    const versions = await tx
      .update(scholarlyVersion)
      .set({ workId: a.id })
      .where(and(eq(scholarlyVersion.ownerId, ownerId), eq(scholarlyVersion.workId, b.id)))
      .returning({ id: scholarlyVersion.id, label: scholarlyVersion.label });
    const notes = await tx
      .update(notebookEntry)
      .set({ scholarlyWorkId: a.id })
      .where(and(eq(notebookEntry.ownerId, ownerId), eq(notebookEntry.scholarlyWorkId, b.id)))
      .returning({ id: notebookEntry.id });
    const items = await tx
      .select()
      .from(libraryCollectionItem)
      .where(and(eq(libraryCollectionItem.ownerId, ownerId), eq(libraryCollectionItem.workId, b.id)));
    const moved: string[] = [];
    const dropped: { collectionId: string; position: number; reason: string | null; reasonKept: boolean }[] = [];
    for (const item of items) {
      const inserted = await tx
        .insert(libraryCollectionItem)
        .values({
          collectionId: item.collectionId,
          ownerId,
          workId: a.id,
          position: item.position,
          reason: item.reason,
          addedAt: item.addedAt,
        })
        .onConflictDoNothing()
        .returning({ collectionId: libraryCollectionItem.collectionId });
      if (inserted.length) {
        moved.push(item.collectionId);
        continue;
      }
      // A is already there and keeps its place; B's reason (a trail step's "why") fills A's when
      // A's item has none, so the owner's words are not lost.
      const kept = item.reason?.trim()
        ? await tx
            .update(libraryCollectionItem)
            .set({ reason: item.reason })
            .where(
              and(
                eq(libraryCollectionItem.collectionId, item.collectionId),
                eq(libraryCollectionItem.workId, a.id),
                sql`coalesce(btrim(${libraryCollectionItem.reason}), '') = ''`,
              ),
            )
            .returning({ collectionId: libraryCollectionItem.collectionId })
        : [];
      dropped.push({ collectionId: item.collectionId, position: item.position, reason: item.reason, reasonKept: kept.length > 0 });
    }
    await tx.delete(libraryCollectionItem).where(and(eq(libraryCollectionItem.ownerId, ownerId), eq(libraryCollectionItem.workId, b.id)));
    // Tombstones that pointed at B point at A, so every chain stays one step long.
    await tx
      .update(scholarlyWork)
      .set({ mergedIntoId: a.id })
      .where(and(eq(scholarlyWork.ownerId, ownerId), eq(scholarlyWork.mergedIntoId, b.id)));

    const aEdited = new Set(a.ownerEditedFields);
    const patch: Partial<typeof scholarlyWork.$inferInsert> = {
      savedAt: pickDate(a.savedAt, b.savedAt, "earliest"),
      favourite: a.favourite || b.favourite,
      readLater: a.readLater || b.readLater,
      readAt: pickDate(a.readAt, b.readAt, "latest"),
    };
    const copied: ScholarlyField[] = [];
    const provenance: WorkProvenance = { ...a.provenance };
    const edited = new Set(a.ownerEditedFields);
    for (const field of WORK_FIELDS) {
      const bEdited = b.ownerEditedFields.includes(field);
      const take = (!aEdited.has(field) && bEdited) || (!aEdited.has(field) && emptyOnWork(a, field) && !emptyOnWork(b, field));
      if (!take) continue;
      copyField(patch, b, field);
      if (b.provenance[field]) provenance[field] = b.provenance[field];
      if (bEdited) edited.add(field);
      copied.push(field);
    }
    patch.provenance = provenance;
    patch.ownerEditedFields = [...edited];
    patch.integrityNotices = mergeNotices(a.integrityNotices, b.integrityNotices, []);
    if (a.metadataStatus === "unidentified" && b.metadataStatus === "resolved") patch.metadataStatus = "resolved";
    await tx.update(scholarlyWork).set(patch).where(eq(scholarlyWork.id, a.id));
    await tx.update(scholarlyWork).set({ mergedIntoId: a.id }).where(eq(scholarlyWork.id, b.id));
    await tx.insert(auditEvent).values({
      ownerId,
      actor: "learner",
      action: "scholarly:merge",
      entity: "scholarly_work",
      entityId: a.id,
      details: {
        mergedWorkId: b.id,
        identifiers: identifiers.map((i) => ({ id: i.id, key: `${i.scheme}:${i.value}` })),
        versions: versions.map((v) => v.id),
        notebookEntries: notes.map((n) => n.id),
        collectionItemsMoved: moved,
        collectionItemsDropped: dropped,
        fieldsCopiedFromMerged: copied,
        before: {
          kept: { savedAt: a.savedAt, favourite: a.favourite, readLater: a.readLater, readAt: a.readAt },
          merged: { savedAt: b.savedAt, favourite: b.favourite, readLater: b.readLater, readAt: b.readAt, title: b.title },
        },
      },
    });
    return { workId: a.id };
  });
}

/** The earlier or later of two optional dates (one alone wins; none gives null). */
function pickDate(a: Date | null, b: Date | null, which: "earliest" | "latest"): Date | null {
  if (!a || !b) return a ?? b;
  const aFirst = a.getTime() <= b.getTime();
  return which === "earliest" ? (aFirst ? a : b) : aFirst ? b : a;
}

function copyField(patch: Partial<typeof scholarlyWork.$inferInsert>, from: WorkRow, field: ScholarlyField): void {
  switch (field) {
    case "title":
      patch.title = from.title;
      return;
    case "authors":
      patch.authors = from.authors;
      return;
    case "abstract":
      patch.abstract = from.abstract;
      patch.abstractSource = from.abstractSource;
      return;
    case "publicationYear":
      patch.publicationYear = from.publicationYear;
      return;
    case "publicationDate":
      patch.publicationDate = from.publicationDate;
      patch.publicationDatePrecision = from.publicationDatePrecision;
      return;
    case "venue":
      patch.venue = from.venue;
      return;
    case "workType":
      patch.workType = from.workType;
      return;
    case "subjects":
      patch.subjects = from.subjects;
      return;
    case "referencedOpenAlexIds":
      patch.referencedOpenalexIds = from.referencedOpenalexIds;
      patch.referencesRetrievedAt = from.referencesRetrievedAt;
      return;
  }
}

function lookupRefFor(identifiers: IdentifierRow[]): IdentifierRef | null {
  const current = identifiers.filter((i) => i.status === "current");
  const pick = (scheme: IdentifierScheme, test: (v: string) => boolean = () => true) =>
    current.find((i) => i.scheme === scheme && test(i.value));
  const chosen =
    pick("openalex") ?? pick("doi", (v) => !isArxivDoi(v)) ?? pick("arxiv") ?? pick("doi") ?? pick("pmid") ?? pick("pmcid") ?? null;
  return chosen ? { scheme: chosen.scheme, value: chosen.value } : null;
}

/**
 * Refreshes a work from OpenAlex (merges followed): provider values replace earlier provider
 * values, owner-edited fields are never touched, and an OpenAlex W that came back different (an
 * OpenAlex merge) is added while the old one is marked superseded. The record was fetched for this
 * work, so it is the work updated: identifiers it lacks are added, and identifiers another work
 * holds stay there and are recorded as a possible duplicate (never merged, never overwriting the
 * other work). A failed refresh changes nothing.
 */
export async function refreshWork(
  db: DbOrTx,
  ownerId: string,
  client: ScholarlyClient,
  workId: string,
): Promise<{ workId: string; merged: boolean }> {
  const work = await requireWork(db, ownerId, workId);
  const identifiers = await db
    .select()
    .from(scholarlyIdentifier)
    .where(and(eq(scholarlyIdentifier.ownerId, ownerId), eq(scholarlyIdentifier.workId, work.id)));
  const ref = lookupRefFor(identifiers);
  if (!ref) throw new ScholarlyError("invalid_state", "This paper has no identifier a provider can look up.");
  let result: OpenAlexWorkResult;
  try {
    result = await client.openalexWork(ref, { cache: "refresh" });
  } catch (error) {
    providerFailure(error);
  }
  const record = scholarlyRecordFromOpenAlex(result.record);
  if (ref.scheme === "arxiv") record.identifiers = dedupeRefs([...record.identifiers, ref]);
  const requested = result.merged ? normaliseIdentifier("openalex", result.requestedId) : null;
  const upserted = await upsertWork(db, ownerId, {
    record,
    mode: "refresh",
    save: false,
    enqueueArxiv: true,
    targetWorkId: work.id,
    lookup: [ref],
    supersede: requested ? [requested] : [],
  });
  return { workId: upserted.workId, merged: result.merged };
}

/**
 * Checks Crossref for corrections, retractions and expressions of concern on the work's DOIs
 * (arXiv DOIs are DataCite's and not covered). Crossref's notices replace earlier Crossref and
 * Retraction Watch notices for the DOIs checked; a DOI Crossref does not know counts as checked
 * with no notices. A provider failure changes nothing.
 */
export async function refreshIntegrity(
  db: DbOrTx,
  ownerId: string,
  client: ScholarlyClient,
  workId: string,
): Promise<{ checked: string[]; notices: number }> {
  const work = await requireWork(db, ownerId, workId);
  const dois = (
    await db
      .select({ value: scholarlyIdentifier.value })
      .from(scholarlyIdentifier)
      .where(and(eq(scholarlyIdentifier.ownerId, ownerId), eq(scholarlyIdentifier.workId, work.id), eq(scholarlyIdentifier.scheme, "doi")))
  )
    .map((r) => r.value)
    .filter((doi) => !isArxivDoi(doi))
    .slice(0, 5);
  const incoming: IntegrityNotice[] = [];
  for (const doi of dois) {
    try {
      const crossref = await client.crossrefWork(doi, { cache: "refresh" });
      incoming.push(...crossref.integrityNotices);
    } catch (error) {
      if (error instanceof ScholarlyProviderError && error.code === "not_found") continue;
      providerFailure(error);
    }
  }
  const notices = mergeNotices(work.integrityNotices, incoming, ["crossref", "retraction-watch"], new Set(dois));
  await db.update(scholarlyWork).set({ integrityNotices: notices, integrityCheckedAt: new Date() }).where(eq(scholarlyWork.id, work.id));
  return { checked: dois, notices: incoming.length };
}

/**
 * After a save: queues the Crossref check for corrections and retractions when the work has a
 * Crossref-registered DOI (not an arXiv DataCite DOI) and its notices were never checked.
 */
export async function requestIntegrityCheckIfDue(db: DbOrTx, ownerId: string, workId: string): Promise<{ queued: boolean }> {
  const work = await requireWork(db, ownerId, workId);
  if (work.integrityCheckedAt) return { queued: false };
  const dois = await db
    .select({ value: scholarlyIdentifier.value })
    .from(scholarlyIdentifier)
    .where(and(eq(scholarlyIdentifier.ownerId, ownerId), eq(scholarlyIdentifier.workId, work.id), eq(scholarlyIdentifier.scheme, "doi")));
  if (!dois.some((d) => !isArxivDoi(d.value))) return { queued: false };
  return requestWorkRefresh(db, ownerId, work.id, "integrity");
}

/** Queues a refresh of a work (and its integrity notices) for the worker. */
export async function requestWorkRefresh(
  db: DbOrTx,
  ownerId: string,
  workId: string,
  task: "work" | "integrity" = "work",
): Promise<{ queued: boolean }> {
  const work = await requireWork(db, ownerId, workId);
  const bucket = new Date().toISOString().slice(0, 13);
  const payload = ScholarlyRefreshPayload.parse({
    idempotencyKey: `scholarly-refresh:${task}:${work.id}:${bucket}`,
    ownerId,
    task,
    workId: work.id,
  });
  const result = await enqueue(db, { queue: QUEUES.scholarlyRefresh, kind: "scholarly-refresh", payload });
  return { queued: result.created };
}

/**
 * *Delete this paper and its notes* (confirmed by the caller, audited): removes the work and the
 * tombstones merged into it, their identifiers, versions, Documents (linked and stored: blobs and
 * extracted text), annotations and reading positions, and their shelf and trail items. Paper notes
 * in the notebook stay and lose the link. Blobs are deleted after the database commit. The id is
 * taken exactly as confirmed: merges are not followed, and a merged paper (a stale page or form)
 * is refused, so a confirmation for one paper never deletes the paper it was merged into.
 */
export async function deleteWorkCompletely(
  db: DbOrTx,
  blobs: BlobStore,
  ownerId: string,
  workId: string,
): Promise<{ documents: number; annotations: number }> {
  if (!isUuid(workId)) throw new ScholarlyError("not_found", "Paper not found.");
  const [work] = await db
    .select()
    .from(scholarlyWork)
    .where(and(eq(scholarlyWork.id, workId), eq(scholarlyWork.ownerId, ownerId)))
    .limit(1);
  if (!work) throw new ScholarlyError("not_found", "Paper not found.");
  const mergedRefusal = async (mergedIntoId: string) =>
    new ScholarlyError("invalid_state", "This paper was merged into another paper; delete it from that paper's page.", {
      workId: (await resolveWorkId(db, ownerId, mergedIntoId)) ?? undefined,
    });
  if (work.mergedIntoId) throw await mergedRefusal(work.mergedIntoId);
  const result = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: scholarlyWork.id, mergedIntoId: scholarlyWork.mergedIntoId })
      .from(scholarlyWork)
      .where(and(eq(scholarlyWork.id, work.id), eq(scholarlyWork.ownerId, ownerId)))
      .for("update");
    if (!locked) throw new ScholarlyError("not_found", "Paper not found.");
    // Merged while the confirmation was open.
    if (locked.mergedIntoId) throw await mergedRefusal(locked.mergedIntoId);
    const tombstones = await tx
      .select({ id: scholarlyWork.id })
      .from(scholarlyWork)
      .where(and(eq(scholarlyWork.ownerId, ownerId), eq(scholarlyWork.mergedIntoId, work.id)));
    const workIds = [work.id, ...tombstones.map((t) => t.id)];
    const versions = await tx
      .select({ id: scholarlyVersion.id })
      .from(scholarlyVersion)
      .where(and(eq(scholarlyVersion.ownerId, ownerId), inArray(scholarlyVersion.workId, workIds)));
    const versionIds = versions.map((v) => v.id);
    const assets = versionIds.length
      ? await tx
          .select({ id: resourceAsset.id, storageKey: resourceAsset.storageKey, filename: resourceAsset.filename })
          .from(resourceAsset)
          .where(and(eq(resourceAsset.ownerId, ownerId), inArray(resourceAsset.scholarlyVersionId, versionIds)))
      : [];
    const assetIds = assets.map((a) => a.id);
    let removedAnnotations = 0;
    if (assetIds.length) {
      const removed = await tx
        .delete(annotation)
        .where(and(eq(annotation.ownerId, ownerId), inArray(annotation.assetId, assetIds)))
        .returning({ id: annotation.id });
      removedAnnotations = removed.length;
      // Extracted pages, passages, reading positions and permissions go with their Document.
      await tx.delete(resourceAsset).where(and(eq(resourceAsset.ownerId, ownerId), inArray(resourceAsset.id, assetIds)));
    }
    await tx
      .update(notebookEntry)
      .set({ scholarlyWorkId: null })
      .where(and(eq(notebookEntry.ownerId, ownerId), inArray(notebookEntry.scholarlyWorkId, workIds)));
    await tx
      .delete(libraryCollectionItem)
      .where(and(eq(libraryCollectionItem.ownerId, ownerId), inArray(libraryCollectionItem.workId, workIds)));
    if (versionIds.length) await tx.delete(scholarlyVersion).where(inArray(scholarlyVersion.id, versionIds));
    await tx.delete(scholarlyIdentifier).where(and(eq(scholarlyIdentifier.ownerId, ownerId), inArray(scholarlyIdentifier.workId, workIds)));
    if (tombstones.length)
      await tx.delete(scholarlyWork).where(
        inArray(
          scholarlyWork.id,
          tombstones.map((t) => t.id),
        ),
      );
    await tx.delete(scholarlyWork).where(eq(scholarlyWork.id, work.id));
    await tx.insert(auditEvent).values({
      ownerId,
      actor: "learner",
      action: "scholarly:delete-work",
      entity: "scholarly_work",
      entityId: work.id,
      details: {
        title: work.title,
        tombstones: tombstones.map((t) => t.id),
        documents: assets.map((a) => ({ id: a.id, filename: a.filename })),
        annotations: removedAnnotations,
      },
    });
    return { assets, removedAnnotations };
  });
  for (const asset of result.assets) if (asset.storageKey) await blobs.delete(asset.storageKey).catch(() => undefined);
  return { documents: result.assets.length, annotations: result.removedAnnotations };
}
