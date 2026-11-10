/**
 * The four kinds of help a learner can ask for on an exercise, plus an open question. Which help
 * is allowed is decided here, before any model call, so the contract holds whatever a model says:
 * a full explanation is refused in self-test mode until the attempt has been submitted, and a step
 * check needs the lines it is about. Every request is recorded as assistance, never as evidence.
 */
export type TutorHelpMode = "question" | "small_hint" | "discuss_approach" | "check_step" | "full_explanation";

export const HELP_MODES: readonly TutorHelpMode[] = ["question", "small_hint", "discuss_approach", "check_step", "full_explanation"];

export const HELP_LABELS: Record<TutorHelpMode, string> = {
  question: "Ask a question",
  small_hint: "Small hint",
  discuss_approach: "Discuss my approach",
  check_step: "Check this step",
  full_explanation: "Full explanation",
};

export interface HelpContext {
  mode: TutorHelpMode;
  hasExercise: boolean;
  attemptMode: "practice" | "self_test";
  /** Whether the attempt has been submitted at least once. */
  submitted: boolean;
  attemptText: string;
  /** The 1-based lines of the attempt selected for a step check. */
  lines?: [number, number] | null;
  /** The help this exercise permits (its progression metadata); omitted means all four. */
  permitted?: readonly Exclude<TutorHelpMode, "question">[];
}

export type HelpDecision = { allowed: true } | { allowed: false; reason: string };

export function decideHelp(ctx: HelpContext): HelpDecision {
  if (ctx.mode === "question") return { allowed: true };
  if (!ctx.hasExercise)
    return { allowed: false, reason: "This kind of help is for an exercise; ask a question about the material instead." };
  if (ctx.permitted && !ctx.permitted.includes(ctx.mode)) {
    return { allowed: false, reason: `This exercise does not offer “${HELP_LABELS[ctx.mode]}”; its author limited the help it permits.` };
  }
  switch (ctx.mode) {
    case "small_hint":
      return { allowed: true };
    case "discuss_approach":
      return ctx.attemptText.trim().length >= 10
        ? { allowed: true }
        : { allowed: false, reason: "Write some of your approach first, so there is something to discuss." };
    case "check_step":
      if (ctx.attemptText.trim().length === 0) return { allowed: false, reason: "Write the step first, then select its lines." };
      if (!ctx.lines) return { allowed: false, reason: "Select the lines of your attempt you want checked." };
      return { allowed: true };
    case "full_explanation":
      if (ctx.attemptMode === "self_test" && !ctx.submitted) {
        return {
          allowed: false,
          reason:
            "Self-test mode withholds full explanations until you submit. Ask for a small hint, or work on this exercise in practice mode.",
        };
      }
      return { allowed: true };
  }
}

/** What each mode asks of the tutor; placed in the system prompt under HELP REQUESTED. */
export const HELP_INSTRUCTIONS: Record<TutorHelpMode, string> = {
  question:
    "The learner asked a question. Answer it, scoped to the attached selection when there is one. Do not solve the exercise unless asked.",
  small_hint:
    "Give one small hint: the minimal direction that unblocks the next step. Do not give the solution, the next line in full, or more than one idea. If the hint ladder has an unused step that fits, prefer it.",
  discuss_approach:
    "Discuss the learner's approach: its structure, the assumptions it relies on, whether it can work and where it may break. Do not write the proof for them and do not replace their approach with yours; if theirs can succeed, say so even if it differs from the usual one.",
  check_step:
    "Check only the selected lines of the attempt: whether that inference follows from what precedes it and the stated hypotheses. Say which lines you read. Do not grade or comment on lines that were not selected, except where the selected step depends on them.",
  full_explanation:
    "Give a complete, properly supported explanation or solution, with every hypothesis used named. Label it clearly as a full explanation: it is assisted study, recorded as such, and not independent evidence of understanding.",
};
