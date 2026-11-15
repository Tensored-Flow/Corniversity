import { formatArxivId, parseArxivId } from "@corniversity/core/scholarly/index";

/**
 * The PDF the fixture provider answers for an arXiv version (`SCHOLARLY_PROVIDER=fixture` only): no
 * PDF is recorded from arXiv, so private copies would otherwise be untestable. It is generated here,
 * byte for byte the same for the same version, and its own text says what it is: a fixture
 * stand-in for arXiv:{id}v{n}, not arXiv's file, with no text of the paper. It carries no dates, so
 * nothing in it changes between runs.
 */

/** The first line of every stand-in, followed by the exact version. */
export const FIXTURE_PDF_HEADING = "Fixture stand-in for arXiv:";

export function fixturePdfLines(arxivId: string, version: number): string[][] {
  const label = formatArxivId(arxivId, version);
  return [
    [
      `${FIXTURE_PDF_HEADING}${label}`,
      "This is not arXiv's file.",
      "Corniversity generated this PDF in fixture mode (SCHOLARLY_PROVIDER=fixture),",
      "so that keeping a private copy can be tested without contacting arXiv.",
      "It contains no text of the paper.",
    ],
    [`Fixture stand-in for arXiv:${label}, page 2.`, "Generated in fixture mode; not arXiv's file."],
  ];
}

/** The stand-in's bytes: a small, structurally valid PDF (one Helvetica text page per entry, exact xref offsets). */
export function fixturePdfStandIn(arxivId: string, version: number): Uint8Array {
  const parsed = parseArxivId(formatArxivId(arxivId, version));
  if (!parsed || parsed.version === null) throw new Error("Not a valid arXiv version.");
  return buildPdf(fixturePdfLines(parsed.id, parsed.version));
}

function buildPdf(pages: string[][]): Uint8Array {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const pageIds: number[] = [];
  const pageObjects: string[] = [];
  let nextId = 4;
  for (const lines of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    const stream = `BT /F1 12 Tf 72 720 Td 16 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(" ")} ET`;
    pageObjects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    );
    pageObjects.push(`${contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream\nendobj\n`);
  }
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`,
    // WinAnsiEncoding: an apostrophe stays an apostrophe (StandardEncoding would show a curly quote).
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
    ...pageObjects,
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += object;
  }
  const xrefOffset = Buffer.byteLength(body, "latin1");
  const count = objects.length + 1;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `${xref}trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body, "latin1"));
}
