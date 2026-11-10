import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectText, DYNAMIC_AGENT_CLIENT, type PlanCredentials } from "@corniversity/ai";
import { type FakeOpenAI, startFakeOpenAI } from "@corniversity/ai/chatgpt-plan.fake";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { type Env, getEnv } from "../env";
import { user } from "../schema/auth";
import { auditEvent, providerRun, providerSetting } from "../schema/index";
import { planRun } from "./ai-runs";
import {
  approvePlanUse,
  completePlanSignIn,
  disconnectPlan,
  PlanSettingError,
  planAccessToken,
  planConnection,
  planModels,
  planRequestCounts,
  planStore,
  resumePlanUse,
  savePlanSettings,
  startPlanSignIn,
} from "./chatgpt-plan";
import { finishProviderRun, getSpend, ProviderSettingError, resolveProviderState, saveProviderSetting } from "./provider-config";

/**
 * Teaching through the owner's ChatGPT plan, against PostgreSQL and a local TEST DOUBLE of
 * OpenAI's documented wire format (never OpenAI itself): the hosted site never offers it; the
 * sign-in is single use, checks the registration, the ID token and the plan permission; the
 * rotating refresh token is renewed once when two processes race; an unusable sign-in asks for a
 * new one; requests are decided against the owner's approved request limits; a usage limit
 * pauses plan requests until the owner resumes; signing out revokes and clears the tokens.
 */
const OWNER = `plan-owner-${randomUUID().slice(0, 8)}`;
const Q = { text: "A question.", messages: 1 };
let handle: ReturnType<typeof createDb>;
let fake: FakeOpenAI;
let home: string;
let env: Env;

/** Follows the authorization as the browser would, through the double's consent, to the callback query. */
async function signIn(options: { otherAccount?: boolean } = {}): Promise<URLSearchParams> {
  const url = new URL(await startPlanSignIn(OWNER, env, options));
  return fake.authorize(url.searchParams);
}

async function connect(): Promise<void> {
  await completePlanSignIn(handle.db, env, await signIn());
}

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 4 });
  await handle.db
    .insert(user)
    .values({ id: OWNER, name: "Plan Test", email: `${OWNER}@example.test` })
    .onConflictDoNothing();
  fake = await startFakeOpenAI();
  home = await mkdtemp(join(tmpdir(), "plan-home-"));
  env = {
    ...getEnv(),
    DEPLOYMENT_MODE: "local",
    CHATGPT_PLAN_AUTH_BASE: fake.url,
    CHATGPT_PLAN_API_BASE: `${fake.url}/v1`,
    CHATGPT_PLAN_HOME: home,
  };
});

afterAll(async () => {
  for (const table of [providerRun, auditEvent]) await handle.db.delete(table).where(eq(table.ownerId, OWNER));
  await handle.db.delete(providerSetting).where(eq(providerSetting.userId, OWNER));
  await handle.db.delete(user).where(eq(user.id, OWNER));
  await handle.close();
  await fake.close();
  await rm(home, { recursive: true, force: true });
});

beforeEach(() => {
  fake.consent = { grantPlan: true, deny: false };
  fake.responsesMode = "ok";
});

describe("where the plan may be used", () => {
  it("is never offered by the hosted site", async () => {
    const hosted: Env = { ...env, DEPLOYMENT_MODE: "production", BETTER_AUTH_URL: "https://corniversity.example" };
    await expect(saveProviderSetting(handle.db, OWNER, hosted, { provider: "chatgpt_plan" })).rejects.toThrow(ProviderSettingError);
    await expect(startPlanSignIn(OWNER, hosted)).rejects.toMatchObject({ code: "unavailable" });
    await expect(completePlanSignIn(handle.db, hosted, new URLSearchParams({ state: "x" }))).rejects.toMatchObject({ code: "unavailable" });
    const lan: Env = { ...env, BETTER_AUTH_URL: "http://192.168.1.20:3100" };
    await expect(startPlanSignIn(OWNER, lan)).rejects.toMatchObject({ code: "unavailable" });
  });

  it("is blocked, never scripted, until connected, given a model and approved", async () => {
    await saveProviderSetting(handle.db, OWNER, env, { provider: "chatgpt_plan" });
    expect(await resolveProviderState(handle.db, OWNER, env)).toMatchObject({ mode: "blocked", code: "plan_not_connected" });
    const plan = await planRun(handle.db, OWNER, env, "tutor", Q, { purpose: "tutor-turn", promptVersion: "test" });
    expect(plan).toMatchObject({ kind: "refused", status: "blocked" });
    // A database that has the setting but runs as the hosted site says why, without reading any file.
    const hosted: Env = { ...env, DEPLOYMENT_MODE: "production", BETTER_AUTH_URL: "https://corniversity.example" };
    expect(await resolveProviderState(handle.db, OWNER, hosted)).toMatchObject({ mode: "blocked", code: "plan_unavailable_here" });
  });
});

describe("the sign-in", () => {
  it("registers on first use, verifies the identity and saves owner-only credentials", async () => {
    const query = await signIn();
    expect(query.get("client_id")).toMatch(/^oaiapp_fake_/);
    const result = await completePlanSignIn(handle.db, env, query);
    expect(result).toEqual({ ownerId: OWNER, email: "owner@example.test" });
    const saved = JSON.parse(await readFile(join(home, `credentials-${OWNER}.json`), "utf8")) as PlanCredentials;
    expect(saved).toMatchObject({ owner_id: OWNER, subject: "user-fake-0001", client_id: query.get("client_id"), issuer: fake.url });
    expect(saved.ext_agent_host_id).toMatch(/^urn:uuid:/);
    expect(saved.scopes).toContain("chatgpt.tokens.use.direct");
    expect(await planConnection(env, OWNER)).toMatchObject({ state: "connected", email: "owner@example.test" });
    // The callback is single use.
    await expect(completePlanSignIn(handle.db, env, query)).rejects.toMatchObject({ code: "no_attempt" });
  });

  it("reuses the issued client on a returning sign-in and refuses a different one", async () => {
    const issued = (await planStore(env).registration(OWNER))!.client_id;
    const url = new URL(await startPlanSignIn(OWNER, env));
    expect(url.searchParams.get("client_id")).toBe(issued);
    expect(url.searchParams.get("agent_name_hint")).toBeNull();
    expect(url.searchParams.get("id_token_hint")).toBeTruthy();
    const query = await fake.authorize(url.searchParams);
    query.set("client_id", "oaiapp_someone_else");
    await expect(completePlanSignIn(handle.db, env, query)).rejects.toMatchObject({ code: "client_mismatch" });
  });

  it("stops on a declined consent, a missing registration or a forged state", async () => {
    fake.consent.deny = true;
    await expect(completePlanSignIn(handle.db, env, await signIn({ otherAccount: true }))).rejects.toMatchObject({ code: "denied" });
    fake.consent.deny = false;
    const noClient = await signIn({ otherAccount: true });
    noClient.delete("client_id");
    await expect(completePlanSignIn(handle.db, env, noClient)).rejects.toMatchObject({ code: "registration_incomplete" });
    const forged = await signIn({ otherAccount: true });
    forged.set("state", "guessed");
    await expect(completePlanSignIn(handle.db, env, forged)).rejects.toMatchObject({ code: "no_attempt" });
    // None of these replaced the working connection.
    expect(await planConnection(env, OWNER)).toMatchObject({ state: "connected" });
  });

  it("saves no tokens when plan usage was not granted, and asks for consent next time", async () => {
    const before = await readFile(join(home, `credentials-${OWNER}.json`), "utf8");
    fake.consent.grantPlan = false;
    await expect(completePlanSignIn(handle.db, env, await signIn())).rejects.toMatchObject({ code: "no_plan_permission" });
    expect(await readFile(join(home, `credentials-${OWNER}.json`), "utf8")).toBe(before);
    expect(new URL(await startPlanSignIn(OWNER, env)).searchParams.get("prompt")).toBe("consent");
    fake.consent.grantPlan = true;
    await connect();
    expect(new URL(await startPlanSignIn(OWNER, env)).searchParams.get("prompt")).toBeNull();
  });
});

describe("tokens", () => {
  const ageCredentials = async () => {
    const path = join(home, `credentials-${OWNER}.json`);
    const c = JSON.parse(await readFile(path, "utf8")) as PlanCredentials;
    await writeFile(path, JSON.stringify({ ...c, saved_at: new Date(Date.now() - 3590 * 1000).toISOString() }));
    fake.expireAccessTokens();
  };

  it("are renewed once when the web and worker processes ask at the same moment", async () => {
    await ageCredentials();
    const calls = fake.refreshCalls;
    const second = createDb(process.env.DATABASE_URL!, { max: 1 });
    try {
      const [a, b] = await Promise.all([planAccessToken(handle.db, env, OWNER), planAccessToken(second.db, env, OWNER)]);
      expect(a).toBe(b);
      expect(fake.refreshCalls).toBe(calls + 1);
    } finally {
      await second.close();
    }
    expect(await planModels(handle.db, env, OWNER)).toEqual([
      { slug: "gpt-fake-1", displayName: "GPT Fake 1" },
      { slug: "gpt-fake-2", displayName: "GPT Fake 2" },
    ]);
  });

  it("that can no longer be renewed are cleared, and a new sign-in is asked for", async () => {
    const path = join(home, `credentials-${OWNER}.json`);
    const c = JSON.parse(await readFile(path, "utf8")) as PlanCredentials;
    await writeFile(
      path,
      JSON.stringify({ ...c, refresh_token: "rt-revoked", saved_at: new Date(Date.now() - 3590 * 1000).toISOString() }),
    );
    await expect(planAccessToken(handle.db, env, OWNER)).rejects.toMatchObject({ action: "reconnect" });
    expect(await planConnection(env, OWNER)).toMatchObject({ state: "reconnect" });
    // The audit of it survives the failure that follows it.
    const audits = await handle.db.select().from(auditEvent).where(eq(auditEvent.ownerId, OWNER));
    expect(audits.map((a) => a.action)).toContain("provider:chatgpt-plan-unusable");
    expect(await resolveProviderState(handle.db, OWNER, env)).toMatchObject({ mode: "blocked", code: "plan_reconnect" });
    await connect();
  });
});

describe("requests through the plan", () => {
  it("need a model and the owner's approval of the request limits; a higher limit needs approval again", async () => {
    await expect(approvePlanUse(handle.db, env, OWNER)).rejects.toThrow(PlanSettingError);
    await savePlanSettings(handle.db, OWNER, { model: "gpt-fake-1", dailyRequests: 2, monthlyRequests: 10 });
    expect(await resolveProviderState(handle.db, OWNER, env)).toMatchObject({ mode: "blocked", code: "plan_not_approved" });
    await approvePlanUse(handle.db, env, OWNER);
    expect(await resolveProviderState(handle.db, OWNER, env)).toEqual({
      mode: "plan",
      model: "gpt-fake-1",
      dailyRequests: 2,
      monthlyRequests: 10,
    });
    await savePlanSettings(handle.db, OWNER, { model: "gpt-fake-1", dailyRequests: 3, monthlyRequests: 10 });
    expect(await resolveProviderState(handle.db, OWNER, env)).toMatchObject({ mode: "blocked", code: "plan_approval_outdated" });
    await savePlanSettings(handle.db, OWNER, { model: "gpt-fake-1", dailyRequests: 2, monthlyRequests: 10 });
    await expect(savePlanSettings(handle.db, OWNER, { model: "gpt-fake-1", dailyRequests: 0, monthlyRequests: 10 })).rejects.toThrow();
  });

  it("run on the plan, cost nothing in dollars, and stop at the daily request limit", async () => {
    const first = await planRun(handle.db, OWNER, env, "tutor", Q, {
      purpose: "tutor-turn",
      promptVersion: "test",
      idempotencyKey: `${OWNER}-1`,
    });
    expect(first.kind).toBe("live");
    if (first.kind !== "live") return;
    expect(first.worstCaseUsd).toBe(0);
    const result = await collectText(first.provider, {
      role: "tutor",
      purpose: "tutor-turn",
      system: "s",
      messages: [{ role: "user", content: "q" }],
    });
    expect(result.text).toBe("A reply from the plan test double.");
    await finishProviderRun(handle.db, first.runId, { status: "ok", model: result.model, attempts: result.attempts });
    const [row] = await handle.db.select().from(providerRun).where(eq(providerRun.id, first.runId));
    expect(row).toMatchObject({ provider: "chatgpt_plan", status: "ok", costUsd: "0.000000", inputTokens: 100 });
    expect(await getSpend(handle.db, OWNER)).toEqual({ todayUsd: 0, monthUsd: 0 });
    // The same call cannot be reserved twice.
    const again = await planRun(handle.db, OWNER, env, "tutor", Q, {
      purpose: "tutor-turn",
      promptVersion: "test",
      idempotencyKey: `${OWNER}-1`,
    });
    expect(again).toMatchObject({ kind: "refused", status: "duplicate" });
    const second = await planRun(handle.db, OWNER, env, "tutor", Q, { purpose: "tutor-turn", promptVersion: "test" });
    expect(second.kind).toBe("live");
    if (second.kind === "live") await finishProviderRun(handle.db, second.runId, { status: "ok", model: "gpt-fake-1", attempts: [] });
    const third = await planRun(handle.db, OWNER, env, "tutor", Q, { purpose: "tutor-turn", promptVersion: "test" });
    expect(third).toMatchObject({ kind: "refused", status: "budget_blocked" });
    if (third.kind === "refused") expect(third.reason).toMatch(/Today's limit of 2 requests/);
    expect(await planRequestCounts(handle.db, OWNER)).toEqual({ today: 2, month: 2 });
  });

  it("pause after a usage limit until the owner resumes, without trying another provider", async () => {
    await savePlanSettings(handle.db, OWNER, { model: "gpt-fake-1", dailyRequests: 2, monthlyRequests: 10 });
    await handle.db.delete(providerRun).where(eq(providerRun.ownerId, OWNER));
    fake.responsesMode = "limit_prestream";
    const plan = await planRun(handle.db, OWNER, env, "tutor", Q, { purpose: "tutor-turn", promptVersion: "test" });
    expect(plan.kind).toBe("live");
    if (plan.kind !== "live") return;
    await expect(
      collectText(plan.provider, { role: "tutor", purpose: "t", system: "s", messages: [{ role: "user", content: "q" }] }),
    ).rejects.toMatchObject({
      action: "pause_limit",
    });
    const paused = await resolveProviderState(handle.db, OWNER, env);
    expect(paused).toMatchObject({ mode: "blocked", code: "plan_paused" });
    if (paused.mode === "blocked") expect(paused.reason).toMatch(/usage limit/);
    await resumePlanUse(handle.db, OWNER);
    expect(await resolveProviderState(handle.db, OWNER, env)).toMatchObject({ mode: "plan" });
  });
});

describe("changes to the sign-in while a refresh is in flight", () => {
  it("a sign-out waits for the refresh and then revokes the token it saved, leaving nothing on disk", async () => {
    await connect();
    const path = join(home, `credentials-${OWNER}.json`);
    const c = JSON.parse(await readFile(path, "utf8")) as PlanCredentials;
    await writeFile(path, JSON.stringify({ ...c, saved_at: new Date(Date.now() - 3590 * 1000).toISOString() }));
    fake.refreshDelayMs = 400;
    const second = createDb(process.env.DATABASE_URL!, { max: 1 });
    try {
      const refreshing = planAccessToken(handle.db, env, OWNER);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const [, signedOut] = await Promise.all([refreshing, disconnectPlan(second.db, env, OWNER)]);
      expect(signedOut.revoked).toBe(true);
    } finally {
      fake.refreshDelayMs = 0;
      await second.close();
    }
    expect(await planStore(env).credentials(OWNER)).toBeNull();
    // The refresh token revoked is the one the refresh saved, not the one it replaced.
    expect(fake.revoked.at(-1)).not.toBe(c.refresh_token);
  });

  it("signing in as another ChatGPT account ends the old session and asks for approval again", async () => {
    await connect();
    await savePlanSettings(handle.db, OWNER, { model: "gpt-fake-1", dailyRequests: 2, monthlyRequests: 10 });
    await approvePlanUse(handle.db, env, OWNER);
    const before = JSON.parse(await readFile(join(home, `credentials-${OWNER}.json`), "utf8")) as PlanCredentials;
    fake.subject = "user-fake-0002";
    try {
      await completePlanSignIn(handle.db, env, await signIn({ otherAccount: true }));
    } finally {
      fake.subject = "user-fake-0001";
    }
    expect(fake.revoked).toContain(before.refresh_token);
    expect(await resolveProviderState(handle.db, OWNER, env)).toMatchObject({ mode: "blocked", code: "plan_not_approved" });
    expect((await planStore(env).credentials(OWNER))?.subject).toBe("user-fake-0002");
    await disconnectPlan(handle.db, env, OWNER);
    await planStore(env).clearRegistration(OWNER);
    await connect();
  });

  it("a plan run whose cost is uncertain is recorded as an error, never as an unsettled charge", async () => {
    await savePlanSettings(handle.db, OWNER, { model: "gpt-fake-1", dailyRequests: 50, monthlyRequests: 100 });
    await approvePlanUse(handle.db, env, OWNER);
    await resumePlanUse(handle.db, OWNER);
    const plan = await planRun(handle.db, OWNER, env, "tutor", Q, { purpose: "tutor-turn", promptVersion: "test" });
    expect(plan.kind).toBe("live");
    if (plan.kind !== "live") return;
    await finishProviderRun(handle.db, plan.runId, { status: "unsettled", model: "gpt-fake-1", attempts: [] });
    const [row] = await handle.db.select().from(providerRun).where(eq(providerRun.id, plan.runId));
    expect(row?.status).toBe("error");
  });
});

describe("signing out", () => {
  it("revokes the renewable session, clears the tokens and the approval, and keeps the registration", async () => {
    const before = JSON.parse(await readFile(join(home, `credentials-${OWNER}.json`), "utf8")) as PlanCredentials;
    expect(await disconnectPlan(handle.db, env, OWNER)).toEqual({ revoked: true });
    expect(fake.revoked).toContain(before.refresh_token);
    expect(await planStore(env).credentials(OWNER)).toBeNull();
    expect(await planStore(env).registration(OWNER)).toMatchObject({ client_id: before.client_id, signed_out: "signed_out" });
    expect(await resolveProviderState(handle.db, OWNER, env)).toMatchObject({ mode: "blocked", code: "plan_not_connected" });
    const [setting] = await handle.db.select().from(providerSetting).where(eq(providerSetting.userId, OWNER));
    expect(setting?.planUseApproval).toBeNull();
    const actions = (await handle.db.select().from(auditEvent).where(eq(auditEvent.ownerId, OWNER))).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining(["provider:chatgpt-plan-connect", "provider:chatgpt-plan-disconnect", "provider:chatgpt-plan-paused"]),
    );
    // Nothing secret is written to the audit log.
    expect(JSON.stringify(await handle.db.select().from(auditEvent).where(eq(auditEvent.ownerId, OWNER)))).not.toMatch(/rt-|at-[0-9a-f]/);
    expect(DYNAMIC_AGENT_CLIENT).toBe("dynamic_agent_client");
  });
});
