// Development utility: downloads an openly licensed PDF into a scratch directory and prints
// per-page text with physical index and printed page label. Used to verify locators while
// authoring content, and as the reference behaviour for the ingestion pipeline.
// Usage: pnpm tsx scripts/pdf-dump.ts <url-or-path> [maxChars]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { extractText, getDocumentProxy, getMeta, inspectPages } from "unpdf";

const target = process.argv[2];
const maxChars = Number(process.argv[3] ?? 1500);
if (!target) {
  console.error("usage: pdf-dump <url-or-path> [maxChars]");
  process.exit(1);
}

async function load(): Promise<Uint8Array> {
  if (/^https?:\/\//.test(target!)) {
    const url = new URL(target!);
    const allowed = ["ocw.mit.edu", "openstax.org", "compneuro.neuromatch.io", "deeplearning.neuromatch.io"];
    if (!allowed.includes(url.hostname)) throw new Error(`host ${url.hostname} is not in the open-licence allow-list`);
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const dir = resolve(process.env.TEMP ?? ".", "corniversity-pdf-scratch");
    mkdirSync(dir, { recursive: true });
    const name = url.pathname.split("/").pop() ?? "download.pdf";
    writeFileSync(resolve(dir, name), buf);
    console.log(`saved ${buf.byteLength} bytes to ${resolve(dir, name)}`);
    return buf;
  }
  return new Uint8Array(readFileSync(target!));
}

const data = await load();
console.log(`sha256 ${createHash("sha256").update(data).digest("hex")}`);
const pdf = await getDocumentProxy(data, { maxImageSize: 16_777_216 });
const labels = (await pdf.getPageLabels()) ?? null;
const { info } = await getMeta(pdf);
console.log(`pages ${pdf.numPages}; printed labels ${labels ? "present" : "absent"}; title=${JSON.stringify(info?.Title ?? null)} author=${JSON.stringify(info?.Author ?? null)}`);
const { text } = await extractText(pdf);
const { pages } = await inspectPages(pdf);
const perPage = Array.isArray(text) ? text : [text];
perPage.forEach((pageText, i) => {
  const label = labels?.[i] ?? null;
  const q = pages[i];
  console.log(`\n===== physical ${i} | printed ${label ?? "-"} | chars ${pageText.length} | imageCoverage ${q?.imageCoverage.toFixed(2)} =====`);
  console.log(pageText.slice(0, maxChars));
});
