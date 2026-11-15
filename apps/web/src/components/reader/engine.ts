/**
 * Loads PDF.js in the browser: the polyfilled legacy build (the modern build supports only the
 * latest Chrome and Firefox, not Safari), its core first because the viewer components read
 * `globalThis.pdfjsLib` when they are evaluated. Client-only: never import this from a module that
 * renders on the server.
 */
import type { DocumentInitParameters } from "pdfjs-dist/types/src/display/api";

export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const viewer = await import("pdfjs-dist/legacy/web/pdf_viewer.mjs");
  return { pdfjs, viewer };
}

export type Pdfjs = Awaited<ReturnType<typeof loadPdfjs>>;

/**
 * Same-origin URLs of the vendored assets (apps/web/scripts/vendor-pdfjs.mjs). The folder is named
 * after the running library's version, so a missing or stale copy fails instead of mixing versions.
 * PDF.js requires the trailing slashes.
 */
export function pdfjsAssets(version: string, origin: string) {
  const base = `${origin}/pdfjs/${version}/`;
  return {
    workerSrc: `${base}pdf.worker.min.mjs`,
    wasmUrl: `${base}wasm/`,
    cMapUrl: `${base}cmaps/`,
    standardFontDataUrl: `${base}standard_fonts/`,
    iccUrl: `${base}iccs/`,
  };
}

/**
 * Document options. Scripting is never set up (no scripting manager exists here), XFA is off,
 * and PDF.js 6.4 has no JavaScript eval path left to disable (`isEvalSupported` was removed;
 * PostScript functions compile to WebAssembly in the worker under the /pdfjs/ policy).
 */
export function documentOptions(data: Uint8Array, assets: ReturnType<typeof pdfjsAssets>): DocumentInitParameters {
  return {
    data,
    wasmUrl: assets.wasmUrl,
    cMapUrl: assets.cMapUrl,
    cMapPacked: true,
    standardFontDataUrl: assets.standardFontDataUrl,
    iccUrl: assets.iccUrl,
    enableXfa: false,
  };
}
