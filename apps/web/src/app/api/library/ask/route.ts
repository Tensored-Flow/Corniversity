import { buildReadingPrompt, READING_PROMPT_VERSION, ROLE_CONTRACTS } from "@corniversity/ai";
import { formatEvidenceBlocks, foundOnPage } from "@corniversity/core/grounding/citations";
import { getEnv } from "@corniversity/db/env";
import { getCourseDetail } from "@corniversity/db/services/catalogue";
import { getAsset, getPage, isAllowed, passagesForPage } from "@corniversity/db/services/library";
import { appendLearnerMessage, appendPersonaMessage, getOrCreateConversation } from "@corniversity/db/services/tutoring";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { streamPersonaTurn } from "@/lib/model-runs";
import { requireApiSession } from "@/lib/session";

const Body = z.object({
  assetId: z.string().uuid(),
  physicalIndex: z.number().int().min(0),
  selectedText: z.string().trim().min(1).max(4000),
  question: z.string().trim().min(1).max(2000),
});

export const dynamic = "force-dynamic";

/**
 * "Ask about this passage" in the reading room. The server, not a model, decides whether the
 * passage may be discussed at all: a local-only item or one without external-AI permission is
 * refused with the exact reason, so a tutor can never appear to have read a book it was never
 * given. When permitted, the selected passage and the rest of its page are the whole evidence.
 */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const ownerId = authed.session.user.id;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { assetId, physicalIndex, selectedText, question } = parsed.data;

  const database = db();
  const env = getEnv();
  const asset = await getAsset(database, ownerId, assetId);
  if (!asset) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const title = asset.confirmedTitle ?? asset.candidateMetadata.title ?? asset.filename;
  if (asset.localOnly || !asset.storageKey) {
    return NextResponse.json(
      {
        error: "local_only",
        message: `"${title}" is registered as local-only: its contents have never left your device, so no tutor or lecturer here can read it. Grant private storage and external AI processing on the item page if you want passages discussed; otherwise read it locally and keep notes in the notebook.`,
      },
      { status: 403 },
    );
  }
  if (asset.status !== "processed") {
    return NextResponse.json(
      { error: "not_processed", message: "This item has not been indexed yet, so there is no passage text to discuss." },
      { status: 409 },
    );
  }
  if (!(await isAllowed(database, ownerId, asset.id, "external_ai"))) {
    return NextResponse.json(
      {
        error: "external_ai_not_permitted",
        message: `External AI processing is not permitted for "${title}", so nothing from it is sent to a model provider. Allow it on the item page if the licence permits, or ask about an open source instead.`,
      },
      { status: 403 },
    );
  }
  const page = await getPage(database, asset.id, physicalIndex);
  if (!page) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const pagePassages = await passagesForPage(database, page.id);
  const pageDescription = page.printedLabel
    ? `p. ${page.printedLabel} (PDF page ${page.physicalIndex + 1})`
    : `PDF page ${page.physicalIndex + 1}`;
  const probe = selectedText.slice(0, 80);
  // The selection is attributed to the page only when it is on the page; anything else is the
  // learner's own text, and no citation may present it as this source.
  const evidence = formatEvidenceBlocks([
    foundOnPage(selectedText, page.text)
      ? {
          label: `${title}, ${pageDescription}: selected passage`,
          text: selectedText,
          assetId: asset.id,
          passageId: pagePassages.find((p) => p.text.includes(probe))?.id,
        }
      : { label: `Text you supplied (not found on ${pageDescription})`, text: selectedText },
    { label: `${title}, ${pageDescription}: rest of the page`, text: page.text.slice(0, 6000), assetId: asset.id },
  ]);

  let personaName = "the reading-room lecturer";
  let personaId: string | undefined;
  const courseTitles: string[] = [];
  for (const courseId of asset.courseIds) {
    const detail = await getCourseDetail(database, courseId);
    if (!detail) continue;
    courseTitles.push(detail.course.title);
    if (!personaId && detail.tutor) {
      personaId = detail.tutor.id;
      personaName = detail.tutor.name;
    }
  }
  const system = buildReadingPrompt({
    institutionName: env.INSTITUTION_NAME,
    personaName,
    itemTitle: title,
    pageDescription,
    courseTitles,
    evidencePrompt: evidence.prompt,
  });
  const conversation = await getOrCreateConversation(database, {
    ownerId,
    role: "lecturer",
    personaId,
    purpose: "reading-room",
    allowedLocatorIds: [],
    allowedAssetIds: [asset.id],
  });
  await appendLearnerMessage(database, conversation.id, `> ${selectedText.slice(0, 600)}\n\n${question}`);
  const chat = [{ role: "user" as const, content: `Selected passage:\n"""\n${selectedText}\n"""\n\nQuestion: ${question}` }];

  return streamPersonaTurn({
    database,
    ownerId,
    env,
    role: "lecturer",
    purpose: "reading-passage",
    promptVersion: `${READING_PROMPT_VERSION};role:${ROLE_CONTRACTS.lecturer.version}`,
    system,
    messages: chat,
    scenario: "reading-passage",
    speaker: personaName.charAt(0).toUpperCase() + personaName.slice(1),
    onFinish: async (raw, runId) => {
      await appendPersonaMessage(database, {
        conversationId: conversation.id,
        personaId: personaId ?? null,
        rawText: raw,
        allowed: evidence.refs,
        providerRunId: runId,
      });
    },
  });
}
