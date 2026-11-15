import { describe, expect, it } from "vitest";
import {
  COMPANION_ACTIONS,
  COMPANION_INSTRUCTIONS,
  type CompanionContext,
  decideCompanionAction,
  LINKED_SELECTION_LABEL,
  MAX_COMPANION_SELECTION_CHARS,
} from "./companion";

const stored: CompanionContext = {
  action: "explain_passage",
  document: { kind: "stored", deleted: false, extracted: true },
  externalAi: "allowed",
  selection: "Let G be a finite group.",
  text: "",
  pageIndex: 4,
};
const linked: CompanionContext = { ...stored, document: { kind: "linked", deleted: false, extracted: false } };

describe("decideCompanionAction", () => {
  it("checks the Document's state before external AI, and external AI before the action", () => {
    expect(decideCompanionAction({ ...stored, document: { ...stored.document, deleted: true }, externalAi: "denied" })).toEqual({
      allowed: false,
      reason: "This document has been deleted, so the companion cannot read it.",
    });
    expect(decideCompanionAction({ ...stored, document: { ...stored.document, extracted: false }, externalAi: "unknown" })).toMatchObject({
      allowed: false,
      reason: expect.stringMatching(/not extracted/),
    });
    expect(decideCompanionAction({ ...linked, document: { ...linked.document, unresolvedFileChange: true } })).toMatchObject({
      reason: expect.stringMatching(/file has changed/),
    });
    expect(decideCompanionAction({ ...stored, externalAi: "denied", selection: "" })).toEqual({
      allowed: false,
      reason: "You have not allowed external AI for this document.",
    });
    expect(decideCompanionAction({ ...stored, externalAi: "unknown" })).toMatchObject({
      reason: expect.stringMatching(/Only you can allow it/),
    });
  });

  it("sees only the selection on a linked arXiv Document, labelled as unchecked", () => {
    expect(decideCompanionAction({ ...linked, selection: "  " })).toMatchObject({
      allowed: false,
      reason: expect.stringMatching(/select the passage first/),
    });
    expect(decideCompanionAction({ ...linked, action: "walk_through_proof" })).toEqual({
      allowed: true,
      evidence: { selection: true, page: false, nextPage: false, selectionLabel: LINKED_SELECTION_LABEL },
    });
  });

  it("uses the page, and for proofs the next page, on a stored extracted Document", () => {
    expect(decideCompanionAction({ ...stored, action: "walk_through_proof", selection: "" })).toEqual({
      allowed: true,
      evidence: { selection: false, page: true, nextPage: true, selectionLabel: null },
    });
    expect(decideCompanionAction({ ...stored, pageIndex: null })).toMatchObject({
      allowed: false,
      reason: expect.stringMatching(/Open the page/),
    });
  });

  it("asks of each action what it needs", () => {
    expect(decideCompanionAction({ ...stored, action: "question", text: " " })).toMatchObject({ reason: "Write your question first." });
    expect(decideCompanionAction({ ...stored, action: "question", text: "Why is G finite?", selection: "" })).toMatchObject({
      allowed: true,
    });
    expect(decideCompanionAction({ ...stored, action: "explain_passage", selection: "" })).toMatchObject({ allowed: false });
    expect(decideCompanionAction({ ...stored, action: "explain_notation", selection: "" })).toMatchObject({ allowed: false });
    expect(decideCompanionAction({ ...stored, action: "explain_notation", selection: "x".repeat(301) })).toMatchObject({
      reason: expect.stringMatching(/up to 300 characters/),
    });
    expect(decideCompanionAction({ ...stored, action: "explain_notation", selection: "\\mathfrak{g}" })).toMatchObject({ allowed: true });
    expect(decideCompanionAction({ ...stored, action: "check_understanding", text: "too short" })).toMatchObject({ allowed: false });
    expect(
      decideCompanionAction({ ...stored, action: "check_understanding", text: "The lemma says every finite group has a Sylow subgroup." }),
    ).toMatchObject({ allowed: true });
    expect(decideCompanionAction({ ...stored, selection: "x".repeat(MAX_COMPANION_SELECTION_CHARS + 1) })).toMatchObject({
      reason: expect.stringMatching(/longer than 4000 characters/),
    });
  });

  it("states for every action what the companion may and may not do", () => {
    for (const action of COMPANION_ACTIONS) expect(COMPANION_INSTRUCTIONS[action].length).toBeGreaterThan(60);
    expect(COMPANION_INSTRUCTIONS.walk_through_proof).toMatch(/do not claim the proof is correct/);
    expect(COMPANION_INSTRUCTIONS.check_understanding).toMatch(/Do not rewrite their explanation/);
  });
});
