import { z } from "zod";
import {
  type AttemptUsage,
  type BaseRequest,
  type ModelProvider,
  ProviderError,
  type ProviderErrorKind,
  type StructuredRequest,
  type StructuredResult,
  type TextResult,
} from "./provider";

/*
 * ChatGPT plan usage through Sign in with ChatGPT, as OpenAI documents it for open-source and
 * locally hosted apps (developers.openai.com/siwc, "ChatGPT plan usage", read 10 November 2026).
 * Requests go to the public Responses API with the user's OAuth access token as the bearer
 * credential, `store: false` and `stream: true`; a request succeeds only on `response.completed`.
 * A plan error stops the request: nothing is retried on another billing path.
 */

export const CHATGPT_API_BASE = "https://api.openai.com/v1";
/** Where the user reviews this app's usage and manages its access to their plan. */
export const CHATGPT_MANAGE_USAGE_URL = "https://chatgpt.com/settings/usage";
/** OpenAI's route for a paid or remotely hosted app that wants plan usage. */
export const CHATGPT_PLAN_INTEREST_FORM_URL = "https://openai.com/form/sign-in-with-chatgpt-interest/";

/**
 * What Corniversity does after a plan error, besides reporting it: pause new plan requests until
 * the owner resumes them (a usage limit, or plan usage not available for the account), ask for a
 * new sign-in (the tokens can no longer be used), or nothing more.
 */
export type PlanErrorAction = "pause_limit" | "pause_ineligible" | "reconnect" | "none";

export class PlanUsageError extends ProviderError {
  constructor(
    kind: ProviderErrorKind,
    message: string,
    readonly planCode: string | null,
    readonly action: PlanErrorAction,
    retryable = false,
  ) {
    // Plan usage is not billed per request to Corniversity, so no dollar amount is in doubt.
    super(kind, message, retryable, [], "none");
    this.name = "PlanUsageError";
  }
}

/** The documented structured error codes, what each means here and what follows it. */
const PLAN_ERRORS: Record<string, { kind: ProviderErrorKind; action: PlanErrorAction; retryable: boolean; text: string }> = {
  subscription_sharing_user_not_eligible: {
    kind: "permission",
    action: "pause_ineligible",
    retryable: false,
    text: "OpenAI reports that ChatGPT plan usage is not available for this account, workspace or policy. Corniversity will not repeat the request.",
  },
  subscription_sharing_usage_limit_exceeded: {
    kind: "rate_limited",
    action: "pause_limit",
    retryable: false,
    text: "The usage limit for this app on your ChatGPT plan has been reached. Requests through your plan are paused until you resume them in Settings; review usage in ChatGPT settings.",
  },
  subscription_sharing_usage_unavailable: {
    kind: "unavailable",
    action: "none",
    retryable: true,
    text: "ChatGPT could not check your plan's usage just now. Try again later.",
  },
  subscription_sharing_unsupported_capability: {
    kind: "bad_request",
    action: "none",
    retryable: false,
    text: "ChatGPT plan usage does not support part of this request.",
  },
  subscription_sharing_route_not_supported: {
    kind: "bad_request",
    action: "none",
    retryable: false,
    text: "ChatGPT plan usage does not support this kind of request.",
  },
  subscription_sharing_invalid_user: {
    kind: "authentication",
    action: "none",
    retryable: false,
    text: "OpenAI could not validate the ChatGPT account for this request. If it happens again, sign in with ChatGPT again in Settings.",
  },
  chatpass_v2_scope_not_authorized: {
    kind: "permission",
    action: "none",
    retryable: false,
    text: "The ChatGPT sign-in does not authorise this request. Check the connection in Settings.",
  },
  chatpass_v2_invalid_authorization_context: {
    kind: "permission",
    action: "none",
    retryable: false,
    text: "The ChatGPT sign-in does not authorise this request. Check the connection in Settings.",
  },
  subscription_sharing_user_unavailable: {
    kind: "unavailable",
    action: "none",
    retryable: true,
    text: "ChatGPT account information is temporarily unavailable. Try again later.",
  },
};

/** A plan error from its HTTP status, documented code and request id; the facts stay in the message. */
export function planError(status: number | null, code: string | null, detail: string | null, requestId: string | null): PlanUsageError {
  const known = code ? PLAN_ERRORS[code] : undefined;
  const facts = [status ? `HTTP ${status}` : null, code, requestId ? `request ${requestId}` : null].filter(Boolean).join(", ");
  const suffix = facts ? ` (${facts})` : "";
  if (known) return new PlanUsageError(known.kind, `${known.text}${suffix}`, code, known.action, known.retryable);
  if (code === "model_not_found" || status === 404) {
    return new PlanUsageError(
      "model_unavailable",
      `The chosen model is not available to this ChatGPT account. Choose another in Settings.${suffix}`,
      code,
      "none",
    );
  }
  const said = detail ? ` OpenAI said: "${detail.slice(0, 200)}"` : "";
  if (status === 401) {
    return new PlanUsageError(
      "authentication",
      `OpenAI did not accept the ChatGPT sign-in for this request.${said}${suffix}`,
      code,
      "none",
    );
  }
  if (status === 403) {
    return new PlanUsageError(
      "permission",
      `OpenAI refused this request under its policy or permission checks.${said}${suffix}`,
      code,
      "none",
    );
  }
  if (status === 429)
    return new PlanUsageError("rate_limited", `ChatGPT is limiting requests just now. Try again later.${suffix}`, code, "none", true);
  if (status === 400) return new PlanUsageError("bad_request", `OpenAI could not accept this request.${said}${suffix}`, code, "none");
  return new PlanUsageError("unavailable", `ChatGPT could not be reached or did not answer.${said}${suffix}`, code, "none", true);
}

export interface ChatGptPlanProviderConfig {
  /** A current access token, refreshed when needed; the provider never keeps one. */
  accessToken: () => Promise<string>;
  /** The model slug the owner chose from the account's model list. */
  model: string;
  apiBase?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Told about every plan error before it is thrown, so plan use can be paused or a new sign-in asked for. */
  onPlanError?: (error: PlanUsageError) => Promise<void>;
}

const StreamUsage = z
  .object({
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
    input_tokens_details: z.object({ cached_tokens: z.number().optional() }).nullish(),
  })
  .nullish();

export class ChatGptPlanProvider implements ModelProvider {
  readonly name = "chatgpt_plan" as const;

  constructor(private readonly config: ChatGptPlanProviderConfig) {}

  /** Tells the caller about a plan error and hands it back to be thrown. */
  private async report(error: PlanUsageError): Promise<PlanUsageError> {
    await this.config.onPlanError?.(error);
    return error;
  }

  /** The request body: instructions in place of a system message, the history in `input`. */
  private body(request: BaseRequest, model: string, format?: { name: string; schema: unknown }): Record<string, unknown> {
    const images = request.images ?? [];
    const input = request.messages.map((m, i) => {
      if (images.length === 0 || i !== request.messages.length - 1 || m.role !== "user") return { role: m.role, content: m.content };
      return {
        role: m.role,
        content: [
          ...images.map((img) => ({ type: "input_image", image_url: `data:${img.mediaType};base64,${img.base64}` })),
          { type: "input_text", text: m.content },
        ],
      };
    });
    return {
      model,
      instructions: request.system,
      input,
      store: false,
      stream: true,
      ...(format ? { text: { format: { type: "json_schema", name: format.name, schema: format.schema, strict: false } } } : {}),
    };
  }

  /** Sends one request and yields its stream's events; an error before or during the stream is a plan error. */
  private async *events(body: Record<string, unknown>): AsyncGenerator<Record<string, unknown>, void, void> {
    const token = await this.config.accessToken();
    const fetchImpl = this.config.fetchImpl ?? fetch;
    let response: Response;
    try {
      response = await fetchImpl(`${this.config.apiBase ?? CHATGPT_API_BASE}/responses`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 10 * 60 * 1000),
      });
    } catch {
      throw await this.report(planError(null, null, null, null));
    }
    const requestId = response.headers.get("x-request-id");
    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      let code: string | null = null;
      let detail: string | null = null;
      try {
        const parsed = JSON.parse(text) as { error?: { code?: string; message?: string }; detail?: string };
        code = parsed.error?.code ?? null;
        detail = parsed.error?.message ?? (typeof parsed.detail === "string" ? parsed.detail : null);
      } catch {
        detail = text || null;
      }
      throw await this.report(planError(response.status, code, detail, requestId));
    }
    try {
      for await (const event of sseEvents(response.body)) yield event;
    } catch (error) {
      if (error instanceof PlanUsageError) throw error;
      throw await this.report(
        new PlanUsageError("unavailable", "The connection to ChatGPT broke before the reply was complete.", null, "none", true),
      );
    }
  }

  /** Runs one request to its terminal event: text deltas are passed on, a failure is thrown. */
  private async *run(body: Record<string, unknown>, model: string): AsyncGenerator<string, TextResult, void> {
    let text = "";
    let refusal = "";
    for await (const event of this.events(body)) {
      const type = event.type;
      if (type === "response.output_text.delta" && typeof event.delta === "string") {
        text += event.delta;
        yield event.delta;
      } else if (type === "response.refusal.delta" && typeof event.delta === "string") {
        refusal += event.delta;
      } else if (type === "response.completed" || type === "response.incomplete") {
        const response = (event.response ?? {}) as { model?: string; usage?: unknown; incomplete_details?: { reason?: string } };
        const served = response.model ?? model;
        const reason = response.incomplete_details?.reason;
        if (refusal) yield refusal;
        return {
          text: text + refusal,
          usage: usageOf(response.usage),
          model: served,
          provider: "chatgpt_plan",
          stopReason: refusal || reason === "content_filter" ? "refusal" : type === "response.incomplete" ? "max_tokens" : "end_turn",
          attempts: [{ kind: "message", model: served, ...usageOf(response.usage) }],
          fallbacks: [],
        };
      } else if (type === "response.failed") {
        const error = ((event.response ?? {}) as { error?: { code?: string; message?: string } }).error;
        throw await this.report(planError(null, error?.code ?? null, error?.message ?? null, null));
      } else if (type === "error") {
        throw await this.report(
          planError(
            null,
            typeof event.code === "string" ? event.code : null,
            typeof event.message === "string" ? event.message : null,
            null,
          ),
        );
      }
    }
    throw await this.report(
      new PlanUsageError("unavailable", "The stream from ChatGPT ended before the reply was complete.", null, "none", true),
    );
  }

  streamText(request: BaseRequest): AsyncGenerator<string, TextResult, void> {
    const model = request.model ?? this.config.model;
    return this.run(this.body(request, model), model);
  }

  async generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const model = request.model ?? this.config.model;
    const { $schema: _, ...schema } = z.toJSONSchema(request.schema) as Record<string, unknown>;
    const generator = this.run(this.body(request, model, { name: request.schemaName, schema }), model);
    let next = await generator.next();
    while (!next.done) next = await generator.next();
    const result = next.value;
    if (result.stopReason === "refusal") throw new ProviderError("refused", "The model declined this request.", false, result.attempts);
    if (result.stopReason === "max_tokens") {
      throw new ProviderError("invalid_output", "The model stopped before finishing the structured answer.", false, result.attempts);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      throw new ProviderError("invalid_output", "The model's structured answer was not valid JSON.", false, result.attempts);
    }
    const checked = request.schema.safeParse(parsed);
    if (!checked.success) {
      throw new ProviderError("invalid_output", `Structured output failed validation: ${checked.error.message}`, false, result.attempts);
    }
    return {
      object: checked.data,
      usage: result.usage,
      model: result.model,
      provider: "chatgpt_plan",
      attempts: result.attempts,
      fallbacks: [],
    };
  }
}

function usageOf(raw: unknown): Omit<AttemptUsage, "kind" | "model"> {
  const parsed = StreamUsage.safeParse(raw);
  const usage = parsed.success ? parsed.data : null;
  const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
  return {
    inputTokens: Math.max(0, (usage?.input_tokens ?? 0) - cached),
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: cached,
    cacheWriteTokens: 0,
  };
}

/** Server-sent events from a response body, as parsed JSON objects (`data:` lines of each event). */
export async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const boundary = /\r?\n\r?\n/;
  let buffer = "";
  const parse = (block: string): Record<string, unknown> | null => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data || data === "[DONE]") return null;
    return JSON.parse(data) as Record<string, unknown>;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (;;) {
        const match = boundary.exec(buffer);
        if (!match) break;
        const event = parse(buffer.slice(0, match.index));
        buffer = buffer.slice(match.index + match[0].length);
        if (event) yield event;
      }
    }
    const tail = parse(buffer + decoder.decode());
    if (tail) yield tail;
  } finally {
    // A request abandoned at a terminal event (or a failure) releases its connection.
    await reader.cancel().catch(() => undefined);
  }
}

/** One model the account may use, as the model list names it. */
export interface PlanModel {
  slug: string;
  displayName: string;
}

const ModelList = z.object({
  models: z.array(z.object({ slug: z.string(), display_name: z.string().optional(), visibility: z.string().optional() }).passthrough()),
});

/**
 * The models offered to this account, in the server's order: only those meant for display
 * (`visibility: "list"`). A catalogue, not an entitlement check; a completed request is what
 * shows that a model can be used.
 */
export async function listPlanModels(
  accessToken: string,
  apiBase = CHATGPT_API_BASE,
  fetchImpl: typeof fetch = fetch,
): Promise<PlanModel[]> {
  const response = await fetchImpl(`${apiBase}/models`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw planError(response.status, null, await response.text().catch(() => null), response.headers.get("x-request-id"));
  const parsed = ModelList.safeParse(await response.json());
  if (!parsed.success)
    throw new PlanUsageError("unavailable", "The model list from ChatGPT was not in the documented shape.", null, "none");
  return parsed.data.models.filter((m) => m.visibility === "list").map((m) => ({ slug: m.slug, displayName: m.display_name ?? m.slug }));
}
