import type { PendingAnchor } from "./annotations";

/**
 * What the owner has written in the reader of one Document and not saved yet: the note being started
 * and edits of saved notes. The reader holds them, so switching or hiding a panel keeps them, and
 * mirrors them into the tab's sessionStorage, so a reload keeps them too (never sent anywhere).
 */
export interface ReaderDrafts {
  /** The note being started, with the hash of the bytes its anchor was measured on. */
  composer: { pending: PendingAnchor; measuredOn: string | null; text: string } | null;
  /** Edits of saved notes, by annotation id. */
  edits: Record<string, string>;
}

export const NO_DRAFTS: ReaderDrafts = { composer: null, edits: {} };

export function draftKey(assetId: string): string {
  return `corniversity-reader-drafts:${assetId}`;
}

/**
 * Only what would be lost: a started note with text, and edits that differ from the saved note
 * (`saved` gives an annotation's saved text, undefined when it no longer exists).
 */
export function unsavedDrafts(drafts: ReaderDrafts, saved: (id: string) => string | undefined): ReaderDrafts {
  const edits: Record<string, string> = {};
  for (const [id, text] of Object.entries(drafts.edits)) {
    const current = saved(id);
    if (current !== undefined && text !== current) edits[id] = text;
  }
  return { composer: drafts.composer?.text.trim() ? drafts.composer : null, edits };
}

export function hasDrafts(drafts: ReaderDrafts): boolean {
  return drafts.composer !== null || Object.keys(drafts.edits).length > 0;
}

const SOURCES = new Set(["selection", "area", "page"]);

function isPending(value: unknown): value is PendingAnchor {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  const anchor = p.anchor as Record<string, unknown> | null | undefined;
  return (
    Number.isInteger(p.pageIndex) &&
    (p.pageIndex as number) >= 0 &&
    (p.quote === null || typeof p.quote === "string") &&
    SOURCES.has(p.source as string) &&
    Boolean(anchor) &&
    typeof anchor === "object" &&
    Array.isArray(anchor?.rects) &&
    Array.isArray(anchor?.pageView)
  );
}

/**
 * Drafts kept by this tab, as `serializeDrafts` wrote them; anything malformed is dropped, and edits
 * of annotations that no longer exist are dropped too. The server validates an anchor again on save.
 */
export function parseDrafts(raw: string | null, annotationIds: ReadonlySet<string>): ReaderDrafts {
  if (!raw) return NO_DRAFTS;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return NO_DRAFTS;
  }
  if (!value || typeof value !== "object") return NO_DRAFTS;
  const v = value as Record<string, unknown>;
  const c = v.composer as Record<string, unknown> | null | undefined;
  const composer =
    c && typeof c === "object" && isPending(c.pending) && typeof c.text === "string" && c.text.trim()
      ? { pending: c.pending, measuredOn: typeof c.measuredOn === "string" ? c.measuredOn : null, text: c.text }
      : null;
  const edits: Record<string, string> = {};
  if (v.edits && typeof v.edits === "object")
    for (const [id, text] of Object.entries(v.edits as Record<string, unknown>))
      if (annotationIds.has(id) && typeof text === "string") edits[id] = text;
  return { composer, edits };
}

/** The stored form; null when there is nothing to keep (the entry is then removed). */
export function serializeDrafts(drafts: ReaderDrafts): string | null {
  return hasDrafts(drafts) ? JSON.stringify(drafts) : null;
}
