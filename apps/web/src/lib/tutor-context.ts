import "server-only";
import { decideHelp, HELP_INSTRUCTIONS, HELP_LABELS, type TutorHelpMode } from "@corniversity/core/tutoring/help";
import type { DbOrTx } from "@corniversity/db/client";
import { getUnitDetail } from "@corniversity/db/services/catalogue";
import { getAttemptHistory, getSession } from "@corniversity/db/services/learning";
import { z } from "zod";

export const TutorRequest = z.object({
  sessionId: z.string().uuid(),
  exerciseId: z.string().min(1).nullable().optional(),
  mode: z.enum(["question", "small_hint", "discuss_approach", "check_step", "full_explanation"]).default("question"),
  selection: z
    .object({
      origin: z.enum(["lesson", "attempt"]),
      text: z.string().trim().min(1).max(4000),
      lines: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
    })
    .nullable()
    .optional(),
  scope: z.enum(["selection", "unit"]).default("selection"),
});
export type TutorRequest = z.infer<typeof TutorRequest>;

/** The default words sent with a help request when the learner adds none. */
export const DEFAULT_HELP_MESSAGE: Record<TutorHelpMode, string> = {
  question: "",
  small_hint: "Could I have a small hint for the next step?",
  discuss_approach: "Can we discuss my approach so far?",
  check_step: "Please check the selected step.",
  full_explanation: "Please give me a full explanation.",
};

/**
 * Everything one tutor turn will carry, decided in one place so the preview the learner inspects
 * is exactly what is sent: the help contract's decision, the selection and its scope, the attempt
 * text used, and a readable list of what is attached and what is not.
 */
export async function tutorAttachments(database: DbOrTx, ownerId: string, req: TutorRequest) {
  const session = await getSession(database, ownerId, req.sessionId);
  if (!session) return { ok: false as const, status: 404, error: "not_found" };
  const unitDetail = await getUnitDetail(database, session.unitId);
  if (!unitDetail) return { ok: false as const, status: 404, error: "not_found" };
  const activity = unitDetail.unit.activities.find((a) => a.id === session.activityId) ?? null;
  const exercise = req.exerciseId ? (unitDetail.exercises.find((e) => e.id === req.exerciseId) ?? null) : null;
  const history = exercise ? await getAttemptHistory(database, ownerId, exercise.id) : [];
  const latestAttempt = history.at(-1)?.attempt ?? null;
  const latestVersion = history.at(-1)?.versions.at(-1) ?? null;
  const attemptText = latestAttempt?.draftMarkdown ?? latestVersion?.contentMarkdown ?? "";
  const submitted = Boolean(latestVersion);
  const decision = decideHelp({
    mode: req.mode,
    hasExercise: Boolean(exercise),
    attemptMode: latestAttempt?.mode ?? "practice",
    submitted,
    attemptText,
    lines: req.selection?.origin === "attempt" ? (req.selection.lines ?? null) : null,
    permitted: exercise?.progression?.helpModes,
  });
  const selection = req.selection ?? null;
  const attached: string[] = [];
  attached.push(`The kind of help: ${HELP_LABELS[req.mode]}.`);
  if (selection) {
    attached.push(
      selection.origin === "attempt"
        ? `Lines ${selection.lines?.[0]}–${selection.lines?.[1]} of your attempt, as selected.`
        : `The passage you selected (${selection.text.length} characters).`,
    );
    attached.push(
      req.scope === "selection" ? "Scope: the selection only." : "Scope: the selection as a starting point, with the whole unit.",
    );
  }
  attached.push(`The unit: ${unitDetail.unit.title} (${unitDetail.course.id}), its objective and source locations.`);
  if (exercise) {
    attached.push(`The exercise "${exercise.title}" and its authored hint ladder (hints given so far: ${latestAttempt?.hintsUsed ?? 0}).`);
    if (attemptText) {
      attached.push(
        latestAttempt?.draftMarkdown
          ? `Your latest saved draft (revision ${latestAttempt.draftRevision}), up to 1,500 characters.`
          : `Your latest submission (v${latestVersion?.version}), up to 1,500 characters.`,
      );
    }
  }
  attached.push("Passages from your permitted library for this course that match the question.");
  const notAttached = [
    "your other courses and their work",
    "your notebook outside this session",
    "library items you have not permitted for AI use",
    "any reference solution (the tutor is never given one)",
  ];
  return {
    ok: true as const,
    session,
    unitDetail,
    activity,
    exercise,
    latestAttempt,
    latestVersion,
    attemptText,
    decision,
    selection,
    help: { label: HELP_LABELS[req.mode], instruction: HELP_INSTRUCTIONS[req.mode] },
    attached,
    notAttached,
  };
}
