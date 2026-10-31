import {
  buildReadingPrompt,
  createProvider,
  decideBudget,
  estimateCostUsd,
  estimateRunCostUsd,
  PRICING_VERSION,
  ProviderError,
  READING_PROMPT_VERSION,
  ROLE_CONTRACTS,
} from "@corniversity/ai";
import { formatEvidenceBlocks } from "@corniversity/core/grounding/citations";
import { getEnv } from "@corniversity/db/env";
import { providerRun } from "@corniversity/db/schema/index";
import { getCourseDetail } from "@corniversity/db/services/catalogue";
import { getAsset, getPage, isAllowed, passagesForPage } from "@corniversity/db/services/library";
import { getBudgetLimits, getSpend, resolveProviderConfig } from "@corniversity/db/services/provider-config";
import { appendLearnerMessage, appendPersonaMessage, getOrCreateConversation } from "@corniversity/db/services/tutoring";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
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
  const evidence = formatEvidenceBlocks([
    {
      label: `${title}, ${pageDescription}: selected passage`,
      text: selectedText,
      assetId: asset.id,
      passageId: pagePassages.find((p) => p.text.includes(probe))?.id,
    },
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

  const config = await resolveProviderConfig(database, ownerId, env);
  const { provider, live } = createProvider({
    provider: config.provider,
    anthropicApiKey: config.anthropicApiKey,
    defaultModel: config.defaultModel,
    modelMap: config.modelMap,
  });
  const model = config.modelMap.lecturer ?? config.defaultModel;
  const contract = ROLE_CONTRACTS.lecturer;
  if (live) {
    const limits = await getBudgetLimits(database, ownerId, env);
    const spend = await getSpend(database, ownerId);
    const estimate = estimateRunCostUsd(model, system + chat.map((c) => c.content).join("\n"), 1000);
    const decision = decideBudget(limits, spend, Math.min(estimate, contract.limits.maxRunUsd));
    if (!decision.allowed) {
      await database.insert(providerRun).values({
        ownerId,
        role: "lecturer",
        provider: provider.name,
        model,
        purpose: "reading-passage",
        pricingVersion: PRICING_VERSION,
        promptVersion: `${READING_PROMPT_VERSION};role:${contract.version}`,
        status: "budget_blocked",
        error: decision.reason,
        finishedAt: new Date(),
      });
      return NextResponse.json({ error: "budget", message: decision.reason }, { status: 402 });
    }
  }

  const startedAt = new Date();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let raw = "";
      let status: "ok" | "error" | "refused" = "ok";
      let errorText: string | undefined;
      let usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
      let usedModel = live ? model : "fixture";
      try {
        const generator = provider.streamText({
          role: "lecturer",
          purpose: "reading-passage",
          system,
          messages: chat,
          model,
          maxTokens: contract.limits.maxOutputTokens,
          scenario: "reading-passage",
        });
        let next = await generator.next();
        while (!next.done) {
          raw += next.value;
          controller.enqueue(encoder.encode(next.value));
          next = await generator.next();
        }
        usage = next.value.usage;
        usedModel = next.value.model;
        if (next.value.stopReason === "refusal") {
          status = "refused";
          const note = "\n\n*(The model declined to continue. Nothing has been lost; try rephrasing.)*";
          raw += note;
          controller.enqueue(encoder.encode(note));
        }
      } catch (error) {
        status = "error";
        errorText = error instanceof ProviderError ? error.message : "The provider failed.";
        const note = `\n\n*(No reply could be produced: ${errorText} The page, your notes and the source view remain available.)*`;
        raw += note;
        controller.enqueue(encoder.encode(note));
      }
      const [run] = await database
        .insert(providerRun)
        .values({
          ownerId,
          role: "lecturer",
          provider: provider.name,
          model: usedModel,
          purpose: "reading-passage",
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheWriteTokens: usage.cacheWriteTokens,
          costUsd: String(estimateCostUsd(usedModel, usage)),
          pricingVersion: PRICING_VERSION,
          promptVersion: `${READING_PROMPT_VERSION};role:${contract.version}`,
          status,
          error: errorText ?? null,
          startedAt,
          finishedAt: new Date(),
        })
        .returning({ id: providerRun.id });
      if (raw.trim().length > 0) {
        await appendPersonaMessage(database, {
          conversationId: conversation.id,
          personaId: personaId ?? null,
          rawText: raw,
          allowed: evidence.refs,
          providerRunId: run?.id,
        });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
      "x-provider": provider.name,
    },
  });
}
