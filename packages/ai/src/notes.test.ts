import { describe, expect, it } from "vitest";
import { modelLabel, turnNotes } from "./notes";

describe("notes on how a reply was produced", () => {
  it("say nothing about a reply that finished normally", () => {
    expect(turnNotes({ stopReason: "end_turn", fallbacks: [] })).toEqual([]);
  });

  it("name a decline, with its category when the provider gave one", () => {
    expect(turnNotes({ stopReason: "refusal", refusalCategory: "bio", fallbacks: [] })[0]).toMatch(
      /declined to continue \(category: bio\)/,
    );
  });

  it("say when a reply stops at its length allowance", () => {
    expect(turnNotes({ stopReason: "max_tokens", fallbacks: [] })[0]).toMatch(/length allowance/);
  });

  it("say which model took over after a decline", () => {
    const [note] = turnNotes({ stopReason: "end_turn", fallbacks: [{ from: "claude-opus-5-5", to: "claude-opus-4-8" }] });
    expect(note).toMatch(/Claude Opus 5.5 declined part of this request and claude-opus-4-8 continued it/);
  });

  it("label the scripted demo as such, never as a model", () => {
    expect(modelLabel("fixture")).toBe("Scripted demo");
    expect(modelLabel("claude-sonnet-5-5")).toBe("Claude Sonnet 5.5");
  });
});
