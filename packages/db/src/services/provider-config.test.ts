import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { getEnv } from "../env";
import { user } from "../schema/auth";
import { auditEvent, budgetSetting, providerRun, providerSetting } from "../schema/index";
import { planRun } from "./ai-runs";
import { encryptSecret } from "./crypto";
import {
  approvePaidUse,
  getSpend,
  ProviderSettingError,
  recordProviderRun,
  resolveProviderState,
  saveBudgetLimits,
  saveProviderSetting,
  withdrawPaidUseApproval,
} from "./provider-config";

/**
 * Provider configuration against PostgreSQL: the scripted demo by default; a live model only
 * with a readable key, a supported model and the owner's approval of the current limits; a
 * blocked state, never a scripted fallback, otherwise; hard, validated limits; and runs recorded
 * with each attempt priced at its own model.
 */
const OWNER = `provider-owner-${randomUUID()}`;
const KEY = "sk-ant-integration-test-0000000000";
let handle: ReturnType<typeof createDb>;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  await handle.db
    .insert(user)
    .values({ id: OWNER, name: "Provider Test", email: `${OWNER}@example.test` })
    .onConflictDoNothing();
});

afterAll(async () => {
  for (const table of [providerRun, auditEvent]) await handle.db.delete(table).where(eq(table.ownerId, OWNER));
  await handle.db.delete(providerSetting).where(eq(providerSetting.userId, OWNER));
  await handle.db.delete(budgetSetting).where(eq(budgetSetting.userId, OWNER));
  await handle.db.delete(user).where(eq(user.id, OWNER));
  await handle.close();
});

describe("which provider answers", () => {
  it("is the scripted demo when nothing is configured, at no cost", async () => {
    expect(await resolveProviderState(handle.db, OWNER, getEnv())).toEqual({ mode: "scripted", reason: "not_configured" });
    const plan = await planRun(handle.db, OWNER, getEnv(), "tutor", "A question.");
    expect(plan.kind).toBe("scripted");
    if (plan.kind === "scripted") expect(plan.provider.name).toBe("fixture");
  });

  it("refuses an identifier outside the supported models", async () => {
    await expect(saveProviderSetting(handle.db, OWNER, getEnv(), { provider: "anthropic", model: "claude-imaginary-9" })).rejects.toThrow(
      ProviderSettingError,
    );
  });

  it("blocks a live model without a key, then without approval; it never falls back to scripted replies", async () => {
    await saveBudgetLimits(handle.db, OWNER, { perRunUsd: 1, dailyUsd: 3, monthlyUsd: 40 });
    await saveProviderSetting(handle.db, OWNER, getEnv(), { provider: "anthropic", model: "claude-opus-5-5", refusalFallback: true });
    expect(await resolveProviderState(handle.db, OWNER, getEnv())).toMatchObject({ mode: "blocked", code: "no_key" });
    await saveProviderSetting(handle.db, OWNER, getEnv(), { provider: "anthropic", apiKey: KEY });
    expect(await resolveProviderState(handle.db, OWNER, getEnv())).toMatchObject({ mode: "blocked", code: "not_approved" });
    const plan = await planRun(handle.db, OWNER, getEnv(), "tutor", "A question.");
    expect(plan).toMatchObject({ kind: "refused", status: "blocked" });
  });

  it("is live once paid use is approved, and the approval records the model and limits", async () => {
    const approval = await approvePaidUse(handle.db, OWNER, getEnv());
    expect(approval).toMatchObject({ model: "claude-opus-5-5", perRunUsd: 1, dailyUsd: 3, monthlyUsd: 40, refusalFallback: true });
    expect(await resolveProviderState(handle.db, OWNER, getEnv())).toMatchObject({
      mode: "live",
      model: "claude-opus-5-5",
      source: "owner_setting",
    });
    const audits = await handle.db.select().from(auditEvent).where(eq(auditEvent.ownerId, OWNER));
    expect(audits.some((a) => a.action === "provider:approve-paid-use")).toBe(true);
  });

  it("needs approval again after a limit is raised, but not after one is lowered", async () => {
    await saveBudgetLimits(handle.db, OWNER, { perRunUsd: 1, dailyUsd: 4, monthlyUsd: 40 });
    expect(await resolveProviderState(handle.db, OWNER, getEnv())).toMatchObject({ mode: "blocked", code: "approval_outdated" });
    await saveBudgetLimits(handle.db, OWNER, { perRunUsd: 1, dailyUsd: 2, monthlyUsd: 40 });
    expect((await resolveProviderState(handle.db, OWNER, getEnv())).mode).toBe("live");
  });

  it("blocks when the stored key can no longer be read with the server secret", async () => {
    const [before] = await handle.db.select().from(providerSetting).where(eq(providerSetting.userId, OWNER));
    await handle.db
      .update(providerSetting)
      .set({ apiKeyEncrypted: encryptSecret(KEY, "a-different-secret-a-different-secret-12") })
      .where(eq(providerSetting.userId, OWNER));
    expect(await resolveProviderState(handle.db, OWNER, getEnv())).toMatchObject({ mode: "blocked", code: "key_unreadable" });
    await handle.db.update(providerSetting).set({ apiKeyEncrypted: before!.apiKeyEncrypted }).where(eq(providerSetting.userId, OWNER));
    expect((await resolveProviderState(handle.db, OWNER, getEnv())).mode).toBe("live");
  });
});

describe("limits", () => {
  it("are validated and stored as hard stops", async () => {
    await expect(saveBudgetLimits(handle.db, OWNER, { perRunUsd: 0, dailyUsd: 3, monthlyUsd: 40 })).rejects.toThrow();
    await expect(saveBudgetLimits(handle.db, OWNER, { perRunUsd: 1, dailyUsd: 3, monthlyUsd: 10_000 })).rejects.toThrow();
    const [row] = await handle.db.select().from(budgetSetting).where(eq(budgetSetting.userId, OWNER));
    expect(row?.hardStop).toBe(true);
  });

  it("refuse a live run whose worst case could cross a limit, before anything is sent", async () => {
    await saveBudgetLimits(handle.db, OWNER, { perRunUsd: 0.01, dailyUsd: 0.01, monthlyUsd: 0.01 });
    const plan = await planRun(handle.db, OWNER, getEnv(), "tutor", "x".repeat(30_000));
    expect(plan).toMatchObject({ kind: "refused", status: "budget_blocked" });
    if (plan.kind === "refused") {
      expect(plan.reason).toMatch(/per-run limit/);
      expect(plan.worstCaseUsd).toBeGreaterThan(0.01);
    }
  });
});

describe("recording runs", () => {
  it("prices each attempt at its own model and counts the total towards spend", async () => {
    const before = await getSpend(handle.db, OWNER);
    const id = await recordProviderRun(handle.db, {
      ownerId: OWNER,
      role: "tutor",
      provider: "anthropic",
      model: "claude-opus-4-8",
      purpose: "tutor-turn",
      pricingVersion: "test",
      promptVersion: "test",
      status: "ok",
      attempts: [
        { kind: "message", model: "claude-opus-5-5", inputTokens: 1000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        {
          kind: "fallback_message",
          model: "claude-opus-4-8",
          inputTokens: 1000,
          outputTokens: 1000,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      ],
      worstCaseUsd: 0.2,
      startedAt: new Date(),
    });
    const [row] = await handle.db.select().from(providerRun).where(eq(providerRun.id, id));
    // 1000 at $4/M, then 1000 at $5/M and 1000 at $25/M.
    expect(Number(row!.costUsd)).toBeCloseTo(0.034, 9);
    expect(row!.attempts.map((a) => a.costUsd)).toEqual([0.004, 0.03]);
    expect(row!.inputTokens).toBe(2000);
    expect(Number(row!.worstCaseUsd)).toBe(0.2);
    expect((await getSpend(handle.db, OWNER)).todayUsd).toBeCloseTo(before.todayUsd + 0.034, 9);
  });

  it("withdrawing approval blocks the live model again", async () => {
    await withdrawPaidUseApproval(handle.db, OWNER);
    expect(await resolveProviderState(handle.db, OWNER, getEnv())).toMatchObject({ mode: "blocked", code: "not_approved" });
  });
});
