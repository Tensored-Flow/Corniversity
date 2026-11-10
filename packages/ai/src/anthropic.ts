import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { REFUSAL_FALLBACK_BETA, supportedModel } from "./models";
import {
  type AttemptUsage,
  type BaseRequest,
  type FallbackSwitch,
  type ModelProvider,
  ProviderError,
  type StructuredRequest,
  type StructuredResult,
  type TextResult,
  type Usage,
} from "./provider";

export interface AnthropicProviderConfig {
  apiKey: string;
  /** The model every role uses: the one the owner chose and approved. */
  model: string;
  /** Re-run a declined request on the provider's recommended fallback model (`fallbacks: "default"`). */
  refusalFallback: boolean;
  timeoutMs?: number;
  /** Only for the contract test, which serves the documented wire format locally. */
  baseURL?: string;
  maxRetries?: number;
}

/**
 * Live provider on the official Anthropic SDK (checked against the Claude API reference cached
 * 6 October 2026 and the installed SDK's types). Streams prose so long tutorial turns never hit
 * request timeouts, and uses structured outputs for feedback. Thinking stays at the model's
 * adaptive default (Claude Opus 5.5 cannot switch it off); depth is set explicitly per role with
 * `effort`, and the output allowance has room for thinking because thinking counts towards it.
 * Requests go through the beta namespace so a declined request can be re-run server-side on the
 * fallback model where the model supports it; every attempt's usage is returned so the cost of
 * a run is recorded at each attempt's own rates.
 */
export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic" as const;
  private readonly client: Anthropic;

  constructor(private readonly config: AnthropicProviderConfig) {
    if (!config.apiKey) throw new ProviderError("not_configured", "Anthropic API key is not configured.");
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeoutMs ?? 10 * 60 * 1000,
      maxRetries: config.maxRetries ?? 2,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    });
  }

  private fallbackParams(model: string): { betas?: string[]; fallbacks?: "default" } {
    return this.config.refusalFallback && supportedModel(model)?.serverFallback
      ? { betas: [REFUSAL_FALLBACK_BETA], fallbacks: "default" }
      : {};
  }

  async *streamText(request: BaseRequest): AsyncGenerator<string, TextResult, void> {
    const model = request.model ?? this.config.model;
    // What the stream has reported so far: a stream that fails after it started has been billed
    // for its prompt and for the output already produced.
    let usageSoFar: BetaUsage | null = null;
    try {
      const stream = this.client.beta.messages.stream({
        model,
        max_tokens: request.maxTokens ?? 8_000,
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        output_config: { effort: request.effort ?? "medium" },
        ...this.fallbackParams(model),
      });
      let text = "";
      const fallbacks: FallbackSwitch[] = [];
      for await (const event of stream) {
        if (event.type === "message_start") usageSoFar = event.message.usage;
        else if (event.type === "message_delta" && usageSoFar) usageSoFar = withDelta(usageSoFar, event.usage);
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          text += event.delta.text;
          yield event.delta.text;
        } else if (event.type === "content_block_start" && event.content_block.type === "fallback") {
          fallbacks.push({ from: event.content_block.from.model, to: event.content_block.to.model });
        }
      }
      const final = await stream.finalMessage();
      const attempts = attemptsOf(final.usage, model, final.model);
      return {
        text,
        usage: sumUsage(attempts),
        model: final.model,
        provider: "anthropic",
        stopReason: mapStop(final.stop_reason),
        refusalCategory: final.stop_reason === "refusal" ? (final.stop_details?.category ?? undefined) : undefined,
        attempts,
        fallbacks,
      };
    } catch (error) {
      const mapped = mapError(error);
      if (usageSoFar && mapped.attempts.length === 0) {
        throw new ProviderError(mapped.kind, mapped.message, mapped.retryable, attemptsOf(usageSoFar, model, model));
      }
      throw mapped;
    }
  }

  async generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const model = request.model ?? this.config.model;
    // `create` rather than `parse`: the SDK's parse step throws away the response, and with it the
    // usage that is billed, when an answer fails validation. The schema is sent the same way
    // (constraints JSON Schema cannot express are checked here instead), and the answer is
    // validated below so a failed answer is still recorded at its cost.
    const response = await this.client.beta.messages
      .create({
        model,
        max_tokens: request.maxTokens ?? 16_000,
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        output_config: { format: betaZodOutputFormat(request.schema as never), effort: request.effort ?? "high" },
        ...this.fallbackParams(model),
      })
      .catch((error: unknown) => {
        throw mapError(error);
      });
    const attempts = attemptsOf(response.usage, model, response.model);
    const fallbacks: FallbackSwitch[] = response.content.flatMap((b) =>
      b.type === "fallback" ? [{ from: b.from.model, to: b.to.model }] : [],
    );
    if (response.stop_reason === "refusal") {
      throw new ProviderError(
        "refused",
        `The model declined this request (${response.stop_details?.category ?? "no category given"}).`,
        false,
        attempts,
      );
    }
    if (response.stop_reason === "max_tokens") {
      throw new ProviderError(
        "invalid_output",
        "The model reached its output allowance before finishing the structured answer.",
        false,
        attempts,
      );
    }
    const answer = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(answer);
    } catch {
      throw new ProviderError("invalid_output", "The model's structured answer was not valid JSON.", false, attempts);
    }
    const checked = request.schema.safeParse(parsed);
    if (!checked.success) {
      throw new ProviderError("invalid_output", `Structured output failed validation: ${checked.error.message}`, false, attempts);
    }
    return { object: checked.data, usage: sumUsage(attempts), model: response.model, provider: "anthropic", attempts, fallbacks };
  }
}

type BetaUsage = Anthropic.Beta.BetaUsage;

/** A stream's usage after a `message_delta`: its counts replace earlier ones where it gives them. */
function withDelta(usage: BetaUsage, delta: object): BetaUsage {
  const merged: Record<string, unknown> = { ...usage };
  for (const [key, value] of Object.entries(delta)) if (value !== null && value !== undefined) merged[key] = value;
  return merged as unknown as BetaUsage;
}

/**
 * Every attempt the provider made for one request. `usage.iterations` is the per-attempt source
 * of truth when the provider reports it (a fallback model taking over adds a `fallback_message`
 * entry); otherwise the top-level usage is the single attempt.
 */
export function attemptsOf(usage: BetaUsage, requestedModel: string, servedModel: string): AttemptUsage[] {
  const entries = (usage.iterations ?? []).flatMap((i) =>
    i.type === "message" || i.type === "fallback_message"
      ? [
          {
            kind: i.type,
            model: i.model ?? (i.type === "message" ? requestedModel : servedModel),
            inputTokens: i.input_tokens ?? 0,
            outputTokens: i.output_tokens ?? 0,
            cacheReadTokens: i.cache_read_input_tokens ?? 0,
            cacheWriteTokens: i.cache_creation_input_tokens ?? 0,
          } satisfies AttemptUsage,
        ]
      : [],
  );
  if (entries.length > 0) return entries;
  return [
    {
      kind: "message",
      model: servedModel,
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    },
  ];
}

function sumUsage(attempts: readonly AttemptUsage[]): Usage {
  return attempts.reduce(
    (sum, a) => ({
      inputTokens: sum.inputTokens + a.inputTokens,
      outputTokens: sum.outputTokens + a.outputTokens,
      cacheReadTokens: sum.cacheReadTokens + a.cacheReadTokens,
      cacheWriteTokens: sum.cacheWriteTokens + a.cacheWriteTokens,
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  );
}

function mapStop(reason: string | null): TextResult["stopReason"] {
  switch (reason) {
    case "end_turn":
      return "end_turn";
    case "max_tokens":
      return "max_tokens";
    case "refusal":
      return "refusal";
    default:
      return "other";
  }
}

/** Most specific first: in the TypeScript SDK the connection error is a subclass of `APIError`. */
export function mapError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    return new ProviderError("authentication", "The Anthropic API key was rejected.");
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new ProviderError("permission", "This API key is not permitted to make this request.");
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new ProviderError("model_unavailable", "The chosen model is not available to this API key. Choose another model in Settings.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ProviderError("rate_limited", "The provider is rate-limiting requests. Try again shortly.", true);
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new ProviderError("bad_request", `The provider rejected the request: ${error.message}`);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ProviderError("unavailable", "Could not reach the provider.", true);
  }
  if (error instanceof Anthropic.APIError) {
    const type = (error as { type?: string }).type;
    if (error.status === 402 || type === "billing_error") {
      return new ProviderError(
        "billing",
        "The Anthropic account reports a billing problem, so paid runs cannot start. Nothing was charged here.",
      );
    }
    if (error.status === 413) return new ProviderError("bad_request", "The request was too large for the provider.");
    if (error.status === 529 || type === "overloaded_error") {
      return new ProviderError("unavailable", "The provider is overloaded. Try again shortly.", true);
    }
    return new ProviderError("unavailable", `Provider error ${error.status ?? ""}: ${error.message}`, (error.status ?? 500) >= 500);
  }
  return new ProviderError("unavailable", error instanceof Error ? error.message : String(error), true);
}
