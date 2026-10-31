import {
  buildPeerPrompt,
  buildSeminarChairPrompt,
  createProvider,
  DISCUSSION_PROMPT_VERSION,
  decideBudget,
  estimateCostUsd,
  estimateRunCostUsd,
  PRICING_VERSION,
  ProviderError,
  ROLE_CONTRACTS,
} from "@corniversity/ai";
import { annotateTurn } from "@corniversity/core/grounding/citations";
import { getEnv } from "@corniversity/db/env";
import { providerRun, teachingUnit } from "@corniversity/db/schema/index";
import { appendTurn, completeRound, getDiscussion, getPersonas, listTurns } from "@corniversity/db/services/community";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { getBudgetLimits, getSpend, resolveProviderConfig } from "@corniversity/db/services/provider-config";
import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

const Body = z.object({ discussionId: z.string().uuid(), message: z.string().trim().min(1).max(4000) });
export const dynamic = "force-dynamic";

/**
 * One round of a bounded discussion: the learner's turn, then one reply from each participant
 * (the chair first, then any invited classmates), each confined to the released material fixed
 * when the discussion opened. The round counter is advanced and the discussion closes at its
 * limit. Nothing runs unless the learner wrote a turn, and nothing runs for a muted discussion.
 */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const ownerId = authed.session.user.id;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const database = db();
  const env = getEnv();
  const discussion = await getDiscussion(database, ownerId, parsed.data.discussionId);
  if (!discussion) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (discussion.status !== "open" || discussion.roundsUsed >= discussion.maxRounds) {
    return NextResponse.json(
      { error: "closed", message: "This discussion is closed; open a new one from the common room." },
      { status: 409 },
    );
  }

  const [profile, personas, prior] = await Promise.all([
    ensureProfile(database, ownerId),
    getPersonas(database, discussion.participantPersonaIds),
    listTurns(database, discussion.id),
  ]);
  const units = discussion.releasedMaterial.unitIds.length
    ? await database
        .select({ title: teachingUnit.title })
        .from(teachingUnit)
        .where(inArray(teachingUnit.id, discussion.releasedMaterial.unitIds))
    : [];
  await appendTurn(database, discussion.id, "learner", parsed.data.message);
  const context = {
    institutionName: env.INSTITUTION_NAME,
    learnerName: profile.displayName,
    title: discussion.title,
    societyTitle: undefined,
    releasedUnits: units.map((u) => u.title),
    roundsUsed: discussion.roundsUsed,
    maxRounds: discussion.maxRounds,
    participants: personas.map((p) => p.name),
  };
  const transcript = [
    ...prior.map(
      (t) =>
        `${t.speaker === "learner" ? profile.displayName : (personas.find((p) => p.id === t.speaker)?.name ?? t.speaker)}: ${t.contentMarkdown}`,
    ),
    `${profile.displayName}: ${parsed.data.message}`,
  ];

  const config = await resolveProviderConfig(database, ownerId, env);
  const { provider, live } = createProvider({
    provider: config.provider,
    anthropicApiKey: config.anthropicApiKey,
    defaultModel: config.defaultModel,
    modelMap: config.modelMap,
  });
  const ordered = [...personas.filter((p) => !p.isPeer), ...personas.filter((p) => p.isPeer)];
  const spoken: string[] = [];
  for (const persona of ordered) {
    const role = persona.isPeer ? "peer" : "seminar_chair";
    const contract = ROLE_CONTRACTS[role];
    const system = persona.isPeer
      ? buildPeerPrompt(context, { name: persona.name, style: persona.style })
      : buildSeminarChairPrompt(context, { name: persona.name, style: persona.style });
    const model = config.modelMap[role] ?? config.defaultModel;
    const chat = [
      {
        role: "user" as const,
        content: `Discussion so far:\n${[...transcript, ...spoken].join("\n\n")}\n\nIt is your turn, ${persona.name}.`,
      },
    ];
    if (live) {
      const [limits, spend] = await Promise.all([getBudgetLimits(database, ownerId, env), getSpend(database, ownerId)]);
      const decision = decideBudget(
        limits,
        spend,
        Math.min(estimateRunCostUsd(model, system + chat[0]!.content, 400), contract.limits.maxRunUsd),
      );
      if (!decision.allowed) {
        await appendTurn(database, discussion.id, "system", `${persona.name} did not reply: ${decision.reason}`);
        continue;
      }
    }
    const startedAt = new Date();
    let text = "";
    let status: "ok" | "error" | "refused" = "ok";
    let errorText: string | undefined;
    let usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    let usedModel = live ? model : "fixture";
    try {
      const generator = provider.streamText({
        role,
        purpose: "discussion-turn",
        system,
        messages: chat,
        model,
        maxTokens: contract.limits.maxOutputTokens,
        scenario: "default",
      });
      let next = await generator.next();
      while (!next.done) {
        text += next.value;
        next = await generator.next();
      }
      usage = next.value.usage;
      usedModel = next.value.model;
      if (next.value.stopReason === "refusal") status = "refused";
    } catch (error) {
      status = "error";
      errorText = error instanceof ProviderError ? error.message : "The provider failed.";
      text = `*(${persona.name} could not reply: ${errorText})*`;
    }
    const [run] = await database
      .insert(providerRun)
      .values({
        ownerId,
        role,
        provider: provider.name,
        model: usedModel,
        purpose: "discussion-turn",
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        costUsd: String(estimateCostUsd(usedModel, usage)),
        pricingVersion: PRICING_VERSION,
        promptVersion: `${DISCUSSION_PROMPT_VERSION};role:${contract.version}`,
        status,
        error: errorText ?? null,
        startedAt,
        finishedAt: new Date(),
      })
      .returning({ id: providerRun.id });
    const annotated = annotateTurn(text, []);
    await appendTurn(database, discussion.id, persona.id, annotated.markdown, annotated.labels, run?.id);
    spoken.push(`${persona.name}: ${annotated.markdown}`);
  }
  const { roundsUsed, closed } = await completeRound(database, discussion.id);
  if (closed)
    await appendTurn(
      database,
      discussion.id,
      "system",
      `Closed after ${roundsUsed} round${roundsUsed === 1 ? "" : "s"}, as agreed when it opened.`,
    );
  return NextResponse.json({ roundsUsed, closed });
}
