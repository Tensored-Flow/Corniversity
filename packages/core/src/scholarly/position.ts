import { z } from "zod";

/**
 * Reading positions. Saves are ordered on the server's clock, never a device's: the reader sends
 * how long ago it last moved (`changedAgoMs`, from `performance.now()`), the server computes
 * `effective_at = now − clamp(changedAgoMs, 0, 10 min)` and keeps a save only when its effective
 * time is strictly later than the stored one. Device clocks that disagree cannot freeze a position.
 */

export const MAX_CHANGED_AGO_MS = 10 * 60 * 1000;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10;
/** Bound for coordinates in PDF user space (pages are at most 14,400 units a side). */
const COORD_LIMIT = 100_000;

/** The server-clock time a save stands for. A missing or non-numeric age counts as the oldest allowed. */
export function effectiveAt(serverNow: Date, changedAgoMs: number): Date {
  const age = Number.isFinite(changedAgoMs) ? Math.min(Math.max(changedAgoMs, 0), MAX_CHANGED_AGO_MS) : MAX_CHANGED_AGO_MS;
  return new Date(serverNow.getTime() - age);
}

/** Whether a save with this effective time replaces the stored position (strictly later only). */
export function acceptsPositionSave(storedEffectiveAt: Date | null | undefined, candidate: Date): boolean {
  return !storedEffectiveAt || candidate.getTime() > storedEffectiveAt.getTime();
}

export const ReadingPositionSchema = z.strictObject({
  pageIndex: z.number().int().min(0).max(99_999),
  top: z.number(),
  left: z.number(),
  zoom: z.number().positive(),
});
export type ReadingPosition = z.infer<typeof ReadingPositionSchema>;

function clamp(n: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

/**
 * Clamps a position: page index into [0, pageCount − 1] when the page count is known, coordinates
 * into a sane range, zoom into [0.1, 10]. Non-finite values fall back to the page's top-left at 100%.
 */
export function clampPosition(position: ReadingPosition, pageCount?: number | null): ReadingPosition {
  const lastPage = pageCount && pageCount > 0 ? pageCount - 1 : 99_999;
  return {
    pageIndex: Math.trunc(clamp(position.pageIndex, 0, lastPage, 0)),
    top: clamp(position.top, -COORD_LIMIT, COORD_LIMIT, 0),
    left: clamp(position.left, -COORD_LIMIT, COORD_LIMIT, 0),
    zoom: clamp(position.zoom, MIN_ZOOM, MAX_ZOOM, 1),
  };
}

/**
 * The position part of what the reader posts: the position and how long ago it changed. Any finite
 * age is accepted and clamped into [0, 10 min], whole milliseconds (a `performance.now()`
 * difference is fractional; a tab left open for days saves on page hide with a huge age). The route
 * adds its own fields (Document id, the per-tab sequence the reader uses to drop out-of-order
 * requests).
 */
export const PositionSaveSchema = z.object({
  position: ReadingPositionSchema,
  // zod 4's number() already refuses NaN and ±Infinity.
  changedAgoMs: z.number().transform((ms) => Math.min(Math.max(Math.round(ms), 0), MAX_CHANGED_AGO_MS)),
});
export type PositionSave = z.infer<typeof PositionSaveSchema>;
