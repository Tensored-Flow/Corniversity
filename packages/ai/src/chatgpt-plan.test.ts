import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  authorizeUrl,
  DYNAMIC_AGENT_CLIENT,
  exchangeCode,
  needsRefresh,
  PlanCredentialStore,
  pkcePair,
  verifyIdToken,
} from "./chatgpt-oauth";
import { ChatGptPlanProvider, listPlanModels, PlanUsageError, sseEvents } from "./chatgpt-plan";
import { type FakeOpenAI, startFakeOpenAI } from "./chatgpt-plan.fake";
import { collectText } from "./provider";

/**
 * The ChatGPT plan provider and sign-in helpers against a local test double of OpenAI's
 * documented wire format (not OpenAI itself): the request shape the docs require, streaming to
 * `response.completed`, every documented failure mapped without a retry on another billing
 * path, the model list, PKCE, the authorization URL, ID-token checks and the credential files.
 */
let fake: FakeOpenAI;
let token: string;
const request = {
  role: "tutor" as const,
  purpose: "tutor-turn",
  system: "You are a tutor.",
  messages: [{ role: "user" as const, content: "Why?" }],
};

beforeAll(async () => {
  fake = await startFakeOpenAI();
  const { verifier, challenge } = pkcePair();
  const query = await fake.authorize(
    new URLSearchParams({
      client_id: DYNAMIC_AGENT_CLIENT,
      redirect_uri: "http://127.0.0.1:3100/auth/callback",
      code_challenge: challenge,
      nonce: "n",
    }),
  );
  const tokens = await exchangeCode(fake.url, {
    clientId: query.get("client_id")!,
    code: query.get("code")!,
    verifier,
    redirectUri: "http://127.0.0.1:3100/auth/callback",
  });
  token = tokens.access_token;
});
afterAll(() => fake.close());
beforeEach(() => {
  fake.responsesMode = "ok";
  fake.responsesRequests.length = 0;
});

const provider = (onPlanError?: (e: PlanUsageError) => Promise<void>) =>
  new ChatGptPlanProvider({ accessToken: async () => token, model: "gpt-fake-1", apiBase: `${fake.url}/v1`, onPlanError });

describe("ChatGPT plan requests", () => {
  it("send the documented shape: instructions, the history as input, store false, stream true, nothing unsupported", async () => {
    const result = await collectText(provider(), {
      ...request,
      messages: [
        { role: "user", content: "First" },
        { role: "assistant", content: "Answer" },
        { role: "user", content: "Why?" },
      ],
      maxTokens: 900,
      effort: "high",
    });
    expect(result.text).toBe("A reply from the plan test double.");
    expect(result.provider).toBe("chatgpt_plan");
    expect(result.stopReason).toBe("end_turn");
    expect(result.attempts).toEqual([
      { kind: "message", model: "gpt-fake-1", inputTokens: 100, outputTokens: 8, cacheReadTokens: 20, cacheWriteTokens: 0 },
    ]);
    const body = fake.responsesRequests[0]!;
    expect(body).toMatchObject({ model: "gpt-fake-1", instructions: "You are a tutor.", store: false, stream: true });
    expect(body.input).toEqual([
      { role: "user", content: "First" },
      { role: "assistant", content: "Answer" },
      { role: "user", content: "Why?" },
    ]);
    for (const field of ["max_output_tokens", "temperature", "previous_response_id", "metadata", "user", "background"])
      expect(body).not.toHaveProperty(field);
    expect(JSON.stringify(body.input)).not.toContain('"system"');
  });

  it("send page images as input images on the last user message", async () => {
    await collectText(provider(), { ...request, images: [{ mediaType: "image/jpeg", base64: "AAAA" }] });
    expect(fake.responsesRequests[0]!.input).toEqual([
      {
        role: "user",
        content: [
          { type: "input_image", image_url: "data:image/jpeg;base64,AAAA" },
          { type: "input_text", text: "Why?" },
        ],
      },
    ]);
  });

  it("validate a structured answer against its schema", async () => {
    fake.responsesMode = "json";
    fake.jsonAnswer = '{"verdict":"sound","points":2}';
    const schema = z.object({ verdict: z.string(), points: z.number() });
    const result = await provider().generateStructured({ ...request, schema, schemaName: "feedback" });
    expect(result.object).toEqual({ verdict: "sound", points: 2 });
    expect(fake.responsesRequests[0]!.text).toMatchObject({ format: { type: "json_schema", name: "feedback", strict: false } });
    fake.jsonAnswer = '{"verdict":3}';
    await expect(provider().generateStructured({ ...request, schema, schemaName: "feedback" })).rejects.toMatchObject({
      kind: "invalid_output",
    });
  });

  it("stop on a usage limit before the stream, report it for a pause, and never retry", async () => {
    fake.responsesMode = "limit_prestream";
    const seen: PlanUsageError[] = [];
    const error = await collectText(
      provider(async (e) => void seen.push(e)),
      request,
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PlanUsageError);
    expect(error).toMatchObject({ kind: "rate_limited", action: "pause_limit", planCode: "subscription_sharing_usage_limit_exceeded" });
    expect((error as Error).message).toMatch(/HTTP 429, subscription_sharing_usage_limit_exceeded, request req_fake_/);
    expect(seen).toHaveLength(1);
    expect(fake.responsesRequests).toHaveLength(1);
  });

  it("stop on a usage limit that arrives after streaming began", async () => {
    fake.responsesMode = "limit_midstream";
    const generator = provider().streamText(request);
    expect((await generator.next()).value).toBe("Partial ");
    await expect(generator.next()).rejects.toMatchObject({ action: "pause_limit" });
  });

  it("map ineligibility to a pause and a non-standard 403 body to a permission refusal", async () => {
    fake.responsesMode = "not_eligible";
    await expect(collectText(provider(), request)).rejects.toMatchObject({ action: "pause_ineligible", kind: "permission" });
    fake.responsesMode = "detail403";
    await expect(collectText(provider(), request)).rejects.toMatchObject({ kind: "permission", action: "none" });
  });

  it("treat a stream that ends without response.completed as a failure, not a reply", async () => {
    fake.responsesMode = "cut";
    await expect(collectText(provider(), request)).rejects.toMatchObject({ kind: "unavailable", retryable: true });
  });

  it("list only the models meant for display, in the server's order", async () => {
    expect(await listPlanModels(token, `${fake.url}/v1`)).toEqual([
      { slug: "gpt-fake-1", displayName: "GPT Fake 1" },
      { slug: "gpt-fake-2", displayName: "GPT Fake 2" },
    ]);
  });
});

describe("server-sent events", () => {
  it("parse events split across chunks and CRLF boundaries", async () => {
    const chunks = ['data: {"type":"a"', '}\r\n\r\ndata: {"type":"b"}\n', "\ndata: [DONE]\n\n"];
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk));
        c.close();
      },
    });
    const seen: unknown[] = [];
    for await (const e of sseEvents(body)) seen.push(e);
    expect(seen).toEqual([{ type: "a" }, { type: "b" }]);
  });
});

describe("the sign-in helpers", () => {
  it("make an S256 challenge from the verifier", () => {
    const { verifier, challenge } = pkcePair();
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(challenge).not.toContain("=");
  });

  it("build a first registration with the app name and a returning sign-in without it", () => {
    const common = { hostId: "urn:uuid:h", redirectUri: "http://127.0.0.1:3100/auth/callback", state: "s", nonce: "n", challenge: "c" };
    const first = new URL(authorizeUrl("https://auth.openai.com", { clientId: DYNAMIC_AGENT_CLIENT, ...common, idTokenHint: "x" }));
    expect(first.pathname).toBe("/api/accounts/authorize");
    expect(Object.fromEntries(first.searchParams)).toEqual({
      client_id: "dynamic_agent_client",
      agent_name_hint: "Corniversity",
      ext_agent_host_id: "urn:uuid:h",
      response_type: "code",
      redirect_uri: "http://127.0.0.1:3100/auth/callback",
      scope: "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
      resource: "https://api.openai.com/v1",
      state: "s",
      nonce: "n",
      code_challenge_method: "S256",
      code_challenge: "c",
    });
    const again = new URL(
      authorizeUrl("https://auth.openai.com", { clientId: "oaiapp_1", ...common, idTokenHint: "id", loginHint: "a@b.c", consent: true }),
    );
    expect(again.searchParams.get("agent_name_hint")).toBeNull();
    expect(again.searchParams.get("id_token_hint")).toBe("id");
    expect(again.searchParams.get("login_hint")).toBe("a@b.c");
    expect(again.searchParams.get("prompt")).toBe("consent");
  });

  it("verify the ID token's audience and nonce", async () => {
    const good = await fake.idToken({ aud: "oaiapp_1", nonce: "n1" });
    expect(await verifyIdToken(fake.url, good, { clientId: "oaiapp_1", nonce: "n1" })).toEqual({
      subject: "user-fake-0001",
      email: "owner@example.test",
    });
    await expect(verifyIdToken(fake.url, good, { clientId: "oaiapp_2", nonce: "n1" })).rejects.toMatchObject({ code: "bad_id_token" });
    await expect(verifyIdToken(fake.url, good, { clientId: "oaiapp_1", nonce: "other" })).rejects.toMatchObject({ code: "bad_nonce" });
  });

  it("renew five minutes before expiry, not before OpenAI allows, and always in the last minute", () => {
    const savedAt = new Date("2026-11-10T10:00:00Z").toISOString();
    const at = (iso: string) => Date.parse(iso);
    expect(needsRefresh({ saved_at: savedAt, expires_in: 3600 }, at("2026-11-10T10:50:00Z"))).toBe(false);
    expect(needsRefresh({ saved_at: savedAt, expires_in: 3600 }, at("2026-11-10T10:56:00Z"))).toBe(true);
    const later = Date.parse("2026-11-10T10:58:00Z") / 1000;
    expect(needsRefresh({ saved_at: savedAt, expires_in: 3600, earliest_refresh_at: later }, at("2026-11-10T10:56:00Z"))).toBe(false);
    expect(needsRefresh({ saved_at: savedAt, expires_in: 3600, earliest_refresh_at: later }, at("2026-11-10T10:59:30Z"))).toBe(true);
  });

  it("keep credentials in owner-named files and find a pending sign-in by its state", async () => {
    const dir = await mkdtemp(join(tmpdir(), "plan-store-"));
    try {
      const store = new PlanCredentialStore(dir);
      const host = await store.hostId();
      expect(host).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
      expect(await store.hostId()).toBe(host);
      await store.savePending({
        owner_id: "owner1",
        state_hash: "abc",
        verifier: "v",
        nonce: "n",
        client_id: "c",
        redirect_uri: "r",
        expires_at: "x",
      });
      expect((await store.pendingByStateHash("abc"))?.owner_id).toBe("owner1");
      expect(await store.pendingByStateHash("nope")).toBeNull();
      expect(await readFile(join(dir, "pending-owner1.json"), "utf8")).toContain('"state_hash": "abc"');
      expect(() => store.credentials("../escape")).toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
