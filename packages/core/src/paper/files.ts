/**
 * Paper work arrives as photographs (JPEG, PNG) or PDFs. Before anything is stored, the bytes are
 * checked against their real signature and, for images, stripped of metadata that can carry the
 * place a photograph was taken, the camera or the author (EXIF, XMP, IPTC, comments, PNG text and
 * eXIf chunks). The image data itself is copied unchanged, so nothing of the work is lost.
 * Pure functions on bytes: no image library and nothing executed.
 */

export type WorkMime = "image/jpeg" | "image/png" | "application/pdf";

export class WorkFileError extends Error {
  constructor(
    readonly code: "empty" | "too_large" | "unsupported" | "malformed" | "active_content",
    message: string,
  ) {
    super(message);
    this.name = "WorkFileError";
  }
}

/** Per page; a phone photograph re-encoded on the device is usually well under 2 MB. */
export const MAX_WORK_PAGE_BYTES = 12 * 1024 * 1024;
/** Images larger than this on either side are refused (the page is re-encoded smaller on the device). */
export const MAX_WORK_IMAGE_SIDE = 8_000;

export interface PreparedWorkFile {
  mime: WorkMime;
  bytes: Uint8Array;
  width?: number;
  height?: number;
  /** True when metadata segments were found and removed. */
  stripped: boolean;
}

export function sniffWorkMime(bytes: Uint8Array): WorkMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}

/** Validates and prepares an uploaded page; throws `WorkFileError` with a reason the learner can act on. */
export function prepareWorkFile(bytes: Uint8Array): PreparedWorkFile {
  if (bytes.length === 0) throw new WorkFileError("empty", "The file is empty.");
  if (bytes.length > MAX_WORK_PAGE_BYTES) {
    throw new WorkFileError(
      "too_large",
      `The file is larger than ${MAX_WORK_PAGE_BYTES / 1024 / 1024} MB; photograph the page again at a lower resolution.`,
    );
  }
  const mime = sniffWorkMime(bytes);
  if (!mime) throw new WorkFileError("unsupported", "Only photographs (JPEG or PNG) and PDF files can be attached as paper work.");
  if (mime === "image/jpeg") return checkSize(stripJpeg(bytes));
  if (mime === "image/png") return checkSize(stripPng(bytes));
  return checkPdf(bytes);
}

function checkSize(file: PreparedWorkFile): PreparedWorkFile {
  if ((file.width ?? 0) > MAX_WORK_IMAGE_SIDE || (file.height ?? 0) > MAX_WORK_IMAGE_SIDE) {
    throw new WorkFileError("too_large", `The image is larger than ${MAX_WORK_IMAGE_SIDE} pixels on a side.`);
  }
  return file;
}

/** Markers whose segments carry metadata rather than image data: APP1 (EXIF, XMP), APP12–APP15, and comments. */
const JPEG_METADATA = new Set([0xe1, 0xec, 0xed, 0xee, 0xef, 0xfe]);
const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export function stripJpeg(bytes: Uint8Array): PreparedWorkFile {
  const out: Uint8Array[] = [bytes.subarray(0, 2)];
  let i = 2;
  let stripped = false;
  let width: number | undefined;
  let height: number | undefined;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new WorkFileError("malformed", "The JPEG file is damaged.");
    const marker = bytes[i + 1]!;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (marker === 0xd9) {
      out.push(bytes.subarray(i, i + 2));
      break;
    }
    if (i + 4 > bytes.length) throw new WorkFileError("malformed", "The JPEG file is truncated.");
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (length < 2 || i + 2 + length > bytes.length) throw new WorkFileError("malformed", "The JPEG file is truncated.");
    const segment = bytes.subarray(i, i + 2 + length);
    if (SOF_MARKERS.has(marker) && length >= 7) {
      height = (bytes[i + 5]! << 8) | bytes[i + 6]!;
      width = (bytes[i + 7]! << 8) | bytes[i + 8]!;
    }
    if (marker === 0xda) {
      // Start of scan: the entropy-coded image data runs to the end; copy it unchanged.
      out.push(bytes.subarray(i));
      break;
    }
    if (JPEG_METADATA.has(marker)) stripped = true;
    else out.push(segment);
    i += 2 + length;
  }
  return { mime: "image/jpeg", bytes: concat(out), width, height, stripped };
}

/** Chunks that carry text, time or EXIF metadata; everything else (pixels, colour, transparency) is kept. */
const PNG_METADATA = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

export function stripPng(bytes: Uint8Array): PreparedWorkFile {
  const out: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  let stripped = false;
  let width: number | undefined;
  let height: number | undefined;
  let ended = false;
  while (i + 8 <= bytes.length) {
    const length = ((bytes[i]! << 24) | (bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!) >>> 0;
    const type = String.fromCharCode(...bytes.subarray(i + 4, i + 8));
    const end = i + 12 + length;
    if (end > bytes.length) throw new WorkFileError("malformed", "The PNG file is truncated.");
    if (type === "IHDR") {
      width = ((bytes[i + 8]! << 24) | (bytes[i + 9]! << 16) | (bytes[i + 10]! << 8) | bytes[i + 11]!) >>> 0;
      height = ((bytes[i + 12]! << 24) | (bytes[i + 13]! << 16) | (bytes[i + 14]! << 8) | bytes[i + 15]!) >>> 0;
    }
    if (PNG_METADATA.has(type)) stripped = true;
    else out.push(bytes.subarray(i, end));
    i = end;
    if (type === "IEND") {
      ended = true;
      break;
    }
  }
  if (!ended) throw new WorkFileError("malformed", "The PNG file has no end marker.");
  return { mime: "image/png", bytes: concat(out), width, height, stripped };
}

/**
 * A PDF is kept as uploaded (its pages are the learner's work) but refused if it declares active
 * content: scripts, launch actions or embedded files. It is served only as a download with a
 * sandboxing policy, never rendered by the application.
 */
export function checkPdf(bytes: Uint8Array): PreparedWorkFile {
  const text = latin1(bytes);
  if (/\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|OpenAction\s*<<[^>]*\/S\s*\/JavaScript)\b/.test(text)) {
    throw new WorkFileError(
      "active_content",
      "This PDF contains scripts or embedded files, so it was not stored. Print it to a new PDF, or photograph the pages.",
    );
  }
  if (!text.includes("%%EOF")) throw new WorkFileError("malformed", "The PDF file is truncated.");
  return { mime: "application/pdf", bytes, stripped: false };
}

function latin1(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return s;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
