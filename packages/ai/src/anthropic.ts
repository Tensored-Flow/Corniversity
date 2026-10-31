import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  type BaseRequest,
  type ModelProvider,
  ProviderError,
  type StructuredRequest,
  type StructuredResult,
  type TextResult,
  type Usage,
} from "./provider";

export interface AnthropicProviderConfig {
  apiKey: string;
  defaultModel: string;
  /** Per-role model overrides, e.g. { peer: "claude-sonnet-5-5" }. */
  modelMap?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Live provider on the official Anthropic SDK. Streams prose (so long tutorial turns never
 * hit request timeouts) and uses structured outputs for feedback and proposals. Thinking is
 * left at the model's adaptive default; depth is steered with `effort`. Refusals are surfaced
 * as a distinct stop reason so the application can say what happened instead of pretending.
 */
export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic" as const;
  private readonly client: Anthropic;

  constructor(private readonly config: AnthropicProviderConfig) {
    if (!config.apiKey) throw new ProviderError("not_configured", "Anthropic API key is not configured.");
    this.client = new Anthropic({ apiKey: config.apiKey, timeout: config.timeoutMs ?? 10 * 60 * 1000, maxRetries: 2 });
  }

  private modelFor(request: BaseRequest): string {
    return request.model ?? this.config.modelMap?.[request.role] ?? this.config.defaultModel;
  }

  async *streamText(request: BaseRequest): AsyncGenerator<string, TextResult, void> {
    const model = this.modelFor(request);
    try {
      const stream = this.client.messages.stream({
        model,
        max_tokens: request.maxTokens ?? 8_000,
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        ...(request.effort ? { output_config: { effort: request.effort } } : {}),
      });
      let text = "";
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          text += event.delta.text;
          yield event.delta.text;
        }
      }
      const final = await stream.finalMessage();
      const stopReason = mapStop(final.stop_reason);
      return {
        text,
        usage: mapUsage(final.usage),
        model: final.model,
        provider: "anthropic",
        stopReason,
        refusalCategory: final.stop_reason === "refusal" && final.stop_details ? (final.stop_details.category ?? undefined) : undefined,
      };
    } catch (error) {
      throw mapError(error);
    }
  }

  async generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const model = this.modelFor(request);
    try {
      const response = await this.client.messages.parse({
        model,
        max_tokens: request.maxTokens ?? 16_000,
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        output_config: {
          format: zodOutputFormat(request.schema as never),
          ...(request.effort ? { effort: request.effort } : {}),
        },
      });
      if (response.stop_reason === "refusal") {
        throw new ProviderError("refused", `The model declined this request (${response.stop_details?.category ?? "unspecified"}).`);
      }
      const parsed = response.parsed_output;
      if (parsed === null || parsed === undefined) {
        throw new ProviderError("invalid_output", "The model returned output that did not match the required schema.");
      }
      const checked = request.schema.safeParse(parsed);
      if (!checked.success) {
        throw new ProviderError("invalid_output", `Structured output failed validation: ${checked.error.message}`);
      }
      return { object: checked.data, usage: mapUsage(response.usage), model: response.model, provider: "anthropic" };
    } catch (error) {
      throw mapError(error);
    }
  }
}

function mapUsage(usage: Anthropic.Usage): Usage {
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  };
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

function mapError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    return new ProviderError("authentication", "The Anthropic API key was rejected.");
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
    return new ProviderError("unavailable", `Provider error ${error.status ?? ""}: ${error.message}`, (error.status ?? 500) >= 500);
  }
  return new ProviderError("unavailable", error instanceof Error ? error.message : String(error), true);
}
