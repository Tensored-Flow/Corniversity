/**
 * The reading companion's Ask panel, outside React: what the server page hands it (plain data and
 * server actions), the rules it shows by, how it reads the route's answers, and a small store that
 * keeps its state while the panel is closed (so switching to Notes and back loses nothing, and the
 * reader is not re-rendered for every streamed chunk). Pure and unit-tested.
 */
import {
  COMPANION_ACTIONS,
  COMPANION_LABELS,
  type CompanionAction,
  LINKED_SELECTION_LABEL,
  MIN_UNDERSTANDING_CHARS,
} from "@corniversity/core/scholarly/companion";

export type AskDocumentKind = "stored" | "linked" | "local";
export type PermissionStatus = "unknown" | "allowed" | "denied";

/** The last request and answer stored for a Document, rendered by the server's sanitiser. */
export interface CompanionAnswerView {
  request: { html: string } | null;
  answer: {
    html: string;
    labels: string[];
    citations: { tag: string; label: string }[];
    uncited: number;
    /** What produced it: a model's name, or "Scripted demo". */
    producedBy: string | null;
  } | null;
  /** The action the stored request named, and the evidence blocks it sent (empty for a request stored without them). */
  action: CompanionAction | null;
  evidence: { tag: string; label: string }[];
}

export interface AskPanelData {
  assetId: string;
  kind: AskDocumentKind;
  /** A registered sentence when the Document's state refuses every action (desktop only, not extracted). */
  stateRefusal: string | null;
  permission: { status: PermissionStatus; basis: string | null };
  /** The licence line the grant form shows. */
  licence: string;
  personaName: string;
  /** Who answers now: a live model, the owner's plan, the scripted demo or a block. */
  aiLabel: { text: string; title: string };
  lastAnswer: CompanionAnswerView | null;
}

export interface PermissionFormState {
  status: PermissionStatus;
  basis: string | null;
  error: string | null;
  saved: boolean;
}

/** The reading room's companion actions (server actions; each requires the session and acts on the owner's Document). */
export interface AskActions {
  setPermission: (state: PermissionFormState, form: FormData) => Promise<PermissionFormState>;
  latestAnswer: (assetId: string) => Promise<CompanionAnswerView | null>;
}

export interface AskSelection {
  text: string;
  /** 0-based page the selection starts on. */
  pageIndex: number;
}

export interface AskRefusal {
  message: string;
  /** A run refused by a limit or a blocked provider: the planner's reason, with its amounts. */
  reason: string | null;
  /** Limits and the provider are set in Settings. */
  settings: boolean;
}

export interface AskState {
  selection: AskSelection | null;
  /** Counts selections handed over by the selection bar's Ask. */
  captured: number;
  /** A selection was just handed over: the panel moves keyboard focus into itself once. */
  focusRequested: boolean;
  action: CompanionAction;
  text: string;
  pending: boolean;
  streamed: string;
  refusal: AskRefusal | null;
  permission: { status: PermissionStatus; basis: string | null };
  answer: CompanionAnswerView | null;
  /** What was sent with the answer given in this visit (null for an answer from an earlier visit). */
  sent: { action: CompanionAction; evidence: { tag: string; label: string }[]; selection: string | null } | null;
}

export interface AskStore {
  get: () => AskState;
  set: (patch: Partial<AskState>) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createAskStore(data: AskPanelData): AskStore {
  let state: AskState = {
    selection: null,
    captured: 0,
    focusRequested: false,
    action: "question",
    text: "",
    pending: false,
    streamed: "",
    refusal: null,
    permission: data.permission,
    answer: data.lastAnswer,
    sent: null,
  };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => {
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** A selection handed over by the selection bar: an untouched question becomes an explanation of it. */
export function captureSelection(state: AskState, selection: AskSelection): Partial<AskState> {
  const action = state.action === "question" && state.text.trim() === "" ? "explain_passage" : state.action;
  return { selection, captured: state.captured + 1, focusRequested: true, action, refusal: null };
}

/** The field for the owner's own words: required for a question and for checking an explanation. */
export function textFieldFor(action: CompanionAction): { label: string; required: boolean; hint: string | null } {
  if (action === "question") return { label: "Your question", required: true, hint: null };
  if (action === "check_understanding")
    return { label: "Your explanation", required: true, hint: `In your own words, at least ${MIN_UNDERSTANDING_CHARS} characters.` };
  return { label: "Anything to add (optional)", required: false, hint: null };
}

/** What the request sends, said before it is sent. */
export function sentDescription(input: {
  kind: AskDocumentKind;
  action: CompanionAction;
  hasSelection: boolean;
  pageLabel: string;
}): string {
  if (input.kind === "linked") return "Sent: only your selection, marked as not checked against the paper.";
  const proof = input.action === "walk_through_proof" ? ` and the next page` : "";
  return `Sent: ${input.hasSelection ? "your selection and " : ""}the extracted text of ${input.pageLabel}${proof}.`;
}

/** What the permission covers, by Document kind. */
export function permissionScope(kind: AskDocumentKind): string {
  return kind === "linked"
    ? "only the text you select (marked as not checked against the paper)"
    : "the text you select and the extracted text of the page you ask about (and the next page for a proof)";
}

/** The panel's answer notes that hold whatever the model wrote. */
export function answerNotes(input: { kind: AskDocumentKind; action: CompanionAction | null }): string[] {
  const notes: string[] = [];
  if (input.kind === "linked") notes.push(`Only your selection was sent. ${LINKED_SELECTION_LABEL}.`);
  if (input.action === "walk_through_proof") notes.push("An explanation of a proof is not a formal verification of it.");
  return notes;
}

/**
 * What the panel shows beside a stored answer: the action (for its fixed notes) and what was sent,
 * from this visit's request when there is one, else from the stored request, so an answer from an
 * earlier visit keeps them.
 */
export function answerContext(
  answer: CompanionAnswerView,
  sent: AskState["sent"],
): { action: CompanionAction | null; evidence: { tag: string; label: string }[] } {
  if (sent) return { action: sent.action, evidence: sent.evidence };
  return { action: answer.action, evidence: answer.evidence };
}

const SESSION_ENDED = "Your session has ended, so nothing was sent. Sign in again in another tab, then retry.";

/** A refusal from /api/library/ask as the panel shows it: the server's registered sentence, and a run's reason. */
export function refusalFrom(status: number, body: unknown): AskRefusal {
  const json = (body && typeof body === "object" ? body : {}) as { message?: unknown; reason?: unknown; error?: unknown };
  if (status === 401) return { message: SESSION_ENDED, reason: null, settings: false };
  const message =
    typeof json.message === "string" ? json.message : `The server refused the request (status ${status}), so nothing was sent.`;
  const runRefused = json.error === "companion-budget-refused" || json.error === "companion-provider-blocked";
  return { message, reason: typeof json.reason === "string" ? json.reason : null, settings: runRefused };
}

/** The evidence the route says it sent (x-companion-evidence); anything unreadable is an empty list. */
export function parseEvidenceHeader(value: string | null): { tag: string; label: string }[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) =>
      entry && typeof entry === "object" && typeof entry.tag === "string" && typeof entry.label === "string"
        ? [{ tag: entry.tag.slice(0, 8), label: entry.label.slice(0, 400) }]
        : [],
    );
  } catch {
    return [];
  }
}

export const ACTION_CHOICES: { action: CompanionAction; label: string }[] = COMPANION_ACTIONS.map((action) => ({
  action,
  label: COMPANION_LABELS[action],
}));
