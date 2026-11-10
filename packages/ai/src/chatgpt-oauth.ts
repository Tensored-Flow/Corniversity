import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

/*
 * Sign in with ChatGPT for ChatGPT plan usage, the flow OpenAI documents for open-source and
 * locally hosted apps (developers.openai.com/siwc/token-sharing-open-source, read 10 November
 * 2026): first-time registration of a user-defined agent through `dynamic_agent_client` with a
 * stable host id, OpenID Connect with PKCE and a 127.0.0.1 loopback callback, the issued client
 * id from the callback, rotating refresh tokens, and revocation on sign-out. Tokens live only in
 * owner-only files on this computer, never in the database, the browser or logs.
 */

export const CHATGPT_AUTH_BASE = "https://auth.openai.com";
export const PLAN_RESOURCE = "https://api.openai.com/v1";
export const PLAN_USAGE_SCOPE = "chatgpt.tokens.use.direct";
export const PLAN_SCOPES = ["openid", "profile", "email", "offline_access", "resource.invoke", PLAN_USAGE_SCOPE] as const;
export const DYNAMIC_AGENT_CLIENT = "dynamic_agent_client";
/** The app's actual name, sent only on first-time registration. */
export const AGENT_NAME_HINT = "Corniversity";

const base64url = (bytes: Buffer) => bytes.toString("base64url");

export function randomToken(): string {
  return base64url(randomBytes(32));
}

/** A PKCE verifier and its S256 challenge (base64url, no padding). */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomToken();
  return { verifier, challenge: base64url(createHash("sha256").update(verifier).digest()) };
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface AuthorizeParams {
  /** `dynamic_agent_client` for a first registration, else the issued client id. */
  clientId: string;
  hostId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  challenge: string;
  /** Reauthorization only: the ID token retained from this account's last sign-in, and its email. */
  idTokenHint?: string;
  loginHint?: string;
  /** Ask for consent again (`prompt=consent`), after a sign-in that did not grant plan usage. */
  consent?: boolean;
}

/** The authorization URL for the system browser; the app name hint goes only on a first registration. */
export function authorizeUrl(authBase: string, p: AuthorizeParams): string {
  const url = new URL("/api/accounts/authorize", authBase);
  const q = url.searchParams;
  q.set("client_id", p.clientId);
  if (p.clientId === DYNAMIC_AGENT_CLIENT) q.set("agent_name_hint", AGENT_NAME_HINT);
  q.set("ext_agent_host_id", p.hostId);
  if (p.clientId !== DYNAMIC_AGENT_CLIENT && p.idTokenHint) q.set("id_token_hint", p.idTokenHint);
  if (p.clientId !== DYNAMIC_AGENT_CLIENT && p.loginHint) q.set("login_hint", p.loginHint);
  q.set("response_type", "code");
  q.set("redirect_uri", p.redirectUri);
  q.set("scope", PLAN_SCOPES.join(" "));
  q.set("resource", PLAN_RESOURCE);
  q.set("state", p.state);
  q.set("nonce", p.nonce);
  q.set("code_challenge_method", "S256");
  q.set("code_challenge", p.challenge);
  if (p.consent) q.set("prompt", "consent");
  return url.toString();
}

const TokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  id_token: z.string().min(1).optional(),
  token_type: z.string().default("Bearer"),
  expires_in: z.number().positive(),
  scope: z.string().optional(),
  earliest_refresh_at: z.union([z.number(), z.string()]).optional(),
});
export type TokenResponse = z.infer<typeof TokenResponse>;

/** An OAuth error from the token or revocation endpoint, with OpenAI's code when it gave one. */
export class OAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "OAuthError";
  }
  /** The refresh token can no longer be used: clear it and sign in again with the saved client id. */
  get terminal(): boolean {
    return [
      "invalid_grant",
      "invalid_refresh_token",
      "token_expired",
      "refresh_token_expired",
      "refresh_token_invalidated",
      "refresh_token_reused",
      "invalid_client",
    ].includes(this.code);
  }
}

async function tokenRequest(authBase: string, form: Record<string, string>, fetchImpl: typeof fetch): Promise<TokenResponse> {
  let response: Response;
  try {
    response = await fetchImpl(new URL("/api/accounts/oauth/token", authBase), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new OAuthError("network", "OpenAI's sign-in service could not be reached.", null);
  }
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof body.error === "string" ? body.error : `http_${response.status}`;
    throw new OAuthError(code, `OpenAI's sign-in service refused the request (${code}).`, response.status);
  }
  const parsed = TokenResponse.safeParse(body);
  if (!parsed.success) throw new OAuthError("bad_response", "OpenAI's token response was not in the documented shape.", response.status);
  return parsed.data;
}

/** Exchanges the authorization code with the issued client id, the verifier and the same redirect URI. */
export function exchangeCode(
  authBase: string,
  p: { clientId: string; code: string; verifier: string; redirectUri: string },
  fetchImpl: typeof fetch = fetch,
): Promise<TokenResponse> {
  return tokenRequest(
    authBase,
    {
      grant_type: "authorization_code",
      client_id: p.clientId,
      code: p.code,
      code_verifier: p.verifier,
      redirect_uri: p.redirectUri,
      resource: PLAN_RESOURCE,
    },
    fetchImpl,
  );
}

/** Refreshes near expiry; scope is omitted to keep the grant. The refresh token rotates. */
export function refreshTokens(
  authBase: string,
  p: { clientId: string; refreshToken: string },
  fetchImpl: typeof fetch = fetch,
): Promise<TokenResponse> {
  return tokenRequest(
    authBase,
    { grant_type: "refresh_token", client_id: p.clientId, refresh_token: p.refreshToken, resource: PLAN_RESOURCE },
    fetchImpl,
  );
}

const Discovery = z.object({ issuer: z.string(), jwks_uri: z.string().url(), revocation_endpoint: z.string().url().optional() });

async function discover(authBase: string, fetchImpl: typeof fetch): Promise<z.infer<typeof Discovery>> {
  const response = await fetchImpl(new URL("/.well-known/openid-configuration", authBase), { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new OAuthError(`http_${response.status}`, "OpenAI's sign-in configuration could not be read.", response.status);
  const parsed = Discovery.safeParse(await response.json());
  if (!parsed.success) throw new OAuthError("bad_response", "OpenAI's sign-in configuration was not in the expected shape.", null);
  return parsed.data;
}

/**
 * Verifies the ID token against OpenAI's published keys: signature, issuer, audience (the issued
 * client id), expiry and the nonce saved for this attempt. Returns the verified subject and email.
 */
export async function verifyIdToken(
  authBase: string,
  idToken: string,
  expected: { clientId: string; nonce: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ subject: string; email: string | null }> {
  const config = await discover(authBase, fetchImpl);
  const issuer = authBase.replace(/\/$/, "");
  if (config.issuer.replace(/\/$/, "") !== issuer)
    throw new OAuthError("bad_issuer", "The sign-in configuration names another issuer.", null);
  const keys = createRemoteJWKSet(new URL(config.jwks_uri));
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(idToken, keys, { issuer: [issuer, `${issuer}/`], audience: expected.clientId }));
  } catch {
    throw new OAuthError("bad_id_token", "The ID token from OpenAI did not verify.", null);
  }
  if (payload.nonce !== expected.nonce) throw new OAuthError("bad_nonce", "The ID token was not issued for this sign-in.", null);
  if (typeof payload.sub !== "string" || !payload.sub) throw new OAuthError("bad_id_token", "The ID token has no subject.", null);
  return { subject: payload.sub, email: typeof payload.email === "string" ? payload.email : null };
}

/**
 * Revokes the renewable session (an empty HTTP 200 is success, also for an already-invalid
 * token), retrying a network failure or 5xx twice with backoff. Returns whether it was confirmed.
 */
export async function revokeRefreshToken(
  authBase: string,
  p: { clientId: string; refreshToken: string },
  fetchImpl: typeof fetch = fetch,
  delayMs = 500,
): Promise<boolean> {
  let endpoint: string | undefined;
  try {
    endpoint = (await discover(authBase, fetchImpl)).revocation_endpoint;
  } catch {
    return false;
  }
  if (!endpoint) return false;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, delayMs * 2 ** (attempt - 1)));
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: p.refreshToken, token_type_hint: "refresh_token", client_id: p.clientId }).toString(),
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 200) return true;
      if (response.status < 500) return false;
    } catch {
      // A network failure: try again while attempts remain.
    }
  }
  return false;
}

/** The saved credential record, as the documentation describes it, plus the Corniversity owner it belongs to. */
export const PlanCredentials = z.object({
  owner_id: z.string(),
  email: z.string().nullable(),
  issuer: z.string(),
  subject: z.string(),
  client_id: z.string(),
  ext_agent_host_id: z.string(),
  id_token: z.string(),
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  scopes: z.array(z.string()),
  saved_at: z.string(),
  earliest_refresh_at: z.union([z.number(), z.string()]).nullable().optional(),
});
export type PlanCredentials = z.infer<typeof PlanCredentials>;

/** What is kept after signing out, for a later sign-in to the same account without a new registration. */
export const PlanRegistration = z.object({
  owner_id: z.string(),
  client_id: z.string(),
  subject: z.string(),
  email: z.string().nullable(),
  id_token: z.string().nullable(),
  /** False when the last sign-in did not grant plan usage, so the next one asks for consent again. */
  plan_scope_granted: z.boolean().default(true),
  /** Why no credentials are saved now: the owner signed out, or the tokens could no longer be used. */
  signed_out: z.enum(["signed_out", "unusable"]).nullable().default(null),
});
export type PlanRegistration = z.infer<typeof PlanRegistration>;

/** One sign-in attempt in progress (single use, ten minutes). */
export const PendingSignIn = z.object({
  owner_id: z.string(),
  state_hash: z.string(),
  verifier: z.string(),
  nonce: z.string(),
  client_id: z.string(),
  redirect_uri: z.string(),
  expires_at: z.string(),
});
export type PendingSignIn = z.infer<typeof PendingSignIn>;

/** When the access token should be renewed: five minutes before it expires, not before OpenAI allows. */
export function needsRefresh(c: Pick<PlanCredentials, "saved_at" | "expires_in" | "earliest_refresh_at">, now = Date.now()): boolean {
  const expiresAt = Date.parse(c.saved_at) + c.expires_in * 1000;
  if (now >= expiresAt - 60_000) return true;
  if (now < expiresAt - 5 * 60_000) return false;
  const earliest = c.earliest_refresh_at;
  if (earliest === null || earliest === undefined) return true;
  const earliestMs = typeof earliest === "number" ? earliest * 1000 : Date.parse(earliest);
  return Number.isNaN(earliestMs) || now >= earliestMs;
}

const OWNER_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Owner-only files under one directory: this computer's host id, and per Corniversity owner the
 * credentials, the retained registration and a pending sign-in. Writes are atomic (a temporary
 * file renamed into place) with mode 0600; on Windows the user profile's permissions apply.
 */
export class PlanCredentialStore {
  constructor(readonly dir: string) {}

  /** `CHATGPT_PLAN_HOME`, else `~/.config/corniversity/chatgpt-plan`. */
  static forEnvironment(home = process.env.CHATGPT_PLAN_HOME): PlanCredentialStore {
    return new PlanCredentialStore(home || join(homedir(), ".config", "corniversity", "chatgpt-plan"));
  }

  private file(kind: "credentials" | "registration" | "pending", ownerId: string): string {
    if (!OWNER_ID.test(ownerId)) throw new Error("unexpected owner id");
    return join(this.dir, `${kind}-${ownerId}.json`);
  }

  private async write(path: string, value: unknown): Promise<void> {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const tmp = `${path}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(tmp, path);
  }

  private async read<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch {
      return null;
    }
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  }

  /** This computer's stable, opaque host id (`urn:uuid:` form), created once. */
  async hostId(): Promise<string> {
    const path = join(this.dir, "host-id");
    try {
      const existing = (await readFile(path, "utf8")).trim();
      if (existing.startsWith("urn:uuid:")) return existing;
    } catch {
      // Not created yet.
    }
    const id = `urn:uuid:${randomUUID()}`;
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    await writeFile(path, id, { encoding: "utf8", mode: 0o600, flag: "wx" }).catch(() => undefined);
    return (await readFile(path, "utf8")).trim();
  }

  credentials(ownerId: string) {
    return this.read(this.file("credentials", ownerId), PlanCredentials);
  }
  saveCredentials(c: PlanCredentials) {
    return this.write(this.file("credentials", c.owner_id), c);
  }
  async clearCredentials(ownerId: string): Promise<void> {
    await rm(this.file("credentials", ownerId), { force: true });
  }
  registration(ownerId: string) {
    return this.read(this.file("registration", ownerId), PlanRegistration);
  }
  saveRegistration(r: PlanRegistration) {
    return this.write(this.file("registration", r.owner_id), r);
  }
  async clearRegistration(ownerId: string): Promise<void> {
    await rm(this.file("registration", ownerId), { force: true });
  }
  pending(ownerId: string) {
    return this.read(this.file("pending", ownerId), PendingSignIn);
  }
  savePending(p: PendingSignIn) {
    return this.write(this.file("pending", p.owner_id), p);
  }
  async clearPending(ownerId: string): Promise<void> {
    await rm(this.file("pending", ownerId), { force: true });
  }
  /** The pending sign-in whose state hashes to this value, if any. */
  async pendingByStateHash(stateHash: string): Promise<PendingSignIn | null> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch {
      return null;
    }
    for (const name of names) {
      if (!name.startsWith("pending-") || !name.endsWith(".json")) continue;
      const pending = await this.read(join(this.dir, name), PendingSignIn);
      if (pending && pending.state_hash === stateHash) return pending;
    }
    return null;
  }
}
