import {
  authorizeUrl,
  BLOCKED_REASON,
  DYNAMIC_AGENT_CLIENT,
  exchangeCode,
  listPlanModels,
  needsRefresh,
  OAuthError,
  PLAN_USAGE_SCOPE,
  PlanCredentialStore,
  type PlanCredentials,
  type PlanModel,
  type PlanStateInput,
  PlanUsageError,
  type PlanUseApproval,
  pkcePair,
  randomToken,
  refreshTokens,
  revokeRefreshToken,
  sha256Hex,
  validatePlanLimits,
  verifyIdToken,
} from "@corniversity/ai";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { Database, DbOrTx } from "../client";
import type { Env } from "../env";
import { auditEvent, providerRun, providerSetting } from "../schema/index";

/*
 * Teaching through the owner's own ChatGPT plan, in a local installation only. OpenAI documents
 * ChatGPT plan usage for open-source and locally hosted apps and asks a paid or remotely hosted
 * app to apply through its interest form first, so the hosted site never offers it. The sign-in
 * is the owner's own, separate from their Corniversity account; its tokens stay in owner-only
 * files on this computer (see PlanCredentialStore), and the database holds only the settings,
 * the approval, a pause and the run records.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Null when this installation may offer plan usage (local, served on a loopback address); else why not. */
export function planUnavailableReason(env: Env): string | null {
  if (env.DEPLOYMENT_MODE !== "local") {
    return "This is the hosted site. OpenAI documents ChatGPT plan usage for open-source and locally hosted apps; a remotely hosted app needs OpenAI's approval through its interest form first.";
  }
  if (!LOOPBACK_HOSTS.has(new URL(env.BETTER_AUTH_URL).hostname)) {
    return "This installation is served on an address other than this computer's own, so it is not a locally hosted app.";
  }
  return null;
}

/** The loopback callback OpenAI requires: 127.0.0.1, this installation's port, path /auth/callback. */
export function planRedirectUri(env: Env): string {
  const url = new URL(env.BETTER_AUTH_URL);
  return `http://127.0.0.1:${url.port || "80"}/auth/callback`;
}

export function planStore(env: Env): PlanCredentialStore {
  return PlanCredentialStore.forEnvironment(env.CHATGPT_PLAN_HOME);
}

export type PlanSignInCode =
  | "unavailable"
  | "no_attempt"
  | "expired"
  | "denied"
  | "provider_error"
  | "no_code"
  | "registration_incomplete"
  | "client_mismatch"
  | "exchange_failed"
  | "id_token_invalid"
  | "account_mismatch"
  | "no_plan_permission";

export class PlanSignInError extends Error {
  constructor(
    readonly code: PlanSignInCode,
    message: string,
  ) {
    super(message);
    this.name = "PlanSignInError";
  }
}

function assertAvailable(env: Env): void {
  const reason = planUnavailableReason(env);
  if (reason) throw new PlanSignInError("unavailable", reason);
}

/**
 * Runs `fn` holding this owner's credential lock. Every change to the token files (sign-in, refresh,
 * marking them unusable, sign-out) takes it, so the web and worker processes never interleave: a
 * sign-out cannot be undone by a refresh finishing after it, nor a new sign-in cleared by one.
 */
function withCredentialLock<T>(db: DbOrTx, ownerId: string, fn: (tx: DbOrTx) => Promise<T>): Promise<T> {
  return (db as Database).transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`chatgpt-plan-refresh:${ownerId}`}))`);
    return fn(tx);
  });
}

async function audit(db: DbOrTx, ownerId: string, action: string, details: Record<string, unknown> = {}): Promise<void> {
  await db.insert(auditEvent).values({ ownerId, actor: "learner", action, entity: "provider_setting", entityId: ownerId, details });
}

/**
 * Starts the owner's sign-in: a fresh state, nonce and PKCE pair saved as the single pending
 * attempt, and the authorization URL. A first sign-in registers Corniversity on this computer
 * (`dynamic_agent_client`); later ones reuse the issued client id with the retained hints, and
 * ask for consent again if the last sign-in did not grant plan usage. `otherAccount` registers
 * afresh for a different ChatGPT account.
 */
export async function startPlanSignIn(ownerId: string, env: Env, options: { otherAccount?: boolean } = {}): Promise<string> {
  assertAvailable(env);
  const store = planStore(env);
  const [hostId, registration] = await Promise.all([store.hostId(), options.otherAccount ? null : store.registration(ownerId)]);
  const clientId = registration?.client_id ?? DYNAMIC_AGENT_CLIENT;
  const state = randomToken();
  const nonce = randomToken();
  const { verifier, challenge } = pkcePair();
  const redirectUri = planRedirectUri(env);
  await store.savePending({
    owner_id: ownerId,
    state_hash: sha256Hex(state),
    verifier,
    nonce,
    client_id: clientId,
    redirect_uri: redirectUri,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  return authorizeUrl(env.CHATGPT_PLAN_AUTH_BASE, {
    clientId,
    hostId,
    redirectUri,
    state,
    nonce,
    challenge,
    idTokenHint: registration?.id_token ?? undefined,
    loginHint: registration?.email ?? undefined,
    consent: registration ? !registration.plan_scope_granted : false,
  });
}

/**
 * Completes a sign-in from the callback's query: the attempt is found by its state and used
 * once; a declined consent stops; a new registration must return its issued client id and a
 * returning one may not change it; the code is exchanged; the ID token is verified (signature,
 * issuer, audience, expiry, nonce) and, for a returning account, must name the same account;
 * the granted scopes must include plan usage. Only then are credentials saved.
 */
export async function completePlanSignIn(db: DbOrTx, env: Env, query: URLSearchParams): Promise<{ ownerId: string; email: string | null }> {
  assertAvailable(env);
  const state = query.get("state");
  const store = planStore(env);
  const pending = state ? await store.pendingByStateHash(sha256Hex(state)) : null;
  if (!pending)
    throw new PlanSignInError("no_attempt", "This sign-in was not started here, or it has already been used. Start again from Settings.");
  await store.clearPending(pending.owner_id);
  if (Date.parse(pending.expires_at) < Date.now())
    throw new PlanSignInError("expired", "The sign-in took longer than ten minutes. Start again from Settings.");
  const error = query.get("error");
  if (error === "access_denied") {
    throw new PlanSignInError("denied", "You declined the sign-in, so nothing was connected and nothing will be sent to ChatGPT.");
  }
  if (error) throw new PlanSignInError("provider_error", "OpenAI's sign-in ended with an error, so nothing was connected.");
  const code = query.get("code");
  if (!code) throw new PlanSignInError("no_code", "OpenAI's sign-in did not return an authorization code, so nothing was connected.");
  const returned = query.get("client_id");
  const fresh = pending.client_id === DYNAMIC_AGENT_CLIENT;
  if (fresh && (!returned || returned === DYNAMIC_AGENT_CLIENT)) {
    throw new PlanSignInError(
      "registration_incomplete",
      "OpenAI did not return Corniversity's registration for this computer, so nothing was connected.",
    );
  }
  if (!fresh && returned && returned !== pending.client_id) {
    throw new PlanSignInError(
      "client_mismatch",
      "OpenAI returned a different registration than the one this sign-in used, so nothing was replaced.",
    );
  }
  const clientId = fresh ? (returned as string) : pending.client_id;
  const authBase = env.CHATGPT_PLAN_AUTH_BASE;
  let tokens: Awaited<ReturnType<typeof exchangeCode>>;
  try {
    tokens = await exchangeCode(authBase, { clientId, code, verifier: pending.verifier, redirectUri: pending.redirect_uri });
  } catch (e) {
    throw new PlanSignInError(
      "exchange_failed",
      `The sign-in could not be completed: ${e instanceof OAuthError ? e.message : "no answer from OpenAI."}`,
    );
  }
  if (!tokens.id_token || !tokens.refresh_token) {
    throw new PlanSignInError("exchange_failed", "OpenAI's answer lacked the ID or refresh token the plan connection needs.");
  }
  let identity: { subject: string; email: string | null };
  try {
    identity = await verifyIdToken(authBase, tokens.id_token, { clientId, nonce: pending.nonce });
  } catch {
    throw new PlanSignInError("id_token_invalid", "OpenAI's identity token did not verify, so nothing was connected.");
  }
  const scopes = (tokens.scope ?? "").split(/\s+/).filter(Boolean);
  const granted = scopes.includes(PLAN_USAGE_SCOPE);
  const ownerId = pending.owner_id;
  const idToken = tokens.id_token;
  const refreshToken = tokens.refresh_token;
  await withCredentialLock(db, ownerId, async (tx) => {
    const [previous, old] = await Promise.all([store.registration(ownerId), store.credentials(ownerId)]);
    if (!fresh && previous && previous.subject !== identity.subject) {
      throw new PlanSignInError(
        "account_mismatch",
        "That is a different ChatGPT account from the one registered here. Use “a different ChatGPT account” in Settings.",
      );
    }
    await store.saveRegistration({
      owner_id: ownerId,
      client_id: clientId,
      subject: identity.subject,
      email: identity.email,
      id_token: idToken,
      plan_scope_granted: granted,
      signed_out: granted ? null : "signed_out",
    });
    if (!granted) {
      throw new PlanSignInError(
        "no_plan_permission",
        "The sign-in did not grant permission to use your ChatGPT plan, so nothing will be sent. Continue with ChatGPT again and allow plan usage, or choose another way to teach.",
      );
    }
    // Another account than before: its approval does not carry over, and the old session is ended.
    const priorSubject = old?.subject ?? previous?.subject;
    const switched = priorSubject !== undefined && priorSubject !== identity.subject;
    if (old && (old.subject !== identity.subject || old.client_id !== clientId)) {
      await revokeRefreshToken(authBase, { clientId: old.client_id, refreshToken: old.refresh_token });
    }
    if (switched) await tx.update(providerSetting).set({ planUseApproval: null }).where(eq(providerSetting.userId, ownerId));
    await store.saveCredentials({
      owner_id: ownerId,
      email: identity.email,
      issuer: authBase.replace(/\/$/, ""),
      subject: identity.subject,
      client_id: clientId,
      ext_agent_host_id: await store.hostId(),
      id_token: idToken,
      access_token: tokens.access_token,
      refresh_token: refreshToken,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      scopes,
      saved_at: new Date().toISOString(),
      earliest_refresh_at: tokens.earliest_refresh_at ?? null,
    });
    await audit(tx, ownerId, "provider:chatgpt-plan-connect", { registration: fresh ? "new" : "returning", switchedAccount: switched });
  });
  return { ownerId, email: identity.email };
}

export type PlanConnection =
  | { state: "connected"; email: string | null; since: string }
  | { state: "missing"; registered: boolean; email: string | null }
  | { state: "reconnect"; email: string | null };

/** Whether this owner's plan is connected here, read from the credential files (no request is made). */
export async function planConnection(env: Env, ownerId: string): Promise<PlanConnection> {
  if (planUnavailableReason(env)) return { state: "missing", registered: false, email: null };
  const store = planStore(env);
  const [credentials, registration] = await Promise.all([store.credentials(ownerId), store.registration(ownerId)]);
  if (credentials?.scopes.includes(PLAN_USAGE_SCOPE)) return { state: "connected", email: credentials.email, since: credentials.saved_at };
  if (registration?.signed_out === "unusable") return { state: "reconnect", email: registration.email };
  return { state: "missing", registered: Boolean(registration), email: registration?.email ?? null };
}

/** Clears unusable tokens (keeping the registration for the next sign-in) and records why. */
async function markUnusable(db: DbOrTx, env: Env, ownerId: string, code: string): Promise<void> {
  const store = planStore(env);
  await store.clearCredentials(ownerId);
  const registration = await store.registration(ownerId);
  if (registration) await store.saveRegistration({ ...registration, signed_out: "unusable" });
  await audit(db, ownerId, "provider:chatgpt-plan-unusable", { code });
}

/**
 * A current access token for this owner. Near expiry it is refreshed under a database lock, so
 * the web and worker processes never race the rotating refresh token: whoever waits re-reads the
 * file and uses the token the other saved. A refresh token that can no longer be used clears the
 * tokens and asks for a new sign-in; a temporary failure keeps them.
 */
export async function planAccessToken(db: DbOrTx, env: Env, ownerId: string): Promise<string> {
  const store = planStore(env);
  const notConnected = () => new PlanUsageError("authentication", BLOCKED_REASON.plan_not_connected, null, "reconnect");
  const first = await store.credentials(ownerId);
  if (!first) throw notConnected();
  if (!needsRefresh(first)) return first.access_token;
  const reconnect = (code: string | null) => new PlanUsageError("authentication", BLOCKED_REASON.plan_reconnect, code, "reconnect");
  const outcome = await withCredentialLock(db, ownerId, async (tx): Promise<{ token: string } | { error: PlanUsageError }> => {
    const current = await store.credentials(ownerId);
    if (!current) return { error: notConnected() };
    if (!needsRefresh(current)) return { token: current.access_token };
    let tokens: Awaited<ReturnType<typeof refreshTokens>>;
    try {
      tokens = await refreshTokens(env.CHATGPT_PLAN_AUTH_BASE, { clientId: current.client_id, refreshToken: current.refresh_token });
    } catch (error) {
      if (error instanceof OAuthError && error.terminal) {
        await markUnusable(tx, env, ownerId, error.code);
        return { error: reconnect(error.code) };
      }
      if (Date.now() < Date.parse(current.saved_at) + current.expires_in * 1000) return { token: current.access_token };
      return {
        error: new PlanUsageError("unavailable", "The ChatGPT sign-in could not be renewed just now. Try again later.", null, "none", true),
      };
    }
    const scopes = tokens.scope ? tokens.scope.split(/\s+/).filter(Boolean) : current.scopes;
    if (!scopes.includes(PLAN_USAGE_SCOPE)) {
      await markUnusable(tx, env, ownerId, "plan_scope_missing");
      return { error: reconnect(null) };
    }
    const next: PlanCredentials = {
      ...current,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? current.refresh_token,
      id_token: tokens.id_token ?? current.id_token,
      expires_in: tokens.expires_in,
      scopes,
      saved_at: new Date().toISOString(),
      earliest_refresh_at: tokens.earliest_refresh_at ?? null,
    };
    try {
      await store.saveCredentials(next);
    } catch {
      return {
        error: new PlanUsageError(
          "unavailable",
          "The renewed ChatGPT sign-in could not be saved on this computer. If requests keep failing, sign in with ChatGPT again.",
          null,
          "none",
        ),
      };
    }
    return { token: next.access_token };
  });
  if ("error" in outcome) throw outcome.error;
  return outcome.token;
}

/** The models offered to the owner's ChatGPT account (a catalogue; a completed request is the real check). */
export async function planModels(db: DbOrTx, env: Env, ownerId: string): Promise<PlanModel[]> {
  return listPlanModels(await planAccessToken(db, env, ownerId), env.CHATGPT_PLAN_API_BASE);
}

/**
 * Signs out: stops plan requests, revokes the renewable session and clears the tokens (the
 * registration is kept for a later sign-in). Returns whether OpenAI confirmed the revocation; if
 * not, the tokens are cleared anyway and the owner can disconnect the app in ChatGPT settings.
 */
export async function disconnectPlan(db: DbOrTx, env: Env, ownerId: string): Promise<{ revoked: boolean }> {
  const store = planStore(env);
  const revoked = await withCredentialLock(db, ownerId, async (tx) => {
    const credentials = await store.credentials(ownerId);
    const confirmed = credentials
      ? await revokeRefreshToken(env.CHATGPT_PLAN_AUTH_BASE, { clientId: credentials.client_id, refreshToken: credentials.refresh_token })
      : true;
    await store.clearCredentials(ownerId);
    const registration = await store.registration(ownerId);
    if (registration) await store.saveRegistration({ ...registration, signed_out: "signed_out" });
    await tx.update(providerSetting).set({ planUseApproval: null }).where(eq(providerSetting.userId, ownerId));
    await audit(tx, ownerId, "provider:chatgpt-plan-disconnect", { revoked: confirmed });
    return confirmed;
  });
  return { revoked };
}

/** Why plan requests are paused after a plan error, in words the owner sees; other errors pause nothing. */
export async function recordPlanError(db: DbOrTx, ownerId: string, error: PlanUsageError): Promise<void> {
  if (error.action !== "pause_limit" && error.action !== "pause_ineligible") return;
  const reason =
    error.action === "pause_limit"
      ? "the usage limit for this app on your ChatGPT plan was reached"
      : "OpenAI reported that plan usage is not available for this account";
  await db.update(providerSetting).set({ planPausedAt: new Date(), planPauseReason: reason }).where(eq(providerSetting.userId, ownerId));
  await audit(db, ownerId, "provider:chatgpt-plan-paused", { code: error.planCode });
}

export async function resumePlanUse(db: DbOrTx, ownerId: string): Promise<void> {
  await db.update(providerSetting).set({ planPausedAt: null, planPauseReason: null }).where(eq(providerSetting.userId, ownerId));
  await audit(db, ownerId, "provider:chatgpt-plan-resume");
}

const MODEL_SLUG = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

/** Saves the chosen model and request limits; a higher limit or another model needs a new approval. */
export async function savePlanSettings(
  db: DbOrTx,
  ownerId: string,
  input: { model: string | null; dailyRequests: number; monthlyRequests: number },
): Promise<void> {
  const limits = validatePlanLimits(input);
  if (input.model !== null && !MODEL_SLUG.test(input.model))
    throw new PlanSettingError("Choose one of the models your ChatGPT account offers.");
  const values = { planModel: input.model, planDailyRequests: limits.dailyRequests, planMonthlyRequests: limits.monthlyRequests };
  await db
    .insert(providerSetting)
    .values({ userId: ownerId, ...values })
    .onConflictDoUpdate({ target: providerSetting.userId, set: values });
  await audit(db, ownerId, "provider:chatgpt-plan-settings", { model: input.model, ...limits });
}

export class PlanSettingError extends Error {}

/** Records the owner's approval of plan use for the chosen model and request limits. */
export async function approvePlanUse(db: DbOrTx, env: Env, ownerId: string): Promise<PlanUseApproval> {
  const reason = planUnavailableReason(env);
  if (reason) throw new PlanSettingError(reason);
  const [setting] = await db.select().from(providerSetting).where(eq(providerSetting.userId, ownerId)).limit(1);
  if (setting?.provider !== "chatgpt_plan")
    throw new PlanSettingError("Choose your ChatGPT plan as the way to teach before approving its use.");
  if ((await planConnection(env, ownerId)).state !== "connected")
    throw new PlanSettingError("Continue with ChatGPT before approving plan use.");
  if (!setting.planModel) throw new PlanSettingError("Choose a model from your ChatGPT account before approving plan use.");
  const approval: PlanUseApproval = {
    model: setting.planModel,
    dailyRequests: setting.planDailyRequests,
    monthlyRequests: setting.planMonthlyRequests,
    approvedAt: new Date().toISOString(),
  };
  await db.update(providerSetting).set({ planUseApproval: approval }).where(eq(providerSetting.userId, ownerId));
  await audit(db, ownerId, "provider:chatgpt-plan-approve", { ...approval });
  return approval;
}

export async function withdrawPlanApproval(db: DbOrTx, ownerId: string): Promise<void> {
  await db.update(providerSetting).set({ planUseApproval: null }).where(eq(providerSetting.userId, ownerId));
  await audit(db, ownerId, "provider:chatgpt-plan-withdraw");
}

/** The plan half of the provider state, from the settings row and the credential files. */
export async function planStateInput(
  env: Env,
  ownerId: string,
  setting: {
    planModel: string | null;
    planDailyRequests: number;
    planMonthlyRequests: number;
    planUseApproval: PlanUseApproval | null;
    planPauseReason: string | null;
    planPausedAt: Date | null;
  },
): Promise<PlanStateInput> {
  const unavailableReason = planUnavailableReason(env);
  const connection = unavailableReason ? "missing" : (await planConnection(env, ownerId)).state;
  return {
    unavailableReason,
    connection,
    model: setting.planModel,
    approval: setting.planUseApproval,
    limits: { dailyRequests: setting.planDailyRequests, monthlyRequests: setting.planMonthlyRequests },
    pausedReason: setting.planPausedAt ? (setting.planPauseReason ?? "paused") : null,
  };
}

/** Run statuses that made a request through the plan (blocked and budget-blocked runs made none). */
const PLAN_REQUEST_STATUSES = ["ok", "error", "refused", "running", "unsettled"] as const;

/** Plan requests made today and this month (UTC), the counts the request limits apply to. */
export async function planRequestCounts(db: DbOrTx, ownerId: string, now = new Date()): Promise<{ today: number; month: number }> {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const count = async (since: Date) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(providerRun)
      .where(
        and(
          eq(providerRun.ownerId, ownerId),
          eq(providerRun.provider, "chatgpt_plan"),
          inArray(providerRun.status, [...PLAN_REQUEST_STATUSES]),
          gte(providerRun.startedAt, since),
        ),
      );
    return row?.n ?? 0;
  };
  return { today: await count(startOfDay), month: await count(startOfMonth) };
}

/**
 * Decides one plan request against the approved request limits and, when it may start, records
 * it as running. Decided under the same per-owner lock as paid runs, so requests started together
 * cannot pass a limit between them; a repeated call (same idempotency key) is refused.
 */
export async function reservePlanRun(
  db: DbOrTx,
  input: {
    ownerId: string;
    role: string;
    model: string;
    purpose: string;
    promptVersion: string;
    limits: { dailyRequests: number; monthlyRequests: number };
    idempotencyKey?: string;
    parentRunId?: string;
  },
): Promise<{ allowed: false; reason: string; duplicate?: boolean } | { allowed: true; runId: string; warnings: string[] }> {
  return (db as Database).transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`provider-budget:${input.ownerId}`}))`);
    if (input.idempotencyKey) {
      const [existing] = await tx
        .select({ id: providerRun.id })
        .from(providerRun)
        .where(eq(providerRun.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing) return { allowed: false as const, duplicate: true, reason: "This call has already been made or is in progress." };
    }
    const counts = await planRequestCounts(tx, input.ownerId);
    if (counts.today >= input.limits.dailyRequests) {
      return {
        allowed: false as const,
        reason: `Today's limit of ${input.limits.dailyRequests} requests through your ChatGPT plan is reached. It resets at midnight UTC, or raise it in Settings.`,
      };
    }
    if (counts.month >= input.limits.monthlyRequests) {
      return {
        allowed: false as const,
        reason: `This month's limit of ${input.limits.monthlyRequests} requests through your ChatGPT plan is reached. Raise it in Settings if you choose.`,
      };
    }
    const warnings =
      counts.today + 1 >= input.limits.dailyRequests * 0.8
        ? [`${counts.today + 1} of today's ${input.limits.dailyRequests} plan requests used.`]
        : [];
    const [row] = await tx
      .insert(providerRun)
      .values({
        ownerId: input.ownerId,
        role: input.role,
        provider: "chatgpt_plan",
        model: input.model,
        purpose: input.purpose,
        pricingVersion: "chatgpt-plan",
        promptVersion: input.promptVersion,
        status: "running",
        worstCaseUsd: "0",
        idempotencyKey: input.idempotencyKey ?? null,
        parentRunId: input.parentRunId ?? null,
      })
      .returning({ id: providerRun.id });
    return { allowed: true as const, runId: row!.id, warnings };
  });
}
