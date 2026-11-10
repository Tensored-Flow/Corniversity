import { buildPeerPrompt, buildSeminarChairPrompt, DISCUSSION_PROMPT_VERSION, ROLE_CONTRACTS } from "@corniversity/ai";
import { annotateTurn, citedHistory } from "@corniversity/core/grounding/citations";
import { getEnv } from "@corniversity/db/env";
import { teachingUnit } from "@corniversity/db/schema/index";
import { appendTurn, completeRound, getDiscussion, getPersonas, listTurns } from "@corniversity/db/services/community";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { collectPersonaText } from "@/lib/model-runs";
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
        `${t.speaker === "learner" ? profile.displayName : (personas.find((p) => p.id === t.speaker)?.name ?? t.speaker)}: ${citedHistory(t.contentMarkdown, [])}`,
    ),
    `${profile.displayName}: ${parsed.data.message}`,
  ];

  const ordered = [...personas.filter((p) => !p.isPeer), ...personas.filter((p) => p.isPeer)];
  const spoken: string[] = [];
  // Every turn after the first is attributed to the first run of this round: one learner message,
  // several calls, each reserved on its own before it starts.
  let parentRunId: string | undefined;
  for (const persona of ordered) {
    const role = persona.isPeer ? "peer" : "seminar_chair";
    const system = persona.isPeer
      ? buildPeerPrompt(context, { name: persona.name, style: persona.style })
      : buildSeminarChairPrompt(context, { name: persona.name, style: persona.style });
    const turn = await collectPersonaText({
      database,
      ownerId,
      env,
      role,
      purpose: "discussion-turn",
      promptVersion: `${DISCUSSION_PROMPT_VERSION};role:${ROLE_CONTRACTS[role].version}`,
      system,
      messages: [
        {
          role: "user",
          content: `Discussion so far:\n${[...transcript, ...spoken].join("\n\n")}\n\nIt is your turn, ${persona.name}.`,
        },
      ],
      scenario: "default",
      speaker: persona.name,
      parentRunId,
    });
    if (turn.kind === "refused") {
      await appendTurn(database, discussion.id, "system", `${persona.name} did not reply: ${turn.reason}`);
      continue;
    }
    if (turn.mode === "live") parentRunId ??= turn.runId;
    const annotated = annotateTurn(turn.text, []);
    await appendTurn(database, discussion.id, persona.id, annotated.markdown, annotated.labels, turn.runId);
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
