import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ERROR_NOTICES, errorCode, errorHref, errorNotice, NEUTRAL_NOTICE } from "./notices";

describe("error notices", () => {
  it("never shows text supplied in a URL: a crafted message gets the neutral notice", () => {
    const crafted = "Your account is suspended. Call +44 20 0000 0000 and read out your password to restore it.";
    expect(errorNotice(crafted)).toBe(NEUTRAL_NOTICE);
    expect(errorNotice(encodeURIComponent(crafted))).toBe(NEUTRAL_NOTICE);
    expect(errorNotice("<script>alert(1)</script>")).toBe(NEUTRAL_NOTICE);
    // A repeated parameter arrives as an array; it is not a listed code either.
    expect(errorNotice(["unknown-run", crafted])).toBe(NEUTRAL_NOTICE);
    // Inherited object keys are not codes.
    expect(errorNotice("constructor")).toBe(NEUTRAL_NOTICE);
    expect(errorNotice("__proto__")).toBe(NEUTRAL_NOTICE);
  });

  it("shows the application's own text for a listed code, and nothing when there is no code", () => {
    expect(errorNotice("unknown-run")).toBe("Unknown run.");
    expect(errorNotice(undefined)).toBeNull();
    expect(errorNotice("")).toBeNull();
  });

  it("turns a service message into its code, and an unlisted message into the neutral code", () => {
    expect(errorCode("Tick the confirmation box to delete this entry.")).toBe("tick-confirmation-box-delete-entry");
    expect(errorCode("Decide on each overlapping course first: COG-901, MAT-902.")).toBe("proposal-overlap-undecided");
    expect(errorCode("Choose a budget above $0 and at most $20.00 (your monthly limit, and at most $20).")).toBe(
      "preparation-budget-out-of-range",
    );
    // Validation messages joined in one sentence: the first one names the code.
    expect(errorCode("Give it a title. Record its licence or terms of use.")).toBe("give-title");
    expect(errorCode("Main courses must be between 1 and 4.")).toBe("study-main-courses-range");
    expect(errorCode("Unknown study rhythm.")).toBe("study-unknown-rhythm");
    expect(errorCode("Something no service says.")).toBe("not-completed");
  });

  it("builds redirect targets that carry only the code", () => {
    expect(errorHref("/settings", "unknown-run", "#provider")).toBe("/settings?error=unknown-run#provider");
    expect(errorHref("/library/read/x?page=2", "write-note-before-saving")).toBe("/library/read/x?page=2&error=write-note-before-saving");
  });

  it("lists every literal message the services throw, so none silently becomes the neutral notice", () => {
    const root = resolve(__dirname, "../../../../packages/db/src/services");
    const files = readdirSync(root).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    const listed = new Set<string>(Object.values(ERROR_NOTICES));
    const missing: string[] = [];
    const throwSite = /new (\w+Error)\(([^;]*?)\)\s*;/gs;
    const literal = /"((?:[^"\\]|\\.)*)"/g;
    for (const file of files) {
      const source = readFileSync(join(root, file), "utf8");
      for (const site of source.matchAll(throwSite)) {
        if (["Error", "TypeError", "VisualError"].includes(site[1]!)) continue;
        for (const m of site[2]!.matchAll(literal)) {
          const text = JSON.parse(`"${m[1]}"`) as string;
          // Machine codes (`not_found`) are not messages; sentences are.
          if (!text.includes(" ") || !/^[A-Z]/.test(text)) continue;
          if (!listed.has(text)) missing.push(`${file}: ${text}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
