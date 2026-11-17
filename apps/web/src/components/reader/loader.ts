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
import { arxivAbsUrl, arxivPdfUrl as coreArxivPdfUrl, parseArxivId } from "@corniversity/core/scholarly/identifiers";

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

/**
 * An arXiv identifier without its version, in the normal form core's `parseArxivId` gives
 * (`2305.18290`, `hep-th/9711200`: old-style ids without the optional subject class).
 */
export function isArxivId(id: string): boolean {
  const parsed = parseArxivId(id);
  return parsed !== null && parsed.version === null && parsed.id === id;
}

/** https://arxiv.org/pdf/{id}v{n}, built only from a validated identifier and version. */
export function arxivPdfUrl(id: string, version: number): string {
  if (!isArxivId(id)) throw new Error("Not an arXiv identifier.");
  if (!Number.isInteger(version) || version < 1 || version > 999) throw new Error("Not an arXiv version.");
  return coreArxivPdfUrl(id, version);
}

/** The abstract page arXiv asks services to link to. */
export function arxivAbstractUrl(id: string, version: number): string {
  arxivPdfUrl(id, version);
  return arxivAbsUrl(id, version);
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

const ARXIV_UNREACHABLE = "Your browser could not fetch the PDF from arXiv (network or arXiv's access policy).";

/**
 * The reader's sentence for a PDF that could not be shown: a load failure (from arXiv, said in
 * arXiv's terms; from storage, with the loader's own message), or PDF.js refusing the file.
 */
export function failureText(error: unknown, arxiv: boolean): string {
  if (error instanceof PdfLoadError) {
    if (!arxiv) return `The PDF could not be loaded. ${error.message}`;
    if (error.reason === "network") return ARXIV_UNREACHABLE;
    if (error.reason === "status") return `arXiv answered with status ${error.status ?? "unknown"}, so the PDF could not be shown.`;
    return "arXiv's answer was not a PDF, so nothing was shown.";
  }
  const name = error instanceof Error ? error.name : "";
  if (name === "InvalidPDFException") return "The file could not be read as a PDF.";
  if (name === "PasswordException") return "This PDF is password-protected and cannot be shown here.";
  return "The PDF could not be shown.";
}

/** PDF.js refused the file itself (unreadable, or protected by a password): loading it again cannot succeed. */
export function isPermanentFailure(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  return name === "InvalidPDFException" || name === "PasswordException";
}

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
