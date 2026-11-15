/**
 * Copies the PDF.js worker and the files it fetches at run time into public/pdfjs/<version>/, so
 * the reader loads them from this origin and the version in the path always matches the
 * installed library (a missing copy fails loudly instead of loading a mismatched worker).
 *
 * Copied: the legacy worker; the WebAssembly decoders (JBIG2, OpenJPEG, QCMS colour management)
 * with their non-WebAssembly fallbacks and licences; the Adobe CMaps; the standard fonts with their
 * licences; the ICC profiles; the PDF.js licence. Not copied: the scripting sandbox (scripting is
 * off). Older version folders are removed. public/pdfjs/ is gitignored.
 *
 * Run by the web `dev` and `build` scripts and by scripts/local-owner.ts (which starts Next
 * directly). The Docker build installs with --ignore-scripts, so this is never a lifecycle hook.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageJson = require.resolve("pdfjs-dist/package.json");
const source = dirname(packageJson);
const { version } = JSON.parse(readFileSync(packageJson, "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Unexpected pdfjs-dist version: ${version}`);

const publicRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "pdfjs");
const target = join(publicRoot, version);

const files = [
  ["legacy/build/pdf.worker.min.mjs", "pdf.worker.min.mjs"],
  ["LICENSE", "LICENSE"],
];
const wasm = readdirSync(join(source, "wasm")).filter(
  (name) => /^(jbig2|openjpeg|qcms_bg)\.wasm$/.test(name) || /_nowasm_fallback\.js$/.test(name) || name.startsWith("LICENSE"),
);
for (const name of wasm) files.push([`wasm/${name}`, `wasm/${name}`]);
const folders = ["cmaps", "standard_fonts", "iccs"];

for (const required of ["jbig2.wasm", "openjpeg.wasm", "qcms_bg.wasm", "jbig2_nowasm_fallback.js", "openjpeg_nowasm_fallback.js"]) {
  if (!wasm.includes(required)) throw new Error(`pdfjs-dist ${version} has no wasm/${required}`);
}

if (existsSync(publicRoot)) {
  for (const entry of readdirSync(publicRoot)) {
    if (entry !== version) rmSync(join(publicRoot, entry), { recursive: true, force: true });
  }
}
mkdirSync(join(target, "wasm"), { recursive: true });
for (const [from, to] of files) cpSync(join(source, from), join(target, to));
for (const folder of folders) cpSync(join(source, folder), join(target, folder), { recursive: true });

console.log(`[pdfjs] PDF.js ${version} assets in public/pdfjs/${version}/`);
