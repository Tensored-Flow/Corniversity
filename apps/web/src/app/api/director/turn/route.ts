import { buildDirectorSystemPrompt, DIRECTOR_PROMPT_VERSION, ROLE_CONTRACTS } from "@corniversity/ai";
import { citedHistory } from "@corniversity/core/grounding/citations";
import { getEnv } from "@corniversity/db/env";
import { listCatalogue, listDepartments } from "@corniversity/db/services/catalogue";
import { listEnrolments } from "@corniversity/db/services/enrolment";
import { getConceptStates } from "@corniversity/db/services/evidence";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { appendLearnerMessage, appendPersonaMessage, getConversation, getPersona, listMessages } from "@corniversity/db/services/tutoring";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { streamPersonaTurn } from "@/lib/model-runs";
import { requireApiSession } from "@/lib/session";

const Body = z.object({ conversationId: z.string().uuid(), message: z.string().trim().min(1).max(4000) });
export const dynamic = "force-dynamic";

/** One director turn: catalogue-grounded, draft-only; the same gate and persistence discipline as the tutor. */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const ownerId = authed.session.user.id;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const database = db();
  const env = getEnv();
  const conversation = await getConversation(database, ownerId, parsed.data.conversationId);
  if (conversation?.role !== "director") return NextResponse.json({ error: "not_found" }, { status: 404 });

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
    enrolments: enrolments
      .filter((e) => e.enrolment.status !== "withdrawn")
      .map((e) => ({ courseId: e.course.id, title: e.course.title, mode: e.enrolment.mode, readiness: e.version.readiness })),
    catalogue: catalogue.map((c) => ({
      courseId: c.course.id,
      title: c.course.title,
      readiness: c.version.readiness,
      level: c.course.level,
      department: deptTitle.get(c.course.primaryDepartmentId) ?? c.course.primaryDepartmentId,
    })),
    evidenceSummary: states
      .filter((s) => s.state.state === "demonstrated" || s.state.state === "practised")
      .map((s) => `${s.concept.title}: ${s.state.state}`),
  });
  const chat = [
    ...prior.map((m) => ({
      role: (m.sender === "learner" ? "user" : "assistant") as "user" | "assistant",
      content: m.sender === "learner" ? m.contentMarkdown : citedHistory(m.contentMarkdown, m.citations),
    })),
    { role: "user" as const, content: parsed.data.message },
  ];

  return streamPersonaTurn({
    database,
    ownerId,
    env,
    role: "director",
    purpose: "director-turn",
    promptVersion: `${DIRECTOR_PROMPT_VERSION};role:${ROLE_CONTRACTS.director.version}`,
    system,
    messages: chat,
    scenario: prior.some((m) => m.sender === "persona") ? "default" : "welcome-note",
    speaker: persona?.name ?? "The director",
    onFinish: async (raw, runId) => {
      await appendPersonaMessage(database, {
        conversationId: conversation.id,
        personaId: persona?.id ?? null,
        rawText: raw,
        allowed: [],
        providerRunId: runId,
      });
    },
  });
}
