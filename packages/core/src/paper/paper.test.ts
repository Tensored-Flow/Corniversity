import { describe, expect, it } from "vitest";
import { checkPdf, prepareWorkFile, sniffWorkMime, stripJpeg, stripPng, WorkFileError } from "./files";
import { canConfirm, lineRangeOfSelection, linesOf, pageOfLine, uncertainMarks } from "./transcription";

const seg = (marker: number, payload: number[]) => [
  0xff,
  marker,
  ((payload.length + 2) >> 8) & 0xff,
  (payload.length + 2) & 0xff,
  ...payload,
];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** A structurally valid JPEG: SOI, APP0 (JFIF), APP1 (EXIF with a GPS tag), COM, SOF0 (3x2), SOS + data, EOI. */
function jpegWithMetadata(): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    ...seg(0xe0, ascii("JFIF\0")),
    ...seg(0xe1, ascii("Exif\0\0GPSLatitude 51.4988N")),
    ...seg(0xfe, ascii("taken by Leon")),
    ...seg(0xc0, [8, 0, 2, 0, 3, 1, 1, 0x11, 0]),
    ...seg(0xda, [1, 1, 0, 0, 0x3f, 0]),
    0x12,
    0x34,
    0x56,
    0xff,
    0xd9,
  ]);
}

function crcless(type: string, data: number[]) {
  const len = data.length;
  return [(len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff, ...ascii(type), ...data, 0, 0, 0, 0];
}

function pngWithText(): Uint8Array {
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...crcless("IHDR", [0, 0, 0, 4, 0, 0, 0, 5, 8, 2, 0, 0, 0]),
    ...crcless("tEXt", ascii("Author\0Leon")),
    ...crcless("eXIf", ascii("GPS")),
    ...crcless("IDAT", [1, 2, 3]),
    ...crcless("IEND", []),
  ]);
}

describe("paper files", () => {
  it("recognises files by their real signature, not their name", () => {
    expect(sniffWorkMime(jpegWithMetadata())).toBe("image/jpeg");
    expect(sniffWorkMime(pngWithText())).toBe("image/png");
    expect(sniffWorkMime(new Uint8Array(ascii("%PDF-1.7")))).toBe("application/pdf");
    expect(sniffWorkMime(new Uint8Array(ascii("<html>")))).toBeNull();
    expect(() => prepareWorkFile(new Uint8Array(ascii("<script>alert(1)</script>")))).toThrow(WorkFileError);
  });

  it("removes EXIF (with any location), XMP and comments from a JPEG and keeps the image data", () => {
    const original = jpegWithMetadata();
    const out = stripJpeg(original);
    const text = String.fromCharCode(...out.bytes);
    expect(out.stripped).toBe(true);
    expect(text).not.toContain("GPSLatitude");
    expect(text).not.toContain("taken by Leon");
    expect(text).toContain("JFIF");
    expect([out.width, out.height]).toEqual([3, 2]);
    // The entropy-coded scan and the end marker are copied byte for byte.
    expect([...out.bytes.slice(-5)]).toEqual([0x12, 0x34, 0x56, 0xff, 0xd9]);
  });

  it("removes text and EXIF chunks from a PNG and keeps the pixels", () => {
    const out = stripPng(pngWithText());
    const text = String.fromCharCode(...out.bytes);
    expect(out.stripped).toBe(true);
    expect(text).not.toContain("Author");
    expect(text).not.toContain("eXIf");
    expect(text).toContain("IDAT");
    expect([out.width, out.height]).toEqual([4, 5]);
  });

  it("refuses damaged images and PDFs with active content", () => {
    expect(() => stripJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x40]))).toThrow(/truncated/);
    expect(() => checkPdf(new Uint8Array(ascii("%PDF-1.7\n1 0 obj << /S /JavaScript /JS (app.alert(1)) >>\n%%EOF")))).toThrow(
      /scripts or embedded files/,
    );
    expect(checkPdf(new Uint8Array(ascii("%PDF-1.7\n1 0 obj << /Type /Page >>\n%%EOF"))).mime).toBe("application/pdf");
  });

  it("keeps only decoding segments: metadata between progressive scans, ICC/MPF/JUMBF and anything after the end marker go", () => {
    const progressive = new Uint8Array([
      0xff,
      0xd8,
      ...seg(0xe0, ascii("JFIF\0")),
      ...seg(0xe2, ascii("MPF\0 secondary image")),
      ...seg(0xeb, ascii("JUMBF c2pa")),
      ...seg(0xc2, [8, 0, 2, 0, 3, 1, 1, 0x11, 0]),
      ...seg(0xc4, [0, 1, 2]),
      ...seg(0xda, [1, 1, 0, 0, 0x3f, 0]),
      // First scan: a stuffed 0xFF00 and a restart marker are image data and stay.
      0x12,
      0xff,
      0x00,
      0x34,
      0xff,
      0xd0,
      0x56,
      // Between scans: a table that stays, and EXIF with a location that goes.
      ...seg(0xc4, [3, 4, 5]),
      ...seg(0xe1, ascii("Exif\0\0GPSLatitude 48.8584N")),
      ...seg(0xda, [1, 1, 0, 0, 0x3f, 0]),
      0x78,
      0xff,
      0xd9,
      // After the end marker: a second image's EXIF.
      ...ascii("Exif GPSLongitude 2.2945E"),
    ]);
    const out = stripJpeg(progressive);
    const text = String.fromCharCode(...out.bytes);
    expect(out.stripped).toBe(true);
    for (const gone of ["GPSLatitude", "GPSLongitude", "MPF", "c2pa"]) expect(text).not.toContain(gone);
    expect(text).toContain("JFIF");
    expect([...out.bytes.slice(-2)]).toEqual([0xff, 0xd9]);
    expect(String.fromCharCode(...out.bytes)).toContain(String.fromCharCode(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56));
    expect(String.fromCharCode(...out.bytes)).toContain(String.fromCharCode(...seg(0xc4, [3, 4, 5])));
    expect(() => stripJpeg(jpegWithMetadata().slice(0, -2))).toThrow(/no end marker/);
  });

  it("decodes #xx escapes in PDF names before looking for active content", () => {
    for (const body of ["/S /J#61vaScript", "/S /Launc#68", "/AA << /O 2 0 R >>", "/S /SubmitForm", "/XFA 3 0 R"]) {
      expect(() => checkPdf(new Uint8Array(ascii(`%PDF-1.7\n1 0 obj << ${body} >>\n%%EOF`)))).toThrow(/scripts or embedded files/);
    }
  });
});

describe("transcriptions", () => {
  const text = "[page 1]\nLet ε > 0.\nChoose [[?δ or d]] = ε/2.\n[page 2]\nThen |f(x) − f(y)| [[?<]] ε.";

  it("finds every uncertain symbol with its line, and refuses confirmation until none remain", () => {
    expect(uncertainMarks(text)).toEqual([
      { line: 3, text: "δ or d" },
      { line: 5, text: "<" },
    ]);
    const refused = canConfirm(text);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toMatch(/confirm these 2 symbols/);
    expect(canConfirm(text.replace("[[?δ or d]]", "δ").replace("[[?<]]", "<")).ok).toBe(true);
  });

  it("maps a line to its page and returns the lines of a selected step", () => {
    expect(pageOfLine(text, 3)).toBe(1);
    expect(pageOfLine(text, 5)).toBe(2);
    expect(linesOf(text, 2, 3)).toBe("Let ε > 0.\nChoose [[?δ or d]] = ε/2.");
  });

  it("turns a text-area selection into the lines it covers", () => {
    const t = "line one\nline two\nline three";
    expect(lineRangeOfSelection(t, 0, 3)).toEqual([1, 1]);
    expect(lineRangeOfSelection(t, 5, 15)).toEqual([1, 2]);
    expect(lineRangeOfSelection(t, 9, 18)).toEqual([2, 2]); // ends just after the newline
    expect(lineRangeOfSelection(t, 9, 28)).toEqual([2, 3]);
  });
});
