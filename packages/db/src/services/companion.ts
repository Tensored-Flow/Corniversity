import { type EvidenceRef, formatEvidenceBlocks, foundOnPage } from "@corniversity/core/grounding/citations";
import { quoteFoundIn } from "@corniversity/core/scholarly/anchors";
import {
  COMPANION_ACTIONS,
  COMPANION_LABELS,
  COMPANION_REFUSALS,
  type CompanionAction,
  type CompanionEvidencePlan,
  decideCompanionAction,
  isCompanionAction,
  LINKED_SELECTION_LABEL,
  MAX_COMPANION_SELECTION_CHARS,
  MAX_COMPANION_TEXT_CHARS,
  neutraliseQuotedText,
  quotedLine,
} from "@corniversity/core/scholarly/companion";
import { classifyLicence, licenceAttribution } from "@corniversity/core/scholarly/licence";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { conversation, message } from "../schema/learning";
import { resourceAsset, sourceVersion } from "../schema/library";
import { getCourseDetail } from "./catalogue";
import { type AssetRow, getPage, getPermissions, passagesForPage, setPermission } from "./library";
import { type ReaderDocument, readerDocument } from "./reader";
import { latestConversationForAsset, listMessages, type MessageRow } from "./tutoring";

/**
 * The reading companion's server side: which Document it may read, on what evidence, and the
 * owner's external-AI decision for it. Every function takes the owner, validates ids before any
 * query and acts only on the owner's own Documents (another owner's id is not found). The decision
 * itself is core `decideCompanionAction`; this module supplies its facts in the fixed gate order
 * (the Document's state, then `external_ai`, then what the action needs) and builds the bounded
 * evidence: never the whole PDF.
 */

export class CompanionError extends Error {
  constructor(
    readonly code: "not_found" | "invalid_request",
    message: string,
  ) {
    super(message);
    this.name = "CompanionError";
  }
}

/** Refusals of this service beyond core's (each is a registered notice in the web app). */
export const COMPANION_SERVICE_REFUSALS = {
  notFound: "Document not found.",
  invalidRequest: "That request to the companion is not valid, so nothing was sent.",
  pageMissing: "Corniversity has no extracted text for that page of this document, so nothing was sent.",
  basisRequired:
    "Say briefly on what basis you are deciding (for example the licence, or 'my own notes'). It is recorded with the decision.",
} as const;

const SHA256 = /^[0-9a-f]{64}$/;
/** At most this much of a page's extracted text goes to the model. */
export const MAX_PAGE_EVIDENCE_CHARS = 6000;
const MAX_LABEL_TITLE_CHARS = 160;
const DEFAULT_PERSONA = "the reading companion";

export type CompanionDocumentKind = "stored" | "linked" | "local";

/** What the Ask panel and the route know about a Document before anything is sent. */
export interface CompanionDocument {
  assetId: string;
  title: string;
  kind: CompanionDocumentKind;
  /** Stored Documents: extracted page text exists. */
  extracted: boolean;
  externalAi: { status: "unknown" | "allowed" | "denied"; basis: string | null };
  /** The licence line the grant form shows (who reported it and when; fixture data says so). */
  licence: string;
  /** The exact file, e.g. "arXiv:2305.18290v1" or "Your copy"; null for a Document of no paper. */
  version: string | null;
  /** The persona that answers (a course's tutor when the Document belongs to a course). */
  persona: { id: string | null; name: string };
  courseTitles: string[];
}

function kindOf(asset: AssetRow): CompanionDocumentKind {
  if (asset.status === "linked_remote") return "linked";
  if (asset.localOnly || !asset.storageKey) return "local";
  return "stored";
}

/** The title as it goes into an evidence label: one line, neutralised, bounded (labels head their blocks). */
function shortTitle(title: string): string {
  return quotedLine(title, MAX_LABEL_TITLE_CHARS);
}

/**
 * The licence the owner sees before deciding: the version's licence as its source reported it, the
 * source registry's licence for a registry item, or that none is recorded. Fixture data says so.
 */
export function companionLicenceLine(
  version: Pick<NonNullable<ReaderDocument["version"]>, "arxivId" | "licence" | "licenceSource" | "licenceRetrievedAt" | "source"> | null,
  registry: { licence: string; verifiedAt: string } | null,
): string {
  const fixture = version?.source === "fixture" ? " (recorded fixture data)" : "";
  if (version?.licence && version.licenceSource) {
    const name = classifyLicence(version.licence, version.licenceSource).name ?? version.licence;
    return `Licence ${name}, ${licenceAttribution(version.licenceSource, version.licenceRetrievedAt)}${fixture}.`;
  }
  if (version?.arxivId) return `No licence reported by arXiv for this version${fixture}.`;
  if (registry) return `Licence ${registry.licence}, as recorded in the source registry (verified on ${registry.verifiedAt}).`;
  return "No licence is recorded for this file.";
}

async function personaFor(db: DbOrTx, asset: AssetRow): Promise<{ persona: CompanionDocument["persona"]; courseTitles: string[] }> {
  let persona: CompanionDocument["persona"] = { id: null, name: DEFAULT_PERSONA };
  const courseTitles: string[] = [];
  for (const courseId of asset.courseIds) {
    const detail = await getCourseDetail(db, courseId);
    if (!detail) continue;
    courseTitles.push(detail.course.title);
    if (persona.id === null && detail.tutor) persona = { id: detail.tutor.id, name: detail.tutor.name };
  }
  return { persona, courseTitles };
}

async function describeDocument(db: DbOrTx, ownerId: string, doc: ReaderDocument): Promise<CompanionDocument> {
  const { asset } = doc;
  const [permissions, registry, people] = await Promise.all([
    getPermissions(db, ownerId, asset.id),
    asset.sourceVersionId
      ? db
          .select({ licence: sourceVersion.licence, verifiedAt: sourceVersion.verifiedAt })
          .from(sourceVersion)
          .where(eq(sourceVersion.id, asset.sourceVersionId))
          .limit(1)
      : Promise.resolve([]),
    personaFor(db, asset),
  ]);
  const kind = kindOf(asset);
  return {
    assetId: asset.id,
    title: doc.work?.title ?? asset.confirmedTitle ?? asset.candidateMetadata.title ?? asset.filename,
    kind,
    extracted: kind === "stored" && asset.status === "processed" && Boolean(asset.pageCount),
    externalAi: { status: permissions.external_ai.status, basis: permissions.external_ai.basis ?? null },
    licence: companionLicenceLine(doc.version, registry[0] ?? null),
    version: doc.arxiv ? `arXiv:${doc.arxiv.id}v${doc.arxiv.version}` : (doc.version?.label ?? null),
    persona: people.persona,
    courseTitles: people.courseTitles,
  };
}

/** The companion's view of one of the owner's Documents, or null (not a UUID, deleted, another owner's). */
export async function companionDocument(db: DbOrTx, ownerId: string, assetId: string): Promise<CompanionDocument | null> {
  if (!isUuid(assetId)) return null;
  const doc = await readerDocument(db, ownerId, assetId);
  return doc ? describeDocument(db, ownerId, doc) : null;
}

async function isDeletedDocument(db: DbOrTx, ownerId: string, assetId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: resourceAsset.id })
    .from(resourceAsset)
    .where(and(eq(resourceAsset.id, assetId), eq(resourceAsset.ownerId, ownerId), isNotNull(resourceAsset.deletedAt)))
    .limit(1);
  return Boolean(row);
}

export interface CompanionRequest {
  assetId: string;
  action: CompanionAction;
  /** The 0-based page: the selection's page, else the page in view. */
  pageIndex: number | null;
  selection: string;
  text: string;
  /** Linked Documents: the SHA-256 of the bytes the owner's browser loaded from arXiv. */
  loadedSha256?: string | null;
}

/** One evidence block as the panel lists it (what was sent). */
export interface EvidenceLabel {
  tag: string;
  label: string;
}

/**
 * What kind of refusal a sentence is, so the route can answer with a fitting status: the Document is
 * not the owner's, the request is malformed, the Document's state stops it, the owner has not
 * allowed external AI, or the action lacks what it needs.
 */
export type CompanionRefusalKind = "not_found" | "invalid" | "state" | "permission" | "action";

const STATE_REFUSALS = new Set<string>([
  COMPANION_REFUSALS.deleted,
  COMPANION_REFUSALS.localOnly,
  COMPANION_REFUSALS.notExtracted,
  COMPANION_REFUSALS.fileUnreported,
  COMPANION_REFUSALS.fileChanged,
  COMPANION_SERVICE_REFUSALS.pageMissing,
]);

export function companionRefusalKind(reason: string): CompanionRefusalKind {
  if (reason === COMPANION_SERVICE_REFUSALS.notFound) return "not_found";
  if (reason === COMPANION_SERVICE_REFUSALS.invalidRequest) return "invalid";
  if (STATE_REFUSALS.has(reason)) return "state";
  if (reason === COMPANION_REFUSALS.aiDenied || reason === COMPANION_REFUSALS.aiUnknown) return "permission";
  return "action";
}

export type CompanionTurn =
  | { allowed: false; reason: string; kind: CompanionRefusalKind }
  | {
      allowed: true;
      document: CompanionDocument;
      plan: CompanionEvidencePlan;
      evidence: { prompt: string; refs: EvidenceRef[] };
      /** Linked Documents: only the selection was available, unchecked against the paper. */
      selectionOnly: boolean;
      /** Stored Documents with a selection: whether it was found on the page; null otherwise. */
      selectionFound: boolean | null;
      /** The page the evidence came from (stored Documents), for the learner's message. */
      place: string | null;
    };

function pageDescription(page: { printedLabel: string | null; physicalIndex: number }): string {
  return page.printedLabel ? `p. ${page.printedLabel} (PDF page ${page.physicalIndex + 1})` : `PDF page ${page.physicalIndex + 1}`;
}

function qualityNote(quality: { scannedSuspected: boolean; lowText: boolean }): string {
  if (quality.scannedSuspected) return " (this page looks scanned; its extracted text may be unreliable)";
  if (quality.lowText) return " (little text was found on this page)";
  return "";
}

function pageText(raw: string): string {
  const text = neutraliseQuotedText(raw);
  if (text.length <= MAX_PAGE_EVIDENCE_CHARS) return text || "(no text was extracted from this page)";
  return `${text.slice(0, MAX_PAGE_EVIDENCE_CHARS)}\n[The page's text continues; the rest was not included.]`;
}

/**
 * Decides whether the companion may run, in the fixed gate order, and builds its evidence. A
 * refusal carries a registered sentence (core COMPANION_REFUSALS or COMPANION_SERVICE_REFUSALS).
 * Stored, extracted Document: the selection (attributed to the document only when it is found on
 * the page), the page's extracted text, and for proofs the next page's. Linked arXiv Document: only
 * the selection, labelled LINKED_SELECTION_LABEL.
 */
export async function prepareCompanionTurn(db: DbOrTx, ownerId: string, request: CompanionRequest): Promise<CompanionTurn> {
  const refuse = (reason: string): CompanionTurn => ({ allowed: false, reason, kind: companionRefusalKind(reason) });
  if (
    !isUuid(request.assetId) ||
    !isCompanionAction(request.action) ||
    typeof request.selection !== "string" ||
    typeof request.text !== "string" ||
    request.selection.length > MAX_COMPANION_SELECTION_CHARS * 5 ||
    request.text.length > MAX_COMPANION_TEXT_CHARS * 5 ||
    (request.pageIndex !== null && (!Number.isInteger(request.pageIndex) || request.pageIndex < 0 || request.pageIndex > 99_999)) ||
    (request.loadedSha256 != null && !SHA256.test(request.loadedSha256))
  )
    return refuse(COMPANION_SERVICE_REFUSALS.invalidRequest);

  // 1. The owner's own Document, or a deleted one of theirs (refused as deleted), or nothing.
  const doc = await readerDocument(db, ownerId, request.assetId);
  if (!doc)
    return refuse(
      (await isDeletedDocument(db, ownerId, request.assetId)) ? COMPANION_REFUSALS.deleted : COMPANION_SERVICE_REFUSALS.notFound,
    );
  const document = await describeDocument(db, ownerId, doc);
  const { asset } = doc;

  // 2. The Document's state. A linked Document's file is the one the reader reports having loaded;
  // a change is unresolved while notes still drawn as resolved stand on another file.
  const loaded = request.loadedSha256 ?? null;
  const linked = document.kind === "linked";
  const unresolvedFileChange =
    linked &&
    loaded !== null &&
    asset.observedSha256 !== null &&
    loaded !== asset.observedSha256 &&
    doc.annotations.some((a) => a.anchor !== null && a.mappingStatus === "resolved" && a.anchor.documentSha256 !== loaded);

  // 2–4. The rest of the order (state, external AI, what the action needs) is core's.
  const decision = decideCompanionAction({
    action: request.action,
    document: {
      kind: document.kind,
      deleted: false,
      extracted: document.extracted,
      fileReported: !linked || loaded !== null,
      unresolvedFileChange,
    },
    externalAi: document.externalAi.status,
    selection: request.selection,
    text: request.text,
    pageIndex: request.pageIndex,
  });
  if (!decision.allowed) return refuse(decision.reason);

  const selection = request.selection.trim();
  // What the model is shown of the selection: neutralised, so it cannot end the evidence block or add a block.
  const quotedSelection = neutraliseQuotedText(selection);
  const title = shortTitle(document.title);
  if (linked) {
    const evidence = formatEvidenceBlocks([{ label: LINKED_SELECTION_LABEL, text: quotedSelection, kind: "passage" }]);
    return {
      allowed: true,
      document,
      plan: decision.evidence,
      evidence,
      selectionOnly: true,
      selectionFound: null,
      place: document.version,
    };
  }

  // A stored, extracted Document: the page asked about, and for proofs the next one.
  const pageIndex = request.pageIndex as number;
  const page = await getPage(db, asset.id, pageIndex);
  if (!page) return refuse(COMPANION_SERVICE_REFUSALS.pageMissing);
  const place = pageDescription(page);
  const blocks: Parameters<typeof formatEvidenceBlocks>[0] = [];
  let selectionFound: boolean | null = null;
  if (decision.evidence.selection) {
    selectionFound = quoteFoundIn(selection, page.text) || foundOnPage(selection, page.text);
    if (selectionFound) {
      const passages = await passagesForPage(db, page.id);
      const probe = selection.replace(/\s+/g, " ").slice(0, 80);
      blocks.push({
        label: `${title}, ${place}: selected passage`,
        text: quotedSelection,
        assetId: asset.id,
        passageId: passages.find((p) => p.text.replace(/\s+/g, " ").includes(probe))?.id,
        kind: "passage",
      });
    } else {
      // Not found on the page: the owner's own text, never cited as this document.
      blocks.push({ label: `Text you selected (not found in the extracted text of ${place})`, text: quotedSelection, kind: "passage" });
    }
  }
  blocks.push({
    label: `${title}, ${place}: extracted text of the page${qualityNote(page.quality)}`,
    text: pageText(page.text),
    assetId: asset.id,
    kind: "passage",
  });
  if (decision.evidence.nextPage) {
    const next = await getPage(db, asset.id, pageIndex + 1);
    if (next)
      blocks.push({
        label: `${title}, ${pageDescription(next)}: extracted text of the next page${qualityNote(next.quality)}`,
        text: pageText(next.text),
        assetId: asset.id,
        kind: "passage",
      });
  }
  return {
    allowed: true,
    document,
    plan: decision.evidence,
    evidence: formatEvidenceBlocks(blocks),
    selectionOnly: false,
    selectionFound,
    place,
  };
}

/** The owner's message as it is stored with the conversation (shown again under *Last answer*). */
export function companionLearnerMessage(input: { action: CompanionAction; place: string | null; selection: string; text: string }): string {
  const heading = `**${COMPANION_LABELS[input.action]}**${input.place ? ` · ${input.place}` : ""}`;
  const selection = input.selection.trim();
  const quote = selection
    ? `\n\n${selection
        .slice(0, 600)
        .split(/\r?\n/)
        .map((line) => `> ${line}`)
        .join("\n")}${selection.length > 600 ? "\n> …" : ""}`
    : "";
  const text = input.text.trim();
  return `${heading}${quote}${text ? `\n\n${text}` : ""}`;
}

/** The action a stored request names in its heading (companionLearnerMessage writes it first), or null. */
export function companionActionOf(markdown: string): CompanionAction | null {
  return COMPANION_ACTIONS.find((action) => markdown.startsWith(`**${COMPANION_LABELS[action]}**`)) ?? null;
}

/**
 * Stores the owner's request in their own reading-room conversation, with the evidence blocks that
 * were sent (tag and label, as the message's citations), so a later visit shows the same notes and
 * what was sent. The route calls it before the model runs.
 */
export async function appendCompanionRequest(
  db: DbOrTx,
  ownerId: string,
  conversationId: string,
  request: { action: CompanionAction; place: string | null; selection: string; text: string },
  sent: readonly EvidenceRef[],
): Promise<MessageRow> {
  if (!isUuid(conversationId) || !isCompanionAction(request.action))
    throw new CompanionError("invalid_request", "That request to the companion is not valid, so nothing was sent.");
  const [owned] = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(and(eq(conversation.id, conversationId), eq(conversation.ownerId, ownerId), eq(conversation.purpose, "reading-room")))
    .limit(1);
  if (!owned) throw new CompanionError("not_found", "Document not found.");
  const [last] = await db
    .select({ sequence: message.sequence })
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(desc(message.sequence))
    .limit(1);
  const [row] = await db
    .insert(message)
    .values({
      conversationId,
      sequence: (last?.sequence ?? 0) + 1,
      sender: "learner",
      contentMarkdown: companionLearnerMessage(request),
      citations: sent.map((ref) => ({
        tag: ref.tag,
        label: ref.label,
        assetId: ref.assetId,
        passageId: ref.passageId,
        locatorId: ref.locatorId,
      })),
    })
    .returning();
  return row!;
}

/**
 * The owner's external-AI decision for one of their Documents, through the existing permission
 * service, with their basis and the licence they were shown recorded together. Nothing is ever
 * granted except by this call, which the owner's own form makes.
 */
export async function recordCompanionPermission(
  db: DbOrTx,
  ownerId: string,
  assetId: string,
  status: "allowed" | "denied",
  basis: string,
): Promise<{ status: "allowed" | "denied"; basis: string }> {
  if (!isUuid(assetId) || (status !== "allowed" && status !== "denied"))
    throw new CompanionError("invalid_request", "That request to the companion is not valid, so nothing was sent.");
  const written = typeof basis === "string" ? basis.trim().slice(0, 300) : "";
  if (!written)
    throw new CompanionError(
      "invalid_request",
      "Say briefly on what basis you are deciding (for example the licence, or 'my own notes'). It is recorded with the decision.",
    );
  const document = await companionDocument(db, ownerId, assetId);
  if (!document) throw new CompanionError("not_found", "Document not found.");
  const recorded = `${written} [licence shown: ${document.licence}]`;
  await setPermission(db, ownerId, assetId, "external_ai", status, recorded);
  return { status, basis: recorded };
}

/**
 * The last request and answer about one of the owner's Documents, or null; with the request's action
 * and the evidence blocks it sent (empty for a request stored without them).
 */
export async function latestCompanionExchange(
  db: DbOrTx,
  ownerId: string,
  assetId: string,
): Promise<{ request: MessageRow | null; answer: MessageRow | null; action: CompanionAction | null; sent: EvidenceLabel[] } | null> {
  if (!isUuid(assetId)) return null;
  const thread = await latestConversationForAsset(db, ownerId, assetId);
  if (!thread || thread.ownerId !== ownerId) return null;
  const messages = await listMessages(db, thread.id);
  const answerIndex = messages.findLastIndex((m) => m.sender === "persona");
  const answer = answerIndex >= 0 ? messages[answerIndex]! : null;
  const before = answerIndex >= 0 ? messages.slice(0, answerIndex) : messages;
  const request = before.findLast((m) => m.sender === "learner") ?? null;
  if (!request && !answer) return null;
  return {
    request,
    answer,
    action: request ? companionActionOf(request.contentMarkdown) : null,
    sent: (request?.citations ?? []).map((c) => ({ tag: c.tag, label: c.label })),
  };
}
