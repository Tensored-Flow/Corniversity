/**
 * Options every server-side unpdf `getDocumentProxy` call passes (the worker's extraction, the upload
 * route and scripts/pdf-dump.ts), merged with its own, such as `maxImageSize`.
 *
 * When `pdfjs-dist` resolves from unpdf, unpdf 2.1.0 switches to that package's standard fonts
 * (`useSystemFonts: false`), packed CMaps and wasm decoders. The web reader installs pdfjs-dist, so
 * a full install resolves it; the production worker image (installed with `--filter
 * @corniversity/worker...`) does not. These values keep unpdf's own defaults, so extracted text and
 * metadata are the same with or without the reader's engine installed: in development, in tests
 * and in production.
 */
export const UNPDF_PINNED_OPTIONS = {
  useSystemFonts: true,
  standardFontDataUrl: undefined,
  cMapUrl: undefined,
  wasmUrl: undefined,
} as const;
