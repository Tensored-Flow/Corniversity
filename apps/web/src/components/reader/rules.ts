/**
 * Pure rules for the reading room: which view opens, page parameters, zoom choices, keyboard and
 * wheel handling, the internal-link back stack and status wording. No PDF.js or DOM imports, so
 * the server page and the unit tests use them directly.
 */

export type ReaderView = "page" | "text" | "unavailable";

/** Above either limit a stored Document opens in Text view when its text is extracted. */
export const LARGE_DOCUMENT_BYTES = 40 * 1_048_576;
export const LARGE_DOCUMENT_PAGES = 400;

export function isLargeDocument(sizeBytes: number, pageCount: number | null | undefined): boolean {
  return sizeBytes > LARGE_DOCUMENT_BYTES || (pageCount ?? 0) > LARGE_DOCUMENT_PAGES;
}

/**
 * Page view needs stored bytes of a PDF that has passed validation (it renders the original file);
 * Text view needs extracted text.
 */
export function pageViewAvailable(asset: { storageKey: string | null; mediaType: string; status: string }): boolean {
  return (
    asset.storageKey !== null &&
    asset.mediaType === "application/pdf" &&
    (asset.status === "validated" || asset.status === "processing" || asset.status === "processed")
  );
}

export function textViewAvailable(asset: { status: string; pageCount: number | null }): boolean {
  return asset.status === "processed" && Boolean(asset.pageCount);
}

/**
 * `?view=page|text` decides when that view exists; asking for Text view without extracted text
 * explains why instead of silently showing the pages. Without a choice: Page view, except for
 * large extracted Documents, which open in Text view.
 */
export function chooseView(input: {
  requested: string | undefined;
  pageAvailable: boolean;
  textAvailable: boolean;
  sizeBytes: number;
  pageCount: number | null;
}): ReaderView {
  if (input.requested === "page" && input.pageAvailable) return "page";
  if (input.requested === "text") return input.textAvailable ? "text" : "unavailable";
  if (!input.pageAvailable) return input.textAvailable ? "text" : "unavailable";
  if (input.textAvailable && isLargeDocument(input.sizeBytes, input.pageCount)) return "text";
  return "page";
}

/** `?page=N` is a 1-based physical page; anything else is ignored. */
export function requestedPage(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d{1,6}$/.test(raw.trim())) return null;
  const page = Number(raw.trim());
  return page >= 1 ? page : null;
}

export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page) || pageCount < 1) return 1;
  return Math.min(pageCount, Math.max(1, Math.round(page)));
}

/** Megabytes as the upload limit counts them (1 MB = 1,048,576 bytes), never shown as 0. */
export function formatMegabytes(bytes: number): string {
  const mb = bytes / 1_048_576;
  return `${mb < 10 ? Math.max(0.1, Math.round(mb * 10) / 10) : Math.round(mb)} MB`;
}

export const ZOOM_CHOICES = [
  { value: "page-width", label: "Fit width" },
  { value: "page-fit", label: "Fit page" },
  { value: "1", label: "100%" },
  { value: "1.25", label: "125%" },
  { value: "1.5", label: "150%" },
  { value: "2", label: "200%" },
] as const;

export const DEFAULT_ZOOM = "page-width";

const PRESET_ZOOMS = new Set(["page-width", "page-fit", "page-height", "page-actual", "auto"]);

/** Named zooms follow the container size; they are re-applied when it resizes. */
export function isPresetZoom(value: string): boolean {
  return PRESET_ZOOMS.has(value);
}

/**
 * The zoom select's value for a scale PDF.js reports: a named preset, one of the listed
 * percentages, or a custom percentage (from ctrl+wheel or pinch) that the select adds as an option.
 */
export function zoomSelection(scale: number, presetValue: string | undefined): { value: string; label: string; custom: boolean } {
  const preset = ZOOM_CHOICES.find((choice) => choice.value === presetValue && isPresetZoom(choice.value));
  if (preset) return { value: preset.value, label: preset.label, custom: false };
  const listed = ZOOM_CHOICES.find((choice) => !isPresetZoom(choice.value) && Math.abs(Number(choice.value) - scale) < 0.0005);
  if (listed) return { value: listed.value, label: listed.label, custom: false };
  const percent = Math.round(scale * 100);
  return { value: `custom:${percent}`, label: `${percent}%`, custom: true };
}

/**
 * Ctrl+wheel (and a trackpad pinch, which browsers report as ctrl+wheel) zooms around the
 * pointer. Pixel deltas map smoothly; one step is limited so a mouse wheel notch moves by at most
 * a quarter.
 */
export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 800 : deltaY;
  const factor = Math.exp(-pixels / 100);
  return Math.min(1.25, Math.max(0.8, factor));
}

/**
 * PDF.js rounds every new scale to 0.01, so the many tiny factors of a pinch or a trackpad would
 * be lost one by one. Factors accumulate until they change the rounded scale, then apply at once.
 */
export function accumulateZoom(scale: number, pending: number, factor: number): { scaleFactor: number | null; pending: number } {
  const combined = pending * factor;
  if (Math.round(scale * combined * 100) === Math.round(scale * 100)) return { scaleFactor: null, pending: combined };
  return { scaleFactor: combined, pending: 1 };
}

export type KeyAction = "next" | "previous" | "first" | "last";

/**
 * Keys handled while the pages have focus. Home and End go to the first and last page. PageUp and
 * PageDown turn whole pages only when a page fits the view; otherwise the browser scrolls by a
 * screen, which keeps tall pages readable. Modified keys and every other key are left alone.
 */
export function keyAction(
  key: string,
  modifiers: { ctrl: boolean; alt: boolean; meta: boolean; shift: boolean },
  zoom: string,
): KeyAction | null {
  if (modifiers.ctrl || modifiers.alt || modifiers.meta || modifiers.shift) return null;
  if (key === "Home") return "first";
  if (key === "End") return "last";
  if (zoom === "page-fit" && key === "PageDown") return "next";
  if (zoom === "page-fit" && key === "PageUp") return "previous";
  return null;
}

/** Where the reader was before following an internal link or a contents entry. */
export interface BackEntry {
  pageNumber: number;
  /** PDF user space position from PDF.js's view area; null when not yet known. */
  left: number | null;
  top: number | null;
}

export const BACK_STACK_LIMIT = 50;

export function pushBack(stack: readonly BackEntry[], entry: BackEntry): BackEntry[] {
  const last = stack.at(-1);
  if (last && last.pageNumber === entry.pageNumber && last.left === entry.left && last.top === entry.top) return [...stack];
  return [...stack, entry].slice(-BACK_STACK_LIMIT);
}

export function popBack(stack: readonly BackEntry[]): { entry: BackEntry | null; stack: BackEntry[] } {
  if (stack.length === 0) return { entry: null, stack: [] };
  return { entry: stack[stack.length - 1]!, stack: stack.slice(0, -1) };
}

/** "p. iv" only when the printed label differs from the physical page number. */
export function printedLabel(pageNumber: number, label: string | null | undefined): string | null {
  const trimmed = label?.trim();
  if (!trimmed || trimmed === String(pageNumber)) return null;
  return trimmed;
}

/** PDF.js FindState values (pdf_find_controller.js). */
export const FIND_STATE = { FOUND: 0, NOT_FOUND: 1, WRAPPED: 2, PENDING: 3 } as const;

export function findStatus(input: { query: string; state: number | null; current: number; total: number; previous: boolean }): string {
  if (!input.query.trim() || input.state === null) return "";
  if (input.state === FIND_STATE.PENDING) return "Searching…";
  if (input.state === FIND_STATE.NOT_FOUND || input.total === 0) return "No matches";
  const count = `${input.current} of ${input.total} ${input.total === 1 ? "match" : "matches"}`;
  if (input.state === FIND_STATE.WRAPPED) return `${count} (continued from the ${input.previous ? "end" : "start"})`;
  return count;
}

/** Outline entries may carry an external URL; only http and https are ever linked. */
export function safeOutlineUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}
