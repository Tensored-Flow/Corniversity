import { buildReadingMessage, buildReadingPrompt, READING_PROMPT_VERSION, ROLE_CONTRACTS, readingScenario } from "@corniversity/ai";
import { COMPANION_ACTIONS, MAX_COMPANION_SELECTION_CHARS, MAX_COMPANION_TEXT_CHARS } from "@corniversity/core/scholarly/companion";
import { getEnv } from "@corniversity/db/env";
import { appendCompanionRequest, prepareCompanionTurn } from "@corniversity/db/services/companion";
import { appendPersonaMessage, getOrCreateConversation } from "@corniversity/db/services/tutoring";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { streamPersonaTurn } from "@/lib/model-runs";
import { requireApiSession } from "@/lib/session";
import { refuseUnlessReaderRequest } from "../annotations/guard";
import { evidenceHeader, gateRefusal, runRefusal, selectionHeader } from "./companion-response";

// Generous bounds so an over-long selection or text reaches core's registered refusal instead of a bare 400.
const Body = z.strictObject({
  assetId: z.string().uuid(),
  action: z.enum(COMPANION_ACTIONS),
  pageIndex: z.number().int().min(0).max(99_999).nullable(),
  selection: z.string().max(MAX_COMPANION_SELECTION_CHARS * 5),
  text: z.string().max(MAX_COMPANION_TEXT_CHARS * 5),
  loadedSha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable()
    .optional(),
});

export const dynamic = "force-dynamic";

/**
 * The reading companion: one action (contract §8) about one of the owner's Documents, answered once
 * and streamed. Order: the session (401); JSON from this site's own pages (415, 403); a body of the
 * right shape (400); then the service's gates in their fixed order (the Document, its state,
 * `external_ai`, what the action needs), each refusal a registered sentence; then the run planner
 * (a limit or a blocked provider is refused with its reason, never replaced by scripted text). The
 * evidence and the document's title are bounded and neutralised (services/companion.ts, core
 * neutraliseQuotedText) and travel in the owner's message, delimited, never in the system prompt. The
 * request is stored with what was sent; the headers name it too.
 */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const refused = refuseUnlessReaderRequest(request);
  if (refused) return refused;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const ownerId = authed.session.user.id;
  const { assetId, action, pageIndex, selection, text } = parsed.data;

  const database = db();
  const turn = await prepareCompanionTurn(database, ownerId, {
    assetId,
    action,
    pageIndex,
    selection,
    text,
    loadedSha256: parsed.data.loadedSha256 ?? null,
  });
  if (!turn.allowed) {
    const answer = gateRefusal(turn);
    return NextResponse.json(answer.body, { status: answer.status });
  }

  const env = getEnv();
  const { document } = turn;
  const persona = document.persona;
  const system = buildReadingPrompt({
    institutionName: env.INSTITUTION_NAME,
    personaName: persona.name,
    courseTitles: document.courseTitles,
    action,
    selectionOnly: turn.selectionOnly,
  });
  // Each request is its own conversation: single-turn, so nothing earlier reaches the model.
  const conversation = await getOrCreateConversation(database, {
    ownerId,
    role: "lecturer",
    personaId: persona.id ?? undefined,
    purpose: "reading-room",
    allowedLocatorIds: [],
    allowedAssetIds: [document.assetId],
  });
  // The request is stored with the evidence blocks sent, so a later visit shows what was sent.
  await appendCompanionRequest(database, ownerId, conversation.id, { action, place: turn.place, selection, text }, turn.evidence.refs);

  const response = await streamPersonaTurn({
    database,
    ownerId,
    env,
    role: "lecturer",
    purpose: "reading-companion",
    promptVersion: `${READING_PROMPT_VERSION};role:${ROLE_CONTRACTS.lecturer.version}`,
    system,
    messages: [
      {
        role: "user",
        content: buildReadingMessage({
          action,
          document: { title: document.title, version: document.version },
          evidencePrompt: turn.evidence.prompt,
          ownerText: text,
        }),
      },
    ],
    scenario: readingScenario(action),
    speaker: persona.name.charAt(0).toUpperCase() + persona.name.slice(1),
    onFinish: async (raw, runId) => {
      await appendPersonaMessage(database, {
        conversationId: conversation.id,
        personaId: persona.id,
        rawText: raw,
        allowed: turn.evidence.refs,
        providerRunId: runId,
      });
    },
  });
  if (!response.ok) {
    const answer = runRefusal(response.status, await response.json().catch(() => null));
    return NextResponse.json(answer.body, { status: answer.status });
  }
  const headers = new Headers(response.headers);
  headers.set("x-companion-evidence", evidenceHeader(turn.evidence.refs));
  headers.set("x-companion-selection", selectionHeader(turn));
  return new Response(response.body, { status: response.status, headers });
}
