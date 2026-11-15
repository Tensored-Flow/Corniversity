/**
 * The Page view's reading position (contract §3, the server clock rule). The reader sends where it is
 * (page, the top-left of the view in PDF user space, the zoom) and how long ago it last moved
 * (`changedAgoMs`, from `performance.now()`); the server orders saves on its own clock. Only the
 * owner's own moves are saved: arriving (through `?page=N` or the remembered position), resizing and
 * re-laying out the pages are not moves. Each tab numbers its saves, and the route drops a save that
 * arrives after a later one from the same tab.
 */

export interface SavedPosition {
  pageIndex: number;
  top: number;
  left: number;
  zoom: number;
}

/** PDF.js's view location: 1-based page and the top-left of the view in PDF user space. */
export interface ViewLocation {
  pageNumber: number;
  top: number;
  left: number;
}

/** A change of view within this long after the owner's own input (scroll, key, tap, a control) is a move. */
export const MOVE_INTENT_MS = 2000;
/** Saves wait this long after the last move. */
export const SAVE_DELAY_MS = 1200;

export function countsAsMove(lastIntentAt: number | null, now: number): boolean {
  return lastIntentAt !== null && now - lastIntentAt >= 0 && now - lastIntentAt <= MOVE_INTENT_MS;
}

export function positionFromLocation(location: ViewLocation, scale: number): SavedPosition {
  return {
    pageIndex: Math.max(0, location.pageNumber - 1),
    top: Number.isFinite(location.top) ? location.top : 0,
    left: Number.isFinite(location.left) ? location.left : 0,
    zoom: Number.isFinite(scale) && scale > 0 ? Math.round(scale * 1000) / 1000 : 1,
  };
}

/**
 * Whether a saved position names only its page: top 0 and left 0 is "the page's top-left" (core
 * `clampPosition`'s fallback; the Text view's page saves, `saveReadingProgress`). In PDF user space y
 * grows upwards, so taking it as a point would open at the bottom of the page.
 */
export function namesPageOnly(position: SavedPosition): boolean {
  return position.top === 0 && position.left === 0;
}

/**
 * Where the reader opens: the requested or remembered page, and inside it the remembered top-left
 * when the remembered position is on that page (a `?page=N` elsewhere opens at the top of page N; a
 * position that names only its page opens at the top of that page). The remembered zoom is not
 * applied: a scale chosen on one screen is wrong on another, so the reader opens at its fit-width
 * default.
 */
export function openingTarget(
  pageNumber: number,
  remembered: SavedPosition | null,
): { pageNumber: number; destArray: [null, { name: "XYZ" }, number, number, null] | null } {
  if (remembered && remembered.pageIndex === pageNumber - 1 && !namesPageOnly(remembered))
    return { pageNumber, destArray: [null, { name: "XYZ" }, remembered.left, remembered.top, null] };
  return { pageNumber, destArray: null };
}

/**
 * The latest position this tab sent, kept in sessionStorage for a short while. A reload (or a return
 * to the reader) right after a move can be rendered before the save sent as the page went away has
 * reached the server; the reader then opens at what this tab last sent instead of the older row.
 * Only this tab's own clock measures the age, and only an entry for the same Document counts.
 */
export const LAST_SENT_KEY = "corniversity-reader-last-sent";
export const LAST_SENT_MAX_AGE_MS = 30_000;

export function lastSentEntry(assetId: string, position: SavedPosition, now: number): string {
  return JSON.stringify({ assetId, position, at: now });
}

/** The position in an entry written by `lastSentEntry`, when it is this Document's and recent; otherwise null. */
export function lastSentPosition(raw: string | null, assetId: string, now: number): SavedPosition | null {
  if (!raw) return null;
  let entry: unknown;
  try {
    entry = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof entry !== "object" || entry === null) return null;
  const { assetId: id, position, at } = entry as { assetId?: unknown; position?: unknown; at?: unknown };
  if (id !== assetId || typeof at !== "number" || !Number.isFinite(at)) return null;
  if (now - at < 0 || now - at > LAST_SENT_MAX_AGE_MS) return null;
  if (typeof position !== "object" || position === null) return null;
  const { pageIndex, top, left, zoom } = position as Record<string, unknown>;
  if (typeof pageIndex !== "number" || !Number.isInteger(pageIndex) || pageIndex < 0) return null;
  if (![top, left, zoom].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return { pageIndex, top: top as number, left: left as number, zoom: zoom as number };
}

/**
 * Sends positions to POST /api/library/position, one request at a time: a move made while a save is
 * in flight is sent when it ends. A save on page hide (or when the tab becomes hidden) uses `fetch`
 * with `keepalive` and does not wait. Every request carries this tab's next sequence number.
 */
export class PositionSender {
  private pending: { position: SavedPosition; movedAt: number } | null = null;
  private inflight = false;
  private seq = 0;

  constructor(
    private readonly options: {
      assetId: string;
      tab: string;
      now: () => number;
      post: (body: string, keepalive: boolean) => Promise<unknown>;
      /** Told about every position as it is sent (the reader keeps the latest for a reload). */
      sent?: (position: SavedPosition) => void;
    },
  ) {}

  /** The owner moved to this position just now. */
  moved(position: SavedPosition): void {
    this.pending = { position, movedAt: this.options.now() };
  }

  hasPending(): boolean {
    return this.pending !== null;
  }

  /** Sends the latest unsent position, if any. */
  flush(keepalive = false): void {
    if (!this.pending || (this.inflight && !keepalive)) return;
    const { position, movedAt } = this.pending;
    this.pending = null;
    this.seq += 1;
    const body = JSON.stringify({
      assetId: this.options.assetId,
      position,
      changedAgoMs: Math.max(0, Math.round(this.options.now() - movedAt)),
      tab: this.options.tab,
      seq: this.seq,
    });
    this.options.sent?.(position);
    if (keepalive) {
      void this.options.post(body, true).catch(() => undefined);
      return;
    }
    this.inflight = true;
    void this.options
      .post(body, false)
      .catch(() => undefined)
      .finally(() => {
        this.inflight = false;
        this.flush();
      });
  }
}
