import { and, desc, eq, isNotNull, type SQL, sql } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { type Citation, notebookEntry, type StudyAnchor, scholarlyWork } from "../schema/index";

export type NotebookEntryRow = typeof notebookEntry.$inferSelect;
export type NotebookKind = NotebookEntryRow["kind"];

export const NOTEBOOK_KINDS: readonly NotebookKind[] = [
  "definition",
  "theorem",
  "example",
  "proof_attempt",
  "calculation",
  "question",
  "note",
];

export class NotebookError extends Error {
  constructor(
    readonly code: "invalid" | "not_found" | "prediction",
    message: string,
  ) {
    super(message);
    this.name = "NotebookError";
  }
}

function clean(input: { title: string; bodyMarkdown: string; kind: string; tags?: string[] }) {
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new NotebookError("invalid", "A title is required.");
  if (!NOTEBOOK_KINDS.includes(input.kind as NotebookKind)) throw new NotebookError("invalid", "Unknown entry kind.");
  const tags = [...new Set((input.tags ?? []).map((t) => t.trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 20);
  return { title, bodyMarkdown: input.bodyMarkdown.slice(0, 50_000), kind: input.kind as NotebookKind, tags };
}

/**
 * The durable notebook: definitions, theorems, examples, proof attempts, calculations, open
 * questions and notes, in Markdown with LaTeX, tagged and linked to exact source locations.
 * The database is the source of truth; exports are derived from it.
 */
export async function createEntry(
  db: DbOrTx,
  ownerId: string,
  input: {
    title: string;
    bodyMarkdown: string;
    kind: string;
    tags?: string[];
    sourceLinks?: Citation[];
    courseId?: string | null;
    unitId?: string | null;
    /** The study session the note was written in, and exactly what it points at. */
    learningSessionId?: string | null;
    anchor?: StudyAnchor | null;
    /** A paper note: the paper (one of the owner's works; a merged work's survivor is used). */
    scholarlyWorkId?: string | null;
  },
): Promise<NotebookEntryRow> {
  const fields = clean(input);
  let scholarlyWorkId: string | null = null;
  if (input.scholarlyWorkId) {
    const paper = await notesPaper(db, ownerId, input.scholarlyWorkId);
    if (!paper) throw new NotebookError("not_found", "Paper not found.");
    scholarlyWorkId = paper.id;
  }
  const [row] = await db
    .insert(notebookEntry)
    .values({
      ownerId,
      ...fields,
      sourceLinks: input.sourceLinks ?? [],
      courseId: input.courseId ?? null,
      unitId: input.unitId ?? null,
      learningSessionId: input.learningSessionId ?? null,
      anchor: input.anchor ?? null,
      scholarlyWorkId,
    })
    .returning();
  return row!;
}

/** The tag a laboratory gives a saved prediction, a dated record of what was expected before the results. */
const PREDICTION_TAG = "prediction";

export async function updateEntry(
  db: DbOrTx,
  ownerId: string,
  id: string,
  patch: {
    title?: string;
    bodyMarkdown?: string;
    kind?: string;
    tags?: string[];
    resolved?: boolean;
    courseId?: string | null;
    unitId?: string | null;
  },
): Promise<NotebookEntryRow | null> {
  const existing = await getEntry(db, ownerId, id);
  if (!existing) return null;
  // A prediction is never rewritten after the results, and an older note is never made to look
  // like one: either would read as a prediction made before the results were seen.
  if (existing.tags.includes(PREDICTION_TAG)) {
    throw new NotebookError(
      "prediction",
      "A saved prediction is a dated record and cannot be changed; write a new note, or predict again.",
    );
  }
  if (patch.tags?.includes(PREDICTION_TAG)) {
    throw new NotebookError("prediction", "Only a laboratory saves predictions; an existing note cannot be tagged as one.");
  }
  const fields = clean({
    title: patch.title ?? existing.title,
    bodyMarkdown: patch.bodyMarkdown ?? existing.bodyMarkdown,
    kind: patch.kind ?? existing.kind,
    tags: patch.tags ?? existing.tags,
  });
  const [row] = await db
    .update(notebookEntry)
    .set({
      ...fields,
      resolved: patch.resolved ?? existing.resolved,
      courseId: patch.courseId === undefined ? existing.courseId : patch.courseId,
      unitId: patch.unitId === undefined ? existing.unitId : patch.unitId,
    })
    .where(and(eq(notebookEntry.id, id), eq(notebookEntry.ownerId, ownerId)))
    .returning();
  return row ?? null;
}

export async function deleteEntry(db: DbOrTx, ownerId: string, id: string): Promise<void> {
  if ((await getEntry(db, ownerId, id))?.tags.includes(PREDICTION_TAG)) {
    throw new NotebookError("prediction", "A saved prediction is a dated record and cannot be deleted.");
  }
  await db.delete(notebookEntry).where(and(eq(notebookEntry.id, id), eq(notebookEntry.ownerId, ownerId)));
}

export async function getEntry(db: DbOrTx, ownerId: string, id: string): Promise<NotebookEntryRow | null> {
  if (!isUuid(id)) return null;
  const rows = await db
    .select()
    .from(notebookEntry)
    .where(and(eq(notebookEntry.id, id), eq(notebookEntry.ownerId, ownerId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listEntries(
  db: DbOrTx,
  ownerId: string,
  filter: { kind?: NotebookKind; tag?: string; courseId?: string; unitId?: string; unresolvedOnly?: boolean; limit?: number } = {},
): Promise<NotebookEntryRow[]> {
  const conditions = [eq(notebookEntry.ownerId, ownerId)];
  if (filter.kind) conditions.push(eq(notebookEntry.kind, filter.kind));
  if (filter.courseId) conditions.push(eq(notebookEntry.courseId, filter.courseId));
  if (filter.unitId) conditions.push(eq(notebookEntry.unitId, filter.unitId));
  if (filter.tag) conditions.push(sql`${notebookEntry.tags} ? ${filter.tag.toLowerCase()}`);
  if (filter.unresolvedOnly) conditions.push(eq(notebookEntry.resolved, false));
  return db
    .select()
    .from(notebookEntry)
    .where(and(...conditions))
    .orderBy(desc(notebookEntry.updatedAt))
    .limit(filter.limit ?? 200);
}

/** Full-text search over titles and bodies (the generated tsvector), ranked. */
export async function searchEntries(db: DbOrTx, ownerId: string, query: string, limit = 40): Promise<NotebookEntryRow[]> {
  const q = query.trim();
  if (!q) return [];
  return db
    .select()
    .from(notebookEntry)
    .where(and(eq(notebookEntry.ownerId, ownerId), sql`${notebookEntry.tsv} @@ websearch_to_tsquery('english', ${q})`))
    .orderBy(sql`ts_rank(${notebookEntry.tsv}, websearch_to_tsquery('english', ${q})) desc`, desc(notebookEntry.updatedAt))
    .limit(limit);
}

/** "Questions I have not resolved": open questions across every course, oldest first so nothing is buried. */
export async function questionsShelf(db: DbOrTx, ownerId: string): Promise<NotebookEntryRow[]> {
  return db
    .select()
    .from(notebookEntry)
    .where(and(eq(notebookEntry.ownerId, ownerId), eq(notebookEntry.kind, "question"), eq(notebookEntry.resolved, false)))
    .orderBy(notebookEntry.createdAt);
}

export async function setResolved(db: DbOrTx, ownerId: string, id: string, resolved: boolean): Promise<void> {
  await db
    .update(notebookEntry)
    .set({ resolved })
    .where(and(eq(notebookEntry.id, id), eq(notebookEntry.ownerId, ownerId)));
}

export async function listTags(db: DbOrTx, ownerId: string): Promise<{ tag: string; count: number }[]> {
  const result = await db.execute(sql`
    select tag, count(*)::int as count
    from notebook_entry, jsonb_array_elements_text(tags) as tag
    where owner_id = ${ownerId}
    group by tag order by count desc, tag asc limit 60`);
  return result.rows as { tag: string; count: number }[];
}

/** Backlinks: entries that cite a given source location or library item. */
export async function entriesLinkedTo(
  db: DbOrTx,
  ownerId: string,
  target: { locatorId?: string; assetId?: string; unitId?: string },
  limit = 20,
): Promise<NotebookEntryRow[]> {
  const conditions = [eq(notebookEntry.ownerId, ownerId)];
  if (target.locatorId)
    conditions.push(
      sql`exists (select 1 from jsonb_array_elements(${notebookEntry.sourceLinks}) l where l->>'locatorId' = ${target.locatorId})`,
    );
  if (target.assetId)
    conditions.push(
      sql`exists (select 1 from jsonb_array_elements(${notebookEntry.sourceLinks}) l where l->>'assetId' = ${target.assetId})`,
    );
  if (target.unitId) conditions.push(eq(notebookEntry.unitId, target.unitId));
  return db
    .select()
    .from(notebookEntry)
    .where(and(...conditions))
    .orderBy(desc(notebookEntry.updatedAt))
    .limit(limit);
}

export async function countEntries(db: DbOrTx, ownerId: string): Promise<{ total: number; openQuestions: number }> {
  const result = await db.execute(sql`
    select count(*)::int as total, count(*) filter (where kind = 'question' and resolved = false)::int as open_questions
    from notebook_entry where owner_id = ${ownerId}`);
  const row = result.rows[0] as { total: number; open_questions: number } | undefined;
  return { total: row?.total ?? 0, openQuestions: row?.open_questions ?? 0 };
}

// ---------------------------------------------------------------------------------------------
// Paper notes (research library, contract §2 and §3): notebook entries with `scholarly_work_id`

/** The paper a note is (or would be) about: the owner's work, merges followed to the survivor; null for any other id. */
export async function notesPaper(db: DbOrTx, ownerId: string, workId: string): Promise<{ id: string; title: string | null } | null> {
  if (!isUuid(workId)) return null;
  let current = workId;
  for (let hop = 0; hop < 10; hop++) {
    const [row] = await db
      .select({ id: scholarlyWork.id, title: scholarlyWork.title, mergedIntoId: scholarlyWork.mergedIntoId })
      .from(scholarlyWork)
      .where(and(eq(scholarlyWork.id, current), eq(scholarlyWork.ownerId, ownerId)))
      .limit(1);
    if (!row) return null;
    if (!row.mergedIntoId) return { id: row.id, title: row.title };
    current = row.mergedIntoId;
  }
  return null;
}

export interface PaperNote {
  entry: NotebookEntryRow;
  workTitle: string | null;
}

export interface PaperNotesQuery {
  workId?: string;
  /** An OpenAlex field id among the paper's subjects (as classified by OpenAlex). */
  subject?: string;
  /** Full-text search over the note's title and body. */
  query?: string;
  limit?: number;
}

/** OpenAlex field ids are short digit strings ("17"). */
export const OPENALEX_FIELD_ID = /^\d{1,6}$/;

/** Paper notes, most recently updated first, by paper, by the paper's OpenAlex field, and by words. */
export async function paperNotes(db: DbOrTx, ownerId: string, filters: PaperNotesQuery = {}): Promise<PaperNote[]> {
  const conditions: SQL[] = [eq(notebookEntry.ownerId, ownerId), isNotNull(notebookEntry.scholarlyWorkId)];
  if (filters.workId !== undefined) {
    if (!isUuid(filters.workId)) return [];
    conditions.push(eq(notebookEntry.scholarlyWorkId, filters.workId));
  }
  if (filters.subject !== undefined) {
    if (!OPENALEX_FIELD_ID.test(filters.subject)) return [];
    conditions.push(sql`${scholarlyWork.subjects} @> ${JSON.stringify([{ id: filters.subject, level: "field" }])}::jsonb`);
  }
  const q = filters.query?.trim().slice(0, 300);
  if (q) conditions.push(sql`${notebookEntry.tsv} @@ websearch_to_tsquery('english', ${q})`);
  const rows = await db
    .select({ entry: notebookEntry, workTitle: scholarlyWork.title })
    .from(notebookEntry)
    .innerJoin(scholarlyWork, and(eq(scholarlyWork.id, notebookEntry.scholarlyWorkId), eq(scholarlyWork.ownerId, ownerId)))
    .where(and(...conditions))
    .orderBy(desc(notebookEntry.updatedAt), desc(notebookEntry.id))
    .limit(Math.min(Math.max(Math.trunc(filters.limit ?? 100), 1), 200));
  return rows;
}

/**
 * The OpenAlex fields (as OpenAlex classified the papers) of the owner's papers that carry a library
 * note: an annotation on one of their files or a paper note. The notebook's subject filter offers these.
 */
export async function libraryNoteSubjects(db: DbOrTx, ownerId: string): Promise<{ id: string; name: string }[]> {
  const result = await db.execute(sql`
    select distinct s->>'id' as id, s->>'name' as name
    from scholarly_work w, jsonb_array_elements(w.subjects) as s
    where w.owner_id = ${ownerId} and w.merged_into_id is null and s->>'level' = 'field'
      and (
        exists (select 1 from notebook_entry n where n.owner_id = ${ownerId} and n.scholarly_work_id = w.id)
        or exists (
          select 1 from annotation a
          join resource_asset r on r.id = a.asset_id and r.owner_id = ${ownerId}
          join scholarly_version v on v.id = r.scholarly_version_id
          where a.owner_id = ${ownerId} and v.work_id = w.id
        )
      )
    order by name, id`);
  return (result.rows as { id: string; name: string }[]).filter((r) => OPENALEX_FIELD_ID.test(r.id) && r.name);
}
