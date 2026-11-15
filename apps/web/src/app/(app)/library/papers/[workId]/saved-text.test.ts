import { describe, expect, it } from "vitest";
import { savedText } from "./saved-text";

describe("the paper page's ?saved= confirmation", () => {
  it("shows only the page's own keys: inherited names, repeated parameters and unknown keys show nothing", () => {
    expect(savedText("saved", { extracting: false })).toBe("Saved to your library.");
    for (const key of ["__proto__", "constructor", "toString", "hasOwnProperty", "nope", "", undefined, ["saved", "saved"]])
      expect(savedText(key, { extracting: true }), String(key)).toBeNull();
  });

  it("says Extraction queued. only while the extraction is queued or running, never beside the file's finished status", () => {
    expect(savedText("processing", { extracting: true })).toBe("Extraction queued.");
    expect(savedText("processing", { extracting: false })).toBeNull();
  });
});
