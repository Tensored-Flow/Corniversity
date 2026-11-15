import { createRequire } from "node:module";
import { version as unpdfEngine } from "unpdf/pdfjs";
import { describe, expect, it } from "vitest";
import { documentOptions, pdfjsAssets } from "./engine";

const require = createRequire(import.meta.url);

describe("PDF.js versions", () => {
  it("the browser reader and the server's extraction run the same PDF.js engine", () => {
    const readerPackage = require("pdfjs-dist/package.json") as { version: string };
    // Upgrade unpdf and pdfjs-dist together (a pdf.js security advisory may bump pdfjs-dist alone).
    expect(readerPackage.version).toBe(unpdfEngine);
    expect(readerPackage.version).toBe("6.4.299");
  });
});

describe("vendored assets", () => {
  it("are same-origin, versioned and end in slashes as PDF.js requires", () => {
    const assets = pdfjsAssets("6.4.299", "http://127.0.0.1:3600");
    expect(assets).toEqual({
      workerSrc: "http://127.0.0.1:3600/pdfjs/6.4.299/pdf.worker.min.mjs",
      wasmUrl: "http://127.0.0.1:3600/pdfjs/6.4.299/wasm/",
      cMapUrl: "http://127.0.0.1:3600/pdfjs/6.4.299/cmaps/",
      standardFontDataUrl: "http://127.0.0.1:3600/pdfjs/6.4.299/standard_fonts/",
      iccUrl: "http://127.0.0.1:3600/pdfjs/6.4.299/iccs/",
    });
  });

  it("open documents from bytes with XFA off and packed CMaps", () => {
    const data = new Uint8Array([37, 80, 68, 70, 45]);
    const options = documentOptions(data, pdfjsAssets("6.4.299", "https://example.org"));
    expect(options).toMatchObject({ data, enableXfa: false, cMapPacked: true });
    expect(options).not.toHaveProperty("url");
  });
});
