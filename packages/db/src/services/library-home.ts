import { and, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { readingProgress, resourceAsset, scholarlyVersion, scholarlyWork, type WorkProvenance } from "../schema/index";

/**
 * The Library home's database reads (contract §2): *Continue reading* and the Documents of the
 * papers a list shows. Nothing here calls a provider; every query is the owner's own rows.
 */

type AssetRow = typeof resourceAsset.$inferSelect;

export interface ContinueReadingItem {
  assetId: string;
  /** The paper's title when the Document is a paper's file, else the file's confirmed or reported title, else its file name. */
  title: string;
  workId: string | null;
  /** The version the file is ("arXiv v3", "Your copy"); null for a file of no paper. */
  versionLabel: string | null;
  /** The 1-based page of the saved position (page 1 when only the opening was recorded). */
  page: number;
  pageCount: number | null;
  lastOpenedAt: Date;
  /** The paper's per-field provenance (who reported its title and when), so the page can label fixture data. */
  workProvenance: WorkProvenance | null;
}

/** The Documents the owner opened most recently (at most `limit`, default 3), newest first, with the page they were on. */
export async function continueReading(db: DbOrTx, ownerId: string, limit = 3): Promise<ContinueReadingItem[]> {
  const rows = await db
    .select({
      assetId: resourceAsset.id,
      confirmedTitle: resourceAsset.confirmedTitle,
      candidate: resourceAsset.candidateMetadata,
      filename: resourceAsset.filename,
      pageCount: resourceAsset.pageCount,
      physicalIndex: readingProgress.physicalIndex,
      position: readingProgress.position,
      lastOpenedAt: readingProgress.lastOpenedAt,
      versionLabel: scholarlyVersion.label,
      workId: scholarlyWork.id,
      workTitle: scholarlyWork.title,
      workProvenance: scholarlyWork.provenance,
    })
    .from(readingProgress)
    .innerJoin(resourceAsset, and(eq(resourceAsset.id, readingProgress.assetId), eq(resourceAsset.ownerId, ownerId)))
    .leftJoin(scholarlyVersion, eq(scholarlyVersion.id, resourceAsset.scholarlyVersionId))
    .leftJoin(scholarlyWork, eq(scholarlyWork.id, scholarlyVersion.workId))
    .where(
      and(
        eq(readingProgress.ownerId, ownerId),
        isNotNull(readingProgress.lastOpenedAt),
        isNull(resourceAsset.deletedAt),
        ne(resourceAsset.status, "deleted"),
      ),
    )
    .orderBy(desc(readingProgress.lastOpenedAt), desc(resourceAsset.id))
    .limit(Math.min(Math.max(Math.trunc(limit), 1), 20));
  return rows.map((r) => ({
    assetId: r.assetId,
    title: r.workTitle ?? r.confirmedTitle ?? r.candidate.title ?? r.filename,
    workId: r.workId,
    versionLabel: r.versionLabel,
    page: (r.position?.pageIndex ?? r.physicalIndex) + 1,
    pageCount: r.pageCount,
    lastOpenedAt: r.lastOpenedAt!,
    workProvenance: r.workProvenance,
  }));
}

export interface WorkDocumentEntry {
  workId: string;
  asset: AssetRow;
  versionLabel: string;
  lastOpenedAt: Date | null;
}

/**
 * The live Documents of the given works (linked arXiv versions and stored copies), the most
 * recently opened first, then the newest. The page decides which of them can be read.
 */
export async function documentsForWorks(db: DbOrTx, ownerId: string, workIds: readonly string[]): Promise<WorkDocumentEntry[]> {
  const ids = [...new Set(workIds.filter(isUuid))];
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      workId: scholarlyVersion.workId,
      asset: resourceAsset,
      versionLabel: scholarlyVersion.label,
      lastOpenedAt: readingProgress.lastOpenedAt,
    })
    .from(resourceAsset)
    .innerJoin(
      scholarlyVersion,
      and(eq(scholarlyVersion.id, resourceAsset.scholarlyVersionId), eq(scholarlyVersion.ownerId, resourceAsset.ownerId)),
    )
    .leftJoin(readingProgress, and(eq(readingProgress.assetId, resourceAsset.id), eq(readingProgress.ownerId, ownerId)))
    .where(and(eq(resourceAsset.ownerId, ownerId), inArray(scholarlyVersion.workId, ids), isNull(resourceAsset.deletedAt)))
    .orderBy(sql`${readingProgress.lastOpenedAt} desc nulls last`, desc(resourceAsset.createdAt), desc(resourceAsset.id));
  return rows;
}
