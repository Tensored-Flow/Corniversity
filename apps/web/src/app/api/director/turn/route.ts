import { NextResponse } from "next/server";
import { z } from "zod";
import { DIRECTOR_PROMPT_VERSION, PRICING_VERSION, ProviderError, ROLE_CONTRACTS, buildDirectorSystemPrompt, createProvider, decideBudget, estimateCostUsd, estimateRunCostUsd } from "@corniversity/ai";
import { getEnv } from "@corniversity/db/env";
import { providerRun } from "@corniversity/db/schema/index";
import { listCatalogue, listDepartments } from "@corniversity/db/services/catalogue";
import { listEnrolments } from "@corniversity/db/services/enrolment";
import { getConceptStates } from "@corniversity/db/services/evidence";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { getBudgetLimits, getSpend, resolveProviderConfig } from "@corniversity/db/services/provider-config";
import { appendLearnerMessage, appendPersonaMessage, getConversation, getPersona, listMessages } from "@corniversity/db/services/tutoring";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

const Body = z.object({ conversationId: z.string().uuid(), message: z.string().trim().min(1).max(4000) });
export const dynamic = "force-dynamic";

/** One director turn: catalogue-grounded, draft-only; the same budget and persistence discipline as the tutor. */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const ownerId = authed.session.user.id;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const database = db();
  const env = getEnv();
  const conversation = await getConversation(database, ownerId, parsed.data.conversationId);
  if (!conversation || conversation.role !== "director") return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [profile, enrolments, catalogue, departments, states] = await Promise.all([
    ensureProfile(database, ownerId),
    listEnrolments(database, ownerId),
    listCatalogue(database),
    listDepartments(database),
    getConceptStates(database, ownerId),
  ]);
  const persona = conversation.personaId ? await getPersona(database, conversation.personaId) : null;
  const prior = await listMessages(database, conversation.id);
  await appendLearnerMessage(database, conversation.id, parsed.data.message);
  const deptTitle = new Map(departments.map((d) => [d.id, d.title]));
  const system = buildDirectorSystemPrompt({
    institutionName: env.INSTITUTION_NAME,
    personaName: persona?.name ?? "the Director of Studies",
    learnerName: profile.displayName,
    goalsText: profile.goalsText ?? "",
    interests: profile.onboardingAnswers.interestCourseIds ?? [],
    weeklyHours: profile.weeklyHoursCeiling,
    rhythm: profile.studyRhythm,
    enrolments: enrolments.filter((e) => e.enrolment.status !== "withdrawn").map((e) => ({ courseId: e.course.id, title: e.course.title, mode: e.enrolment.mode, readiness: e.version.readiness })),
    catalogue: catalogue.map((c) => ({ courseId: c.course.id, title: c.course.title, readiness: c.version.readiness, level: c.course.level, department: deptTitle.get(c.course.primaryDepartmentId) ?? c.course.primaryDepartmentId })),
    evidenceSummary: states.filter((s) => s.state.state === "demonstrated" || s.state.state === "practised").map((s) => `${s.concept.title}: ${s.state.state}`),
  });
  const chat = [...prior.map((m) => ({ role: (m.sender === "learner" ? "user" : "assistant") as "user" | "assistant", content: m.contentMarkdown })), { role: "user" as const, content: parsed.data.message }];
  const config = await resolveProviderConfig(database, ownerId, env);
  const { provider, live } = createProvider({ provider: config.provider, anthropicApiKey: config.anthropicApiKey, defaultModel: config.defaultModel, modelMap: config.modelMap });
  const model = config.modelMap.director ?? config.defaultModel;
  const contract = ROLE_CONTRACTS.director;
  if (live) {
    const [limits, spend] = await Promise.all([getBudgetLimits(database, ownerId, env), getSpend(database, ownerId)]);
    const decision = decideBudget(limits, spend, Math.min(estimateRunCostUsd(model, system + chat.map((c) => c.content).join("\n"), 800), contract.limits.maxRunUsd));
    if (!decision.allowed) return NextResponse.json({ error: decision.reason }, { status: 402 });
  }
  const scenario = prior.some((m) => m.sender === "persona") ? "default" : "welcome-note";
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
        const gen = provider.streamText({ role: "director", purpose: "director-turn", system, messages: chat, model, maxTokens: contract.limits.maxOutputTokens, scenario });
        let next = await gen.next();
        while (!next.done) {
          raw += next.value;
          controller.enqueue(encoder.encode(next.value));
          next = await gen.next();
        }
        usage = next.value.usage;
        usedModel = next.value.model;
        if (next.value.stopReason === "refusal") status = "refused";
      } catch (error) {
        status = "error";
        errorText = error instanceof ProviderError ? error.message : "The provider failed.";
        const note = `\n\n*(The director could not reply: ${errorText})*`;
        raw += note;
        controller.enqueue(encoder.encode(note));
      }
      const [run] = await database
        .insert(providerRun)
        .values({ ownerId, role: "director", provider: provider.name, model: usedModel, purpose: "director-turn", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cacheReadTokens: usage.cacheReadTokens, cacheWriteTokens: usage.cacheWriteTokens, costUsd: String(estimateCostUsd(usedModel, usage)), pricingVersion: PRICING_VERSION, promptVersion: `${DIRECTOR_PROMPT_VERSION};role:${contract.version}`, status, error: errorText ?? null, startedAt, finishedAt: new Date() })
        .returning({ id: providerRun.id });
      if (raw.trim()) await appendPersonaMessage(database, { conversationId: conversation.id, personaId: persona?.id ?? null, rawText: raw, allowed: [], providerRunId: run?.id });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-provider": provider.name } });
}
