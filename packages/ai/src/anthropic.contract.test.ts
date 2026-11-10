import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AnthropicProvider } from "./anthropic";
import { REFUSAL_FALLBACK_BETA } from "./models";
import { costOfAttempts } from "./pricing";
import { ProviderError, type TextResult } from "./provider";

/**
 * Contract test of the live provider: the real AnthropicProvider and the real SDK, against a
 * local server that speaks the Messages API wire format as the Claude API reference documents
 * it (server-sent events for streams, JSON messages, typed error bodies). It checks what this
 * application sends and how it reads what comes back. It is not a live test: no request leaves
 * the machine, and it says nothing about how a real model answers.
 */
type Scenario = { kind: "stream"; events: object[] } | { kind: "json"; status: number; body: object };

let scenario: Scenario;
let seen: { path: string; headers: IncomingHttpHeaders; body: Record<string, unknown> }[] = [];
const server = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  seen.push({ path: req.url ?? "", headers: req.headers, body: raw ? JSON.parse(raw) : {} });
  if (scenario.kind === "stream") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    for (const event of scenario.events) res.write(`event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`);
    res.end();
  } else {
    res.writeHead(scenario.status, { "content-type": "application/json" });
    res.end(JSON.stringify(scenario.body));
  }
});
let baseURL = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  seen = [];
});

const KEY = "sk-ant-contract-test-0000000000";
const provider = (model = "claude-opus-5-5", refusalFallback = true) =>
  new AnthropicProvider({ apiKey: KEY, model, refusalFallback, baseURL, maxRetries: 0 });

const usage = (input: number, output: number) => ({
  input_tokens: input,
  output_tokens: output,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
});
const start = (model: string) => ({
  type: "message_start",
  message: {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model,
    content: [],
    stop_reason: null,
    stop_sequence: null,
    usage: usage(1200, 1),
  },
});
const text = (index: number, parts: string[]) => [
  { type: "content_block_start", index, content_block: { type: "text", text: "" } },
  ...parts.map((t) => ({ type: "content_block_delta", index, delta: { type: "text_delta", text: t } })),
  { type: "content_block_stop", index },
];
const end = (stop_reason: string, extra: Record<string, unknown> = {}, usageExtra: Record<string, unknown> = {}) => [
  { type: "message_delta", delta: { stop_reason, stop_sequence: null, ...extra }, usage: { output_tokens: 40, ...usageExtra } },
  { type: "message_stop" },
];

async function drain(generator: AsyncGenerator<string, TextResult, void>): Promise<{ chunks: string[]; result: TextResult }> {
  const chunks: string[] = [];
  let next = await generator.next();
  while (!next.done) {
    chunks.push(next.value);
    next = await generator.next();
  }
  return { chunks, result: next.value };
}

const request = {
  role: "tutor" as const,
  purpose: "tutor-turn",
  system: "You are the tutor.",
  messages: [{ role: "user" as const, content: "Why?" }],
};

describe("streamed turns", () => {
  it("send the documented request and read text, stop reason and usage back", async () => {
    scenario = { kind: "stream", events: [start("claude-opus-5-5"), ...text(0, ["Two ", "models."]), ...end("end_turn")] };
    const { chunks, result } = await drain(provider().streamText({ ...request, maxTokens: 8000, effort: "medium" }));
    expect(chunks.join("")).toBe("Two models.");
    expect(result).toMatchObject({
      text: "Two models.",
      stopReason: "end_turn",
      model: "claude-opus-5-5",
      provider: "anthropic",
      fallbacks: [],
    });
    expect(result.attempts).toEqual([
      { kind: "message", model: "claude-opus-5-5", inputTokens: 1200, outputTokens: 40, cacheReadTokens: 0, cacheWriteTokens: 0 },
    ]);
    const sent = seen[0]!;
    expect(sent.path).toMatch(/^\/v1\/messages/);
    // The installed SDK (1.3.0) sends the key as a bearer credential; it travels only in a header.
    expect(sent.headers.authorization ?? `Bearer ${sent.headers["x-api-key"]}`).toBe(`Bearer ${KEY}`);
    expect(JSON.stringify(sent.body)).not.toContain(KEY);
    expect(sent.headers["anthropic-beta"]).toContain(REFUSAL_FALLBACK_BETA);
    expect(sent.body).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      stream: true,
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [{ type: "text", text: "You are the tutor.", cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: "Why?" }],
    });
    // Thinking is left to the model's adaptive default, which Claude Opus 5.5 cannot switch off.
    expect(sent.body).not.toHaveProperty("thinking");
  });

  it("record a fallback model taking over, with each attempt's usage priced at its own model", async () => {
    scenario = {
      kind: "stream",
      events: [
        start("claude-opus-4-8"),
        {
          type: "content_block_start",
          index: 0,
          content_block: {
            type: "fallback",
            from: { model: "claude-opus-5-5" },
            to: { model: "claude-opus-4-8" },
            trigger: { type: "refusal", category: "bio" },
          },
        },
        { type: "content_block_stop", index: 0 },
        ...text(1, ["Continued."]),
        ...end(
          "end_turn",
          {},
          {
            iterations: [
              { type: "message", model: "claude-opus-5-5", ...usage(1000, 0), cache_creation: null },
              { type: "fallback_message", model: "claude-opus-4-8", ...usage(1000, 30), cache_creation: null },
            ],
          },
        ),
      ],
    };
    const { result } = await drain(provider().streamText(request));
    expect(result.fallbacks).toEqual([{ from: "claude-opus-5-5", to: "claude-opus-4-8" }]);
    expect(result.model).toBe("claude-opus-4-8");
    expect(result.attempts.map((a) => [a.kind, a.model])).toEqual([
      ["message", "claude-opus-5-5"],
      ["fallback_message", "claude-opus-4-8"],
    ]);
    // 1000 tokens at $4/M for the declined attempt, then 1000 at $5/M and 30 at $25/M.
    expect(costOfAttempts(result.attempts)).toBeCloseTo(0.004 + 0.005 + 0.00075, 9);
  });

  it("report a decline with its category, and a reply cut off at its allowance", async () => {
    scenario = {
      kind: "stream",
      events: [
        start("claude-opus-5-5"),
        ...text(0, ["Part"]),
        ...end("refusal", { stop_details: { type: "refusal", category: "cyber", explanation: null } }),
      ],
    };
    expect((await drain(provider().streamText(request))).result).toMatchObject({ stopReason: "refusal", refusalCategory: "cyber" });
    scenario = { kind: "stream", events: [start("claude-opus-5-5"), ...text(0, ["Long"]), ...end("max_tokens")] };
    expect((await drain(provider().streamText(request))).result.stopReason).toBe("max_tokens");
  });

  it("keep the usage of a stream that fails after it started, so its cost is still recorded", async () => {
    scenario = {
      kind: "stream",
      events: [
        start("claude-opus-5-5"),
        ...text(0, ["Half a reply"]),
        { type: "error", error: { type: "overloaded_error", message: "Overloaded" } },
      ],
    };
    const error = await drain(provider().streamText(request)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).attempts).toEqual([
      { kind: "message", model: "claude-opus-5-5", inputTokens: 1200, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
    ]);
  });

  it("ask for no fallback where the model has none, or where the owner turned it off", async () => {
    scenario = { kind: "stream", events: [start("claude-haiku-5-5"), ...text(0, ["ok"]), ...end("end_turn")] };
    await drain(provider("claude-haiku-5-5").streamText(request));
    await drain(provider("claude-opus-5-5", false).streamText(request));
    for (const sent of seen) {
      expect(sent.body).not.toHaveProperty("fallbacks");
      expect(String(sent.headers["anthropic-beta"] ?? "")).not.toContain(REFUSAL_FALLBACK_BETA);
    }
  });
});

describe("structured feedback", () => {
  const Schema = z.object({ verdict: z.enum(["accepted", "needs_review"]), confidence: z.number().min(0).max(1), summary: z.string() });
  const structured = { ...request, role: "assessor" as const, purpose: "assess", schema: Schema, schemaName: "Feedback" };
  const message = (content: object[], stop_reason = "end_turn") => ({
    id: "msg_2",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content,
    stop_reason,
    stop_sequence: null,
    stop_details: stop_reason === "refusal" ? { type: "refusal", category: "bio", explanation: null } : null,
    usage: usage(3000, 200),
  });

  it("sends the schema as the output format with high effort, and returns the validated object", async () => {
    const answer = { verdict: "needs_review", confidence: 0.4, summary: "The step from three cases to every n is not argued." };
    scenario = { kind: "json", status: 200, body: message([{ type: "text", text: JSON.stringify(answer) }]) };
    const result = await provider().generateStructured(structured);
    expect(result.object).toEqual(answer);
    expect(result.attempts[0]).toMatchObject({ model: "claude-opus-5-5", inputTokens: 3000, outputTokens: 200 });
    const config = seen[0]!.body.output_config as { effort: string; format: { type: string; schema: { properties: object } } };
    expect(config.effort).toBe("high");
    expect(config.format.type).toBe("json_schema");
    expect(Object.keys(config.format.schema.properties)).toEqual(["verdict", "confidence", "summary"]);
  });

  it("turns a decline or an off-schema answer into an error that keeps the attempt's usage", async () => {
    scenario = { kind: "json", status: 200, body: message([], "refusal") };
    const refused = await provider()
      .generateStructured(structured)
      .catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(ProviderError);
    expect((refused as ProviderError).kind).toBe("refused");
    expect((refused as ProviderError).attempts[0]?.inputTokens).toBe(3000);
    scenario = { kind: "json", status: 200, body: message([{ type: "text", text: JSON.stringify({ verdict: "brilliant" }) }]) };
    const invalid = await provider()
      .generateStructured(structured)
      .catch((e: unknown) => e);
    expect((invalid as ProviderError).kind).toBe("invalid_output");
    expect((invalid as ProviderError).attempts[0]?.outputTokens).toBe(200);
    scenario = { kind: "json", status: 200, body: message([{ type: "text", text: "Here is my assessment:" }]) };
    const notJson = await provider()
      .generateStructured(structured)
      .catch((e: unknown) => e);
    expect((notJson as ProviderError).kind).toBe("invalid_output");
    expect((notJson as ProviderError).attempts).toHaveLength(1);
  });
});

describe("errors become precise states", () => {
  const cases: [number, string, string, boolean][] = [
    [401, "authentication_error", "authentication", false],
    [403, "permission_error", "permission", false],
    [404, "not_found_error", "model_unavailable", false],
    [402, "billing_error", "billing", false],
    [429, "rate_limit_error", "rate_limited", true],
    [529, "overloaded_error", "unavailable", true],
    [500, "api_error", "unavailable", true],
  ];
  for (const [status, type, kind, retryable] of cases) {
    it(`${status} ${type} → ${kind}`, async () => {
      scenario = { kind: "json", status, body: { type: "error", error: { type, message: `simulated ${type}` } } };
      const error = await drain(provider().streamText(request)).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).kind).toBe(kind);
      expect((error as ProviderError).retryable).toBe(retryable);
      expect((error as ProviderError).message).not.toContain(KEY);
    });
  }
});
