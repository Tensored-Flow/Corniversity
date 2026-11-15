/**
 * Fetches the bytes the reader hands to PDF.js. Two sources:
 *
 * - a stored Document: the owner-only file route on this origin, fetched once, not hashed;
 * - a linked arXiv version: https://arxiv.org/pdf/{id}v{n}, fetched by the owner's browser
 *   without cookies, referrer or redirects, then hashed (SHA-256) so the server can record what the
 *   browser actually received (a drift detector, not an identity).
 *
 * Every response must succeed, say it is a PDF and start with the PDF signature before PDF.js
 * sees it. The URL of an arXiv version is always built from a validated identifier here.
 */

export type PdfSource = { kind: "stored"; url: string } | { kind: "arxiv"; id: string; version: number };

export interface LoadedPdf {
  data: Uint8Array;
  /** Hex SHA-256 of the received bytes (arXiv only). */
  observedSha256: string | null;
}

export type PdfLoadFailure = "network" | "status" | "content_type" | "signature";

export class PdfLoadError extends Error {
  constructor(
    readonly reason: PdfLoadFailure,
    readonly source: PdfSource["kind"],
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PdfLoadError";
  }
}

const NEW_STYLE_ARXIV = /^\d{4}\.\d{4,5}$/;
const OLD_STYLE_ARXIV = /^[a-z]+(?:-[a-z]+)*(?:\.[A-Z]{2})?\/\d{7}$/;

/** arXiv identifier without its version: 2305.18290 or math.GT/0309136. */
export function isArxivId(id: string): boolean {
  return NEW_STYLE_ARXIV.test(id) || OLD_STYLE_ARXIV.test(id);
}

export function arxivPdfUrl(id: string, version: number): string {
  if (!isArxivId(id)) throw new Error("Not an arXiv identifier.");
  if (!Number.isInteger(version) || version < 1 || version > 999) throw new Error("Not an arXiv version.");
  return `https://arxiv.org/pdf/${id}v${version}`;
}

export function arxivAbstractUrl(id: string, version: number): string {
  return arxivPdfUrl(id, version).replace("/pdf/", "/abs/");
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export type PdfResponseCheck = { ok: true } | { ok: false; reason: Exclude<PdfLoadFailure, "network">; status?: number };

/** The checks every response passes before its bytes reach PDF.js. */
export function checkPdfResponse(
  response: { ok: boolean; status: number; contentType: string | null },
  bytes: Uint8Array,
): PdfResponseCheck {
  if (!response.ok) return { ok: false, reason: "status", status: response.status };
  const mediaType = (response.contentType ?? "").split(";")[0]!.trim().toLowerCase();
  if (mediaType !== "application/pdf") return { ok: false, reason: "content_type" };
  if (bytes.length < PDF_SIGNATURE.length || PDF_SIGNATURE.some((byte, i) => bytes[i] !== byte)) return { ok: false, reason: "signature" };
  return { ok: true };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const FAILURE_TEXT: Record<Exclude<PdfLoadFailure, "network">, string> = {
  status: "The server did not return the file",
  content_type: "The response is not a PDF",
  signature: "The file does not start with a PDF signature",
};

export async function loadPdfBytes(source: PdfSource, signal: AbortSignal): Promise<LoadedPdf> {
  const url = source.kind === "stored" ? source.url : arxivPdfUrl(source.id, source.version);
  const init: RequestInit =
    source.kind === "stored"
      ? { credentials: "same-origin", cache: "no-store", signal }
      : { mode: "cors", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", cache: "no-store", signal };
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (signal.aborted) throw error;
    throw new PdfLoadError("network", source.kind, "The PDF could not be fetched.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const check = checkPdfResponse({ ok: response.ok, status: response.status, contentType: response.headers.get("content-type") }, bytes);
  if (!check.ok) {
    const status = check.status ? ` (status ${check.status})` : "";
    throw new PdfLoadError(check.reason, source.kind, `${FAILURE_TEXT[check.reason]}${status}.`, check.status);
  }
  return { data: bytes, observedSha256: source.kind === "arxiv" ? await sha256Hex(bytes) : null };
}
