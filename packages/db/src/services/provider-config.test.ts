import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { getEnv } from "../env";
import { user } from "../schema/auth";
import { auditEvent, budgetSetting, providerRun, providerSetting } from "../schema/index";
import { planRun } from "./ai-runs";
import { encryptSecret } from "./crypto";
import {
  approvePaidUse,
  finishProviderRun,
  getSpend,
  markStaleRunsUnsettled,
  ProviderSettingError,
  recordProviderRun,
  resolveProviderState,
  SettlementError,
  saveBudgetLimits,
  saveProviderSetting,
  settleUnsettledRun,
  withdrawPaidUseApproval,
} from "./provider-config";

/**
 * Provider configuration against PostgreSQL: the scripted demo by default; a live model only
 * with a readable key, a supported model and the owner's approval of the current limits; a
 * blocked state, never a scripted fallback, otherwise; hard, validated limits; and runs recorded
 * with each attempt priced at its own model.
 */
const OWNER = `provider-owner-${randomUUID()}`;
const Q = { text: "A question.", messages: 1 };
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
    const plan = await planRun(handle.db, OWNER, getEnv(), "tutor", Q, { purpose: "tutor-turn", promptVersion: "test" });
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
    const plan = await planRun(handle.db, OWNER, getEnv(), "tutor", Q, { purpose: "tutor-turn", promptVersion: "test" });
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
  it("are validated before they are stored", async () => {
    await expect(saveBudgetLimits(handle.db, OWNER, { perRunUsd: 0, dailyUsd: 3, monthlyUsd: 40 })).rejects.toThrow();
    await expect(saveBudgetLimits(handle.db, OWNER, { perRunUsd: 1, dailyUsd: 3, monthlyUsd: 10_000 })).rejects.toThrow();
  });

  it("refuse a live run whose worst case could cross a limit, before anything is sent", async () => {
    await saveBudgetLimits(handle.db, OWNER, { perRunUsd: 0.01, dailyUsd: 0.01, monthlyUsd: 0.01 });
    const plan = await planRun(
      handle.db,
      OWNER,
      getEnv(),
      "tutor",
      { text: "x".repeat(30_000), messages: 1 },
      { purpose: "tutor-turn", promptVersion: "test" },
    );
    expect(plan).toMatchObject({ kind: "refused", status: "budget_blocked" });
    if (plan.kind === "refused") {
      expect(plan.reason).toMatch(/per-run limit/);
      expect(plan.worstCaseUsd).toBeGreaterThan(0.01);
    }
  });
});

describe("spend, runs in progress and runs started together", () => {
  const SPENDER = `provider-spender-${randomUUID()}`;
  const meta = { purpose: "tutor-turn", promptVersion: "test" };
  const plan = () => planRun(handle.db, SPENDER, getEnv(), "tutor", Q, meta);
  // The tutor on Claude Opus 5.5 with fallback. The prompt bound is 11 bytes + 16 + 64 framing = 91
  // tokens: 91*$5/M + 8000*$20/M, plus the fallback (91 + 8000)*$6.25/M + 8000*$25/M, rounded up
  // to the micro-dollar: 0.000455 + 0.16 + 0.05056875 + 0.2 = 0.41102375 -> 0.411024.
  const TUTOR_WORST = 0.411024;
  const finish = (runId: string, outputTokens: number) =>
    finishProviderRun(handle.db, runId, {
      status: "ok",
      model: "claude-opus-5-5",
      attempts: [{ kind: "message", model: "claude-opus-5-5", inputTokens: 1000, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 }],
    });

  beforeAll(async () => {
    await handle.db.insert(user).values({ id: SPENDER, name: "Spend Test", email: `${SPENDER}@example.test` });
    await saveBudgetLimits(handle.db, SPENDER, { perRunUsd: 1, dailyUsd: 1, monthlyUsd: 40 });
    await saveProviderSetting(handle.db, SPENDER, getEnv(), {
      provider: "anthropic",
      model: "claude-opus-5-5",
      apiKey: KEY,
      refusalFallback: true,
    });
    await approvePaidUse(handle.db, SPENDER, getEnv());
  });

  afterAll(async () => {
    for (const table of [providerRun, auditEvent]) await handle.db.delete(table).where(eq(table.ownerId, SPENDER));
    await handle.db.delete(providerSetting).where(eq(providerSetting.userId, SPENDER));
    await handle.db.delete(budgetSetting).where(eq(budgetSetting.userId, SPENDER));
    await handle.db.delete(user).where(eq(user.id, SPENDER));
  });

  it("holds a run in progress at its worst case until it finishes, then counts what it cost", async () => {
    const first = await plan();
    const second = await plan();
    if (first.kind !== "live" || second.kind !== "live") throw new Error("expected two live runs");
    expect(first.worstCaseUsd).toBeCloseTo(TUTOR_WORST, 6);
    expect((await getSpend(handle.db, SPENDER)).todayUsd).toBeCloseTo(2 * TUTOR_WORST, 6);
    // A third would make three worst cases in progress: more than today's $1.
    expect(await plan()).toMatchObject({ kind: "refused", status: "budget_blocked" });
    // 1000*$4/M + 500*$20/M = $0.014.
    await finish(first.runId, 500);
    expect((await getSpend(handle.db, SPENDER)).todayUsd).toBeCloseTo(0.014 + TUTOR_WORST, 6);
    await finishProviderRun(handle.db, second.runId, { status: "error", model: "claude-opus-5-5", error: "failed", attempts: [] });
    expect((await getSpend(handle.db, SPENDER)).todayUsd).toBeCloseTo(0.014, 6);
    const [row] = await handle.db.select().from(providerRun).where(eq(providerRun.id, first.runId));
    expect(row).toMatchObject({ status: "ok", purpose: "tutor-turn", outputTokens: 500 });
    expect(row!.finishedAt).not.toBeNull();
  });

  it("waits while another decision on the same owner's limits holds the lock", async () => {
    const other = createDb(process.env.DATABASE_URL!, { max: 1 });
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let transaction: Promise<void> = Promise.resolve();
    await new Promise<void>((locked) => {
      transaction = other.db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`provider-budget:${SPENDER}`}))`);
        locked();
        await held;
      });
    });
    let settled = false;
    const pending = plan().then((p) => {
      settled = true;
      return p;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(settled).toBe(false);
    release();
    await transaction;
    const decided = await pending;
    if (decided.kind !== "live") throw new Error("expected a live run once the lock was released");
    await finish(decided.runId, 0);
    await other.close();
  });

  it("counts runs started together against the limit: two fit, the third is refused", async () => {
    // About $0.98 of today's $1 is left: room for two worst cases, not three.
    const wide = createDb(process.env.DATABASE_URL!, { max: 3 });
    const plans = await Promise.all([1, 2, 3].map(() => planRun(wide.db, SPENDER, getEnv(), "tutor", Q, meta)));
    await wide.close();
    const live = plans.filter((p) => p.kind === "live");
    expect(live).toHaveLength(2);
    expect(plans.filter((p) => p.kind === "refused")).toHaveLength(1);
    for (const p of live) if (p.kind === "live") await finish(p.runId, 0);
  });

  it("refuses a run once recorded spend leaves too little of today's limit", async () => {
    await recordProviderRun(handle.db, {
      ownerId: SPENDER,
      role: "tutor",
      provider: "anthropic",
      model: "claude-opus-5-5",
      purpose: "tutor-turn",
      pricingVersion: "test",
      promptVersion: "test",
      status: "ok",
      // 30000*$20/M = $0.60, leaving less than a worst case of today's $1.
      attempts: [
        { kind: "message", model: "claude-opus-5-5", inputTokens: 0, outputTokens: 30_000, cacheReadTokens: 0, cacheWriteTokens: 0 },
      ],
      worstCaseUsd: 0.7,
      startedAt: new Date(),
    });
    const refused = await plan();
    expect(refused).toMatchObject({ kind: "refused", status: "budget_blocked" });
    if (refused.kind === "refused") expect(refused.reason).toMatch(/Today's limit/);
  });

  it("has no soft mode: a stored row that once switched the hard stop off still refuses", async () => {
    await handle.db.update(budgetSetting).set({ hardStop: false }).where(eq(budgetSetting.userId, SPENDER));
    expect(await plan()).toMatchObject({ kind: "refused", status: "budget_blocked" });
  });
});

describe("unsettled runs, settlement, duplicate calls and the UTC windows", () => {
  const SETTLER = `provider-settler-${randomUUID()}`;
  const meta = { purpose: "tutor-turn", promptVersion: "test" };

  beforeAll(async () => {
    await handle.db.insert(user).values({ id: SETTLER, name: "Settle Test", email: `${SETTLER}@example.test` });
    await saveBudgetLimits(handle.db, SETTLER, { perRunUsd: 1, dailyUsd: 5, monthlyUsd: 50 });
    await saveProviderSetting(handle.db, SETTLER, getEnv(), {
      provider: "anthropic",
      model: "claude-opus-5-5",
      apiKey: KEY,
      refusalFallback: false,
    });
    await approvePaidUse(handle.db, SETTLER, getEnv());
  });

  afterAll(async () => {
    for (const table of [providerRun, auditEvent]) await handle.db.delete(table).where(eq(table.ownerId, SETTLER));
    await handle.db.delete(providerSetting).where(eq(providerSetting.userId, SETTLER));
    await handle.db.delete(budgetSetting).where(eq(budgetSetting.userId, SETTLER));
    await handle.db.delete(user).where(eq(user.id, SETTLER));
  });

  it("keeps a run whose billing is uncertain at its worst case, never at the lower bound or zero", async () => {
    const before = (await getSpend(handle.db, SETTLER)).todayUsd;
    const run = await planRun(handle.db, SETTLER, getEnv(), "tutor", Q, meta);
    if (run.kind !== "live") throw new Error("expected a live run");
    // A stream that broke part way: the prompt and a little output are known, the rest is not.
    await finishProviderRun(handle.db, run.runId, {
      status: "unsettled",
      model: "claude-opus-5-5",
      error: "The connection was lost mid-stream.",
      attempts: [{ kind: "message", model: "claude-opus-5-5", inputTokens: 91, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }],
    });
    const [row] = await handle.db.select().from(providerRun).where(eq(providerRun.id, run.runId));
    expect(row!.status).toBe("unsettled");
    expect(Number(row!.costUsd)).toBeGreaterThan(0); // the lower bound is kept
    expect((await getSpend(handle.db, SETTLER)).todayUsd).toBeCloseTo(before + run.worstCaseUsd, 6);
  });

  it("settles an unsettled run only with an amount from 0 to its worst case, recorded and audited", async () => {
    const unsettled = (await handle.db.select().from(providerRun).where(eq(providerRun.ownerId, SETTLER))).find(
      (r) => r.status === "unsettled",
    );
    if (!unsettled) throw new Error("expected an unsettled run");
    const worst = Number(unsettled.worstCaseUsd);
    await expect(settleUnsettledRun(handle.db, SETTLER, unsettled.id, { amountUsd: -1, note: "console" })).rejects.toThrow(SettlementError);
    await expect(
      settleUnsettledRun(handle.db, SETTLER, unsettled.id, { amountUsd: worst + 0.01, note: "console usage page" }),
    ).rejects.toThrow(/more than this run's worst case/);
    await expect(
      settleUnsettledRun(handle.db, "someone-else", unsettled.id, { amountUsd: 0.01, note: "console usage page" }),
    ).rejects.toThrow(/not found/);
    const before = (await getSpend(handle.db, SETTLER)).todayUsd;
    await settleUnsettledRun(handle.db, SETTLER, unsettled.id, { amountUsd: 0.012345, note: "Console usage page, 10 Nov" });
    const [settled] = await handle.db.select().from(providerRun).where(eq(providerRun.id, unsettled.id));
    expect(settled).toMatchObject({ status: "ok", costUsd: "0.012345" });
    expect(settled!.settlement).toMatchObject({ method: "owner_recorded", amountUsd: "0.012345" });
    expect((await getSpend(handle.db, SETTLER)).todayUsd).toBeCloseTo(before - worst + 0.012345, 6);
    await expect(settleUnsettledRun(handle.db, SETTLER, unsettled.id, { amountUsd: 0, note: "again please" })).rejects.toThrow(
      /Only an unsettled/,
    );
    const audits = await handle.db.select().from(auditEvent).where(eq(auditEvent.ownerId, SETTLER));
    expect(audits.some((a) => a.action === "provider:settle-run")).toBe(true);
  });

  it("marks a run left running by a process that ended as unsettled, still held at its worst case", async () => {
    const stale = await planRun(handle.db, SETTLER, getEnv(), "tutor", Q, meta);
    const fresh = await planRun(handle.db, SETTLER, getEnv(), "tutor", Q, meta);
    if (stale.kind !== "live" || fresh.kind !== "live") throw new Error("expected live runs");
    await handle.db
      .update(providerRun)
      .set({ startedAt: new Date(Date.now() - 45 * 60 * 1000) })
      .where(eq(providerRun.id, stale.runId));
    const before = (await getSpend(handle.db, SETTLER)).todayUsd;
    expect(await markStaleRunsUnsettled(handle.db)).toBeGreaterThanOrEqual(1);
    const [s1] = await handle.db.select().from(providerRun).where(eq(providerRun.id, stale.runId));
    const [s2] = await handle.db.select().from(providerRun).where(eq(providerRun.id, fresh.runId));
    expect(s1!.status).toBe("unsettled");
    expect(s2!.status).toBe("running");
    // Nothing was released: both still count at their worst case.
    expect((await getSpend(handle.db, SETTLER)).todayUsd).toBeCloseTo(before, 6);
    await finishProviderRun(handle.db, fresh.runId, { status: "error", model: "claude-opus-5-5", error: "rejected", attempts: [] });
  });

  it("refuses a second reservation for the same call and records nothing for it", async () => {
    const key = `test-call-${randomUUID()}`;
    const first = await planRun(handle.db, SETTLER, getEnv(), "tutor", Q, { ...meta, idempotencyKey: key });
    const again = await planRun(handle.db, SETTLER, getEnv(), "tutor", Q, { ...meta, idempotencyKey: key });
    expect(first.kind).toBe("live");
    expect(again).toMatchObject({ kind: "refused", status: "duplicate" });
    const rows = await handle.db.select().from(providerRun).where(eq(providerRun.idempotencyKey, key));
    expect(rows).toHaveLength(1);
    if (first.kind === "live") await finishProviderRun(handle.db, first.runId, { status: "ok", model: "claude-opus-5-5", attempts: [] });
  });

  it("counts a run in the UTC day and month it started in", async () => {
    const at = (iso: string) => new Date(iso);
    const record = (startedAt: Date, outputTokens: number) =>
      recordProviderRun(handle.db, {
        ownerId: SETTLER,
        role: "tutor",
        provider: "anthropic",
        model: "claude-opus-5-5",
        purpose: "boundary-test",
        pricingVersion: "test",
        promptVersion: "test",
        status: "ok",
        attempts: [{ kind: "message", model: "claude-opus-5-5", inputTokens: 0, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 }],
        worstCaseUsd: 1,
        startedAt,
      });
    await record(at("2031-01-31T23:59:59.999Z"), 1000); // $0.02, the last moment of January
    await record(at("2031-02-01T00:00:00.000Z"), 2000); // $0.04, the first moment of February
    const feb = await getSpend(handle.db, SETTLER, at("2031-02-01T12:00:00Z"));
    expect(feb.todayUsd).toBeCloseTo(0.04, 9);
    expect(feb.monthUsd).toBeCloseTo(0.04, 9);
    const jan = await getSpend(handle.db, SETTLER, at("2031-01-31T23:59:59.999Z"));
    expect(jan.todayUsd).toBeCloseTo(0.02 + 0.04, 9); // the window has no upper end: later runs count too
    await handle.db.delete(providerRun).where(eq(providerRun.purpose, "boundary-test"));
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
