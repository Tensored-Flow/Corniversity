import { createHash, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";

/**
 * A TEST DOUBLE of OpenAI's documented wire format for ChatGPT plan usage: discovery, signing
 * keys, the authorize redirect, the token endpoint (authorization code with PKCE, rotating
 * refresh tokens with reuse detection), revocation, the model list and streamed Responses. It
 * lets tests and the local rehearsal exercise the whole path without a ChatGPT account. Nothing
 * that passes against it is evidence that OpenAI accepts a request.
 */
export type ResponsesMode = "ok" | "json" | "limit_midstream" | "limit_prestream" | "not_eligible" | "detail403" | "cut";

export interface FakeOpenAI {
  url: string;
  /** What the next authorize redirects with: granted scopes, or a declined consent. */
  consent: { grantPlan: boolean; deny: boolean };
  responsesMode: ResponsesMode;
  /** The JSON text streamed in `json` mode. */
  jsonAnswer: string;
  /** Bodies of every Responses request, for checking what was sent. */
  responsesRequests: Record<string, unknown>[];
  refreshCalls: number;
  /** The account the next sign-in authenticates as. */
  subject: string;
  /** Delay before the token endpoint answers a refresh, to hold a refresh in flight. */
  refreshDelayMs: number;
  revoked: string[];
  /** Expire every issued access token now (the next request must refresh). */
  expireAccessTokens(): void;
  /** Issue a signed ID token directly (to test validation failures). */
  idToken(claims: { aud: string; nonce: string; sub?: string; email?: string }): Promise<string>;
  /** Start an authorization as a browser would and return the callback query OpenAI would send. */
  authorize(params: URLSearchParams): Promise<URLSearchParams>;
  close(): Promise<void>;
}

interface CodeGrant {
  clientId: string;
  redirectUri: string;
  challenge: string;
  nonce: string;
  scopes: string[];
}

export async function startFakeOpenAI(port = 0): Promise<FakeOpenAI> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: "fake-key-1", alg: "RS256", use: "sig" };
  const codes = new Map<string, CodeGrant>();
  const refreshTokens = new Map<string, { clientId: string; scopes: string[]; current: boolean }>();
  const accessTokens = new Map<string, { clientId: string; expired: boolean }>();
  let clients = 0;
  const email = "owner@example.test";
  let base = "";

  const signIdToken = (claims: { aud: string; nonce: string; sub?: string; email?: string }) =>
    new SignJWT({ nonce: claims.nonce, email: claims.email ?? email })
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid! })
      .setIssuer(base)
      .setAudience(claims.aud)
      .setSubject(claims.sub ?? fake.subject)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

  const issue = async (clientId: string, scopes: string[], nonce: string | null) => {
    const access = `at-${randomUUID()}`;
    const refresh = `rt-${randomUUID()}`;
    accessTokens.set(access, { clientId, expired: false });
    refreshTokens.set(refresh, { clientId, scopes, current: true });
    return {
      access_token: access,
      refresh_token: refresh,
      ...(nonce !== null ? { id_token: await signIdToken({ aud: clientId, nonce }) } : {}),
      token_type: "Bearer",
      expires_in: 3600,
      scope: scopes.join(" "),
    };
  };

  const authorizeQuery = (q: URLSearchParams): URLSearchParams => {
    const out = new URLSearchParams({ state: q.get("state") ?? "" });
    if (fake.consent.deny) {
      out.set("error", "access_denied");
      return out;
    }
    const requested = q.get("client_id") ?? "";
    const clientId = requested === "dynamic_agent_client" ? `oaiapp_fake_${++clients}` : requested;
    const scopes = [
      "openid",
      "profile",
      "email",
      "offline_access",
      "resource.invoke",
      ...(fake.consent.grantPlan ? ["chatgpt.tokens.use.direct"] : []),
    ];
    const code = `code-${randomUUID()}`;
    codes.set(code, {
      clientId,
      redirectUri: q.get("redirect_uri") ?? "",
      challenge: q.get("code_challenge") ?? "",
      nonce: q.get("nonce") ?? "",
      scopes,
    });
    out.set("code", code);
    out.set("scope", scopes.join(" "));
    if (requested === "dynamic_agent_client") out.set("client_id", clientId);
    return out;
  };

  const json = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", "x-request-id": `req_fake_${randomUUID().slice(0, 8)}`, ...headers });
    res.end(JSON.stringify(body));
  };
  const readBody = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      let data = "";
      req.on("data", (c) => {
        data += c;
      });
      req.on("end", () => resolve(data));
    });
  const bearer = (req: IncomingMessage) => {
    const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    const known = accessTokens.get(token);
    return known && !known.expired ? token : null;
  };
  const sse = (res: ServerResponse, events: Record<string, unknown>[], end = true) => {
    res.writeHead(200, { "Content-Type": "text/event-stream", "x-request-id": "req_fake_stream" });
    for (const e of events) res.write(`event: ${String(e.type)}\ndata: ${JSON.stringify(e)}\n\n`);
    if (end) res.end();
    else res.destroy();
  };

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", base);
    if (req.method === "GET" && url.pathname === "/.well-known/openid-configuration") {
      return json(res, 200, {
        issuer: base,
        authorization_endpoint: `${base}/api/accounts/authorize`,
        token_endpoint: `${base}/api/accounts/oauth/token`,
        jwks_uri: `${base}/jwks`,
        revocation_endpoint: `${base}/revoke`,
      });
    }
    if (req.method === "GET" && url.pathname === "/jwks") return json(res, 200, { keys: [jwk] });
    if (req.method === "GET" && url.pathname === "/api/accounts/authorize") {
      const out = authorizeQuery(url.searchParams);
      res.writeHead(302, { Location: `${url.searchParams.get("redirect_uri")}?${out.toString()}` });
      return res.end();
    }
    if (req.method === "POST" && url.pathname === "/api/accounts/oauth/token") {
      const form = new URLSearchParams(await readBody(req));
      if (form.get("grant_type") === "authorization_code") {
        const grant = codes.get(form.get("code") ?? "");
        codes.delete(form.get("code") ?? "");
        const verifier = form.get("code_verifier") ?? "";
        const challenge = createHash("sha256").update(verifier).digest("base64url");
        if (
          !grant ||
          grant.clientId !== form.get("client_id") ||
          grant.redirectUri !== form.get("redirect_uri") ||
          grant.challenge !== challenge
        ) {
          return json(res, 400, { error: "invalid_grant" });
        }
        return json(res, 200, await issue(grant.clientId, grant.scopes, grant.nonce));
      }
      if (form.get("grant_type") === "refresh_token") {
        fake.refreshCalls++;
        if (fake.refreshDelayMs) await new Promise((resolve) => setTimeout(resolve, fake.refreshDelayMs));
        const token = refreshTokens.get(form.get("refresh_token") ?? "");
        if (!token || token.clientId !== form.get("client_id")) return json(res, 400, { error: "invalid_grant" });
        if (!token.current) return json(res, 400, { error: "refresh_token_reused" });
        token.current = false;
        const issued = await issue(token.clientId, token.scopes, null);
        return json(res, 200, issued);
      }
      return json(res, 400, { error: "unsupported_grant_type" });
    }
    if (req.method === "POST" && url.pathname === "/revoke") {
      const form = new URLSearchParams(await readBody(req));
      fake.revoked.push(form.get("token") ?? "");
      const token = refreshTokens.get(form.get("token") ?? "");
      if (token) token.current = false;
      res.writeHead(200);
      return res.end();
    }
    if (req.method === "GET" && url.pathname === "/v1/models") {
      if (!bearer(req)) return json(res, 401, { error: { code: "subscription_sharing_invalid_user", message: "bad token" } });
      return json(res, 200, {
        models: [
          { slug: "gpt-fake-1", display_name: "GPT Fake 1", visibility: "list" },
          { slug: "gpt-fake-hidden", display_name: "Hidden", visibility: "hide" },
          { slug: "gpt-fake-2", display_name: "GPT Fake 2", visibility: "list" },
        ],
      });
    }
    if (req.method === "POST" && url.pathname === "/v1/responses") {
      if (!bearer(req)) return json(res, 401, { error: { code: "subscription_sharing_invalid_user", message: "bad token" } });
      const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
      fake.responsesRequests.push(body);
      const model = String(body.model);
      const done = {
        type: "response.completed",
        response: { model, usage: { input_tokens: 120, output_tokens: 8, input_tokens_details: { cached_tokens: 20 } } },
      };
      switch (fake.responsesMode) {
        case "limit_prestream":
          return json(res, 429, { error: { code: "subscription_sharing_usage_limit_exceeded", message: "limit" } });
        case "not_eligible":
          return json(res, 403, { error: { code: "subscription_sharing_user_not_eligible", message: "no" } });
        case "detail403":
          return json(res, 403, { detail: "Direct routing is not permitted from this region." });
        case "limit_midstream":
          return sse(res, [
            { type: "response.output_text.delta", delta: "Partial " },
            { type: "response.failed", response: { error: { code: "subscription_sharing_usage_limit_exceeded", message: "limit" } } },
          ]);
        case "cut":
          return sse(res, [{ type: "response.output_text.delta", delta: "Half a rep" }], false);
        case "json":
          return sse(res, [{ type: "response.output_text.delta", delta: fake.jsonAnswer }, done]);
        default:
          return sse(res, [
            { type: "response.created", response: { model } },
            { type: "response.output_text.delta", delta: "A reply " },
            { type: "response.output_text.delta", delta: "from the plan test double." },
            done,
          ]);
      }
    }
    json(res, 404, { error: "not_found" });
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const fake: FakeOpenAI = {
    url: base,
    consent: { grantPlan: true, deny: false },
    responsesMode: "ok",
    jsonAnswer: "{}",
    responsesRequests: [],
    refreshCalls: 0,
    subject: "user-fake-0001",
    refreshDelayMs: 0,
    revoked: [],
    expireAccessTokens() {
      for (const t of accessTokens.values()) t.expired = true;
    },
    idToken: signIdToken,
    async authorize(params) {
      return authorizeQuery(params);
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
  return fake;
}
