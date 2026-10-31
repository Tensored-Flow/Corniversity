import { and, desc, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { type Citation, notebookEntry } from "../schema/index";

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
    readonly code: "invalid" | "not_found",
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
  },
): Promise<NotebookEntryRow> {
  const fields = clean(input);
  const [row] = await db
    .insert(notebookEntry)
    .values({ ownerId, ...fields, sourceLinks: input.sourceLinks ?? [], courseId: input.courseId ?? null, unitId: input.unitId ?? null })
    .returning();
  return row!;
}

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
  await db.delete(notebookEntry).where(and(eq(notebookEntry.id, id), eq(notebookEntry.ownerId, ownerId)));
}

export async function getEntry(db: DbOrTx, ownerId: string, id: string): Promise<NotebookEntryRow | null> {
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
