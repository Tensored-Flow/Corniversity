import { z } from "zod";

/**
 * Problem progressions. Where it suits the subject, a unit's exercises move from a worked example
 * to an independent exercise, an unfamiliar application, a counterexample or failure case, and a
 * synthesis. The stage, the stated basis for a difficulty label and the permitted help are content;
 * a difficulty label is a qualitative judgement with its reason, never a calibrated measure.
 */
export const PROGRESSION_STAGES = ["worked_example", "independent", "unfamiliar", "counterexample", "synthesis"] as const;
export type ProgressionStage = (typeof PROGRESSION_STAGES)[number];

export const STAGE_LABELS: Record<ProgressionStage, string> = {
  worked_example: "Worked example",
  independent: "Independent exercise",
  unfamiliar: "Unfamiliar application",
  counterexample: "Counterexample or failure case",
  synthesis: "Synthesis",
};

export const ExerciseProgression = z.object({
  stage: z.enum(PROGRESSION_STAGES),
  difficulty: z.object({
    level: z.enum(["routine", "standard", "challenging"]),
    /** Why the label: the steps or ideas the exercise needs. Not a measured difficulty. */
    basis: z.string().min(10),
  }),
  /** For an unfamiliar application: what is genuinely new compared with the earlier exercise. */
  transferNote: z.string().min(10).optional(),
  /** Help this exercise permits; omitted means all four kinds. */
  helpModes: z.array(z.enum(["small_hint", "discuss_approach", "check_step", "full_explanation"])).optional(),
  /** Ambiguities in the statement known to the author, shown with the exercise. */
  knownAmbiguities: z.array(z.string().min(5)).default([]),
});
export type ExerciseProgression = z.infer<typeof ExerciseProgression>;

export interface ProgressionItem {
  exerciseId: string;
  title: string;
  stage: ProgressionStage | null;
  /** The latest attempt's state, or null when never attempted. */
  state: string | null;
  submitted: boolean;
  /** Open (proposed, confirmed or revisiting) issues recorded against this exercise. */
  openIssues: number;
}

export interface NextTask {
  exerciseId: string;
  reason: string;
}

/**
 * Proposes one next task from visible evidence, with its reason; the learner may take any other.
 * An open issue on submitted work comes first (revise it), then the earliest stage not yet
 * attempted. Nothing is ever reset, and a single mistake never sends the learner back to the start.
 */
export function proposeNextTask(items: readonly ProgressionItem[]): NextTask | null {
  const order = (s: ProgressionStage | null) => (s ? PROGRESSION_STAGES.indexOf(s) : PROGRESSION_STAGES.length);
  const sorted = [...items].sort((a, b) => order(a.stage) - order(b.stage));
  const withIssue = sorted.find((i) => i.submitted && i.openIssues > 0 && i.state !== "accepted");
  if (withIssue) {
    return {
      exerciseId: withIssue.exerciseId,
      reason: `Your last submission on "${withIssue.title}" has ${withIssue.openIssues === 1 ? "an open issue" : `${withIssue.openIssues} open issues`} in your notebook; a revision is the most direct next step.`,
    };
  }
  const next = sorted.find((i) => !i.submitted);
  if (next) {
    return {
      exerciseId: next.exerciseId,
      reason: next.stage
        ? `Next in the progression: ${STAGE_LABELS[next.stage].toLowerCase()} ("${next.title}").`
        : `Not yet attempted: "${next.title}".`,
    };
  }
  return null;
}
