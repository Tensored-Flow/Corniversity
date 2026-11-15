import { parseArxivId } from "@corniversity/core";
import { and, asc, eq } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { scholarlyIdentifier, scholarlyVersion, scholarlyWork } from "../schema/index";
import { type AnnotationRow, type AssetRow, getAsset, getReadingPosition, listAnnotations, type ReadingPositionState } from "./library";
import { type IdentifierRow, type VersionRow, type WorkRow, workIdForDocument } from "./scholarly-works";

/** Another arXiv version of the paper a Document belongs to, as the reader's header names it. */
export interface ReaderArxivVersion {
  version: number;
  label: string;
  withdrawn: boolean;
  date: Date | null;
}

/** Everything the reading room shows about one Document, read for its owner. */
export interface ReaderDocument {
  asset: AssetRow;
  /** The paper this Document is a file of (merges followed), or null for a Document of no paper. */
  work: WorkRow | null;
  identifiers: IdentifierRow[];
  /** The Document's scholarly version, or null. */
  version: VersionRow | null;
  /** The validated arXiv id and version of that version, or null when it has none. */
  arxiv: { id: string; version: number } | null;
  /** Every recorded version of the same arXiv paper, oldest first (the Document's own included). */
  arxivVersions: ReaderArxivVersion[];
  position: ReadingPositionState | null;
  annotations: AnnotationRow[];
}

/**
 * The reader's loader: the Document joined with its version, its paper (merges followed), the
 * paper's identifiers, the other versions of the same arXiv paper, the reading position and the
 * annotations. Null for an id that is not a UUID, a deleted Document or another owner's Document.
 * The arXiv id is re-validated with the core parser, so the reader only ever builds arXiv URLs from
 * an identifier in its normal form.
 */
export async function readerDocument(db: DbOrTx, ownerId: string, assetId: string): Promise<ReaderDocument | null> {
  if (!isUuid(assetId)) return null;
  const asset = await getAsset(db, ownerId, assetId);
  if (!asset) return null;
  const [version] = asset.scholarlyVersionId
    ? await db
        .select()
        .from(scholarlyVersion)
        .where(and(eq(scholarlyVersion.id, asset.scholarlyVersionId), eq(scholarlyVersion.ownerId, ownerId)))
        .limit(1)
    : [];
  const workId = version ? await workIdForDocument(db, ownerId, asset.id) : null;
  const [work] = workId
    ? await db
        .select()
        .from(scholarlyWork)
        .where(and(eq(scholarlyWork.id, workId), eq(scholarlyWork.ownerId, ownerId)))
        .limit(1)
    : [];
  const arxiv = validArxiv(version ?? null);
  const [identifiers, siblings, position, annotations] = await Promise.all([
    work
      ? db
          .select()
          .from(scholarlyIdentifier)
          .where(and(eq(scholarlyIdentifier.ownerId, ownerId), eq(scholarlyIdentifier.workId, work.id)))
          .orderBy(asc(scholarlyIdentifier.scheme), asc(scholarlyIdentifier.value))
      : Promise.resolve([] as IdentifierRow[]),
    arxiv
      ? db
          .select({
            version: scholarlyVersion.arxivVersion,
            label: scholarlyVersion.label,
            withdrawn: scholarlyVersion.withdrawn,
            date: scholarlyVersion.versionDate,
          })
          .from(scholarlyVersion)
          .where(and(eq(scholarlyVersion.ownerId, ownerId), eq(scholarlyVersion.arxivId, arxiv.id)))
          .orderBy(asc(scholarlyVersion.arxivVersion))
      : Promise.resolve([]),
    getReadingPosition(db, ownerId, asset.id),
    listAnnotations(db, ownerId, asset.id),
  ]);
  return {
    asset,
    work: work ?? null,
    identifiers,
    version: version ?? null,
    arxiv,
    arxivVersions: siblings.flatMap((s) =>
      s.version === null ? [] : [{ version: s.version, label: s.label, withdrawn: s.withdrawn, date: s.date }],
    ),
    position,
    annotations,
  };
}

function validArxiv(version: VersionRow | null): { id: string; version: number } | null {
  if (!version?.arxivId || !version.arxivVersion) return null;
  const parsed = parseArxivId(`${version.arxivId}v${version.arxivVersion}`);
  if (!parsed || parsed.id !== version.arxivId || parsed.version !== version.arxivVersion) return null;
  return { id: parsed.id, version: parsed.version };
}

export type { AnnotationRow, AssetRow, IdentifierRow, VersionRow, WorkRow };
