/**
 * Budget decisions are pure functions of configured limits and recorded spend, so they are
 * testable and identical in the web app and the worker. Every limit is a hard stop: a run whose
 * worst case would cross one is refused before it starts, and reading, notes and the timetable
 * never depend on a model call.
 */
export interface BudgetLimits {
  perRunUsd: number;
  dailyUsd: number;
  monthlyUsd: number;
  warnFraction: number; // 0–1
}

export interface SpendSnapshot {
  todayUsd: number;
  monthUsd: number;
}

export type BudgetDecision = { allowed: true; warnings: string[] } | { allowed: false; reason: string; warnings: string[] };

/**
 * `worstCaseRunUsd` is the most the run can cost (see `worstCaseRunUsd` in pricing); `roleCapUsd`
 * is the role's own ceiling from its contract, which applies alongside the owner's per-run limit.
 */
export function decideBudget(
  limits: BudgetLimits,
  spend: SpendSnapshot,
  worstCaseRunUsd: number,
  roleCapUsd = Number.POSITIVE_INFINITY,
): BudgetDecision {
  const warnings: string[] = [];
  const dailyAfter = spend.todayUsd + worstCaseRunUsd;
  const monthlyAfter = spend.monthUsd + worstCaseRunUsd;

  if (worstCaseRunUsd > limits.perRunUsd) {
    return {
      allowed: false,
      reason: `This run could cost up to $${worstCaseRunUsd.toFixed(3)}, above your per-run limit of $${limits.perRunUsd.toFixed(2)}.`,
      warnings,
    };
  }
  if (worstCaseRunUsd > roleCapUsd) {
    return {
      allowed: false,
      reason: `This run could cost up to $${worstCaseRunUsd.toFixed(3)}, above this role's ceiling of $${roleCapUsd.toFixed(2)}. Shorten the conversation or start a new one.`,
      warnings,
    };
  }
  if (dailyAfter > limits.dailyUsd) {
    return {
      allowed: false,
      reason: `Today's limit of $${limits.dailyUsd.toFixed(2)} could be exceeded ($${spend.todayUsd.toFixed(2)} spent so far). Paid runs pause until tomorrow (UTC) or until you raise the limit.`,
      warnings,
    };
  }
  if (monthlyAfter > limits.monthlyUsd) {
    return {
      allowed: false,
      reason: `This month's limit of $${limits.monthlyUsd.toFixed(2)} could be exceeded ($${spend.monthUsd.toFixed(2)} spent so far).`,
      warnings,
    };
  }
  if (dailyAfter >= limits.dailyUsd * limits.warnFraction) {
    warnings.push(`Approaching today's limit: up to $${dailyAfter.toFixed(2)} of $${limits.dailyUsd.toFixed(2)}.`);
  }
  if (monthlyAfter >= limits.monthlyUsd * limits.warnFraction) {
    warnings.push(`Approaching this month's limit: up to $${monthlyAfter.toFixed(2)} of $${limits.monthlyUsd.toFixed(2)}.`);
  }
  return { allowed: true, warnings };
}

/** The largest limits the settings accept, so a typing slip cannot authorise open-ended spending. */
export const BUDGET_CEILINGS = { perRunUsd: 5, dailyUsd: 50, monthlyUsd: 500 } as const;

export class BudgetLimitError extends Error {}

/** Validates limits the owner enters: finite, positive, within the ceilings, and nested. */
export function validateBudgetLimits(input: { perRunUsd: number; dailyUsd: number; monthlyUsd: number }): {
  perRunUsd: number;
  dailyUsd: number;
  monthlyUsd: number;
} {
  for (const key of ["perRunUsd", "dailyUsd", "monthlyUsd"] as const) {
    const v = input[key];
    if (!Number.isFinite(v) || v <= 0) throw new BudgetLimitError("Every limit must be a positive amount.");
    if (v > BUDGET_CEILINGS[key]) throw new BudgetLimitError(`The ${LABEL[key]} limit can be at most $${BUDGET_CEILINGS[key]}.`);
  }
  if (input.perRunUsd > input.dailyUsd) throw new BudgetLimitError("The per-run limit cannot exceed the daily limit.");
  if (input.dailyUsd > input.monthlyUsd) throw new BudgetLimitError("The daily limit cannot exceed the monthly limit.");
  return { perRunUsd: input.perRunUsd, dailyUsd: input.dailyUsd, monthlyUsd: input.monthlyUsd };
}

const LABEL = { perRunUsd: "per-run", dailyUsd: "daily", monthlyUsd: "monthly" } as const;
