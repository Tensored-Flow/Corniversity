import { buildTutorSystemPrompt, ROLE_CONTRACTS, TUTOR_PROMPT_VERSION } from "@corniversity/ai";
import { getEnv } from "@corniversity/db/env";
import { getCourseDetail } from "@corniversity/db/services/catalogue";
import { getOrCreateAttempt } from "@corniversity/db/services/learning";
import { localOnlyAssetsForCourse, sourcePassagesStillPermitted } from "@corniversity/db/services/library";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { attachRunToAssistance, recordAssistance } from "@corniversity/db/services/study-session";
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
import { DEFAULT_HELP_MESSAGE, TutorRequest, tutorAttachments } from "@/lib/tutor-context";
import { tutorHistory } from "@/lib/tutor-history";

const Body = TutorRequest.extend({ message: z.string().trim().max(6000).default("") });

export const dynamic = "force-dynamic";

/**
 * One tutor turn. Authorises; applies the help contract before any model call (a refused kind of
 * help sends nothing and costs nothing); records the request as assistance; stores the learner's
 * message; builds the evidence-bounded prompt with the selection and its scope; then runs it
 * through the shared gate: the scripted demo, an approved live model within the budget, or a
 * refusal with its reason. A provider failure is reported in the stream, never replaced by a
 * canned answer; the reply is stored with its citations checked.
 */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const ownerId = authed.session.user.id;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const req = parsed.data;
  const message = req.message || DEFAULT_HELP_MESSAGE[req.mode];
  if (!message) return NextResponse.json({ error: "Write a question first." }, { status: 400 });

  const database = db();
  const env = getEnv();
  const ctx = await tutorAttachments(database, ownerId, req);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!ctx.decision.allowed) {
    return NextResponse.json({ error: ctx.decision.reason, code: "help_refused" }, { status: 422 });
  }
  const { session, unitDetail, activity, exercise, latestAttempt, latestVersion, selection, attemptContext, lessonContext } = ctx;
  const courseDetail = await getCourseDetail(database, unitDetail.course.id);
  const tutor = courseDetail?.tutor ?? null;
  const profile = await ensureProfile(database, ownerId);

  const attemptForHelp =
    exercise && req.mode !== "question"
      ? await getOrCreateAttempt(database, { ownerId, exerciseId: exercise.id, sessionId: session.id })
      : null;
  const assistanceId = await recordAssistance(database, {
    ownerId,
    sessionId: session.id,
    attemptId: attemptForHelp?.id ?? latestAttempt?.id ?? null,
    exerciseId: exercise?.id ?? null,
    mode: req.mode,
    anchor: selection
      ? selection.origin === "attempt"
        ? { kind: "attempt_lines", lines: selection.lines, text: selection.text }
        : { kind: "selection", text: selection.text, unitId: unitDetail.unit.id }
      : null,
  });

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
  const quoted = selection
    ? `${selection.origin === "attempt" ? `[lines ${selection.lines?.[0]}–${selection.lines?.[1]}] ` : "> "}${selection.text.slice(0, 280)}${selection.text.length > 280 ? "…" : ""}\n\n`
    : "";
  await appendLearnerMessage(database, conversation.id, `${req.mode === "question" ? "" : `**${ctx.help.label}.** `}${quoted}${message}`);

  // Retrieval starts from the selection when there is one, so a question such as "why is
  // completeness needed here?" finds passages about the selected text, not only its own words.
  const query = selection && req.scope === "selection" ? `${selection.text}\n${message}` : message;
  const evidence = await buildUnitEvidence(database, unitDetail.unit.id, { ownerId, courseId: unitDetail.course.id, query });
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
    lessonContext: `${lessonContext.note}\n${lessonContext.text}`,
    relevantAttempts: attemptContext.text
      ? [
          `${latestAttempt?.draftMarkdown ? `Current draft (revision ${latestAttempt.draftRevision})` : `Submission v${latestVersion?.version} (${latestAttempt?.state})`}: ${attemptContext.note}\n${attemptContext.text}`,
        ]
      : [],
    approvedSummaries: [],
    help: ctx.help,
    selection: selection ? { ...selection, scope: req.scope } : undefined,
  });
  // Bounded context: the most recent turns within a fixed size; the record keeps every turn.
  const history = await tutorHistory(priorMessages, message, (ref) =>
    sourcePassagesStillPermitted(database, ownerId, unitDetail.course.id, [ref]),
  );

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

  const scenario =
    req.mode !== "question" ? req.mode : priorMessages.some((m) => m.sender === "persona") ? "default" : `${unitDetail.unit.id}-intro`;
  return streamPersonaTurn({
    database,
    ownerId,
    env,
    role: "tutor",
    purpose: `tutor-${req.mode.replace("_", "-")}`,
    promptVersion: `${TUTOR_PROMPT_VERSION};role:${ROLE_CONTRACTS.tutor.version}`,
    system,
    messages: history.chat,
    scenario,
    speaker: tutor?.name ?? "The tutor",
    prefix: `${localOnlyNote}${history.omitted ? "*(Earlier replies citing unavailable library passages were left out of this turn; your saved conversation is unchanged.)*\n\n" : ""}`,
    sourcesStillPermitted: () =>
      sourcePassagesStillPermitted(database, ownerId, unitDetail.course.id, [...evidence.refs, ...history.sourceRefs]),
    onFinish: async (raw, runId) => {
      await attachRunToAssistance(database, assistanceId, runId);
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
