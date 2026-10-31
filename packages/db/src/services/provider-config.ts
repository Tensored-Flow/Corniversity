import { and, eq, gte, sql } from "drizzle-orm";
import type { DbOrTx } from "../client";
import type { Env } from "../env";
import { budgetSetting, providerRun, providerSetting } from "../schema/index";
import { decryptSecret, encryptSecret, keyHint } from "./crypto";

export interface ResolvedProviderConfig {
  provider: "fixture" | "anthropic";
  anthropicApiKey?: string;
  defaultModel: string;
  modelMap: Record<string, string>;
  /** Where the configuration came from, for the settings screen. */
  source: "owner_setting" | "environment" | "default";
  keyConfigured: boolean;
}

/**
 * Resolves which provider a learner's runs use. Precedence: the owner's saved setting (with an
 * encrypted key) > environment configuration > fixture. A live provider is only reported when a
 * key is actually present.
 */
export async function resolveProviderConfig(db: DbOrTx, ownerId: string, env: Env): Promise<ResolvedProviderConfig> {
  const [setting] = await db.select().from(providerSetting).where(eq(providerSetting.userId, ownerId)).limit(1);
  const ownerKey = setting?.apiKeyEncrypted ? decryptSecret(setting.apiKeyEncrypted, env.BETTER_AUTH_SECRET) : undefined;
  if (setting?.provider === "anthropic" && ownerKey) {
    return {
      provider: "anthropic",
      anthropicApiKey: ownerKey,
      defaultModel: env.AI_MODEL_DEFAULT,
      modelMap: setting.modelMap,
      source: "owner_setting",
      keyConfigured: true,
    };
  }
  if (env.AI_PROVIDER === "anthropic" && env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      defaultModel: env.AI_MODEL_DEFAULT,
      modelMap: setting?.modelMap ?? {},
      source: "environment",
      keyConfigured: true,
    };
  }
  return {
    provider: "fixture",
    defaultModel: env.AI_MODEL_DEFAULT,
    modelMap: setting?.modelMap ?? {},
    source: setting ? "owner_setting" : "default",
    keyConfigured: false,
  };
}

export async function saveProviderSetting(
  db: DbOrTx,
  ownerId: string,
  env: Env,
  input: { provider: "fixture" | "anthropic"; apiKey?: string; clearKey?: boolean; modelMap?: Record<string, string> },
): Promise<void> {
  const [existing] = await db.select().from(providerSetting).where(eq(providerSetting.userId, ownerId)).limit(1);
  const encrypted = input.clearKey
    ? null
    : input.apiKey
      ? encryptSecret(input.apiKey, env.BETTER_AUTH_SECRET)
      : (existing?.apiKeyEncrypted ?? null);
  const hint = input.clearKey ? null : input.apiKey ? keyHint(input.apiKey) : (existing?.apiKeyHint ?? null);
  await db
    .insert(providerSetting)
    .values({
      userId: ownerId,
      provider: input.provider,
      apiKeyEncrypted: encrypted,
      apiKeyHint: hint,
      modelMap: input.modelMap ?? existing?.modelMap ?? {},
    })
    .onConflictDoUpdate({
      target: providerSetting.userId,
      set: { provider: input.provider, apiKeyEncrypted: encrypted, apiKeyHint: hint, modelMap: input.modelMap ?? existing?.modelMap ?? {} },
    });
}

export interface BudgetLimitsRow {
  perRunUsd: number;
  dailyUsd: number;
  monthlyUsd: number;
  hardStop: boolean;
  warnFraction: number;
}

export async function getBudgetLimits(db: DbOrTx, ownerId: string, env: Env): Promise<BudgetLimitsRow> {
  const [row] = await db.select().from(budgetSetting).where(eq(budgetSetting.userId, ownerId)).limit(1);
  if (!row) {
    return {
      perRunUsd: env.AI_BUDGET_PER_RUN_USD,
      dailyUsd: env.AI_BUDGET_DAILY_USD,
      monthlyUsd: env.AI_BUDGET_MONTHLY_USD,
      hardStop: true,
      warnFraction: 0.8,
    };
  }
  return {
    perRunUsd: Number(row.perRunUsd),
    dailyUsd: Number(row.dailyUsd),
    monthlyUsd: Number(row.monthlyUsd),
    hardStop: row.hardStop,
    warnFraction: row.warnFraction,
  };
}

export async function saveBudgetLimits(db: DbOrTx, ownerId: string, limits: BudgetLimitsRow): Promise<void> {
  await db
    .insert(budgetSetting)
    .values({
      userId: ownerId,
      perRunUsd: String(limits.perRunUsd),
      dailyUsd: String(limits.dailyUsd),
      monthlyUsd: String(limits.monthlyUsd),
      hardStop: limits.hardStop,
      warnFraction: limits.warnFraction,
    })
    .onConflictDoUpdate({
      target: budgetSetting.userId,
      set: {
        perRunUsd: String(limits.perRunUsd),
        dailyUsd: String(limits.dailyUsd),
        monthlyUsd: String(limits.monthlyUsd),
        hardStop: limits.hardStop,
        warnFraction: limits.warnFraction,
      },
    });
}

/** Recorded spend for budget decisions. Fixture runs cost nothing and are excluded by price. */
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
