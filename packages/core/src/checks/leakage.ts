/**
 * Keeps the instructor's reference reasoning out of feedback. The assessor is given the reference
 * to judge with and told never to quote it; this check does not depend on the model following
 * that instruction. A run of RUN_WORDS consecutive words shared with the reference counts as
 * repeating it, unless the learner has seen that run anyway, in the exercise prompt or in their
 * own submission.
 */
export const RUN_WORDS = 10;

export const WITHHELD = "*(Withheld: this part of the feedback repeated the reference solution, which stays hidden.)*";

const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

function runsOf(tokens: string[]): Set<string> {
  const runs = new Set<string>();
  for (let i = 0; i + RUN_WORDS <= tokens.length; i++) runs.add(tokens.slice(i, i + RUN_WORDS).join(" "));
  return runs;
}

/** The reference's word runs that the learner has not seen in `seen`. */
export function hiddenRuns(reference: string, seen: readonly string[]): Set<string> {
  const runs = runsOf(words(reference));
  for (const text of seen) for (const run of runsOf(words(text))) runs.delete(run);
  return runs;
}

/** Whether `text` repeats any of the hidden runs. */
export function repeatsHidden(text: string, hidden: ReadonlySet<string>): boolean {
  if (hidden.size === 0) return false;
  for (const run of runsOf(words(text))) if (hidden.has(run)) return true;
  return false;
}

interface FeedbackText {
  summary: string;
  firstGap: { line: number; excerpt: string; issue: string } | null;
  checks: { criterionId: string; status: string; comment: string }[];
  strengths: string[];
  nextStep: string;
}

/**
 * Feedback with every field that repeats the reference replaced by WITHHELD, and how many were.
 * The first gap's excerpt quotes the learner's own submission and is left as it is.
 */
export function withholdReferenceText<F extends FeedbackText>(
  feedback: F,
  reference: string | null,
  seen: readonly string[],
): { feedback: F; withheld: number } {
  const hidden = reference ? hiddenRuns(reference, seen) : new Set<string>();
  let withheld = 0;
  const guard = (text: string) => {
    if (!repeatsHidden(text, hidden)) return text;
    withheld += 1;
    return WITHHELD;
  };
  const guarded: F = {
    ...feedback,
    summary: guard(feedback.summary),
    firstGap: feedback.firstGap ? { ...feedback.firstGap, issue: guard(feedback.firstGap.issue) } : null,
    checks: feedback.checks.map((c) => ({ ...c, comment: guard(c.comment) })),
    strengths: feedback.strengths.map(guard),
    nextStep: guard(feedback.nextStep),
  };
  return { feedback: guarded, withheld };
}
