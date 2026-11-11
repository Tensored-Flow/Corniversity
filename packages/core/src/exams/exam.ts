/**
 * Course exams: a timed, closed-book paper of problems the learner has not attempted, marked by
 * the assessor. These are the pure rules; the service applies them to records.
 */

export const EXAM_LIMITS = { minQuestions: 1, maxQuestions: 10, minMinutes: 5, maxMinutes: 300 } as const;
export const EXAM_DEFAULTS = { questions: 4, minutes: 60 } as const;
/** Saving is still accepted this long after the deadline, so a save sent in the last second lands. */
export const EXAM_GRACE_MS = 30_000;

export class ExamRuleError extends Error {}

export function validateExamSettings(input: { questions: number; minutes: number }): { questions: number; minutes: number } {
  const { questions, minutes } = input;
  if (!Number.isInteger(questions) || questions < EXAM_LIMITS.minQuestions || questions > EXAM_LIMITS.maxQuestions) {
    throw new ExamRuleError(`Choose between ${EXAM_LIMITS.minQuestions} and ${EXAM_LIMITS.maxQuestions} questions.`);
  }
  if (!Number.isInteger(minutes) || minutes < EXAM_LIMITS.minMinutes || minutes > EXAM_LIMITS.maxMinutes) {
    throw new ExamRuleError(`Choose between ${EXAM_LIMITS.minMinutes} and ${EXAM_LIMITS.maxMinutes} minutes.`);
  }
  return { questions, minutes };
}

/**
 * Picks the exam's problems: a random sample of the unattempted ones, at most `count`, presented
 * in course order (unit, then problem). `random` returns numbers in [0, 1).
 */
export function pickExamQuestions<T extends { id: string; unitSequence: number; sequence: number }>(
  available: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const pool = [...available];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count).sort((a, b) => a.unitSequence - b.unitSequence || a.sequence - b.sequence);
}

/** Whether a save or submission at `now` still counts for an exam with this deadline. */
export function withinExamTime(deadlineAt: Date, now: Date = new Date()): boolean {
  return now.getTime() <= deadlineAt.getTime() + EXAM_GRACE_MS;
}

export type CheckStatus = "met" | "partially_met" | "not_met" | "not_applicable";

const CREDIT: Record<Exclude<CheckStatus, "not_applicable">, number> = { met: 1, partially_met: 0.5, not_met: 0 };

/**
 * A question's score in [0, 1] from the assessor's check of each rubric criterion: met earns the
 * criterion's full weight, partly met half, not met nothing. A criterion the assessor did not check
 * counts as not met, so a missing check never raises a score. Criteria judged not applicable are
 * left out. Null when no criterion carrying weight applies.
 */
export function questionScore(
  criteria: readonly { id: string; weight: number }[],
  checks: readonly { criterionId: string; status: CheckStatus }[],
): number | null {
  let earned = 0;
  let possible = 0;
  for (const c of criteria) {
    const status = checks.find((k) => k.criterionId === c.id)?.status ?? "not_met";
    if (status === "not_applicable") continue;
    earned += c.weight * CREDIT[status];
    possible += c.weight;
  }
  return possible > 0 ? earned / possible : null;
}

/** `unscored`: marked, but the assessor judged no weighted criterion applicable, so there is no score. */
export type QuestionOutcome = { kind: "unanswered" } | { kind: "awaiting" } | { kind: "unscored" } | { kind: "marked"; score: number };

/**
 * The exam's result: an unanswered question counts as 0; an unscored one is left out; the overall
 * score, the mean over the rest, exists only once no answered question is still awaiting marking.
 */
export function examResult(outcomes: readonly QuestionOutcome[]): {
  questions: number;
  marked: number;
  awaiting: number;
  unanswered: number;
  score: number | null;
} {
  const marked = outcomes.filter((o) => o.kind === "marked" || o.kind === "unscored").length;
  const awaiting = outcomes.filter((o) => o.kind === "awaiting").length;
  const unanswered = outcomes.filter((o) => o.kind === "unanswered").length;
  const counted = outcomes.filter((o) => o.kind !== "unscored").length;
  const total = outcomes.reduce((sum, o) => sum + (o.kind === "marked" ? o.score : 0), 0);
  return {
    questions: outcomes.length,
    marked,
    awaiting,
    unanswered,
    score: awaiting === 0 && counted > 0 ? total / counted : null,
  };
}
