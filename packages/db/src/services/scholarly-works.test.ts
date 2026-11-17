import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IdentifierRef } from "@corniversity/core";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FsBlobStore } from "../blob";
import { createDb } from "../client";
import { stopBoss } from "../queue";
import { user } from "../schema/auth";
import { notebookEntry } from "../schema/learning";
import { annotation, readingProgress, resourceAsset } from "../schema/library";
import { auditEvent, jobRecord } from "../schema/operations";
import { libraryCollection, libraryCollectionItem, scholarlyIdentifier, scholarlyVersion, scholarlyWork } from "../schema/scholarly";
import { createFixtureScholarlyClient, type ScholarlyClient } from "../scholarly/client";
import { ScholarlyProviderError } from "../scholarly/errors";
import type { ArxivEntry, IntegrityNotice, OpenAlexWorkRecord, OpenAlexWorkResult } from "../scholarly/types";
import { createAnnotation, markDocumentOpened, setPermission } from "./library";
import { addToCollection, getCollection } from "./library-collections";
import { createEntry } from "./notebook";
import {
  acceptNewFile,
  applyArxivRecord,
  attachUploadToWork,
  createWorkFromUpload,
  deleteWorkCompletely,
  editWorkFields,
  existingWorkIds,
  getWork,
  getWorkByIdentifier,
  importByIdentifier,
  importFromOpenAlexRecord,
  keepPrivateCopy,
  listWorks,
  mergeWorks,
  openArxivVersion,
  ownerWorkIndex,
  possibleDuplicates,
  recordObservedHash,
  refreshIntegrity,
  refreshWork,
  requestIntegrityCheckIfDue,
  requestPrivateCopy,
  requestWorkRefresh,
  resolveInput,
  ScholarlyError,
  saveWork,
  searchMyLibrary,
  setWorkFlags,
  unsaveWork,
  workDeletionSummary,
  workIdFor,
} from "./scholarly-works";

/**
 * Integration tests for scholarly works against the embedded PostgreSQL. Two kinds of provider:
 * the fixture client (responses recorded once from the live providers, labelled `fixture`) and a
 * scripted test double built here for situations no recording shows (an OpenAlex merge, a DOI and
 * an arXiv id that only later turn out to be one paper). Neither is a live provider.
 */
const OWNER = "works-test-owner";
const OTHER = "works-test-other";
const FIXTURES = join(__dirname, "../scholarly/fixtures");
let handle: ReturnType<typeof createDb>;
let dataRoot: string;
let blobs: FsBlobStore;
let fixture: ScholarlyClient;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 4 });
  dataRoot = mkdtempSync(join(tmpdir(), "corniversity-works-"));
  blobs = new FsBlobStore(dataRoot);
  fixture = createFixtureScholarlyClient({ dir: FIXTURES });
  await handle.db
    .insert(user)
    .values([
      { id: OWNER, name: "Works Test", email: "works-test@example.test" },
      { id: OTHER, name: "Works Other", email: "works-other@example.test" },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await stopBoss();
  await handle.close();
  rmSync(dataRoot, { recursive: true, force: true });
});

async function freshOwner(label: string): Promise<string> {
  const id = `${label}-${randomUUID().slice(0, 8)}`;
  await handle.db.insert(user).values({ id, name: label, email: `${id}@example.test` });
  return id;
}

// --- the scripted test double -------------------------------------------------------------------

const STAMP = { provider: "openalex" as const, source: "fixture" as const, retrievedAt: "2026-11-15T00:00:00.000Z", stale: false };

function oaRecord(id: string, opts: { doi?: string; arxiv?: string; title?: string; refs?: string[] } = {}): OpenAlexWorkRecord {
  const identifiers: IdentifierRef[] = [{ scheme: "openalex", value: id }];
  if (opts.doi) identifiers.push({ scheme: "doi", value: opts.doi });
  if (opts.arxiv) identifiers.push({ scheme: "arxiv", value: opts.arxiv });
  return {
    provenance: STAMP,
    openalexId: id,
    doi: opts.doi ?? null,
    identifiers,
    title: opts.title ?? `Scripted work ${id}`,
    authors: [{ name: "Ada Scripted" }],
    abstract: null,
    publicationYear: 2024,
    publicationDate: null,
    publicationDatePrecision: "year",
    venue: null,
    workType: "article",
    language: "en",
    subjects: [],
    citedByCount: 0,
    referencedWorksCount: (opts.refs ?? []).length,
    referencedOpenAlexIds: opts.refs ?? [],
    relatedOpenAlexIds: [],
    isRetracted: false,
    openAccess: null,
    primaryLocation: null,
    bestOaLocation: null,
    locations: [],
  };
}

function scripted(works: Record<string, OpenAlexWorkResult | "not_found">, extra: Partial<ScholarlyClient> = {}): ScholarlyClient {
  return {
    ...fixture,
    mode: "fixture",
    openalexWork: async (ref) => {
      const found = works[`${ref.scheme}:${ref.value}`];
      if (!found || found === "not_found") throw new ScholarlyProviderError("openalex", "not_found", "OpenAlex has no record (scripted).");
      return found;
    },
    ...extra,
  };
}

const result = (record: OpenAlexWorkRecord, requestedId = record.openalexId): OpenAlexWorkResult => ({
  requestedId,
  returnedId: record.openalexId,
  merged: requestedId.startsWith("W") && requestedId !== record.openalexId,
  record,
});

function arxivEntry(id: string, doi: string | null = null, title = `arXiv paper ${id}`): ArxivEntry {
  return {
    provenance: { provider: "arxiv", source: "fixture", retrievedAt: "2026-11-15T00:00:00.000Z", stale: false },
    id,
    version: 1,
    title,
    abstract: "An abstract.",
    authors: [{ name: "Bo Scripted", affiliations: [] }],
    published: "2025-01-02T00:00:00Z",
    updated: "2025-01-02T00:00:00Z",
    primaryCategory: "math.FA",
    categories: ["math.FA"],
    comment: null,
    journalRef: null,
    doi,
    withdrawalHint: false,
  };
}

async function worksHolding(ownerId: string, scheme: string, value: string) {
  return handle.db
    .select({ workId: scholarlyIdentifier.workId })
    .from(scholarlyIdentifier)
    .where(
      and(eq(scholarlyIdentifier.ownerId, ownerId), sql`${scholarlyIdentifier.scheme} = ${scheme}`, eq(scholarlyIdentifier.value, value)),
    );
}

/** The invariant: a version with an arXiv id has that arXiv identifier on the same work. */
async function versionsWithoutArxivIdentifier(ownerId: string): Promise<number> {
  const rows = await handle.db.execute(sql`
    select count(*)::int as n from scholarly_version v
    where v.owner_id = ${ownerId} and v.arxiv_id is not null
      and not exists (select 1 from scholarly_identifier i
                      where i.owner_id = v.owner_id and i.work_id = v.work_id and i.scheme = 'arxiv' and i.value = v.arxiv_id)`);
  return (rows.rows[0] as { n: number }).n;
}

// --- tests ----------------------------------------------------------------------------------------

describe("importing with recorded provider data (fixture mode)", () => {
  it("imports a DOI from OpenAlex's record, every identifier labelled with its source", async () => {
    const imported = await importByIdentifier(handle.db, OWNER, fixture, { scheme: "doi", value: "https://doi.org/10.7717/PEERJ.4375" });
    expect(imported.created).toBe(true);
    const detail = (await getWork(handle.db, OWNER, imported.workId))!;
    expect(detail.work.title).toMatch(/^The state of OA/);
    expect(detail.work.savedAt).toBeInstanceOf(Date);
    expect(detail.work.provenance.title?.source).toBe("fixture");
    expect(detail.identifiers.map((i) => `${i.scheme}:${i.value}`)).toEqual(
      expect.arrayContaining(["openalex:W2741809807", "doi:10.7717/peerj.4375", "pmid:29456894", "pmcid:PMC5815332"]),
    );
    expect(detail.identifiers.every((i) => i.source === "fixture")).toBe(true);
    expect(detail.work.referencedOpenalexIds.length).toBe(46);
    // Importing again (by its W, recorded by the find group) attaches to the same work.
    const again = await importByIdentifier(handle.db, OWNER, fixture, { scheme: "openalex", value: "W2741809807" });
    expect(again).toMatchObject({ workId: imported.workId, created: false });
    // A W lookup with no recording is unavailable, never "not found" or "no results".
    const unrecorded = await importByIdentifier(handle.db, OWNER, fixture, { scheme: "openalex", value: "W1" }).catch((e: unknown) => e);
    expect((unrecorded as Error).message).toBe(
      "No recorded provider response exists for this request (fixture mode), so it is unavailable.",
    );
    expect((await resolveInput(handle.db, OWNER, "10.7717/peerj.4375")).kind).toBe("identifier");
    const resolved = await resolveInput(handle.db, OWNER, "https://doi.org/10.7717/peerj.4375");
    expect(resolved.kind === "identifier" && resolved.workId).toBe(imported.workId);
    // Text shaped like a DOI that is not one: marked, so Find says so and searches nothing.
    expect(await resolveInput(handle.db, OWNER, "10.12/peerj")).toEqual({
      kind: "search",
      query: "10.12/peerj",
      host: null,
      invalidDoi: true,
    });
    expect(await resolveInput(handle.db, OWNER, "peerj open access")).toEqual({ kind: "search", query: "peerj open access", host: null });
  });

  it("an unknown DOI falls through to Crossref; a DOI neither knows is not found, an unrecorded one unavailable", async () => {
    const error = await importByIdentifier(handle.db, OWNER, fixture, { scheme: "doi", value: "10.7717/corniversity-no-such-work" }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ScholarlyError);
    expect((error as ScholarlyError).message).toBe("Crossref has no record of this DOI.");
    expect((error as ScholarlyError).details.providerCode).toBe("not_found");
    const unrecorded = await importByIdentifier(handle.db, OWNER, fixture, { scheme: "doi", value: "10.7717/peerj.9999" }).catch(
      (e: unknown) => e,
    );
    expect((unrecorded as ScholarlyError).details.providerCode).toBe("fixture_missing");
    await expect(importByIdentifier(handle.db, OWNER, fixture, { scheme: "doi", value: "not a doi" })).rejects.toThrow(
      "That identifier is not valid.",
    );
  });

  it("an arXiv import creates the work at once and queues the arXiv record; versions and licences arrive from the worker", async () => {
    const owner = await freshOwner("arxiv-import");
    const imported = await importByIdentifier(handle.db, owner, fixture, { scheme: "arxiv", value: "arXiv:2305.18290v2" });
    expect(imported.arxivQueued).toBe(true);
    const jobs = await handle.db
      .select()
      .from(jobRecord)
      .where(and(eq(jobRecord.ownerId, owner), eq(jobRecord.queue, "scholarly-arxiv")));
    expect(jobs).toHaveLength(1);
    expect((jobs[0]!.payload as { arxivId: string }).arxivId).toBe("2305.18290");
    let detail = (await getWork(handle.db, owner, imported.workId))!;
    expect(detail.versions).toEqual([]);
    expect(detail.arxivJob?.status).toBe("queued");
    // A version cannot be opened before the record arrives.
    await expect(openArxivVersion(handle.db, owner, imported.workId, "2305.18290", 3)).rejects.toThrow(
      "The arXiv record of this paper has not been fetched yet, so this version cannot be opened.",
    );
    // What the worker does: the arXiv API entry and the OAI-PMH arXivRaw record, both recorded.
    const entries = await fixture.arxivEntries([{ id: "2305.18290", version: null }]);
    const raw = await fixture.arxivRaw("2305.18290");
    const applied = await applyArxivRecord(handle.db, owner, {
      workId: imported.workId,
      arxivId: "2305.18290",
      entry: entries.entries[0]!,
      raw,
    });
    expect(applied.workId).toBe(imported.workId);
    detail = (await getWork(handle.db, owner, imported.workId))!;
    expect(detail.versions.map((v) => v.label)).toEqual(["arXiv v1", "arXiv v2", "arXiv v3"]);
    const v3 = detail.versions.find((v) => v.arxivVersion === 3)!;
    expect(v3.licence).toBe("http://creativecommons.org/licenses/by/4.0/");
    expect(v3.licenceSource).toBe("arxiv-oai");
    expect(v3.landingUrl).toBe("https://arxiv.org/abs/2305.18290v3");
    expect(detail.versions.filter((v) => v.arxivVersion !== 3).every((v) => v.licence === null)).toBe(true);
    // A later record never overwrites v3's licence; the new current version gets its own.
    const later = {
      ...raw,
      versions: [
        ...raw.versions.map((v) => ({ ...v, licence: null, licenceSource: null, licenceRetrievedAt: null })),
        {
          ...raw.versions[2]!,
          version: 4,
          licence: "http://arxiv.org/licenses/nonexclusive-distrib/1.0/",
          licenceSource: "arxiv-oai" as const,
        },
      ],
    };
    await applyArxivRecord(handle.db, owner, { workId: imported.workId, arxivId: "2305.18290", entry: entries.entries[0]!, raw: later });
    const versions = await handle.db.select().from(scholarlyVersion).where(eq(scholarlyVersion.ownerId, owner));
    expect(versions.find((v) => v.arxivVersion === 3)?.licence).toBe("http://creativecommons.org/licenses/by/4.0/");
    expect(versions.find((v) => v.arxivVersion === 4)?.licence).toBe("http://arxiv.org/licenses/nonexclusive-distrib/1.0/");
    expect(await versionsWithoutArxivIdentifier(owner)).toBe(0);
  });

  it("withdrawn versions are recorded with a notice and are not opened; others are", async () => {
    const owner = await freshOwner("withdrawn");
    const imported = await importByIdentifier(handle.db, owner, scripted({}), { scheme: "arxiv", value: "2607.20049" });
    const entries = await fixture.arxivEntries([{ id: "2607.20049", version: null }]);
    const raw = await fixture.arxivRaw("2607.20049");
    await applyArxivRecord(handle.db, owner, { workId: imported.workId, arxivId: "2607.20049", entry: entries.entries[0]!, raw });
    const detail = (await getWork(handle.db, owner, imported.workId))!;
    expect(detail.versions.find((v) => v.arxivVersion === 2)?.withdrawn).toBe(true);
    expect(detail.integrityNotices.some((n) => n.type === "withdrawal" && n.concerns === "arXiv:2607.20049v2")).toBe(true);
    await expect(openArxivVersion(handle.db, owner, imported.workId, "2607.20049", 2)).rejects.toThrow(
      "This arXiv version was withdrawn, so it is not opened here.",
    );
    expect((await openArxivVersion(handle.db, owner, imported.workId, "2607.20049", 1)).status).toBe("linked_remote");
  });
});

describe("the identifier-resolution rule", () => {
  it("two concurrent imports of the same paper make one work", async () => {
    const owner = await freshOwner("concurrent");
    const [a, b] = await Promise.all([
      importByIdentifier(handle.db, owner, fixture, { scheme: "arxiv", value: "2305.18290" }),
      importByIdentifier(handle.db, owner, fixture, { scheme: "arxiv", value: "2305.18290" }),
    ]);
    expect(a.workId).toBe(b.workId);
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
    const works = await handle.db.select().from(scholarlyWork).where(eq(scholarlyWork.ownerId, owner));
    expect(works).toHaveLength(1);
    expect(await worksHolding(owner, "arxiv", "2305.18290")).toHaveLength(1);
  });

  it("DOI then arXiv: the arXiv import finds the work through OpenAlex's shared W", async () => {
    const owner = await freshOwner("doi-then-arxiv");
    const client = scripted({
      "doi:10.1234/published": result(oaRecord("W1001", { doi: "10.1234/published" })),
      "arxiv:2503.00001": result(oaRecord("W1001", { doi: "10.1234/published", arxiv: "2503.00001" })),
    });
    const first = await importByIdentifier(handle.db, owner, client, { scheme: "doi", value: "10.1234/published" });
    const second = await importByIdentifier(handle.db, owner, client, { scheme: "arxiv", value: "2503.00001" });
    expect(second.workId).toBe(first.workId);
    expect(second.created).toBe(false);
    expect(await worksHolding(owner, "arxiv", "2503.00001")).toEqual([{ workId: first.workId }]);
  });

  it("DOI then arXiv unknown to OpenAlex: a second work, and the arXiv record's DOI records a possible duplicate", async () => {
    const owner = await freshOwner("doi-then-unknown-arxiv");
    const client = scripted({ "doi:10.1234/journal": result(oaRecord("W1101", { doi: "10.1234/journal" })) });
    const published = await importByIdentifier(handle.db, owner, client, { scheme: "doi", value: "10.1234/journal" });
    const preprint = await importByIdentifier(handle.db, owner, client, { scheme: "arxiv", value: "2503.00002" });
    expect(preprint.workId).not.toBe(published.workId);
    const applied = await applyArxivRecord(handle.db, owner, {
      workId: preprint.workId,
      arxivId: "2503.00002",
      entry: arxivEntry("2503.00002", "10.1234/journal"),
      raw: null,
    });
    // arXiv is the strongest identifier: the record stays with the preprint's work; the DOI stays put.
    expect(applied.workId).toBe(preprint.workId);
    expect(applied.possibleDuplicates).toEqual([published.workId]);
    expect(await worksHolding(owner, "doi", "10.1234/journal")).toEqual([{ workId: published.workId }]);
    // Without an arXivRaw record only the version the API entry describes is recorded, with no licence.
    const versions = (await getWork(handle.db, owner, preprint.workId))!.versions;
    expect(versions.map((v) => [v.arxivVersion, v.licence, v.withdrawn])).toEqual([[1, null, false]]);
    const suggestions = await possibleDuplicates(handle.db, owner, published.workId);
    expect(suggestions).toEqual([expect.objectContaining({ workId: preprint.workId, reason: "shared_identifier" })]);
  });

  it("arXiv then DOI: OpenAlex's arXiv location ties the published DOI to the existing work", async () => {
    const owner = await freshOwner("arxiv-then-doi");
    const client = scripted({ "doi:10.1234/nature": result(oaRecord("W1201", { doi: "10.1234/nature", arxiv: "2503.00003" })) });
    const preprint = await importByIdentifier(handle.db, owner, client, { scheme: "arxiv", value: "2503.00003" });
    await applyArxivRecord(handle.db, owner, {
      workId: preprint.workId,
      arxivId: "2503.00003",
      entry: arxivEntry("2503.00003"),
      raw: null,
    });
    const published = await importByIdentifier(handle.db, owner, client, { scheme: "doi", value: "10.1234/nature" });
    expect(published.workId).toBe(preprint.workId);
    expect(published.possibleDuplicates).toEqual([]);
    const ids = (await getWork(handle.db, owner, preprint.workId))!.identifiers.map((i) => `${i.scheme}:${i.value}`);
    expect(ids).toEqual(expect.arrayContaining(["arxiv:2503.00003", "doi:10.1234/nature", "openalex:W1201"]));
    expect(await versionsWithoutArxivIdentifier(owner)).toBe(0);
  });

  it("refresh after an OpenAlex merge adds the new W and marks the old one superseded", async () => {
    const owner = await freshOwner("openalex-merge");
    const merged = oaRecord("W1302", { doi: "10.1234/merged", title: "The title OpenAlex reports now" });
    const client = scripted({
      "openalex:W1301": result(oaRecord("W1301", { title: "An older title" })),
    });
    const imported = await importByIdentifier(handle.db, owner, client, { scheme: "openalex", value: "W1301" });
    const after = scripted({ "openalex:W1301": result(merged, "W1301") });
    const refreshed = await refreshWork(handle.db, owner, after, imported.workId);
    expect(refreshed).toEqual({ workId: imported.workId, merged: true });
    const ids = (await getWork(handle.db, owner, imported.workId))!.identifiers;
    expect(ids.find((i) => i.value === "W1302")?.status).toBe("current");
    expect(ids.find((i) => i.value === "W1301")?.status).toBe("superseded");
    const index = await ownerWorkIndex(handle.db, owner);
    expect(workIdFor(index, { scheme: "openalex", value: "W1301" })).toBe(imported.workId);
    expect(workIdFor(index, { scheme: "openalex", value: "W1302" })).toBe(imported.workId);
    expect((await getWork(handle.db, owner, imported.workId))!.work.title).toBe("The title OpenAlex reports now");
    // A refresh never overwrites a field the owner edited.
    await editWorkFields(handle.db, owner, imported.workId, { title: "My corrected title", publicationYear: 2023 });
    const again = scripted({ "openalex:W1302": result(oaRecord("W1302", { title: "Provider title" })) });
    await refreshWork(handle.db, owner, again, imported.workId);
    const work = (await getWork(handle.db, owner, imported.workId))!.work;
    expect(work.title).toBe("My corrected title");
    expect(work.publicationYear).toBe(2023);
    expect(work.ownerEditedFields).toEqual(expect.arrayContaining(["title", "publicationYear"]));
    expect(work.provenance.title?.source).toBe("owner");
    // A failed refresh changes nothing.
    const down = scripted({}, { openalexWork: async () => Promise.reject(new ScholarlyProviderError("openalex", "unavailable", "down")) });
    await expect(refreshWork(handle.db, owner, down, imported.workId)).rejects.toThrow(
      "The provider could not be reached just now. Nothing was changed; try again later.",
    );
    expect((await getWork(handle.db, owner, imported.workId))!.work.title).toBe("My corrected title");
  });
});

describe("merging works", () => {
  it("moves everything to A in one transaction, combines flags, keeps A's edits and leaves B a tombstone", async () => {
    const owner = await freshOwner("merge");
    const client = scripted({
      "doi:10.1234/a": result(oaRecord("W1401", { doi: "10.1234/a", title: "Paper A" })),
      "doi:10.1234/b": result(oaRecord("W1402", { doi: "10.1234/b", title: "Paper B" })),
    });
    const a = (await importByIdentifier(handle.db, owner, client, { scheme: "doi", value: "10.1234/a" })).workId;
    const b = (await importByIdentifier(handle.db, owner, client, { scheme: "doi", value: "10.1234/b" })).workId;
    await setWorkFlags(handle.db, owner, a, { readLater: true });
    await setWorkFlags(handle.db, owner, b, { favourite: true, read: true });
    await editWorkFields(handle.db, owner, a, { title: "A as I call it" });
    await editWorkFields(handle.db, owner, b, { title: "B as I call it", venue: "My venue note" });
    const bDoc = await attachUploadToWork(handle.db, blobs, {
      ownerId: owner,
      workId: b,
      filename: "b.pdf",
      mediaType: "application/pdf",
      data: Buffer.from(`%PDF-1.4\n% merge ${randomUUID()}\n`, "latin1"),
      maxBytes: 1_000_000,
    });
    const [shelf] = await handle.db.insert(libraryCollection).values({ ownerId: owner, kind: "shelf", name: "Both" }).returning();
    const [trail] = await handle.db.insert(libraryCollection).values({ ownerId: owner, kind: "trail", name: "Only B" }).returning();
    await handle.db.insert(libraryCollectionItem).values([
      { collectionId: shelf!.id, ownerId: owner, workId: a, position: 1, reason: "A's reason" },
      { collectionId: shelf!.id, ownerId: owner, workId: b, position: 2, reason: "B's reason" },
      { collectionId: trail!.id, ownerId: owner, workId: b, position: 1, reason: "why B comes first" },
    ]);
    const [note] = await handle.db.insert(notebookEntry).values({ ownerId: owner, title: "On B", scholarlyWorkId: b }).returning();
    const [aBefore] = await handle.db.select().from(scholarlyWork).where(eq(scholarlyWork.id, a));
    const [bBefore] = await handle.db.select().from(scholarlyWork).where(eq(scholarlyWork.id, b));

    await mergeWorks(handle.db, owner, a, b);
    const merged = (await getWork(handle.db, owner, a))!;
    expect(merged.work.title).toBe("A as I call it");
    expect(merged.work.venue).toBe("My venue note");
    expect(merged.work.favourite).toBe(true);
    expect(merged.work.readLater).toBe(true);
    expect(merged.work.readAt?.getTime()).toBe(bBefore!.readAt!.getTime());
    expect(merged.work.savedAt?.getTime()).toBe(Math.min(aBefore!.savedAt!.getTime(), bBefore!.savedAt!.getTime()));
    expect(merged.identifiers.map((i) => i.value)).toEqual(expect.arrayContaining(["10.1234/a", "10.1234/b", "W1401", "W1402"]));
    expect(merged.documents.map((d) => d.asset.id)).toEqual([bDoc.asset.id]);
    const [movedNote] = await handle.db.select().from(notebookEntry).where(eq(notebookEntry.id, note!.id));
    expect(movedNote?.scholarlyWorkId).toBe(a);
    const items = await handle.db.select().from(libraryCollectionItem).where(eq(libraryCollectionItem.ownerId, owner));
    expect(items.filter((i) => i.collectionId === shelf!.id)).toEqual([expect.objectContaining({ workId: a, reason: "A's reason" })]);
    expect(items.filter((i) => i.collectionId === trail!.id)).toEqual([
      expect.objectContaining({ workId: a, reason: "why B comes first" }),
    ]);
    const [tombstone] = await handle.db.select().from(scholarlyWork).where(eq(scholarlyWork.id, b));
    expect(tombstone?.mergedIntoId).toBe(a);
    expect((await getWork(handle.db, owner, b))!.work.mergedIntoId).toBe(a);
    expect((await listWorks(handle.db, owner, "saved")).map((w) => w.work.id)).toEqual([a]);
    const [audit] = await handle.db
      .select()
      .from(auditEvent)
      .where(and(eq(auditEvent.ownerId, owner), eq(auditEvent.action, "scholarly:merge")));
    const details = audit!.details as { mergedWorkId: string; collectionItemsDropped: { reason: string }[] };
    expect(details.mergedWorkId).toBe(b);
    expect(details.collectionItemsDropped).toEqual([expect.objectContaining({ reason: "B's reason" })]);
    // Imports that resolve to B's identifiers now reach A.
    expect((await getWorkByIdentifier(handle.db, owner, "doi", "10.1234/b"))?.id).toBe(a);
    const reimport = await importByIdentifier(handle.db, owner, client, { scheme: "doi", value: "10.1234/b" });
    expect(reimport.workId).toBe(a);
    await expect(mergeWorks(handle.db, owner, a, b)).rejects.toThrow("One of these papers was already merged into another.");
    await expect(mergeWorks(handle.db, owner, a, a)).rejects.toThrow("A paper cannot be merged into itself.");
    await expect(mergeWorks(handle.db, OTHER, a, b)).rejects.toThrow("Paper not found.");
  });
});

describe("a paper's Documents", () => {
  it("records the observed hash, detects a change and accepts the new file only when the geometry matches", async () => {
    const owner = await freshOwner("observed");
    const imported = await importByIdentifier(handle.db, owner, scripted({}), { scheme: "arxiv", value: "1706.03762" });
    const raw = await fixture.arxivRaw("1706.03762");
    const entries = await fixture.arxivEntries([{ id: "1706.03762", version: null }]);
    await applyArxivRecord(handle.db, owner, { workId: imported.workId, arxivId: "1706.03762", entry: entries.entries[0]!, raw });
    const linked = await openArxivVersion(handle.db, owner, imported.workId, "1706.03762", 7);
    const first = "1".repeat(64);
    expect(await recordObservedHash(handle.db, owner, linked.id, { sha256: first, pageCount: 15 })).toEqual({
      status: "first",
      previous: null,
    });
    expect(await recordObservedHash(handle.db, owner, linked.id, { sha256: first })).toEqual({ status: "same", previous: first });
    expect(await recordObservedHash(handle.db, owner, linked.id, { sha256: "2".repeat(64) })).toEqual({
      status: "changed",
      previous: first,
    });
    await createAnnotation(handle.db, owner, {
      assetId: linked.id,
      physicalIndex: 2,
      kind: "highlight",
      anchor: { v: 1, coordSpace: "pdf_user_space", pageIndex: 2, pageView: [612, 792], rotate: 0, rects: [[72, 600, 400, 612]] },
    });
    const views = Array.from({ length: 15 }, () => [612, 792] as [number, number]);
    const differs = await acceptNewFile(handle.db, owner, linked.id, {
      observedSha256: "2".repeat(64),
      pageCount: 15,
      pageViews: views.map((v, i) => (i === 2 ? [600, 800] : v)),
    });
    expect(differs.accepted).toBe(false);
    expect((await handle.db.select().from(annotation).where(eq(annotation.assetId, linked.id)))[0]?.mappingStatus).toBe("needs_repair");
    const accepted = await acceptNewFile(handle.db, owner, linked.id, { observedSha256: "2".repeat(64), pageCount: 15, pageViews: views });
    expect(accepted).toEqual({ accepted: true, problems: [] });
    const [after] = await handle.db.select().from(resourceAsset).where(eq(resourceAsset.id, linked.id));
    expect(after?.observedSha256).toBe("2".repeat(64));
    // Marked for repair by the refusal, the note is neither checked nor changed by the acceptance (see the next test).
    expect((await handle.db.select().from(annotation).where(eq(annotation.assetId, linked.id)))[0]?.mappingStatus).toBe("needs_repair");
    await expect(recordObservedHash(handle.db, owner, linked.id, { sha256: "not-a-hash" })).rejects.toThrow(
      "The reported file hash is not valid.",
    );
    await expect(recordObservedHash(handle.db, OTHER, linked.id, { sha256: first })).rejects.toThrow("Asset not found.");
    // ArXiv's non-exclusive licence for v7 does not allow a private copy.
    expect(await requestPrivateCopy(handle.db, owner, linked.id)).toEqual({
      queued: false,
      reason: "arXiv's licence for this version does not permit Corniversity to store a copy; it is read from arxiv.org.",
    });
  });

  it("keeps the notes on a changed file by checking only resolved anchors measured on another file", async () => {
    const owner = await freshOwner("accept-scope");
    const imported = await importByIdentifier(handle.db, owner, scripted({}), { scheme: "arxiv", value: "1706.03762" });
    const raw = await fixture.arxivRaw("1706.03762");
    const entries = await fixture.arxivEntries([{ id: "1706.03762", version: null }]);
    await applyArxivRecord(handle.db, owner, { workId: imported.workId, arxivId: "1706.03762", entry: entries.entries[0]!, raw });
    const linked = await openArxivVersion(handle.db, owner, imported.workId, "1706.03762", 7);
    const [oldBytes, newBytes] = ["a".repeat(64), "b".repeat(64)];
    await recordObservedHash(handle.db, owner, linked.id, { sha256: oldBytes, pageCount: 15 });
    const anchor = (pageIndex: number) => ({
      v: 1,
      coordSpace: "pdf_user_space",
      pageIndex,
      pageView: [612, 792],
      rotate: 0,
      rects: [[72, 600, 400, 612]],
    });
    // Resolved on the recorded file (page 3), marked for repair earlier (page 4), and made on the new bytes (page 5).
    const resolved = await createAnnotation(handle.db, owner, {
      assetId: linked.id,
      physicalIndex: 2,
      kind: "highlight",
      anchor: anchor(2),
    });
    const repair = await createAnnotation(handle.db, owner, { assetId: linked.id, physicalIndex: 3, kind: "highlight", anchor: anchor(3) });
    await handle.db.update(annotation).set({ mappingStatus: "needs_repair" }).where(eq(annotation.id, repair.id));
    expect((await recordObservedHash(handle.db, owner, linked.id, { sha256: newBytes })).status).toBe("changed");
    const onNew = await createAnnotation(handle.db, owner, {
      assetId: linked.id,
      physicalIndex: 4,
      kind: "highlight",
      anchor: anchor(4),
      loadedSha256: newBytes,
    });
    expect(onNew.anchor?.documentSha256).toBe(newBytes);
    const row = async (id: string) => (await handle.db.select().from(annotation).where(eq(annotation.id, id)))[0]!;
    const views = (changed: number[]) =>
      Array.from({ length: 15 }, (_, i) => (changed.includes(i) ? [600, 800] : [612, 792]) as [number, number]);

    // Refused (the resolved note's page differs): only that note is marked; the others are left as they were.
    const refused = await acceptNewFile(handle.db, owner, linked.id, { observedSha256: newBytes, pageCount: 15, pageViews: views([2, 4]) });
    expect(refused.accepted).toBe(false);
    expect((await row(resolved.id)).mappingStatus).toBe("needs_repair");
    expect((await row(onNew.id)).mappingStatus).toBe("resolved");
    expect((await row(onNew.id)).anchor?.documentSha256).toBe(newBytes);
    expect((await row(repair.id)).mappingStatus).toBe("needs_repair");

    // Accepted although the page of the note already marked for repair differs: that note is neither checked nor changed.
    await handle.db.update(annotation).set({ mappingStatus: "resolved" }).where(eq(annotation.id, resolved.id));
    const accepted = await acceptNewFile(handle.db, owner, linked.id, { observedSha256: newBytes, pageCount: 15, pageViews: views([3]) });
    expect(accepted).toEqual({ accepted: true, problems: [] });
    expect((await row(resolved.id)).anchor?.documentSha256).toBe(linked.sha256);
    expect((await row(resolved.id)).mappingStatus).toBe("resolved");
    expect((await row(onNew.id)).anchor?.documentSha256).toBe(linked.sha256);
    expect((await row(onNew.id)).mappingStatus).toBe("resolved");
    expect((await row(repair.id)).mappingStatus).toBe("needs_repair");
    const [after] = await handle.db.select().from(resourceAsset).where(eq(resourceAsset.id, linked.id));
    expect(after?.observedSha256).toBe(newBytes);
  });

  it("keeps a private copy of an openly licensed version: promoted in place with the licence as basis", async () => {
    const owner = await freshOwner("private-copy");
    const imported = await importByIdentifier(handle.db, owner, scripted({}), { scheme: "arxiv", value: "2305.18290" });
    const raw = await fixture.arxivRaw("2305.18290");
    const entries = await fixture.arxivEntries([{ id: "2305.18290", version: null }]);
    await applyArxivRecord(handle.db, owner, { workId: imported.workId, arxivId: "2305.18290", entry: entries.entries[0]!, raw });
    const linked = await openArxivVersion(handle.db, owner, imported.workId, "2305.18290", 3);
    const note = await createAnnotation(handle.db, owner, { assetId: linked.id, physicalIndex: 0, kind: "bookmark" });
    await markDocumentOpened(handle.db, owner, linked.id);
    expect(await requestPrivateCopy(handle.db, owner, linked.id)).toEqual({ queued: true });
    // The fixture provider has no recorded PDF; a scripted PDF stands in for arXiv's bytes here.
    const pdfBytes = new Uint8Array(Buffer.from(`%PDF-1.4\n% scripted stand-in ${randomUUID()}\n`, "latin1"));
    const requested: string[] = [];
    const client = scripted(
      {},
      {
        arxivPdf: async (id, version) => {
          requested.push(`${id}v${version}`);
          return pdfBytes;
        },
      },
    );
    const done = await keepPrivateCopy(handle.db, blobs, client, { ownerId: owner, assetId: linked.id, maxBytes: 1_000_000 });
    expect(done.outcome).toBe("promoted");
    expect(done.queued).toBe(true);
    expect(requested).toEqual(["2305.18290v3"]);
    const detail = (await getWork(handle.db, owner, imported.workId))!;
    const doc = detail.documents.find((d) => d.asset.id === linked.id)!;
    expect(doc.asset.status).toBe("processing");
    expect(doc.asset.storageKey).not.toBeNull();
    expect(doc.asset.origin).toBe("scholarly_import");
    expect(doc.permissions.local_read).toEqual({
      status: "allowed",
      basis: "licence reported by arXiv OAI-PMH on 2026-11-15 for v3: http://creativecommons.org/licenses/by/4.0/",
    });
    expect(doc.permissions.private_cloud_store.status).toBe("allowed");
    expect(doc.permissions.local_extract.status).toBe("allowed");
    expect(doc.permissions.share.status).toBe("denied");
    expect(doc.permissions.external_ai.status).toBe("unknown");
    expect((await handle.db.select().from(annotation).where(eq(annotation.id, note.id)))[0]?.assetId).toBe(linked.id);
    expect((await handle.db.select().from(readingProgress).where(eq(readingProgress.assetId, linked.id)))[0]?.lastOpenedAt).toBeInstanceOf(
      Date,
    );
    // A second run finds the copy already stored.
    expect((await keepPrivateCopy(handle.db, blobs, client, { ownerId: owner, assetId: linked.id, maxBytes: 1_000_000 })).outcome).toBe(
      "already_stored",
    );
  });
});

describe("corrections and saving conflicts", () => {
  it("refuses a correction whose field changed after the form showed it; fields the form did not change stay as they are", async () => {
    const owner = await freshOwner("edit-conflict");
    const [work] = await handle.db
      .insert(scholarlyWork)
      .values({ ownerId: owner, title: "Original title", venue: "Old venue", abstract: "Reported by arXiv." })
      .returning();
    const id = work!.id;
    // Another tab corrects the venue first.
    await editWorkFields(handle.db, owner, id, { venue: "Venue from tab B" }, { venue: "Old venue" });
    // This form still showed the old venue and changes it too: refused as a whole, nothing written.
    await expect(
      editWorkFields(
        handle.db,
        owner,
        id,
        { venue: "Venue from tab A", title: "New title" },
        { venue: "Old venue", title: "Original title" },
      ),
    ).rejects.toThrow(
      "These details changed after you opened the form, so nothing was saved. The page now shows them; make your correction again.",
    );
    let current = (await getWork(handle.db, owner, id))!.work;
    expect([current.title, current.venue]).toEqual(["Original title", "Venue from tab B"]);
    // A form that changes only the title leaves the venue (changed meanwhile) and the abstract alone.
    await editWorkFields(handle.db, owner, id, { title: "New title" }, { title: "Original title" });
    current = (await getWork(handle.db, owner, id))!.work;
    expect([current.title, current.venue, current.abstract]).toEqual(["New title", "Venue from tab B", "Reported by arXiv."]);
    expect([...current.ownerEditedFields].sort()).toEqual(["title", "venue"]);
    // A form showing values the way the page does (authors one per line, an empty year) compares equal to what is stored.
    await editWorkFields(handle.db, owner, id, { publicationYear: 2017 }, { publicationYear: null, authors: [] });
    expect((await getWork(handle.db, owner, id))!.work.publicationYear).toBe(2017);
    // Without the shown values (an older form) a correction applies as before.
    await editWorkFields(handle.db, owner, id, { workType: "article" });
    expect((await getWork(handle.db, owner, id))!.work.workType).toBe("article");
    await expect(editWorkFields(handle.db, OTHER, id, { title: "x" }, { title: "New title" })).rejects.toThrow("Paper not found.");
  });
});

describe("flags, lists, search and subjects", () => {
  it("lists saved, read later, favourites, read and recently opened papers; searches titles and authors", async () => {
    const owner = await freshOwner("lists");
    const client = scripted({
      "doi:10.1234/l1": result(oaRecord("W1501", { doi: "10.1234/l1", title: "Banach spaces and their duals" })),
      "doi:10.1234/l2": result(oaRecord("W1502", { doi: "10.1234/l2", title: "Quantum fields on curved spacetime" })),
    });
    const one = (await importByIdentifier(handle.db, owner, client, { scheme: "doi", value: "10.1234/l1" })).workId;
    const two = (await importByIdentifier(handle.db, owner, client, { scheme: "doi", value: "10.1234/l2" }, { save: false })).workId;
    await setWorkFlags(handle.db, owner, one, { favourite: true, readLater: true });
    expect((await listWorks(handle.db, owner, "saved")).map((w) => w.work.id)).toEqual([one]);
    expect((await listWorks(handle.db, owner, "favourites")).map((w) => w.work.id)).toEqual([one]);
    expect((await listWorks(handle.db, owner, "read_later")).map((w) => w.work.id)).toEqual([one]);
    expect(await listWorks(handle.db, owner, "read")).toEqual([]);
    await saveWork(handle.db, owner, two);
    await setWorkFlags(handle.db, owner, two, { read: true });
    expect((await listWorks(handle.db, owner, "read")).map((w) => w.work.id)).toEqual([two]);
    await unsaveWork(handle.db, owner, two);
    expect((await listWorks(handle.db, owner, "saved")).map((w) => w.work.id)).toEqual([one]);
    const doc = await attachUploadToWork(handle.db, blobs, {
      ownerId: owner,
      workId: two,
      filename: "two.pdf",
      mediaType: "application/pdf",
      data: Buffer.from(`%PDF-1.4\n% lists ${randomUUID()}\n`, "latin1"),
      maxBytes: 1_000_000,
    });
    await markDocumentOpened(handle.db, owner, doc.asset.id);
    const recent = await listWorks(handle.db, owner, "recent");
    expect(recent.map((w) => w.work.id)).toEqual([two]);
    expect(recent[0]!.lastOpenedAt).toBeInstanceOf(Date);
    expect((await searchMyLibrary(handle.db, owner, "Banach")).map((r) => r.work.id)).toEqual([one]);
    expect((await searchMyLibrary(handle.db, owner, "Scripted")).length).toBe(2);
    expect(await searchMyLibrary(handle.db, OTHER, "Banach")).toEqual([]);
    expect(await listWorks(handle.db, OTHER, "saved")).toEqual([]);
  });

  it("imports a list item without fetching it again", async () => {
    const owner = await freshOwner("list-item");
    const imported = await importFromOpenAlexRecord(handle.db, owner, oaRecord("W1601", { doi: "10.1234/item", title: "A listed work" }));
    expect((await getWork(handle.db, owner, imported.workId))!.work.title).toBe("A listed work");
  });
});

describe("integrity notices and complete deletion", () => {
  it("records Crossref's retraction and correction notices for the work's DOI", async () => {
    const owner = await freshOwner("integrity");
    const [work] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "A retracted paper" }).returning();
    await handle.db
      .insert(scholarlyIdentifier)
      .values({ ownerId: owner, workId: work!.id, scheme: "doi", value: "10.1016/s0140-6736(97)11096-0", source: "fixture" });
    const checked = await refreshIntegrity(handle.db, owner, fixture, work!.id);
    expect(checked.checked).toEqual(["10.1016/s0140-6736(97)11096-0"]);
    const detail = (await getWork(handle.db, owner, work!.id))!;
    expect(detail.integrityNotices.map((n) => `${n.type}:${n.source}`).sort()).toEqual([
      "correction:retraction-watch",
      "retraction:retraction-watch",
    ]);
    expect(detail.work.integrityCheckedAt).toBeInstanceOf(Date);
    await expect(refreshIntegrity(handle.db, OTHER, fixture, work!.id)).rejects.toThrow("Paper not found.");
  });

  it("in fixture mode a DOI with no recorded Crossref answer is not checked: its notices stay and the work is not marked checked", async () => {
    const owner = await freshOwner("integrity-unrecorded");
    const earlier = {
      type: "correction" as const,
      source: "crossref" as const,
      concerns: "10.1063/1.464913",
      label: "Correction",
      retrievedAt: "2026-01-01T00:00:00.000Z",
    };
    const [work] = await handle.db
      .insert(scholarlyWork)
      .values({ ownerId: owner, title: "Two DOIs, one recorded", integrityNotices: [earlier] })
      .returning();
    await handle.db.insert(scholarlyIdentifier).values([
      { ownerId: owner, workId: work!.id, scheme: "doi", value: "10.1016/s0140-6736(97)11096-0", source: "fixture" },
      { ownerId: owner, workId: work!.id, scheme: "doi", value: "10.1063/1.464913", source: "fixture" },
    ]);
    const result = await refreshIntegrity(handle.db, owner, fixture, work!.id);
    expect(result).toEqual({ checked: ["10.1016/s0140-6736(97)11096-0"], notices: 2, unrecorded: ["10.1063/1.464913"] });
    const detail = (await getWork(handle.db, owner, work!.id))!;
    expect(detail.work.integrityCheckedAt).toBeNull();
    expect(detail.integrityNotices).toContainEqual(earlier);
    expect(detail.integrityNotices.some((n) => n.type === "retraction")).toBe(true);
    // The paper page reads the latest check from its job: the unrecorded DOIs, each a valid DOI.
    expect(detail.integrityJob).toBeNull();
    await requestWorkRefresh(handle.db, owner, work!.id, "integrity");
    await handle.db
      .update(jobRecord)
      .set({ status: "completed", result: { unrecorded: ["10.1063/1.464913", "<b>not a doi</b>"] } })
      .where(and(eq(jobRecord.ownerId, owner), sql`${jobRecord.payload}->>'workId' = ${work!.id}`));
    expect((await getWork(handle.db, owner, work!.id))!.integrityJob).toMatchObject({
      status: "completed",
      error: null,
      unrecorded: ["10.1063/1.464913"],
    });
    expect((await getWork(handle.db, OTHER, work!.id))?.integrityJob).toBeUndefined();
  });

  it("deletes the work, its Documents, blobs, annotations and positions; notebook entries stay unlinked", async () => {
    const owner = await freshOwner("delete");
    const imported = await importByIdentifier(handle.db, owner, scripted({}), { scheme: "arxiv", value: "2305.18290" });
    const raw = await fixture.arxivRaw("2305.18290");
    const entries = await fixture.arxivEntries([{ id: "2305.18290", version: null }]);
    await applyArxivRecord(handle.db, owner, { workId: imported.workId, arxivId: "2305.18290", entry: entries.entries[0]!, raw });
    const linked = await openArxivVersion(handle.db, owner, imported.workId, "2305.18290", 1);
    const stored = await attachUploadToWork(handle.db, blobs, {
      ownerId: owner,
      workId: imported.workId,
      filename: "own.pdf",
      mediaType: "application/pdf",
      data: Buffer.from(`%PDF-1.4\n% delete ${randomUUID()}\n`, "latin1"),
      maxBytes: 1_000_000,
    });
    await setPermission(handle.db, owner, stored.asset.id, "external_ai", "allowed", "mine");
    await createAnnotation(handle.db, owner, { assetId: linked.id, physicalIndex: 0, kind: "bookmark" });
    await createAnnotation(handle.db, owner, { assetId: stored.asset.id, physicalIndex: 0, noteMarkdown: "note" });
    await markDocumentOpened(handle.db, owner, linked.id);
    const [entry] = await handle.db
      .insert(notebookEntry)
      .values({ ownerId: owner, title: "Paper note", scholarlyWorkId: imported.workId })
      .returning();
    const [shelf] = await handle.db.insert(libraryCollection).values({ ownerId: owner, kind: "shelf", name: "S" }).returning();
    await handle.db.insert(libraryCollectionItem).values({ collectionId: shelf!.id, ownerId: owner, workId: imported.workId, position: 1 });
    const removed = await deleteWorkCompletely(handle.db, blobs, owner, imported.workId);
    expect(removed).toEqual({ documents: 2, annotations: 2 });
    expect(await getWork(handle.db, owner, imported.workId)).toBeNull();
    // The Jobs page links a job's paper only while it exists.
    expect(await existingWorkIds(handle.db, owner, [imported.workId])).toEqual(new Set());
    expect(await blobs.exists(stored.asset.storageKey!)).toBe(false);
    expect(await handle.db.select().from(resourceAsset).where(eq(resourceAsset.ownerId, owner))).toEqual([]);
    expect(await handle.db.select().from(scholarlyIdentifier).where(eq(scholarlyIdentifier.ownerId, owner))).toEqual([]);
    expect(await handle.db.select().from(readingProgress).where(eq(readingProgress.ownerId, owner))).toEqual([]);
    const [kept] = await handle.db.select().from(notebookEntry).where(eq(notebookEntry.id, entry!.id));
    expect(kept?.scholarlyWorkId).toBeNull();
    expect(await handle.db.select().from(libraryCollectionItem).where(eq(libraryCollectionItem.ownerId, owner))).toEqual([]);
  });
});

describe("another owner's ids are not found", () => {
  it("refuses every operation on a work that belongs to someone else", async () => {
    const client = scripted({ "doi:10.1234/mine": result(oaRecord("W1701", { doi: "10.1234/mine" })) });
    const mine = (await importByIdentifier(handle.db, OWNER, client, { scheme: "doi", value: "10.1234/mine" })).workId;
    expect(await getWork(handle.db, OTHER, mine)).toBeNull();
    expect(await existingWorkIds(handle.db, OWNER, [mine, "not-a-uuid", mine])).toEqual(new Set([mine]));
    expect(await existingWorkIds(handle.db, OTHER, [mine])).toEqual(new Set());
    expect(await getWorkByIdentifier(handle.db, OTHER, "doi", "10.1234/mine")).toBeNull();
    expect(workIdFor(await ownerWorkIndex(handle.db, OTHER), { scheme: "doi", value: "10.1234/mine" })).toBeNull();
    for (const attempt of [
      () => saveWork(handle.db, OTHER, mine),
      () => unsaveWork(handle.db, OTHER, mine),
      () => setWorkFlags(handle.db, OTHER, mine, { favourite: true }),
      () => editWorkFields(handle.db, OTHER, mine, { title: "x" }),
      () => openArxivVersion(handle.db, OTHER, mine, "2305.18290", 1),
      () => refreshWork(handle.db, OTHER, client, mine),
      () => possibleDuplicates(handle.db, OTHER, mine),
      () => deleteWorkCompletely(handle.db, blobs, OTHER, mine),
      () =>
        attachUploadToWork(handle.db, blobs, {
          ownerId: OTHER,
          workId: mine,
          filename: "x.pdf",
          mediaType: "application/pdf",
          data: Buffer.from("%PDF-1.4\n% x\n", "latin1"),
          maxBytes: 1000,
        }),
    ]) {
      await expect(attempt()).rejects.toThrow("Paper not found.");
    }
    expect(await getWork(handle.db, OWNER, "not-a-uuid")).toBeNull();
    // Another owner importing the same paper gets their own work.
    const theirs = await importByIdentifier(handle.db, OTHER, client, { scheme: "doi", value: "10.1234/mine" });
    expect(theirs.workId).not.toBe(mine);
  });
});

/**
 * An owner merge of B into A committing while an import or an arXiv record waits for B's row
 * lock: a raw connection holds both rows FOR UPDATE (as mergeWorks does), moves B's identifiers and
 * versions to A, marks B merged and commits once the other call is blocked.
 */
async function mergeWhileBlocked(owner: string, a: string, b: string, call: () => Promise<unknown>): Promise<unknown> {
  const c = await handle.pool.connect();
  try {
    await c.query("begin");
    const holder = ((await c.query("select pg_backend_pid() as pid")).rows[0] as { pid: number }).pid;
    await c.query("select id from scholarly_work where id = any($1::uuid[]) order by id for update", [[a, b]]);
    const pending = call();
    let blocked = false;
    for (let i = 0; i < 200 && !blocked; i++) {
      const waiting = await handle.pool.query("select count(*)::int as n from pg_stat_activity where $1 = any(pg_blocking_pids(pid))", [
        holder,
      ]);
      blocked = (waiting.rows[0] as { n: number }).n > 0;
      if (!blocked) await new Promise((r) => setTimeout(r, 25));
    }
    expect(blocked).toBe(true);
    await c.query("update scholarly_identifier set work_id = $1 where owner_id = $2 and work_id = $3", [a, owner, b]);
    await c.query("update scholarly_version set work_id = $1 where owner_id = $2 and work_id = $3", [a, owner, b]);
    await c.query("update scholarly_work set merged_into_id = $1 where id = $2", [a, b]);
    await c.query("commit");
    return await pending;
  } finally {
    c.release();
  }
}

describe("review fixes: merges, provenance, refresh, deletion", () => {
  it("an import racing an owner merge writes to the survivor, never the tombstone", async () => {
    const owner = await freshOwner("merge-race");
    const b = await importByIdentifier(
      handle.db,
      owner,
      scripted({ "doi:10.9999/race": result(oaRecord("W91001", { doi: "10.9999/race" })) }),
      {
        scheme: "doi",
        value: "10.9999/race",
      },
    );
    const [a] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Survivor A", savedAt: new Date() }).returning();
    // OpenAlex now answers with a new W for the same DOI.
    const later = scripted({ "doi:10.9999/race": result(oaRecord("W91002", { doi: "10.9999/race" })) });
    const imported = (await mergeWhileBlocked(owner, a!.id, b.workId, () =>
      importByIdentifier(handle.db, owner, later, { scheme: "doi", value: "10.9999/race" }),
    )) as { workId: string };
    expect(imported.workId).toBe(a!.id);
    expect(await worksHolding(owner, "openalex", "W91002")).toEqual([{ workId: a!.id }]);
  });

  it("an arXiv record racing an owner merge keeps the invariant and opens on the survivor", async () => {
    const owner = await freshOwner("merge-race-arxiv");
    const [b] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "B", savedAt: new Date() }).returning();
    await handle.db
      .insert(scholarlyIdentifier)
      .values({ ownerId: owner, workId: b!.id, scheme: "arxiv", value: "2509.40001", source: "owner" });
    const [a] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "A", savedAt: new Date() }).returning();
    await mergeWhileBlocked(owner, a!.id, b!.id, () =>
      applyArxivRecord(handle.db, owner, { workId: b!.id, arxivId: "2509.40001", entry: arxivEntry("2509.40001"), raw: null }),
    );
    expect(await versionsWithoutArxivIdentifier(owner)).toBe(0);
    expect((await openArxivVersion(handle.db, owner, a!.id, "2509.40001", 1)).status).toBe("linked_remote");
  });

  it("an arXiv id OpenAlex does not know is labelled as the owner's (live mode) until arXiv's record carries it", async () => {
    const owner = await freshOwner("owner-typed");
    // A scripted test double reporting itself as live: OpenAlex has no record of the id.
    const live: ScholarlyClient = { ...scripted({}), mode: "live" };
    const imported = await importByIdentifier(handle.db, owner, live, { scheme: "arxiv", value: "2509.40002" });
    const sourceNow = async () =>
      (
        await handle.db
          .select({ source: scholarlyIdentifier.source })
          .from(scholarlyIdentifier)
          .where(and(eq(scholarlyIdentifier.ownerId, owner), eq(scholarlyIdentifier.value, "2509.40002")))
      )[0]?.source;
    expect(await sourceNow()).toBe("owner");
    // The worker applies arXiv's record (recorded entry, labelled fixture): now arXiv's report.
    await applyArxivRecord(handle.db, owner, {
      workId: imported.workId,
      arxivId: "2509.40002",
      entry: arxivEntry("2509.40002"),
      raw: null,
    });
    expect(await sourceNow()).toBe("fixture");
  });

  it("refreshing A whose record now names an arXiv id B holds updates A and leaves B alone", async () => {
    const owner = await freshOwner("refresh-target");
    const doi = "10.9999/published-refresh";
    const a = await importByIdentifier(
      handle.db,
      owner,
      scripted({ [`doi:${doi}`]: result(oaRecord("W92001", { doi, title: "Published title" })) }),
      {
        scheme: "doi",
        value: doi,
      },
    );
    const [b] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Preprint title", savedAt: new Date() }).returning();
    await handle.db
      .insert(scholarlyIdentifier)
      .values({ ownerId: owner, workId: b!.id, scheme: "arxiv", value: "2509.40003", source: "owner" });
    const later = scripted({
      "openalex:W92001": result(oaRecord("W92001", { doi, arxiv: "2509.40003", title: "Published title, corrected" })),
    });
    const refreshed = await refreshWork(handle.db, owner, later, a.workId);
    expect(refreshed.workId).toBe(a.workId);
    expect((await getWork(handle.db, owner, a.workId))!.work.title).toBe("Published title, corrected");
    expect((await getWork(handle.db, owner, b!.id))!.work.title).toBe("Preprint title");
    expect(await worksHolding(owner, "arxiv", "2509.40003")).toEqual([{ workId: b!.id }]);
    expect(await possibleDuplicates(handle.db, owner, a.workId)).toEqual([
      expect.objectContaining({ workId: b!.id, reason: "shared_identifier" }),
    ]);
  });

  it("deleting a merged paper (a stale page) is refused; the paper it was merged into stays", async () => {
    const owner = await freshOwner("delete-tombstone");
    const [a] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Survivor", savedAt: new Date() }).returning();
    const [b] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Merged away", savedAt: new Date() }).returning();
    await mergeWorks(handle.db, owner, a!.id, b!.id);
    const refused = await deleteWorkCompletely(handle.db, blobs, owner, b!.id).catch((e: unknown) => e as ScholarlyError);
    expect(refused).toBeInstanceOf(ScholarlyError);
    expect((refused as ScholarlyError).message).toBe("This paper was merged into another paper; delete it from that paper's page.");
    expect((refused as ScholarlyError).details.workId).toBe(a!.id);
    expect(await handle.db.select({ id: scholarlyWork.id }).from(scholarlyWork).where(eq(scholarlyWork.ownerId, owner))).toHaveLength(2);
    // The survivor itself is deleted by its own id, with its tombstone.
    await deleteWorkCompletely(handle.db, blobs, owner, a!.id);
    expect(await handle.db.select().from(scholarlyWork).where(eq(scholarlyWork.ownerId, owner))).toEqual([]);
  });

  it("a merge keeps B's trail reason where A's step has none, and A's own reason where it has one", async () => {
    const owner = await freshOwner("merge-reasons");
    const [a] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "A", savedAt: new Date() }).returning();
    const [b] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "B", savedAt: new Date() }).returning();
    const [trail] = await handle.db.insert(libraryCollection).values({ ownerId: owner, kind: "trail", name: "Route" }).returning();
    const [shelf] = await handle.db.insert(libraryCollection).values({ ownerId: owner, kind: "shelf", name: "Both" }).returning();
    await handle.db.insert(libraryCollectionItem).values([
      { collectionId: trail!.id, ownerId: owner, workId: a!.id, position: 1, reason: null },
      { collectionId: trail!.id, ownerId: owner, workId: b!.id, position: 2, reason: "Read this second: it proves the lemma." },
      { collectionId: shelf!.id, ownerId: owner, workId: a!.id, position: 1, reason: "A's note" },
      { collectionId: shelf!.id, ownerId: owner, workId: b!.id, position: 2, reason: "B's note" },
    ]);
    await mergeWorks(handle.db, owner, a!.id, b!.id);
    const items = await handle.db.select().from(libraryCollectionItem).where(eq(libraryCollectionItem.ownerId, owner));
    expect(items.find((i) => i.collectionId === trail!.id)).toMatchObject({
      workId: a!.id,
      position: 1,
      reason: "Read this second: it proves the lemma.",
    });
    expect(items.find((i) => i.collectionId === shelf!.id)).toMatchObject({ workId: a!.id, reason: "A's note" });
    const [audit] = await handle.db
      .select()
      .from(auditEvent)
      .where(and(eq(auditEvent.ownerId, owner), eq(auditEvent.action, "scholarly:merge")));
    expect((audit!.details as { collectionItemsDropped: unknown[] }).collectionItemsDropped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ collectionId: trail!.id, reasonKept: true }),
        expect.objectContaining({ collectionId: shelf!.id, reason: "B's note", reasonKept: false }),
      ]),
    );
  });

  it("an entry-only arXiv record never un-withdraws a version arXivRaw marked withdrawn", async () => {
    const owner = await freshOwner("withdrawn-sticky");
    const imported = await importByIdentifier(handle.db, owner, scripted({}), { scheme: "arxiv", value: "2607.20049" });
    const entries = await fixture.arxivEntries([{ id: "2607.20049", version: null }]);
    const raw = await fixture.arxivRaw("2607.20049");
    await applyArxivRecord(handle.db, owner, { workId: imported.workId, arxivId: "2607.20049", entry: entries.entries[0]!, raw });
    const withdrawn = async () => (await getWork(handle.db, owner, imported.workId))!.versions.find((v) => v.arxivVersion === 2)?.withdrawn;
    expect(await withdrawn()).toBe(true);
    // The export API's entry describes v2 without a withdrawal hint; arXivRaw is not available this time.
    const entry = { ...entries.entries[0]!, version: 2, withdrawalHint: false };
    await applyArxivRecord(handle.db, owner, { workId: imported.workId, arxivId: "2607.20049", entry, raw: null });
    expect(await withdrawn()).toBe(true);
  });
});

describe("find and paper pages: library search filters, document jobs, deletion summary, integrity checks", () => {
  it("searches the owner's works with year, type and OpenAlex field filters and offset paging", async () => {
    const owner = await freshOwner("library-filters");
    const record = (id: string, title: string, year: number, type: string, field: string) => ({
      ...oaRecord(id, { doi: `10.1234/${id.toLowerCase()}`, title }),
      publicationYear: year,
      workType: type,
      subjects: [{ id: field, name: `Field ${field}`, level: "field" as const, score: null }],
    });
    const client = scripted({
      "doi:10.1234/w2001": result(record("W2001", "Spectral theory of operators", 2019, "article", "26")),
      "doi:10.1234/w2002": result(record("W2002", "Spectral methods for networks", 2023, "preprint", "17")),
      "doi:10.1234/w2003": result(record("W2003", "Spectral sequences explained", 2024, "article", "26")),
    });
    for (const id of ["w2001", "w2002", "w2003"])
      await importByIdentifier(handle.db, owner, client, { scheme: "doi", value: `10.1234/${id}` });
    const titles = async (options: Parameters<typeof searchMyLibrary>[3]) =>
      (await searchMyLibrary(handle.db, owner, "spectral", options)).map((r) => r.work.title).sort();
    expect((await titles({})).length).toBe(3);
    expect(await titles({ yearFrom: 2023 })).toEqual(["Spectral methods for networks", "Spectral sequences explained"]);
    expect(await titles({ yearTo: 2020 })).toEqual(["Spectral theory of operators"]);
    expect(await titles({ type: "preprint" })).toEqual(["Spectral methods for networks"]);
    expect(await titles({ fieldId: "26" })).toEqual(["Spectral sequences explained", "Spectral theory of operators"]);
    expect(await titles({ fieldId: "26", yearFrom: 2024 })).toEqual(["Spectral sequences explained"]);
    // Offset paging returns the rest, in the same order.
    const all = (await searchMyLibrary(handle.db, owner, "spectral", { limit: 3 })).map((r) => r.work.id);
    expect((await searchMyLibrary(handle.db, owner, "spectral", { limit: 2, offset: 1 })).map((r) => r.work.id)).toEqual(all.slice(1));
    // A malformed field id is ignored rather than injected.
    expect((await titles({ fieldId: "26') or ('1" })).length).toBe(3);
    expect(await searchMyLibrary(handle.db, OTHER, "spectral", { fieldId: "26" })).toEqual([]);
  });

  it("summarises what deleting a paper removes, exactly what deleteWorkCompletely then removes; another owner's id is null", async () => {
    const owner = await freshOwner("deletion-summary");
    const imported = await importByIdentifier(handle.db, owner, scripted({}), { scheme: "arxiv", value: "2305.18290" });
    const raw = await fixture.arxivRaw("2305.18290");
    const entries = await fixture.arxivEntries([{ id: "2305.18290", version: null }]);
    await applyArxivRecord(handle.db, owner, { workId: imported.workId, arxivId: "2305.18290", entry: entries.entries[0]!, raw });
    const linked = await openArxivVersion(handle.db, owner, imported.workId, "2305.18290", 2);
    const stored = await attachUploadToWork(handle.db, blobs, {
      ownerId: owner,
      workId: imported.workId,
      filename: "own.pdf",
      mediaType: "application/pdf",
      data: Buffer.from(`%PDF-1.4\n% summary ${randomUUID()}\n`, "latin1"),
      maxBytes: 1_000_000,
    });
    await createAnnotation(handle.db, owner, { assetId: linked.id, physicalIndex: 0, kind: "bookmark" });
    await createAnnotation(handle.db, owner, { assetId: stored.asset.id, physicalIndex: 0, noteMarkdown: "mine" });
    await createAnnotation(handle.db, owner, { assetId: stored.asset.id, physicalIndex: 1, noteMarkdown: "mine too" });
    await handle.db.insert(notebookEntry).values({ ownerId: owner, title: "Paper note", scholarlyWorkId: imported.workId });
    const summary = await workDeletionSummary(handle.db, owner, imported.workId);
    expect(summary).toEqual({ documents: 2, storedCopies: 1, annotations: 3, notebookEntries: 1, collections: 0 });
    expect(await workDeletionSummary(handle.db, OTHER, imported.workId)).toBeNull();
    expect(await workDeletionSummary(handle.db, owner, "not-a-uuid")).toBeNull();
    expect(await deleteWorkCompletely(handle.db, blobs, owner, imported.workId)).toEqual({ documents: 2, annotations: 3 });
  });

  it("lists each Document's latest private-copy job, and the fixture provider's stand-in PDF becomes the stored copy", async () => {
    const owner = await freshOwner("document-jobs");
    const imported = await importByIdentifier(handle.db, owner, scripted({}), { scheme: "arxiv", value: "2305.18290" });
    const raw = await fixture.arxivRaw("2305.18290");
    const entries = await fixture.arxivEntries([{ id: "2305.18290", version: null }]);
    await applyArxivRecord(handle.db, owner, { workId: imported.workId, arxivId: "2305.18290", entry: entries.entries[0]!, raw });
    const linked = await openArxivVersion(handle.db, owner, imported.workId, "2305.18290", 3);
    expect((await getWork(handle.db, owner, imported.workId))!.documentJobs).toEqual([]);
    expect(await requestPrivateCopy(handle.db, owner, linked.id)).toEqual({ queued: true });
    const queued = (await getWork(handle.db, owner, imported.workId))!.documentJobs;
    expect(queued).toEqual([expect.objectContaining({ assetId: linked.id, kind: "private_copy", status: "queued" })]);
    // The recorded fixture provider answers arXiv's PDF with its labelled stand-in (no scripted bytes here).
    const done = await keepPrivateCopy(handle.db, blobs, fixture, { ownerId: owner, assetId: linked.id, maxBytes: 1_000_000 });
    expect(done.outcome).toBe("promoted");
    const detail = (await getWork(handle.db, owner, imported.workId))!;
    const doc = detail.documents.find((d) => d.asset.id === linked.id)!;
    expect(doc.asset.storageKey).not.toBeNull();
    const bytes = await blobs.get(doc.asset.storageKey!);
    expect(Buffer.from(bytes!).toString("latin1")).toContain("Fixture stand-in for arXiv:2305.18290v3");
    expect(detail.documentJobs.map((j) => j.kind).sort()).toEqual(["extraction", "private_copy"]);
    // Another owner sees neither the work nor its jobs.
    expect(await getWork(handle.db, OTHER, imported.workId)).toBeNull();
  });

  it("queues the Crossref integrity check after a save only for a publisher DOI not yet checked", async () => {
    const owner = await freshOwner("integrity-due");
    const client = scripted({ "doi:10.1234/due": result(oaRecord("W2101", { doi: "10.1234/due" })) });
    const doi = (await importByIdentifier(handle.db, owner, client, { scheme: "doi", value: "10.1234/due" })).workId;
    const arxiv = (await importByIdentifier(handle.db, owner, scripted({}), { scheme: "arxiv", value: "2607.20049" })).workId;
    expect(await requestIntegrityCheckIfDue(handle.db, owner, doi)).toEqual({ queued: true });
    expect(await requestIntegrityCheckIfDue(handle.db, owner, arxiv)).toEqual({ queued: false });
    await handle.db.update(scholarlyWork).set({ integrityCheckedAt: new Date() }).where(eq(scholarlyWork.id, doi));
    expect(await requestIntegrityCheckIfDue(handle.db, owner, doi)).toEqual({ queued: false });
    await expect(requestIntegrityCheckIfDue(handle.db, OTHER, doi)).rejects.toThrow("Paper not found.");
  });

  it("a paper's file is a PDF: other files are refused before anything is stored or created", async () => {
    const owner = await freshOwner("pdf-only");
    const client = scripted({ "doi:10.1234/pdf-only": result(oaRecord("W2201", { doi: "10.1234/pdf-only" })) });
    const workId = (await importByIdentifier(handle.db, owner, client, { scheme: "doi", value: "10.1234/pdf-only" })).workId;
    const notes = Buffer.from(`Plain notes ${randomUUID()}\n`, "utf8");
    const base = { ownerId: owner, data: notes, maxBytes: 1_000_000 };
    for (const [filename, mediaType] of [
      ["notes.txt", "text/plain"],
      ["notes.md", "text/markdown"],
      ["notes", "application/octet-stream"],
    ] as const) {
      await expect(attachUploadToWork(handle.db, blobs, { ...base, workId, filename, mediaType })).rejects.toThrow(
        "A paper's file must be a PDF; nothing was stored.",
      );
      await expect(createWorkFromUpload(handle.db, blobs, { ...base, filename, mediaType })).rejects.toThrow(
        "A paper's file must be a PDF; nothing was stored.",
      );
    }
    // Named as a PDF but not one: refused by its signature.
    await expect(
      attachUploadToWork(handle.db, blobs, { ...base, workId, filename: "fake.pdf", mediaType: "application/pdf" }),
    ).rejects.toThrow("The file does not start with a PDF signature; it was not stored.");
    expect(await handle.db.select().from(resourceAsset).where(eq(resourceAsset.ownerId, owner))).toEqual([]);
    expect((await handle.db.select().from(scholarlyWork).where(eq(scholarlyWork.ownerId, owner))).map((w) => w.id)).toEqual([workId]);
  });
});

describe("writes racing an owner merge or a newer notice", () => {
  /** A Crossref double whose answers wait until `release` is called; `asked` resolves at the first call. */
  function heldCrossref(notice: (doi: string) => IntegrityNotice) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let markAsked!: () => void;
    const asked = new Promise<void>((resolve) => {
      markAsked = resolve;
    });
    const client = scripted(
      {},
      {
        crossrefWork: async (doi: string) => {
          markAsked();
          await gate;
          return { integrityNotices: [notice(doi)] } as never;
        },
      },
    );
    return { client, asked, release };
  }
  const retraction = (doi: string): IntegrityNotice => ({
    type: "retraction",
    source: "crossref",
    concerns: doi,
    label: "Retraction",
    retrievedAt: "2026-11-17T00:00:00.000Z",
  });

  it("an arXiv withdrawal notice written during the Crossref check is kept beside Crossref's notice", async () => {
    const owner = await freshOwner("integrity-race");
    const [work] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Racing notices" }).returning();
    await handle.db
      .insert(scholarlyIdentifier)
      .values({ ownerId: owner, workId: work!.id, scheme: "doi", value: "10.9999/race-notice", source: "fixture" });
    const held = heldCrossref(retraction);
    const pending = refreshIntegrity(handle.db, owner, held.client, work!.id);
    await held.asked;
    // The arXiv record job commits its withdrawal notice meanwhile.
    const withdrawn: IntegrityNotice = {
      type: "withdrawal",
      source: "arxiv",
      concerns: "arXiv:2509.40010v2",
      label: "Withdrawn on arXiv",
      retrievedAt: "2026-11-17T00:00:00.000Z",
    };
    await handle.db
      .update(scholarlyWork)
      .set({ integrityNotices: [withdrawn] })
      .where(eq(scholarlyWork.id, work!.id));
    held.release();
    await pending;
    const [after] = await handle.db.select().from(scholarlyWork).where(eq(scholarlyWork.id, work!.id));
    expect(after!.integrityNotices).toEqual(expect.arrayContaining([withdrawn, retraction("10.9999/race-notice")]));
    expect(after!.integrityNotices).toHaveLength(2);
    expect(after!.integrityCheckedAt).toBeInstanceOf(Date);
  });

  it("a Crossref check that finishes after an owner merge writes its notices on the survivor, never the tombstone", async () => {
    const owner = await freshOwner("integrity-merge");
    const [a] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Survivor", savedAt: new Date() }).returning();
    const [b] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Merged away", savedAt: new Date() }).returning();
    await handle.db
      .insert(scholarlyIdentifier)
      .values({ ownerId: owner, workId: b!.id, scheme: "doi", value: "10.9999/race-merge", source: "fixture" });
    const held = heldCrossref(retraction);
    const pending = refreshIntegrity(handle.db, owner, held.client, b!.id);
    await held.asked;
    await mergeWorks(handle.db, owner, a!.id, b!.id);
    held.release();
    await pending;
    const [survivor] = await handle.db.select().from(scholarlyWork).where(eq(scholarlyWork.id, a!.id));
    const [tombstone] = await handle.db.select().from(scholarlyWork).where(eq(scholarlyWork.id, b!.id));
    expect(survivor!.integrityNotices).toEqual([retraction("10.9999/race-merge")]);
    expect(tombstone!.integrityNotices).toEqual([]);
    expect(tombstone!.integrityCheckedAt).toBeNull();
  });

  it("a merge that brought DOIs the check did not ask about leaves the survivor not checked", async () => {
    const owner = await freshOwner("integrity-merge-dois");
    const [a] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Survivor", savedAt: new Date() }).returning();
    const [b] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Merged away", savedAt: new Date() }).returning();
    await handle.db.insert(scholarlyIdentifier).values([
      { ownerId: owner, workId: a!.id, scheme: "doi", value: "10.9999/survivor-own", source: "fixture" },
      { ownerId: owner, workId: b!.id, scheme: "doi", value: "10.9999/merged-own", source: "fixture" },
    ]);
    const held = heldCrossref(retraction);
    const pending = refreshIntegrity(handle.db, owner, held.client, b!.id);
    await held.asked;
    await mergeWorks(handle.db, owner, a!.id, b!.id);
    held.release();
    await pending;
    const [survivor] = await handle.db.select().from(scholarlyWork).where(eq(scholarlyWork.id, a!.id));
    expect(survivor!.integrityNotices).toEqual([retraction("10.9999/merged-own")]);
    expect(survivor!.integrityCheckedAt).toBeNull();
  });

  it("an edit that waited behind an owner merge is refused and writes nothing on the tombstone", async () => {
    const owner = await freshOwner("edit-merge-race");
    const [a] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Survivor", savedAt: new Date() }).returning();
    const [b] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Merged away", savedAt: new Date() }).returning();
    await expect(
      mergeWhileBlocked(owner, a!.id, b!.id, () => editWorkFields(handle.db, owner, b!.id, { title: "Corrected title" })),
    ).rejects.toThrow("These details changed after you opened the form, so nothing was saved.");
    const [tombstone] = await handle.db.select().from(scholarlyWork).where(eq(scholarlyWork.id, b!.id));
    expect(tombstone!.title).toBe("Merged away");
    expect(tombstone!.ownerEditedFields).toEqual([]);
  });

  it("a shelf item or a paper note that waited behind an owner merge goes to the survivor; a shelf never lists a tombstone", async () => {
    const owner = await freshOwner("add-merge-race");
    const [a] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Survivor", savedAt: new Date() }).returning();
    const [b] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Merged away", savedAt: new Date() }).returning();
    const [shelf] = await handle.db.insert(libraryCollection).values({ ownerId: owner, kind: "shelf", name: "Race" }).returning();
    const added = (await mergeWhileBlocked(owner, a!.id, b!.id, () => addToCollection(handle.db, owner, shelf!.id, b!.id))) as {
      item: { workId: string };
    };
    expect(added.item.workId).toBe(a!.id);

    const [c] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Survivor 2", savedAt: new Date() }).returning();
    const [d] = await handle.db.insert(scholarlyWork).values({ ownerId: owner, title: "Merged away 2", savedAt: new Date() }).returning();
    const entry = (await mergeWhileBlocked(owner, c!.id, d!.id, () =>
      createEntry(handle.db, owner, { title: "Paper note", bodyMarkdown: "", kind: "note", scholarlyWorkId: d!.id }),
    )) as { scholarlyWorkId: string | null };
    expect(entry.scholarlyWorkId).toBe(c!.id);

    // An item that still names a tombstone (written before this guard) is not listed.
    await handle.db.insert(libraryCollectionItem).values({ collectionId: shelf!.id, ownerId: owner, workId: b!.id, position: 2 });
    const detail = (await getCollection(handle.db, owner, shelf!.id))!;
    expect(detail.items.map((i) => i.work.id)).toEqual([a!.id]);
    expect(detail.total).toBe(1);
  });
});
