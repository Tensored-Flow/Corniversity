/**
 * Bounded review: an inspectable rule, a weekly budget the learner sets, pause, snooze and
 * archive, and no debt. Items past their date are not "owed": the next set is at most a few items,
 * chosen from what is due, and missing a review changes nothing else. Review outcomes reschedule
 * an item; they are never evidence of understanding.
 */

export type ReviewOutcome = "recalled" | "shaky" | "forgot";
export type ReviewKind = "definition" | "theorem" | "problem" | "explain" | "counterexample" | "derivation" | "unfamiliar" | "issue";

/** The rule, as shown to the learner. */
export const REVIEW_RULE =
  "An item comes back after 2 days. Recalled: the gap doubles (up to 60 days). Shaky: the same gap again. Forgot: back tomorrow. At most your weekly number of items is offered, five at a time; nothing is offered on your days off, and skipping a review costs nothing.";

export const MAX_INTERVAL_DAYS = 60;
export const NEXT_SET_SIZE = 5;

export function nextInterval(current: number, outcome: ReviewOutcome): number {
  if (outcome === "forgot") return 1;
  if (outcome === "shaky") return Math.max(1, current);
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, current) * 2);
}

export interface ReviewCandidate {
  id: string;
  dueAt: Date;
  status: "active" | "paused" | "archived";
  snoozedUntil?: Date | null;
}

export interface NextSetInput {
  now: Date;
  /** Items the learner chose to see per week (their setting), and how many they reviewed this week. */
  budgetPerWeek: number;
  reviewedThisWeek: number;
  /** All review is paused by the learner. */
  paused: boolean;
  /** Days the learner keeps free (ISO weekday 1–7, Monday = 1); nothing is offered on them. */
  restWeekdays?: readonly number[];
}

export type NextSet =
  | { kind: "offered"; items: string[]; dueCount: number; remainingThisWeek: number }
  | { kind: "paused" | "rest_day" | "budget_used"; items: []; dueCount: number; remainingThisWeek: number };

/**
 * The small set to offer now. `dueCount` is reported as information only; the set never grows with
 * it, so a week away produces the same five items, not a backlog.
 */
export function nextReviewSet(items: readonly ReviewCandidate[], input: NextSetInput): NextSet {
  const due = items
    .filter((i) => i.status === "active" && i.dueAt.getTime() <= input.now.getTime())
    .filter((i) => !i.snoozedUntil || i.snoozedUntil.getTime() <= input.now.getTime())
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const remaining = Math.max(0, input.budgetPerWeek - input.reviewedThisWeek);
  if (input.paused) return { kind: "paused", items: [], dueCount: due.length, remainingThisWeek: remaining };
  const weekday = ((input.now.getUTCDay() + 6) % 7) + 1;
  if (input.restWeekdays?.includes(weekday)) return { kind: "rest_day", items: [], dueCount: due.length, remainingThisWeek: remaining };
  if (remaining === 0) return { kind: "budget_used", items: [], dueCount: due.length, remainingThisWeek: 0 };
  return {
    kind: "offered",
    items: due.slice(0, Math.min(NEXT_SET_SIZE, remaining)).map((i) => i.id),
    dueCount: due.length,
    remainingThisWeek: remaining,
  };
}

/** Monday 00:00 UTC of the week containing `now`, for counting this week's reviews. */
export function startOfWeekUtc(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

/**
 * Phrases that describe a person instead of a piece of work. Statements the system proposes about a
 * learner's work must describe the work ("this application of the theorem omitted completeness"),
 * never the learner ("weak at analysis").
 */
const IDENTITY_LABELS = [
  /\b(you are|you're|learner is|student is)\s+(weak|bad|poor|slow|careless|not good)\b/i,
  /\b(weak|bad|poor|terrible|hopeless)\s+at\b/i,
  /\bstruggles?\s+with\b/i,
  /\blacks?\s+(ability|talent|aptitude)\b/i,
  /\bnot\s+(a\s+)?(maths?|math|science)\s+person\b/i,
];

export function isIdentityLabel(text: string): boolean {
  return IDENTITY_LABELS.some((r) => r.test(text));
}
