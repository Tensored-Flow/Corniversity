import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PRICING_VERSION,
  ProviderError,
  ROLE_CONTRACTS,
  TUTOR_PROMPT_VERSION,
  buildTutorSystemPrompt,
  createProvider,
  decideBudget,
  estimateCostUsd,
  estimateRunCostUsd,
} from "@corniversity/ai";
import { getEnv } from "@corniversity/db/env";
import { providerRun } from "@corniversity/db/schema/index";
import { getCourseDetail, getUnitDetail } from "@corniversity/db/services/catalogue";
import { getAttemptHistory, getSession } from "@corniversity/db/services/learning";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { getBudgetLimits, getSpend, resolveProviderConfig } from "@corniversity/db/services/provider-config";
import {
  appendLearnerMessage,
  appendPersonaMessage,
  buildUnitEvidence,
  getOrCreateConversation,
  listMessages,
} from "@corniversity/db/services/tutoring";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

const Body = z.object({
  sessionId: z.string().uuid(),
  exerciseId: z.string().min(1).nullable().optional(),
  message: z.string().trim().min(1).max(6000),
});

export const dynamic = "force-dynamic";

/**
 * One tutor turn. Authorises, builds the evidence-bounded prompt, checks the budget, streams
 * the reply as plain text, then persists the validated turn. A provider failure is reported
 * in the stream and never replaced by a canned answer.
 */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const ownerId = authed.session.user.id;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { sessionId, exerciseId, message } = parsed.data;

  const database = db();
  const env = getEnv();
  const session = await getSession(database, ownerId, sessionId);
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const unitDetail = await getUnitDetail(database, session.unitId);
  if (!unitDetail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const activity = unitDetail.unit.activities.find((a) => a.id === session.activityId);
  const courseDetail = await getCourseDetail(database, unitDetail.course.id);
  const tutor = courseDetail?.tutor ?? null;
  const profile = await ensureProfile(database, ownerId);
  const exercise = exerciseId ? unitDetail.exercises.find((e) => e.id === exerciseId) ?? null : null;
  const history = exercise ? await getAttemptHistory(database, ownerId, exercise.id) : [];
  const latestAttempt = history.at(-1)?.attempt ?? null;
  const latestVersion = history.at(-1)?.versions.at(-1) ?? null;

  const conversation = await getOrCreateConversation(database, {
    ownerId,
    learningSessionId: session.id,
    role: "tutor",
    personaId: tutor?.id,
    purpose: "tutorial",
    unitId: unitDetail.unit.id,
    exerciseId: exercise?.id,
    allowedLocatorIds: [...new Set([...unitDetail.unit.preparation.map((p) => p.locatorId), ...(activity?.sourceLocatorIds ?? [])])],
  });
  const priorMessages = await listMessages(database, conversation.id);
  await appendLearnerMessage(database, conversation.id, message);

  const evidence = await buildUnitEvidence(database, unitDetail.unit.id);
  const system = buildTutorSystemPrompt({
    institutionName: env.INSTITUTION_NAME,
    personaName: tutor?.name ?? "the tutor",
    personaStyle: tutor?.style ?? { approach: "precise and patient", habits: ["asks what was attempted first"] },
    courseTitle: unitDetail.course.title,
    unitTitle: unitDetail.unit.title,
    unitObjective: unitDetail.unit.objectives.map((o) => o.description).join(" "),
    notationConventions: courseDetail ? [] : [],
    exercisePrompt: exercise?.promptMarkdown,
    hintLadder: exercise?.hintLadder,
    hintsAlreadyGiven: latestAttempt?.hintsUsed ?? 0,
    assistanceMode: latestAttempt?.mode ?? "practice",
    learnerStyle: profile.learningStyles[unitDetail.course.primaryDepartmentId],
    evidencePrompt: evidence.prompt,
    relevantAttempts: latestVersion ? [`Submission v${latestVersion.version} (${latestAttempt?.state}): ${latestVersion.contentMarkdown.slice(0, 1500)}`] : latestAttempt?.draftMarkdown ? [`Current draft: ${latestAttempt.draftMarkdown.slice(0, 1500)}`] : [],
    approvedSummaries: [],
  });
  const chat = [
    ...priorMessages.map((m) => ({ role: (m.sender === "learner" ? "user" : "assistant") as "user" | "assistant", content: m.contentMarkdown })),
    { role: "user" as const, content: message },
  ];

  const config = await resolveProviderConfig(database, ownerId, env);
  const { provider, live } = createProvider({ provider: config.provider, anthropicApiKey: config.anthropicApiKey, defaultModel: config.defaultModel, modelMap: config.modelMap });
  const model = config.modelMap.tutor ?? config.defaultModel;
  const contract = ROLE_CONTRACTS.tutor;

  if (live) {
    const limits = await getBudgetLimits(database, ownerId, env);
    const spend = await getSpend(database, ownerId);
    const estimate = estimateRunCostUsd(model, system + chat.map((c) => c.content).join("\n"), 1200);
    const decision = decideBudget(limits, spend, Math.min(estimate, contract.limits.maxRunUsd));
    if (!decision.allowed) {
      await database.insert(providerRun).values({
        ownerId, role: "tutor", provider: provider.name, model, purpose: "tutor-turn", pricingVersion: PRICING_VERSION,
        promptVersion: `${TUTOR_PROMPT_VERSION};role:${contract.version}`, status: "budget_blocked", error: decision.reason, finishedAt: new Date(),
      });
      return NextResponse.json({ error: decision.reason }, { status: 402 });
    }
  }

  const scenario = priorMessages.some((m) => m.sender === "persona") ? "default" : `${unitDetail.unit.id}-intro`;
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
        const generator = provider.streamText({ role: "tutor", purpose: "tutor-turn", system, messages: chat, model, maxTokens: contract.limits.maxOutputTokens, scenario });
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
          const note = "\n\n*(The model declined to continue this turn. Nothing has been lost; try rephrasing.)*";
          raw += note;
          controller.enqueue(encoder.encode(note));
        }
      } catch (error) {
        status = "error";
        errorText = error instanceof ProviderError ? error.message : "The provider failed.";
        const note = `\n\n*(The tutor could not reply: ${errorText} Your work is saved; the sources and your notes remain available.)*`;
        raw += note;
        controller.enqueue(encoder.encode(note));
      }
      const [run] = await database
        .insert(providerRun)
        .values({
          ownerId,
          role: "tutor",
          provider: provider.name,
          model: usedModel,
          purpose: "tutor-turn",
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheWriteTokens: usage.cacheWriteTokens,
          costUsd: String(estimateCostUsd(usedModel, usage)),
          pricingVersion: PRICING_VERSION,
          promptVersion: `${TUTOR_PROMPT_VERSION};role:${contract.version}`,
          status,
          error: errorText ?? null,
          startedAt,
          finishedAt: new Date(),
        })
        .returning({ id: providerRun.id });
      if (raw.trim().length > 0) {
        await appendPersonaMessage(database, { conversationId: conversation.id, personaId: tutor?.id ?? null, rawText: raw, allowed: evidence.refs, providerRunId: run?.id });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no", "x-provider": provider.name },
  });
}
