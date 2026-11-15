/**
 * What the reading room's page tells the client reader about a Document: the paper, the exact
 * version, the arXiv facts and the item it falls back to. Plain data (it crosses from the server
 * page to the client). Provider strings in it are plain text and are shown only as escaped React text.
 */

export interface ReaderPaperInfo {
  workId: string;
  title: string | null;
  authors: string[];
  year: number | null;
  venue: string | null;
  /** Who reported the paper's details and when (from the work's provenance), e.g. OpenAlex on 2026-11-15. */
  sources: { name: string; day: string | null }[];
  /** The details are recorded fixture data (fixture mode), not a live provider's answer. */
  fixture: boolean;
  identifiers: { label: string; value: string; href: string | null }[];
  /** The paper page (built by the find stream). */
  href: string;
}

export interface ReaderVersionInfo {
  /** "arXiv v1", "Your copy". */
  label: string;
  date: string | null;
  withdrawn: boolean;
  licence: { name: string; attribution: string } | null;
  arxiv: { id: string; version: number; display: string; absUrl: string; pdfUrl: string } | null;
  /** The newest later arXiv version that was not withdrawn. */
  newest: { version: number; label: string } | null;
  /** Later arXiv versions arXiv lists as withdrawn. */
  withdrawnLater: { version: number; label: string }[];
}

export interface ReaderDocumentInfo {
  /** The Document's key: its real hash, or `arxiv:{id}v{n}` for a paper read from arxiv.org. */
  documentKey: string;
  linked: boolean;
  /** The page count the server recorded, when known. */
  pageCount: number | null;
  paper: ReaderPaperInfo | null;
  version: ReaderVersionInfo | null;
  /** The library item (its page and file name), for a Document of no paper. */
  item: { filename: string; href: string };
}
