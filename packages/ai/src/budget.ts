/**
 * Budget decisions are pure functions of configured limits and recorded spend, so they are
 * testable and identical in the web app and the worker. A hard stop refuses new paid work;
 * reading, notes and the timetable never depend on a model call.
 */
export interface BudgetLimits {
  perRunUsd: number;
  dailyUsd: number;
  monthlyUsd: number;
  hardStop: boolean;
  warnFraction: number; // 0–1
}

export interface SpendSnapshot {
  todayUsd: number;
  monthUsd: number;
}

export type BudgetDecision =
  | { allowed: true; warnings: string[] }
  | { allowed: false; reason: string; warnings: string[] };

export function decideBudget(limits: BudgetLimits, spend: SpendSnapshot, estimatedRunUsd: number): BudgetDecision {
  const warnings: string[] = [];
  const dailyAfter = spend.todayUsd + estimatedRunUsd;
  const monthlyAfter = spend.monthUsd + estimatedRunUsd;

  if (estimatedRunUsd > limits.perRunUsd) {
    return {
      allowed: false,
      reason: `This single run is estimated at $${estimatedRunUsd.toFixed(3)}, above the per-run limit of $${limits.perRunUsd.toFixed(2)}.`,
      warnings,
    };
  }
  if (limits.hardStop && dailyAfter > limits.dailyUsd) {
    return {
      allowed: false,
      reason: `Today's budget of $${limits.dailyUsd.toFixed(2)} would be exceeded ($${spend.todayUsd.toFixed(2)} spent so far). New paid work pauses until tomorrow or until you raise the limit.`,
      warnings,
    };
  }
  if (limits.hardStop && monthlyAfter > limits.monthlyUsd) {
    return {
      allowed: false,
      reason: `This month's budget of $${limits.monthlyUsd.toFixed(2)} would be exceeded ($${spend.monthUsd.toFixed(2)} spent so far).`,
      warnings,
    };
  }
  if (dailyAfter >= limits.dailyUsd * limits.warnFraction) {
    warnings.push(`Approaching today's budget: $${dailyAfter.toFixed(2)} of $${limits.dailyUsd.toFixed(2)}.`);
  }
  if (monthlyAfter >= limits.monthlyUsd * limits.warnFraction) {
    warnings.push(`Approaching this month's budget: $${monthlyAfter.toFixed(2)} of $${limits.monthlyUsd.toFixed(2)}.`);
  }
  return { allowed: true, warnings };
}
