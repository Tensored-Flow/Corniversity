import { LINKED_SELECTION_LABEL } from "@corniversity/core/scholarly/companion";
import { describe, expect, it } from "vitest";
import {
  ACTION_CHOICES,
  type AskPanelData,
  answerContext,
  answerNotes,
  type CompanionAnswerView,
  captureSelection,
  createAskStore,
  parseEvidenceHeader,
  refusalFrom,
  sentDescription,
  textFieldFor,
} from "./ask";

const data: AskPanelData = {
  assetId: "00000000-0000-4000-8000-000000000000",
  kind: "stored",
  stateRefusal: null,
  permission: { status: "unknown", basis: null },
  licence: "No licence is recorded for this file.",
  personaName: "the reading companion",
  aiLabel: { text: "AI reading companion · scripted demo", title: "" },
  lastAnswer: null,
};

describe("the Ask panel's rules", () => {
  it("starts closed and empty, and keeps its state for the panel to read back", () => {
    const store = createAskStore(data);
    expect(store.get()).toMatchObject({ selection: null, action: "question", pending: false, permission: data.permission, answer: null });
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    store.set({ text: "Why?" });
    unsubscribe();
    store.set({ text: "Why not?" });
    expect(calls).toBe(1);
    expect(store.get().text).toBe("Why not?");
  });

  it("turns an untouched question into an explanation when the selection bar hands over a selection", () => {
    const store = createAskStore(data);
    store.set(captureSelection(store.get(), { text: "Let G be a group.", pageIndex: 2 }));
    expect(store.get()).toMatchObject({ action: "explain_passage", captured: 1, focusRequested: true, selection: { pageIndex: 2 } });
    // A question the owner has started writing, or another chosen action, is left alone.
    store.set({ action: "question", text: "What is G?" });
    store.set(captureSelection(store.get(), { text: "x", pageIndex: 0 }));
    expect(store.get().action).toBe("question");
    store.set({ action: "explain_notation", text: "" });
    store.set(captureSelection(store.get(), { text: "y", pageIndex: 0 }));
    expect(store.get().action).toBe("explain_notation");
  });

  it("asks for the owner's words where an action needs them", () => {
    expect(textFieldFor("question")).toMatchObject({ label: "Your question", required: true });
    expect(textFieldFor("check_understanding")).toMatchObject({ label: "Your explanation", required: true });
    expect(textFieldFor("explain_passage")).toMatchObject({ label: "Anything to add (optional)", required: false });
    expect(ACTION_CHOICES.map((c) => c.label)).toEqual([
      "Ask a question",
      "Explain this passage",
      "Explain this notation",
      "Walk through this proof",
      "Explain the background",
      "Question this argument",
      "Check my understanding",
    ]);
  });

  it("says before sending what is sent", () => {
    expect(sentDescription({ kind: "linked", action: "explain_passage", hasSelection: true, pageLabel: "page 3" })).toBe(
      "Sent: only your selection, marked as not checked against the paper.",
    );
    expect(sentDescription({ kind: "stored", action: "explain_passage", hasSelection: true, pageLabel: "page 3" })).toBe(
      "Sent: your selection and the extracted text of page 3.",
    );
    expect(sentDescription({ kind: "stored", action: "walk_through_proof", hasSelection: false, pageLabel: "page 3" })).toBe(
      "Sent: the extracted text of page 3 and the next page.",
    );
  });

  it("notes beside an answer what no model text can change", () => {
    expect(answerNotes({ kind: "linked", action: "walk_through_proof" })).toEqual([
      `Only your selection was sent. ${LINKED_SELECTION_LABEL}.`,
      "An explanation of a proof is not a formal verification of it.",
    ]);
    expect(answerNotes({ kind: "stored", action: "question" })).toEqual([]);
  });

  it("shows an earlier visit's answer with its action's notes and what was sent, from the stored request", () => {
    const stored: CompanionAnswerView = {
      request: { html: "<p>Walk through this proof</p>" },
      answer: { html: "<p>An answer</p>", labels: [], citations: [], uncited: 0, producedBy: "Scripted demo" },
      action: "walk_through_proof",
      evidence: [{ tag: "E1", label: "Notes, PDF page 1: extracted text of the page" }],
    };
    const shown = answerContext(stored, null);
    expect(shown).toEqual({ action: "walk_through_proof", evidence: stored.evidence });
    expect(answerNotes({ kind: "stored", action: shown.action })).toEqual([
      "An explanation of a proof is not a formal verification of it.",
    ]);
    // This visit's request, when there is one, is the same exchange.
    const sent = { action: "question" as const, evidence: [{ tag: "E1", label: "x" }], selection: null };
    expect(answerContext({ ...stored, action: null, evidence: [] }, sent)).toEqual({ action: "question", evidence: sent.evidence });
    expect(answerContext({ ...stored, action: null, evidence: [] }, null)).toEqual({ action: null, evidence: [] });
  });

  it("shows the server's registered sentence for a refusal, and a refused run's reason with the way to Settings", () => {
    expect(
      refusalFrom(422, {
        error: "companion-notation-too-long",
        message: "Select only the notation you want explained (up to 300 characters).",
      }),
    ).toEqual({ message: "Select only the notation you want explained (up to 300 characters).", reason: null, settings: false });
    expect(
      refusalFrom(402, {
        error: "companion-budget-refused",
        message: "No model was asked and nothing was charged: a limit you set stops this request.",
        reason: "Today's limit of $1.00 could be exceeded.",
      }),
    ).toEqual({
      message: "No model was asked and nothing was charged: a limit you set stops this request.",
      reason: "Today's limit of $1.00 could be exceeded.",
      settings: true,
    });
    expect(refusalFrom(401, { error: "unauthorized" }).message).toMatch(/session has ended, so nothing was sent/);
    expect(refusalFrom(403, { error: "cross_origin" }).message).toBe("The server refused the request (status 403), so nothing was sent.");
    expect(refusalFrom(500, null).message).toBe("The server refused the request (status 500), so nothing was sent.");
  });

  it("reads the evidence the route sent, and nothing it cannot read", () => {
    const value = encodeURIComponent(
      JSON.stringify([
        { tag: "E1", label: LINKED_SELECTION_LABEL },
        { tag: 2, label: "x" },
      ]),
    );
    expect(parseEvidenceHeader(value)).toEqual([{ tag: "E1", label: LINKED_SELECTION_LABEL }]);
    expect(parseEvidenceHeader(null)).toEqual([]);
    expect(parseEvidenceHeader("%E0%A4%A")).toEqual([]);
    expect(parseEvidenceHeader(encodeURIComponent('{"tag":"E1"}'))).toEqual([]);
  });
});
