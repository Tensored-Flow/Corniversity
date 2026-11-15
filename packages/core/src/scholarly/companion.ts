import type { PermissionStatus } from "../domain/enums";

/**
 * The reading companion's actions and the decision, before any model call, whether an action may
 * run and on what evidence. The gate order is fixed: the Document's state (deleted; on the owner's
 * desktop only; a stored Document not extracted; a linked Document whose file the reader has not
 * reported, or whose change the owner has not resolved), then `external_ai` allowed on that
 * Document (only the owner grants it), then what the action needs. The session and ownership are
 * checked by the route and the service before this is called.
 *
 * Evidence: for a stored, extracted Document the selection (attributed to the paper only when it is
 * found on the page), the page, and for proofs the next page; for a linked arXiv Document only the
 * selection, labelled as unchecked.
 */
export const COMPANION_ACTIONS = [
  "question",
  "explain_passage",
  "explain_notation",
  "walk_through_proof",
  "explain_background",
  "question_argument",
  "check_understanding",
] as const;

export type CompanionAction = (typeof COMPANION_ACTIONS)[number];

export const COMPANION_LABELS: Record<CompanionAction, string> = {
  question: "Ask a question",
  explain_passage: "Explain this passage",
  explain_notation: "Explain this notation",
  walk_through_proof: "Walk through this proof",
  explain_background: "Explain the background",
  question_argument: "Question this argument",
  check_understanding: "Check my understanding",
};

export function isCompanionAction(value: unknown): value is CompanionAction {
  return typeof value === "string" && (COMPANION_ACTIONS as readonly string[]).includes(value);
}

export const MAX_COMPANION_SELECTION_CHARS = 4000;
export const MAX_NOTATION_SELECTION_CHARS = 300;
export const MIN_UNDERSTANDING_CHARS = 20;
/** The owner's question, or their own explanation for check_understanding. */
export const MAX_COMPANION_TEXT_CHARS = 2000;

/** How the selection is labelled to the model and in the answer when the server never saw the paper. */
export const LINKED_SELECTION_LABEL = "Text you selected in the reader; Corniversity has not checked it against the paper";

/** Every reason the companion refuses before a model call (each is a registered notice in the web app). */
export const COMPANION_REFUSALS = {
  deleted: "This document has been deleted, so the companion cannot read it.",
  localOnly: "This document is on your desktop only: its contents have never left your device, so the companion cannot read it.",
  notExtracted: "Corniversity has not extracted this document's text yet, so the companion has nothing to read.",
  fileUnreported: "The reader has not yet reported which file it received from arXiv; wait until the pages have loaded, then ask again.",
  fileChanged: "arXiv's file has changed since your notes were made; resolve that in the reader before asking.",
  aiDenied: "You have not allowed external AI for this document.",
  aiUnknown: "External AI has not been allowed for this document. Only you can allow it, with its licence shown.",
  selectionTooLong: `The selection is longer than ${MAX_COMPANION_SELECTION_CHARS} characters; select a shorter passage.`,
  textTooLong: `Keep what you write to ${MAX_COMPANION_TEXT_CHARS} characters.`,
  linkedNeedsSelection: "For a paper read from arXiv the companion sees only the text you select; select the passage first.",
  openPage: "Open the page you are asking about first.",
  writeQuestion: "Write your question first.",
  selectPassage: "Select the passage you want explained.",
  selectNotation: "Select the symbol or expression you want explained.",
  notationTooLong: `Select only the notation you want explained (up to ${MAX_NOTATION_SELECTION_CHARS} characters).`,
  selectArgument: "Select the argument you want questioned.",
  writeExplanation: "Write your own explanation first (a sentence or two), so there is something to check.",
} as const;

export interface CompanionContext {
  action: CompanionAction;
  document: {
    /**
     * `stored`: Corniversity holds the bytes; `linked`: read by the owner's browser from arXiv;
     * `local`: registered from the owner's desktop, its contents never sent.
     */
    kind: "stored" | "linked" | "local";
    deleted: boolean;
    /** Stored Documents: whether extracted page text exists for it. */
    extracted: boolean;
    /** Linked Documents: whether the reader reported the file it loaded (default true). */
    fileReported?: boolean;
    /** Linked Documents: notes stand on another file than the one loaded, and the owner has not resolved that. */
    unresolvedFileChange?: boolean;
  };
  externalAi: PermissionStatus;
  /** The owner's selection in the reader (may be empty). */
  selection: string;
  /** The owner's question, or for check_understanding their own explanation (optional for the other actions). */
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
  const doc = ctx.document;
  if (doc.deleted) return refuse(COMPANION_REFUSALS.deleted);
  if (doc.kind === "local") return refuse(COMPANION_REFUSALS.localOnly);
  if (doc.kind === "stored" && !doc.extracted) return refuse(COMPANION_REFUSALS.notExtracted);
  if (doc.kind === "linked" && doc.fileReported === false) return refuse(COMPANION_REFUSALS.fileUnreported);
  if (doc.kind === "linked" && doc.unresolvedFileChange) return refuse(COMPANION_REFUSALS.fileChanged);
  if (ctx.externalAi === "denied") return refuse(COMPANION_REFUSALS.aiDenied);
  if (ctx.externalAi !== "allowed") return refuse(COMPANION_REFUSALS.aiUnknown);

  const selection = ctx.selection.trim();
  const text = ctx.text.trim();
  const linked = doc.kind === "linked";
  if (selection.length > MAX_COMPANION_SELECTION_CHARS) return refuse(COMPANION_REFUSALS.selectionTooLong);
  if (text.length > MAX_COMPANION_TEXT_CHARS) return refuse(COMPANION_REFUSALS.textTooLong);
  if (linked && selection.length === 0) return refuse(COMPANION_REFUSALS.linkedNeedsSelection);
  if (!linked && ctx.pageIndex === null) return refuse(COMPANION_REFUSALS.openPage);

  switch (ctx.action) {
    case "question":
      if (text.length === 0) return refuse(COMPANION_REFUSALS.writeQuestion);
      break;
    case "explain_passage":
      if (selection.length === 0) return refuse(COMPANION_REFUSALS.selectPassage);
      break;
    case "explain_notation":
      if (selection.length === 0) return refuse(COMPANION_REFUSALS.selectNotation);
      if (selection.length > MAX_NOTATION_SELECTION_CHARS) return refuse(COMPANION_REFUSALS.notationTooLong);
      break;
    case "question_argument":
      if (selection.length === 0) return refuse(COMPANION_REFUSALS.selectArgument);
      break;
    case "walk_through_proof":
    case "explain_background":
      break;
    case "check_understanding":
      if (text.length < MIN_UNDERSTANDING_CHARS) return refuse(COMPANION_REFUSALS.writeExplanation);
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

/** What each action asks of the companion; the reading prompt states it beside the evidence rules. */
export const COMPANION_INSTRUCTIONS: Record<CompanionAction, string> = {
  question:
    "Answer the owner's question about the paper from the evidence only. Cite the evidence you use; say plainly when the evidence does not answer it.",
  explain_passage:
    "Explain the selected passage: what it claims, the terms it uses and how it follows from what the evidence shows before it. Do not go beyond the evidence without saying so.",
  explain_notation:
    "Explain the selected notation: what each symbol denotes here and how it is read aloud, from the evidence. If the evidence does not define it, say so and give only the conventional reading, labelled as such.",
  walk_through_proof:
    "Walk through the proof in the evidence step by step: the claim, each inference and the result or hypothesis it uses. Name any step the evidence leaves implicit; do not claim the proof is correct or incorrect beyond what the steps show. End by saying that this explanation is not a formal verification of the proof.",
  explain_background:
    "Introduce the concepts a reader needs to follow the evidence: name each one, say briefly what it is and where the evidence uses it. Everything that does not come from the evidence is background, marked as background, never as a claim of the paper.",
  question_argument:
    "Examine the selected argument: the assumptions it states or relies on, the steps that depend on each, and where it could fail or needs more support. Put possible weaknesses as questions to check, not as established faults; do not claim the argument is wrong beyond what the evidence shows.",
  check_understanding:
    "Compare the owner's explanation with the evidence: say what matches, what is missing and what disagrees, citing the evidence. Do not rewrite their explanation for them.",
};

/*
 * Quoted text (a selection, a page's extracted text, a document's title, the owner's own words)
 * reaches the model only inside the reading prompt's evidence block, between <evidence> and
 * </evidence>, as numbered blocks headed "[E1] label". Quoted text can neither end or open that
 * block nor start a block of its own: invisible format characters (zero-width characters,
 * bidirectional controls, tag characters) are removed, fullwidth and small forms of ASCII are read as
 * ASCII, any evidence tag (with or without its closing bracket) is replaced, and a line that begins
 * like a block header is marked as quoted. Ordinary text, mathematics included, is unchanged.
 */
const FORMAT_CHARACTERS = /\p{Cf}/gu;
const FULLWIDTH_ASCII = /[\uFF01-\uFF5E]/g;
const SMALL_LESS_THAN = /\uFE64/g;
const SMALL_GREATER_THAN = /\uFE65/g;
const EVIDENCE_TAG = /<\s*\/?\s*evidence\b[^>\n]{0,100}>?/gi;
const BLOCK_HEADER = /^([ \t]*)\[\s*(E\d+)\s*\]/gim;

function asciiForms(text: string): string {
  return text
    .replace(FORMAT_CHARACTERS, "")
    .replace(FULLWIDTH_ASCII, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(SMALL_LESS_THAN, "<")
    .replace(SMALL_GREATER_THAN, ">");
}

/** Replaces every evidence tag, however it is written, so quoted text cannot open or close the evidence block. */
export function neutraliseEvidenceTags(text: string): string {
  return asciiForms(text).replace(EVIDENCE_TAG, "[evidence tag removed]");
}

/** Quoted text as the companion is shown it: no evidence tag, and no line that reads as another block's header. */
export function neutraliseQuotedText(text: string): string {
  return neutraliseEvidenceTags(text).replace(BLOCK_HEADER, "$1(quoted $2)");
}

/** Quoted text on one line of at most `max` characters (a title, a version), neutralised. */
export function quotedLine(text: string, max: number): string {
  const line = neutraliseQuotedText(text.replace(/\s+/g, " ").trim());
  return line.length > max ? `${line.slice(0, max - 1)}\u2026` : line;
}
