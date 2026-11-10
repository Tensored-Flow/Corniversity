import {
  type AttemptUsage,
  costOfAttempts,
  DEFAULT_MODEL,
  DEFAULT_PLAN_LIMITS,
  decideBudget,
  decideProviderState,
  isSupportedModel,
  microsToUsd,
  type PaidUseApproval,
  type PlanUseApproval,
  PRICING_VERSION,
  type ProviderState,
  parseUsdMicros,
  validateBudgetLimits,
} from "@corniversity/ai";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Database, DbOrTx } from "../client";
import type { Env } from "../env";
import { auditEvent, budgetSetting, providerRun, providerSetting } from "../schema/index";
import { planStateInput, planUnavailableReason } from "./chatgpt-plan";
import { decryptSecret, encryptSecret, keyHint } from "./crypto";

export class ProviderSettingError extends Error {}

/**
 * Resolves which provider a learner's runs use (see `decideProviderState`): the scripted demo, a
 * live model the owner approved, the owner's ChatGPT plan (local installation only), or blocked.
 * Precedence: the owner's saved setting > environment configuration > the scripted demo. A key
 * that is stored but unreadable blocks; it never falls back to scripted responses.
 */
export async function resolveProviderState(db: DbOrTx, ownerId: string, env: Env): Promise<ProviderState> {
  const [setting] = await db.select().from(providerSetting).where(eq(providerSetting.userId, ownerId)).limit(1);
  const limits = await getBudgetLimits(db, ownerId, env);
  return decideProviderState({
    setting: setting
      ? {
          provider: setting.provider,
          keyStored: Boolean(setting.apiKeyEncrypted),
          key: setting.apiKeyEncrypted ? decryptSecret(setting.apiKeyEncrypted, env.BETTER_AUTH_SECRET) : undefined,
          model: setting.model,
          refusalFallback: setting.refusalFallback,
          approval: setting.paidUseApproval ?? null,
        }
      : null,
    env: { provider: env.AI_PROVIDER, apiKey: env.ANTHROPIC_API_KEY, defaultModel: env.AI_MODEL_DEFAULT },
    limits,
    plan: setting?.provider === "chatgpt_plan" ? await planStateInput(env, ownerId, setting) : undefined,
  });
}

export interface ProviderSettingView {
  provider: "fixture" | "anthropic" | "chatgpt_plan";
  keyHint: string | null;
  model: string;
  refusalFallback: boolean;
  approval: PaidUseApproval | null;
  planModel: string | null;
  planDailyRequests: number;
  planMonthlyRequests: number;
  planApproval: PlanUseApproval | null;
  /** Why plan requests are paused, or null. */
  planPausedReason: string | null;
}

/** What the settings page shows: never the key, only its recognisable ends. */
export async function providerSettingView(db: DbOrTx, ownerId: string, env: Env): Promise<ProviderSettingView> {
  const [setting] = await db.select().from(providerSetting).where(eq(providerSetting.userId, ownerId)).limit(1);
  return {
    provider: setting?.provider ?? (env.AI_PROVIDER === "anthropic" ? "anthropic" : "fixture"),
    keyHint: setting?.apiKeyHint ?? null,
    model: setting?.model ?? (isSupportedModel(env.AI_MODEL_DEFAULT) ? env.AI_MODEL_DEFAULT : DEFAULT_MODEL),
    refusalFallback: setting?.refusalFallback ?? true,
    approval: setting?.paidUseApproval ?? null,
    planModel: setting?.planModel ?? null,
    planDailyRequests: setting?.planDailyRequests ?? DEFAULT_PLAN_LIMITS.dailyRequests,
    planMonthlyRequests: setting?.planMonthlyRequests ?? DEFAULT_PLAN_LIMITS.monthlyRequests,
    planApproval: setting?.planUseApproval ?? null,
    planPausedReason: setting?.planPausedAt ? (setting.planPauseReason ?? "paused") : null,
  };
}

export async function saveProviderSetting(
  db: DbOrTx,
  ownerId: string,
  env: Env,
  input: {
    provider: "fixture" | "anthropic" | "chatgpt_plan";
    apiKey?: string;
    clearKey?: boolean;
    model?: string;
    refusalFallback?: boolean;
  },
): Promise<void> {
  if (input.model !== undefined && !isSupportedModel(input.model)) throw new ProviderSettingError("Choose one of the supported models.");
  if (input.provider === "chatgpt_plan") {
    const unavailable = planUnavailableReason(env);
    if (unavailable) throw new ProviderSettingError(unavailable);
  }
  const [existing] = await db.select().from(providerSetting).where(eq(providerSetting.userId, ownerId)).limit(1);
  const encrypted = input.clearKey
    ? null
    : input.apiKey
      ? encryptSecret(input.apiKey, env.BETTER_AUTH_SECRET)
      : (existing?.apiKeyEncrypted ?? null);
  const hint = input.clearKey ? null : input.apiKey ? keyHint(input.apiKey) : (existing?.apiKeyHint ?? null);
  const values = {
    provider: input.provider,
    apiKeyEncrypted: encrypted,
    apiKeyHint: hint,
    model: input.model ?? existing?.model ?? null,
    refusalFallback: input.refusalFallback ?? existing?.refusalFallback ?? true,
  };
  await db
    .insert(providerSetting)
    .values({ userId: ownerId, ...values })
    .onConflictDoUpdate({ target: providerSetting.userId, set: values });
  await db.insert(auditEvent).values({
    ownerId,
    actor: "learner",
    action: "provider:save",
    entity: "provider_setting",
    entityId: ownerId,
    details: {
      provider: values.provider,
      model: values.model,
      refusalFallback: values.refusalFallback,
      keyChanged: Boolean(input.apiKey || input.clearKey),
    },
  });
}

/**
 * Records the owner's approval of paid use for the current model, fallback setting and limits.
 * Only a live provider with a usable key can be approved; raising a limit or changing the model
 * later makes the approval stop covering the settings until it is given again.
 */
export async function approvePaidUse(db: DbOrTx, ownerId: string, env: Env): Promise<PaidUseApproval> {
  const view = await providerSettingView(db, ownerId, env);
  if (view.provider !== "anthropic") throw new ProviderSettingError("Choose a live model before approving paid use.");
  const [setting] = await db.select().from(providerSetting).where(eq(providerSetting.userId, ownerId)).limit(1);
  const key = setting?.apiKeyEncrypted ? decryptSecret(setting.apiKeyEncrypted, env.BETTER_AUTH_SECRET) : env.ANTHROPIC_API_KEY;
  if (!key) throw new ProviderSettingError("Store a readable API key before approving paid use.");
  const limits = await getBudgetLimits(db, ownerId, env);
  const approval: PaidUseApproval = {
    model: view.model,
    perRunUsd: limits.perRunUsd,
    dailyUsd: limits.dailyUsd,
    monthlyUsd: limits.monthlyUsd,
    refusalFallback: view.refusalFallback,
    approvedAt: new Date().toISOString(),
  };
  await db
    .insert(providerSetting)
    .values({ userId: ownerId, provider: "anthropic", model: view.model, paidUseApproval: approval })
    .onConflictDoUpdate({ target: providerSetting.userId, set: { paidUseApproval: approval, model: view.model } });
  await db.insert(auditEvent).values({
    ownerId,
    actor: "learner",
    action: "provider:approve-paid-use",
    entity: "provider_setting",
    entityId: ownerId,
    details: { ...approval },
  });
  return approval;
}

export async function withdrawPaidUseApproval(db: DbOrTx, ownerId: string): Promise<void> {
  await db.update(providerSetting).set({ paidUseApproval: null }).where(eq(providerSetting.userId, ownerId));
  await db.insert(auditEvent).values({
    ownerId,
    actor: "learner",
    action: "provider:withdraw-approval",
    entity: "provider_setting",
    entityId: ownerId,
    details: {},
  });
}

export interface BudgetLimitsRow {
  perRunUsd: number;
  dailyUsd: number;
  monthlyUsd: number;
  warnFraction: number;
}

export async function getBudgetLimits(db: DbOrTx, ownerId: string, env: Env): Promise<BudgetLimitsRow> {
  const [row] = await db.select().from(budgetSetting).where(eq(budgetSetting.userId, ownerId)).limit(1);
  if (!row) {
    return {
      perRunUsd: env.AI_BUDGET_PER_RUN_USD,
      dailyUsd: env.AI_BUDGET_DAILY_USD,
      monthlyUsd: env.AI_BUDGET_MONTHLY_USD,
      warnFraction: 0.8,
    };
  }
  return {
    perRunUsd: Number(row.perRunUsd),
    dailyUsd: Number(row.dailyUsd),
    monthlyUsd: Number(row.monthlyUsd),
    warnFraction: row.warnFraction,
  };
}

/** Saves validated limits (finite, positive, within the ceilings, nested). Every limit is a hard stop. */
export async function saveBudgetLimits(
  db: DbOrTx,
  ownerId: string,
  input: { perRunUsd: number; dailyUsd: number; monthlyUsd: number },
): Promise<BudgetLimitsRow> {
  const limits = validateBudgetLimits(input);
  const values = {
    perRunUsd: String(limits.perRunUsd),
    dailyUsd: String(limits.dailyUsd),
    monthlyUsd: String(limits.monthlyUsd),
    hardStop: true,
  };
  await db
    .insert(budgetSetting)
    .values({ userId: ownerId, ...values })
    .onConflictDoUpdate({ target: budgetSetting.userId, set: values });
  return { ...limits, warnFraction: 0.8 };
}

/** Statuses that hold a run's worst case against the limits instead of what it is known to have cost. */
export const HELD_STATUSES = ["running", "unsettled"] as const;

/**
 * Spend for budget decisions, by UTC day and month (a run counts in the window it started in):
 * what finished runs cost, plus the worst case of every run still running or unsettled (a run
 * whose cost is not known keeps counting at its worst case until it is settled). The sums are
 * exact decimals from the database, carried as micro-dollars. Scripted runs cost nothing.
 */
export async function getSpend(db: DbOrTx, ownerId: string, now = new Date()): Promise<{ todayUsd: number; monthUsd: number }> {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const spent = sql<string>`coalesce(sum(case when ${providerRun.status} in ('running', 'unsettled') then greatest(coalesce(${providerRun.worstCaseUsd}, 0), ${providerRun.costUsd}) else ${providerRun.costUsd} end), 0)::text`;
  const [today] = await db
    .select({ total: spent })
    .from(providerRun)
    .where(and(eq(providerRun.ownerId, ownerId), gte(providerRun.startedAt, startOfDay)));
  const [month] = await db
    .select({ total: spent })
    .from(providerRun)
    .where(and(eq(providerRun.ownerId, ownerId), gte(providerRun.startedAt, startOfMonth)));
  return { todayUsd: microsToUsd(parseUsdMicros(today?.total ?? "0")), monthUsd: microsToUsd(parseUsdMicros(month?.total ?? "0")) };
}

/**
 * A run's outcome. "running" marks a live run in progress; "unsettled" a run whose provider may
 * have billed more than is known. Both hold their worst case against the limits.
 */
export type RunStatus = "ok" | "error" | "refused" | "budget_blocked" | "blocked" | "running" | "unsettled";

/**
 * Decides a live run against the limits and, when it may start, records it as running with its
 * worst case. One owner's runs are decided one at a time under a database lock, and each counts
 * every run still in progress at its worst case, so runs started together cannot cross a limit
 * between them.
 */
export async function reserveLiveRun(
  db: DbOrTx,
  input: {
    ownerId: string;
    env: Env;
    role: string;
    model: string;
    purpose: string;
    promptVersion: string;
    worstCaseUsd: number;
    roleCapUsd: number;
    /** Identifies one provider call; a second reservation under the same key is refused. */
    idempotencyKey?: string;
    parentRunId?: string;
  },
): Promise<
  { allowed: false; reason: string; warnings: string[]; duplicate?: boolean } | { allowed: true; warnings: string[]; runId: string }
> {
  // A transaction on the handle, or a savepoint when the handle already is one.
  return (db as Database).transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`provider-budget:${input.ownerId}`}))`);
    if (input.idempotencyKey) {
      const [existing] = await tx
        .select({ id: providerRun.id })
        .from(providerRun)
        .where(eq(providerRun.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing) {
        return { allowed: false as const, duplicate: true, reason: "This call has already been made or is in progress.", warnings: [] };
      }
    }
    const decision = decideBudget(
      await getBudgetLimits(tx, input.ownerId, input.env),
      await getSpend(tx, input.ownerId),
      input.worstCaseUsd,
      input.roleCapUsd,
    );
    if (!decision.allowed) return decision;
    const [row] = await tx
      .insert(providerRun)
      .values({
        ownerId: input.ownerId,
        role: input.role,
        provider: "anthropic",
        model: input.model,
        purpose: input.purpose,
        pricingVersion: PRICING_VERSION,
        promptVersion: input.promptVersion,
        status: "running",
        worstCaseUsd: String(input.worstCaseUsd),
        idempotencyKey: input.idempotencyKey ?? null,
        parentRunId: input.parentRunId ?? null,
      })
      .returning({ id: providerRun.id });
    return { allowed: true as const, warnings: decision.warnings, runId: row!.id };
  });
}

/**
 * Records one run: its status, every attempt with its own usage and cost (a fallback model that
 * took over is billed at its own rates), and the worst case the gate checked beforehand.
 */
export async function recordProviderRun(
  db: DbOrTx,
  input: {
    ownerId: string;
    role: string;
    provider: "fixture" | "anthropic" | "chatgpt_plan";
    model: string;
    purpose: string;
    pricingVersion: string;
    promptVersion: string;
    status: RunStatus;
    error?: string | null;
    attempts: readonly AttemptUsage[];
    worstCaseUsd?: number | null;
    startedAt: Date;
  },
): Promise<string> {
  const [row] = await db
    .insert(providerRun)
    .values({
      ownerId: input.ownerId,
      role: input.role,
      provider: input.provider,
      model: input.model,
      purpose: input.purpose,
      ...usageColumns(input.attempts),
      pricingVersion: input.pricingVersion,
      promptVersion: input.promptVersion,
      status: input.status,
      error: input.error ?? null,
      worstCaseUsd: input.worstCaseUsd === undefined || input.worstCaseUsd === null ? null : String(input.worstCaseUsd),
      startedAt: input.startedAt,
      finishedAt: new Date(),
    })
    .returning({ id: providerRun.id });
  return row!.id;
}

/**
 * Completes a reserved live run with what happened: its status, the model that answered and every
 * attempt priced at its own model. From then on the run counts at what it cost, not its worst case
 * - unless it finishes as "unsettled", when the attempts are a lower bound and the worst case
 * keeps counting until the owner settles it.
 */
export async function finishProviderRun(
  db: DbOrTx,
  runId: string,
  input: { status: Exclude<RunStatus, "running">; model: string; error?: string | null; attempts: readonly AttemptUsage[] },
): Promise<void> {
  const [run] = await db.select({ provider: providerRun.provider }).from(providerRun).where(eq(providerRun.id, runId)).limit(1);
  // A request through the owner's ChatGPT plan is not billed per request here: it costs $0 and
  // never counts against the dollar limits (the unknown-model rule would price it at the dearest rate).
  const plan = run?.provider === "chatgpt_plan";
  const usage = usageColumns(input.attempts, !plan);
  // An uncertain failure of a plan request has no amount to settle: it is simply an error.
  const status = plan && input.status === "unsettled" ? "error" : input.status;
  await db
    .update(providerRun)
    .set({ status, model: input.model, error: input.error ?? null, ...usage, finishedAt: new Date() })
    .where(and(eq(providerRun.id, runId), eq(providerRun.status, "running")));
}

/** A run's usage columns: every attempt priced at its own model (or at nothing), and the totals. */
function usageColumns(attempts: readonly AttemptUsage[], billed = true) {
  const priced = attempts.map((a) => ({ ...a, costUsd: billed ? costOfAttempts([a]) : 0 }));
  const total = priced.reduce(
    (s, a) => ({
      inputTokens: s.inputTokens + a.inputTokens,
      outputTokens: s.outputTokens + a.outputTokens,
      cacheReadTokens: s.cacheReadTokens + a.cacheReadTokens,
      cacheWriteTokens: s.cacheWriteTokens + a.cacheWriteTokens,
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  );
  return { attempts: priced, ...total, costUsd: String(billed ? costOfAttempts(attempts) : 0) };
}

/**
 * Runs still marked running long after any request could have lasted (the provider's own timeout
 * is ten minutes) belong to a process that ended mid-run. Their cost is unknown, so they become
 * unsettled and keep holding their worst case; nothing about them is released as free.
 */
export async function markStaleRunsUnsettled(db: DbOrTx, now = new Date(), maxAgeMs = 30 * 60 * 1000): Promise<number> {
  const stale = and(eq(providerRun.status, "running"), lt(providerRun.startedAt, new Date(now.getTime() - maxAgeMs)));
  // A request through the owner's ChatGPT plan has no dollar cost to settle; it simply failed.
  await db
    .update(providerRun)
    .set({ status: "error", error: "The process making this request ended before it finished.", finishedAt: now })
    .where(and(stale, eq(providerRun.provider, "chatgpt_plan")));
  const rows = await db
    .update(providerRun)
    .set({
      status: "unsettled",
      error: "The process making this run ended before recording what it cost. It is held at its worst case until settled.",
      finishedAt: now,
    })
    .where(stale)
    .returning({ id: providerRun.id, ownerId: providerRun.ownerId });
  for (const r of rows) {
    await db.insert(auditEvent).values({
      ownerId: r.ownerId,
      actor: "system",
      action: "provider:run-unsettled",
      entity: "provider_run",
      entityId: r.id,
      details: { reason: "stale running run" },
    });
  }
  return rows.length;
}

export class SettlementError extends Error {}

/**
 * Settles an unsettled run with the amount the owner read in the provider console for it. The
 * amount may not be negative and may not exceed the worst case the run was admitted under (a
 * larger charge would mean the bound was wrong, which is refused and must be reported rather
 * than accepted silently). The settlement is kept with the run and in the audit log.
 */
export async function settleUnsettledRun(
  db: DbOrTx,
  ownerId: string,
  runId: string,
  input: { amountUsd: number; note: string },
): Promise<void> {
  if (!Number.isFinite(input.amountUsd) || input.amountUsd < 0)
    throw new SettlementError("Enter the amount as a number of dollars, 0 or more.");
  const note = input.note.trim();
  if (note.length < 5) throw new SettlementError("Say where the amount comes from (for example, the console's usage page).");
  const [run] = await db
    .select()
    .from(providerRun)
    .where(and(eq(providerRun.id, runId), eq(providerRun.ownerId, ownerId)))
    .limit(1);
  if (!run) throw new SettlementError("Run not found.");
  if (run.status !== "unsettled") throw new SettlementError("Only an unsettled run can be settled.");
  const amountMicros = Math.round(input.amountUsd * 1_000_000);
  if (amountMicros > parseUsdMicros(run.worstCaseUsd)) {
    throw new SettlementError(
      "That is more than this run's worst case, which should not be possible. Nothing was changed; please report it, since the bound would need correcting.",
    );
  }
  const amountUsd = microsToUsd(amountMicros).toFixed(6);
  const settlement = { method: "owner_recorded" as const, amountUsd, note: note.slice(0, 500), at: new Date().toISOString() };
  await db
    .update(providerRun)
    .set({ status: "ok", costUsd: amountUsd, settlement })
    .where(and(eq(providerRun.id, runId), eq(providerRun.status, "unsettled")));
  await db.insert(auditEvent).values({
    ownerId,
    actor: "learner",
    action: "provider:settle-run",
    entity: "provider_run",
    entityId: runId,
    details: { ...settlement, worstCaseUsd: run.worstCaseUsd, lowerBoundUsd: run.costUsd },
  });
}

export async function listUnsettledRuns(db: DbOrTx, ownerId: string) {
  return db
    .select()
    .from(providerRun)
    .where(and(eq(providerRun.ownerId, ownerId), eq(providerRun.status, "unsettled")))
    .orderBy(desc(providerRun.startedAt));
}

export async function listRecentRuns(db: DbOrTx, ownerId: string, limit = 15) {
  return db.select().from(providerRun).where(eq(providerRun.ownerId, ownerId)).orderBy(desc(providerRun.startedAt)).limit(limit);
}

/** Who produced each run, so a stored reply keeps the label of what actually wrote it. */
export async function runProducers(db: DbOrTx, runIds: string[]): Promise<Map<string, { provider: string; model: string }>> {
  const ids = [...new Set(runIds)];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: providerRun.id, provider: providerRun.provider, model: providerRun.model })
    .from(providerRun)
    .where(inArray(providerRun.id, ids));
  return new Map(rows.map((r) => [r.id, { provider: r.provider, model: r.model }]));
}
