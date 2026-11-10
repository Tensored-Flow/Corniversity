import { buildTutorSystemPrompt, ROLE_CONTRACTS, TUTOR_PROMPT_VERSION } from "@corniversity/ai";
import { citedHistory } from "@corniversity/core/grounding/citations";
import { getEnv } from "@corniversity/db/env";
import { getCourseDetail, getUnitDetail } from "@corniversity/db/services/catalogue";
import { getAttemptHistory, getSession } from "@corniversity/db/services/learning";
import { localOnlyAssetsForCourse } from "@corniversity/db/services/library";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import {
  appendLearnerMessage,
  appendPersonaMessage,
  buildUnitEvidence,
  getOrCreateConversation,
  listMessages,
} from "@corniversity/db/services/tutoring";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { streamPersonaTurn } from "@/lib/model-runs";
import { requireApiSession } from "@/lib/session";

const Body = z.object({
  sessionId: z.string().uuid(),
  exerciseId: z.string().min(1).nullable().optional(),
  message: z.string().trim().min(1).max(6000),
});

export const dynamic = "force-dynamic";

/**
 * One tutor turn. Authorises, stores the learner's message, builds the evidence-bounded prompt,
 * then runs it through the shared gate: the scripted demo, an approved live model within the
 * budget, or a refusal with its reason. A provider failure is reported in the stream and never
 * replaced by a canned answer; the reply is stored with its citations checked.
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
  const exercise = exerciseId ? (unitDetail.exercises.find((e) => e.id === exerciseId) ?? null) : null;
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

  const evidence = await buildUnitEvidence(database, unitDetail.unit.id, { ownerId, courseId: unitDetail.course.id, query: message });
  const system = buildTutorSystemPrompt({
    institutionName: env.INSTITUTION_NAME,
    personaName: tutor?.name ?? "the tutor",
    personaStyle: tutor?.style ?? { approach: "precise and patient", habits: ["asks what was attempted first"] },
    courseTitle: unitDetail.course.title,
    unitTitle: unitDetail.unit.title,
    unitObjective: unitDetail.unit.objectives.map((o) => o.description).join(" "),
    notationConventions: [],
    exercisePrompt: exercise?.promptMarkdown,
    hintLadder: exercise?.hintLadder,
    hintsAlreadyGiven: latestAttempt?.hintsUsed ?? 0,
    assistanceMode: latestAttempt?.mode ?? "practice",
    learnerStyle: profile.learningStyles[unitDetail.course.primaryDepartmentId],
    evidencePrompt: evidence.prompt,
    relevantAttempts: latestVersion
      ? [`Submission v${latestVersion.version} (${latestAttempt?.state}): ${latestVersion.contentMarkdown.slice(0, 1500)}`]
      : latestAttempt?.draftMarkdown
        ? [`Current draft: ${latestAttempt.draftMarkdown.slice(0, 1500)}`]
        : [],
    approvedSummaries: [],
  });
  const chat = [
    ...priorMessages.map((m) => ({
      role: (m.sender === "learner" ? "user" : "assistant") as "user" | "assistant",
      content: m.sender === "learner" ? m.contentMarkdown : citedHistory(m.contentMarkdown, m.citations),
    })),
    { role: "user" as const, content: message },
  ];

  const haystack = message.toLowerCase();
  const localOnlyMentioned = (await localOnlyAssetsForCourse(database, ownerId, unitDetail.course.id)).filter((a) =>
    [a.confirmedTitle, a.candidateMetadata.title, a.filename.replace(/\.[a-z0-9]+$/i, "")]
      .filter((n): n is string => typeof n === "string" && n.trim().length >= 4)
      .some((n) => haystack.includes(n.trim().toLowerCase())),
  );
  const one = localOnlyMentioned.length === 1;
  const localOnlyNote = localOnlyMentioned.length
    ? `*(Note from the university, not from ${tutor?.name ?? "the tutor"}: ${localOnlyMentioned.map((a) => `"${a.confirmedTitle ?? a.candidateMetadata.title ?? a.filename}"`).join(", ")} ${one ? "is" : "are"} registered as local-only. Nothing of ${one ? "its" : "their"} contents has left your device, so the tutor has not seen a page of ${one ? "it" : "them"} and cannot comment on ${one ? "its" : "their"} text.)*\n\n`
    : "";

  return streamPersonaTurn({
    database,
    ownerId,
    env,
    role: "tutor",
    purpose: "tutor-turn",
    promptVersion: `${TUTOR_PROMPT_VERSION};role:${ROLE_CONTRACTS.tutor.version}`,
    system,
    messages: chat,
    scenario: priorMessages.some((m) => m.sender === "persona") ? "default" : `${unitDetail.unit.id}-intro`,
    speaker: tutor?.name ?? "The tutor",
    prefix: localOnlyNote,
    onFinish: async (raw, runId) => {
      await appendPersonaMessage(database, {
        conversationId: conversation.id,
        personaId: tutor?.id ?? null,
        rawText: raw,
        allowed: evidence.refs,
        providerRunId: runId,
      });
    },
  });
}
