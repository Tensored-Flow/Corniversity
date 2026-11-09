import {
  type AttemptUsage,
  costOfAttempts,
  DEFAULT_MODEL,
  decideProviderState,
  isSupportedModel,
  type PaidUseApproval,
  type ProviderState,
  validateBudgetLimits,
} from "@corniversity/ai";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { DbOrTx } from "../client";
import type { Env } from "../env";
import { auditEvent, budgetSetting, providerRun, providerSetting } from "../schema/index";
import { decryptSecret, encryptSecret, keyHint } from "./crypto";

export class ProviderSettingError extends Error {}

/**
 * Resolves which provider a learner's runs use (see `decideProviderState`): the scripted demo, a
 * live model the owner approved, or blocked. Precedence: the owner's saved setting > environment
 * configuration > the scripted demo. A key that is stored but unreadable blocks; it never falls
 * back to scripted responses.
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
  });
}

export interface ProviderSettingView {
  provider: "fixture" | "anthropic";
  keyHint: string | null;
  model: string;
  refusalFallback: boolean;
  approval: PaidUseApproval | null;
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
  };
}

export async function saveProviderSetting(
  db: DbOrTx,
  ownerId: string,
  env: Env,
  input: { provider: "fixture" | "anthropic"; apiKey?: string; clearKey?: boolean; model?: string; refusalFallback?: boolean },
): Promise<void> {
  if (input.model !== undefined && !isSupportedModel(input.model)) throw new ProviderSettingError("Choose one of the supported models.");
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

/** Recorded spend for budget decisions, by UTC day and month. Scripted runs cost nothing. */
export async function getSpend(db: DbOrTx, ownerId: string, now = new Date()): Promise<{ todayUsd: number; monthUsd: number }> {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [today] = await db
    .select({ total: sql<string>`coalesce(sum(${providerRun.costUsd}), 0)` })
    .from(providerRun)
    .where(and(eq(providerRun.ownerId, ownerId), gte(providerRun.startedAt, startOfDay)));
  const [month] = await db
    .select({ total: sql<string>`coalesce(sum(${providerRun.costUsd}), 0)` })
    .from(providerRun)
    .where(and(eq(providerRun.ownerId, ownerId), gte(providerRun.startedAt, startOfMonth)));
  return { todayUsd: Number(today?.total ?? 0), monthUsd: Number(month?.total ?? 0) };
}

export type RunStatus = "ok" | "error" | "refused" | "budget_blocked" | "blocked";

/**
 * Records one run: its status, every attempt with its own usage and cost (a fallback model that
 * took over is billed at its own rates), and the worst case the gate checked beforehand.
 */
export async function recordProviderRun(
  db: DbOrTx,
  input: {
    ownerId: string;
    role: string;
    provider: "fixture" | "anthropic";
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
  const attempts = input.attempts.map((a) => ({ ...a, costUsd: costOfAttempts([a]) }));
  const total = attempts.reduce(
    (s, a) => ({
      inputTokens: s.inputTokens + a.inputTokens,
      outputTokens: s.outputTokens + a.outputTokens,
      cacheReadTokens: s.cacheReadTokens + a.cacheReadTokens,
      cacheWriteTokens: s.cacheWriteTokens + a.cacheWriteTokens,
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  );
  const [row] = await db
    .insert(providerRun)
    .values({
      ownerId: input.ownerId,
      role: input.role,
      provider: input.provider,
      model: input.model,
      purpose: input.purpose,
      ...total,
      costUsd: String(costOfAttempts(input.attempts)),
      pricingVersion: input.pricingVersion,
      promptVersion: input.promptVersion,
      status: input.status,
      error: input.error ?? null,
      attempts,
      worstCaseUsd: input.worstCaseUsd === undefined || input.worstCaseUsd === null ? null : String(input.worstCaseUsd),
      startedAt: input.startedAt,
      finishedAt: new Date(),
    })
    .returning({ id: providerRun.id });
  return row!.id;
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
