import type { ZodType } from "zod";

export type ProviderName = "fixture" | "anthropic";

export type RoleName = "director" | "convenor" | "lecturer" | "tutor" | "librarian" | "assessor" | "seminar_chair" | "supervisor" | "peer";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export const EMPTY_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

/** One model attempt within a run: the requested model, or a fallback model that took over. */
export interface AttemptUsage extends Usage {
  model: string;
  kind: "message" | "fallback_message";
}

/** A point where the provider handed a declined request to a fallback model. */
export interface FallbackSwitch {
  from: string;
  to: string;
}

export interface BaseRequest {
  role: RoleName;
  /** Short machine-readable purpose, e.g. "tutor-turn", "assess-proof". Recorded per run. */
  purpose: string;
  system: string;
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /**
   * Fixture scenario key. Ignored by live providers. Lets deterministic tests and the offline
   * mode select a specific canned response instead of a generic one.
   */
  scenario?: string;
}

export interface TextResult {
  text: string;
  /** Tokens summed over every attempt. */
  usage: Usage;
  /** The model that produced the returned message (a fallback model when one took over). */
  model: string;
  provider: ProviderName;
  stopReason: "end_turn" | "max_tokens" | "refusal" | "other";
  refusalCategory?: string;
  /** Each attempt with its own usage and model, the basis of the recorded cost. */
  attempts: AttemptUsage[];
  fallbacks: FallbackSwitch[];
}

export interface StructuredResult<T> {
  object: T;
  usage: Usage;
  model: string;
  provider: ProviderName;
  attempts: AttemptUsage[];
  fallbacks: FallbackSwitch[];
}

export interface StructuredRequest<T> extends BaseRequest {
  schema: ZodType<T>;
  schemaName: string;
}

/**
 * The narrow seam between Corniversity and any model provider. Two implementations exist:
 * the deterministic fixture provider (default; free; never a substitute for a live check) and
 * the Anthropic provider (official SDK). Both stream text and return structured objects.
 */
export interface ModelProvider {
  readonly name: ProviderName;
  /** Streams text deltas; the generator's return value carries the final usage. */
  streamText(request: BaseRequest): AsyncGenerator<string, TextResult, void>;
  generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>>;
}

export type ProviderErrorKind =
  | "not_configured"
  | "authentication"
  | "permission"
  | "billing"
  | "model_unavailable"
  | "rate_limited"
  | "bad_request"
  | "unavailable"
  | "refused"
  | "invalid_output"
  | "fixture_missing"
  | "budget_exceeded";

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly retryable = false,
    /** Usage of attempts that ran before the failure (a refusal is billed), so spend is still recorded. */
    readonly attempts: AttemptUsage[] = [],
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Collects a streamed response when streaming is not needed. */
export async function collectText(provider: ModelProvider, request: BaseRequest): Promise<TextResult> {
  const generator = provider.streamText(request);
  let next = await generator.next();
  while (!next.done) {
    next = await generator.next();
  }
  return next.value;
}
