import type { PermissionStatus } from "../domain/enums";

/**
 * The reading companion's actions and the decision, before any model call, whether an action may
 * run and on what evidence. The gate order is fixed: the Document's state, then `external_ai`
 * allowed on that Document (only the owner grants it), then what the action needs. Ownership is
 * checked by the service before this is called.
 *
 * Evidence: for a stored, extracted Document the selection (attributed to the paper only when it is
 * found on the page), the page, and for proofs the next page; for a linked arXiv Document only the
 * selection, labelled as unchecked.
 */
export type CompanionAction = "question" | "explain_passage" | "explain_notation" | "walk_through_proof" | "check_understanding";

export const COMPANION_ACTIONS: readonly CompanionAction[] = [
  "question",
  "explain_passage",
  "explain_notation",
  "walk_through_proof",
  "check_understanding",
];

export const COMPANION_LABELS: Record<CompanionAction, string> = {
  question: "Ask a question",
  explain_passage: "Explain this passage",
  explain_notation: "Explain this notation",
  walk_through_proof: "Walk through this proof",
  check_understanding: "Check my understanding",
};

export const MAX_COMPANION_SELECTION_CHARS = 4000;
export const MAX_NOTATION_SELECTION_CHARS = 300;
export const MIN_UNDERSTANDING_CHARS = 20;

/** How the selection is labelled to the model and in the answer when the server never saw the paper. */
export const LINKED_SELECTION_LABEL = "Text you selected in the reader; Corniversity has not checked it against the paper";

export interface CompanionContext {
  action: CompanionAction;
  document: {
    /** `stored`: Corniversity holds the bytes; `linked`: read by the owner's browser from arXiv. */
    kind: "stored" | "linked";
    deleted: boolean;
    /** Stored Documents: whether extracted page text exists for it. */
    extracted: boolean;
    /** Linked Documents: the reader saw a changed file whose geometry the owner has not accepted. */
    unresolvedFileChange?: boolean;
  };
  externalAi: PermissionStatus;
  /** The owner's selection in the reader (may be empty). */
  selection: string;
  /** The owner's question, or for check_understanding their own explanation. */
  text: string;
  /** The 0-based page the reader is on, when known. */
  pageIndex: number | null;
}

export interface CompanionEvidencePlan {
  selection: boolean;
  /** Stored, extracted Documents only: the current page's extracted text. */
  page: boolean;
  /** walk_through_proof on a stored, extracted Document: also the next page. */
  nextPage: boolean;
  /** The label the selection carries; LINKED_SELECTION_LABEL for linked Documents. */
  selectionLabel: string | null;
}

export type CompanionDecision = { allowed: true; evidence: CompanionEvidencePlan } | { allowed: false; reason: string };

function refuse(reason: string): CompanionDecision {
  return { allowed: false, reason };
}

export function decideCompanionAction(ctx: CompanionContext): CompanionDecision {
  if (ctx.document.deleted) return refuse("This document has been deleted, so the companion cannot read it.");
  if (ctx.document.kind === "stored" && !ctx.document.extracted)
    return refuse("Corniversity has not extracted this document's text yet, so the companion has nothing to read.");
  if (ctx.document.kind === "linked" && ctx.document.unresolvedFileChange)
    return refuse("arXiv's file has changed since your notes were made; resolve that in the reader before asking.");
  if (ctx.externalAi === "denied") return refuse("You have not allowed external AI for this document.");
  if (ctx.externalAi !== "allowed")
    return refuse("External AI has not been allowed for this document. Only you can allow it, on the paper page, with its licence shown.");

  const selection = ctx.selection.trim();
  const text = ctx.text.trim();
  const linked = ctx.document.kind === "linked";
  if (selection.length > MAX_COMPANION_SELECTION_CHARS)
    return refuse(`The selection is longer than ${MAX_COMPANION_SELECTION_CHARS} characters; select a shorter passage.`);
  if (linked && selection.length === 0)
    return refuse("For a paper read from arXiv the companion sees only the text you select; select the passage first.");
  if (!linked && ctx.pageIndex === null) return refuse("Open the page you are asking about first.");

  switch (ctx.action) {
    case "question":
      if (text.length === 0) return refuse("Write your question first.");
      break;
    case "explain_passage":
      if (selection.length === 0) return refuse("Select the passage you want explained.");
      break;
    case "explain_notation":
      if (selection.length === 0) return refuse("Select the symbol or expression you want explained.");
      if (selection.length > MAX_NOTATION_SELECTION_CHARS)
        return refuse(`Select only the notation you want explained (up to ${MAX_NOTATION_SELECTION_CHARS} characters).`);
      break;
    case "walk_through_proof":
      break;
    case "check_understanding":
      if (text.length < MIN_UNDERSTANDING_CHARS)
        return refuse("Write your own explanation first (a sentence or two), so there is something to check.");
      break;
  }
  return {
    allowed: true,
    evidence: {
      selection: selection.length > 0,
      page: !linked,
      nextPage: !linked && ctx.action === "walk_through_proof",
      selectionLabel: selection.length === 0 ? null : linked ? LINKED_SELECTION_LABEL : null,
    },
  };
}

/** What each action asks of the companion; placed beside the evidence block. */
export const COMPANION_INSTRUCTIONS: Record<CompanionAction, string> = {
  question:
    "Answer the owner's question about the paper from the evidence only. Cite the evidence you use; say plainly when the evidence does not answer it.",
  explain_passage:
    "Explain the selected passage: what it claims, the terms it uses and how it follows from what the evidence shows before it. Do not go beyond the evidence without saying so.",
  explain_notation:
    "Explain the selected notation: what each symbol denotes here and how it is read aloud, from the evidence. If the evidence does not define it, say so and give only the conventional reading, labelled as such.",
  walk_through_proof:
    "Walk through the proof in the evidence step by step: the claim, each inference and the result or hypothesis it uses. Name any step the evidence leaves implicit; do not claim the proof is correct or incorrect beyond what the steps show.",
  check_understanding:
    "Compare the owner's explanation with the evidence: say what matches, what is missing and what disagrees, citing the evidence. Do not rewrite their explanation for them.",
};
