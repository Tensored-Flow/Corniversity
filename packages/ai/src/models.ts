/**
 * The models the owner may choose for live teaching, with what the provider documents about each
 * one's server-side refusal fallback (Claude API reference, cached 6 October 2026). Only these
 * identifiers can be saved; an identifier outside the list is refused rather than priced by guess.
 */
export interface SupportedModel {
  id: string;
  label: string;
  /** Whether the provider can re-run a declined request on another model (`fallbacks: "default"`). */
  serverFallback: boolean;
  /** The documented fallback targets; the dearest one bounds the worst-case cost of a run. */
  fallbackTargets: readonly string[];
  note: string;
}

export const DEFAULT_MODEL = "claude-opus-5-5";

/** The beta header that enables `fallbacks: "default"` on the Messages API. */
export const REFUSAL_FALLBACK_BETA = "server-side-fallback-2026-07-01";

export const SUPPORTED_MODELS: readonly SupportedModel[] = [
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    serverFallback: true,
    fallbackTargets: ["claude-opus-5", "claude-opus-4-8"],
    note: "The default. $4 per million input tokens and $20 per million output tokens.",
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    serverFallback: true,
    fallbackTargets: ["claude-sonnet-5"],
    note: "$2 and $10 per million tokens. Its fallback retries only cyber and frontier-model declines.",
  },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    serverFallback: false,
    fallbackTargets: [],
    note: "$0.10 and $0.50 per million tokens for prompts up to 100,000 tokens. No server-side fallback.",
  },
  {
    id: "claude-fable-5-1",
    label: "Claude Fable 5.1",
    serverFallback: true,
    fallbackTargets: ["claude-opus-4-8", "claude-opus-5"],
    note: "The most capable model, at $10 and $50 per million tokens.",
  },
];

export function supportedModel(id: string): SupportedModel | undefined {
  return SUPPORTED_MODELS.find((m) => m.id === id);
}

export function isSupportedModel(id: string): boolean {
  return supportedModel(id) !== undefined;
}
