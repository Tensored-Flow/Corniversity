import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPANION_REFUSALS, LINKED_SELECTION_LABEL } from "@corniversity/core/scholarly/companion";
import { describe, expect, it } from "vitest";
import { ERROR_NOTICES, errorCode } from "@/lib/notices";
import { evidenceHeader, gateRefusal, runRefusal, selectionHeader } from "./companion-response";

/** The companion service's own refusal sentences, read from its source (the service itself needs a database). */
function serviceRefusals(): string[] {
  const source = readFileSync(resolve(__dirname, "../../../../../../../packages/db/src/services/companion.ts"), "utf8");
  const start = source.indexOf("export const COMPANION_SERVICE_REFUSALS");
  const block = source.slice(start, source.indexOf("} as const;", start));
  return [...block.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`) as string);
}

describe("/api/library/ask refusals", () => {
  it("registers every sentence the companion refuses with, so none becomes the neutral notice", () => {
    const sentences = [...Object.values(COMPANION_REFUSALS), ...serviceRefusals()];
    expect(sentences.length).toBeGreaterThan(18);
    for (const sentence of sentences) {
      const code = errorCode(sentence);
      expect(code, sentence).not.toBe("not-completed");
      expect(ERROR_NOTICES[code]).toBe(sentence);
    }
  });

  it("answers a gate refusal with its code, the registered sentence and a status by kind", () => {
    expect(gateRefusal({ reason: COMPANION_REFUSALS.aiUnknown, kind: "permission" })).toEqual({
      status: 403,
      body: { error: "companion-ai-unknown", message: COMPANION_REFUSALS.aiUnknown },
    });
    expect(gateRefusal({ reason: COMPANION_REFUSALS.localOnly, kind: "state" }).status).toBe(409);
    expect(gateRefusal({ reason: COMPANION_REFUSALS.notationTooLong, kind: "action" })).toEqual({
      status: 422,
      body: { error: "companion-notation-too-long", message: COMPANION_REFUSALS.notationTooLong },
    });
    expect(gateRefusal({ reason: "Document not found.", kind: "not_found" }).status).toBe(404);
    // A sentence nobody registered never reaches the owner as it is.
    expect(gateRefusal({ reason: "Something a provider said.", kind: "action" }).body).toEqual({
      error: "not-completed",
      message: ERROR_NOTICES["not-completed"],
    });
  });

  it("explains a refused model run: the registered sentence, and the planner's reason beside it", () => {
    expect(runRefusal(402, { error: "x", message: "Today's limit of $1.00 could be exceeded.", code: "budget_blocked" })).toEqual({
      status: 402,
      body: {
        error: "companion-budget-refused",
        message: ERROR_NOTICES["companion-budget-refused"],
        reason: "Today's limit of $1.00 could be exceeded.",
        code: "budget_blocked",
      },
    });
    expect(runRefusal(409, { message: "The key cannot be read.", code: "blocked" }).body).toMatchObject({
      error: "companion-provider-blocked",
      reason: "The key cannot be read.",
    });
    expect(runRefusal(409, null).body).toEqual({
      error: "companion-provider-blocked",
      message: ERROR_NOTICES["companion-provider-blocked"],
    });
  });

  it("names what was sent in headers the panel reads", () => {
    const header = evidenceHeader([{ tag: "E1", label: LINKED_SELECTION_LABEL, assetId: "secret-id", kind: "passage" }]);
    expect(JSON.parse(decodeURIComponent(header))).toEqual([{ tag: "E1", label: LINKED_SELECTION_LABEL }]);
    expect(header).not.toMatch(/[^\x21-\x7e]/);
    expect(selectionHeader({ selectionOnly: true, selectionFound: null })).toBe("only");
    expect(selectionHeader({ selectionOnly: false, selectionFound: true })).toBe("found");
    expect(selectionHeader({ selectionOnly: false, selectionFound: false })).toBe("not-found");
    expect(selectionHeader({ selectionOnly: false, selectionFound: null })).toBe("none");
  });
});
