/**
 * Builds a small, structurally valid PDF (correct xref offsets) with one text page per entry.
 * With `withLabels`, a /PageLabels tree gives the first two pages roman numerals, so journeys can
 * check that citations carry both the physical index and the printed label.
 */
export function makePdf(pages: string[], withLabels: boolean): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const pageIds: number[] = [];
  const pageObjects: string[] = [];
  let nextId = 4;
  for (const text of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    const lines = text.split("\n").flatMap((line) => line.match(/.{1,75}(?:\s|$)|\S+/g) ?? [""]);
    const stream = `BT /F1 12 Tf 72 720 Td 14 TL ${lines.map((l) => `(${esc(l.trimEnd())}) Tj T*`).join(" ")} ET`;
    pageObjects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    );
    pageObjects.push(`${contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream\nendobj\n`);
  }
  const labels = withLabels ? " /PageLabels << /Nums [0 << /S /r >> 2 << /S /D >>] >>" : "";
  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R${labels} >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`,
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
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
  return Buffer.from(body, "latin1");
}

/**
 * Like makePdf (one text page per entry, no page labels), with a document outline: each entry names
 * a 1-based page, and its destination is the top of that page. For checking the reader's Contents.
 */
export function makePdfWithOutline(pages: string[], outline: { title: string; page: number }[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const pageIds: number[] = [];
  const objects = new Map<number, string>();
  let nextId = 4;
  for (const text of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    const lines = text.split("\n").flatMap((line) => line.match(/.{1,75}(?:\s|$)|\S+/g) ?? [""]);
    const stream = `BT /F1 12 Tf 72 720 Td 14 TL ${lines.map((l) => `(${esc(l.trimEnd())}) Tj T*`).join(" ")} ET`;
    objects.set(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects.set(contentId, `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  }
  const outlineId = nextId++;
  const itemIds = outline.map(() => nextId++);
  outline.forEach((entry, i) => {
    const target = pageIds[Math.min(Math.max(entry.page, 1), pageIds.length) - 1]!;
    const links = [i > 0 ? `/Prev ${itemIds[i - 1]} 0 R` : "", i < itemIds.length - 1 ? `/Next ${itemIds[i + 1]} 0 R` : ""].join(" ");
    objects.set(itemIds[i]!, `<< /Title (${esc(entry.title)}) /Parent ${outlineId} 0 R ${links} /Dest [${target} 0 R /XYZ 0 792 null] >>`);
  });
  objects.set(
    outlineId,
    itemIds.length
      ? `<< /Type /Outlines /First ${itemIds[0]} 0 R /Last ${itemIds.at(-1)} 0 R /Count ${itemIds.length} >>`
      : "<< /Type /Outlines /Count 0 >>",
  );
  objects.set(1, `<< /Type /Catalog /Pages 2 0 R /Outlines ${outlineId} 0 R >>`);
  objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < nextId; id++) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, "latin1");
  let xref = `xref\n0 ${nextId}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `${xref}trailer\n<< /Size ${nextId} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}
