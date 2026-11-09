import { isSupportedModel } from "./models";

/** What the owner approved for paid model use; a change of model or a higher limit needs a new approval. */
export interface PaidUseApproval {
  model: string;
  perRunUsd: number;
  dailyUsd: number;
  monthlyUsd: number;
  refusalFallback: boolean;
  approvedAt: string;
}

export type BlockedCode = "no_key" | "key_unreadable" | "unsupported_model" | "not_approved" | "approval_outdated";

/**
 * Which provider a learner's runs use. There are three states and no silent movement between
 * them: the scripted demo (no model, nothing sent anywhere), a live model the owner has
 * approved, or blocked, when a live model was chosen but cannot run. A blocked state never falls
 * back to scripted responses; the learner is told why and what to change.
 */
export type ProviderState =
  | { mode: "scripted"; reason: "not_configured" | "owner_chose_scripted" }
  | { mode: "live"; apiKey: string; model: string; refusalFallback: boolean; source: "owner_setting" | "environment" }
  | { mode: "blocked"; code: BlockedCode; reason: string; model: string };

/** The state without the key, for pages and logs. */
export type PublicProviderState =
  | { mode: "scripted"; reason: "not_configured" | "owner_chose_scripted" }
  | { mode: "live"; model: string; refusalFallback: boolean; source: "owner_setting" | "environment" }
  | { mode: "blocked"; code: BlockedCode; reason: string; model: string };

export interface ProviderStateInput {
  setting: {
    provider: "fixture" | "anthropic";
    /** Whether an encrypted key is stored, readable or not. */
    keyStored: boolean;
    /** The decrypted key, or undefined when none is stored or it cannot be read. */
    key: string | undefined;
    model: string | null;
    refusalFallback: boolean;
    approval: PaidUseApproval | null;
  } | null;
  env: { provider: "fixture" | "anthropic"; apiKey?: string; defaultModel: string };
  limits: { perRunUsd: number; dailyUsd: number; monthlyUsd: number };
}

export const BLOCKED_REASON: Record<BlockedCode, string> = {
  no_key: "A live model is selected but no API key is stored. Add one in Settings, or choose the scripted demo.",
  key_unreadable: "The stored API key can no longer be read (the server secret changed). Enter the key again in Settings.",
  unsupported_model: "The chosen model is not one Corniversity supports. Choose a model in Settings.",
  not_approved: "A live model is configured but paid use has not been approved. Approve it, with your limits, in Settings.",
  approval_outdated: "The model, the fallback setting or a spending limit changed after paid use was approved. Approve again in Settings.",
};

export function decideProviderState(input: ProviderStateInput): ProviderState {
  const { setting, env, limits } = input;
  if (setting?.provider === "fixture") return { mode: "scripted", reason: "owner_chose_scripted" };
  const wantsLive = setting ? setting.provider === "anthropic" : env.provider === "anthropic";
  if (!wantsLive) return { mode: "scripted", reason: "not_configured" };

  const model = setting?.model ?? env.defaultModel;
  const blocked = (code: BlockedCode): ProviderState => ({ mode: "blocked", code, reason: BLOCKED_REASON[code], model });
  let apiKey: string;
  let source: "owner_setting" | "environment";
  if (setting?.keyStored) {
    if (!setting.key) return blocked("key_unreadable");
    apiKey = setting.key;
    source = "owner_setting";
  } else if (env.apiKey) {
    apiKey = env.apiKey;
    source = "environment";
  } else {
    return blocked("no_key");
  }
  if (!isSupportedModel(model)) return blocked("unsupported_model");
  const refusalFallback = setting?.refusalFallback ?? true;
  const approval = setting?.approval ?? null;
  if (!approval) return blocked("not_approved");
  if (!approvalCovers(approval, { model, refusalFallback, ...limits })) return blocked("approval_outdated");
  return { mode: "live", apiKey, model, refusalFallback, source };
}

/**
 * An approval covers the current settings when the model is the one approved, no limit is
 * higher than approved, and refusal fallback (which can double a run's worst case) is on only
 * if it was on when approved. Lowering a limit or turning fallback off needs no new approval.
 */
export function approvalCovers(
  approval: PaidUseApproval,
  current: { model: string; refusalFallback: boolean; perRunUsd: number; dailyUsd: number; monthlyUsd: number },
): boolean {
  return (
    approval.model === current.model &&
    (!current.refusalFallback || approval.refusalFallback) &&
    current.perRunUsd <= approval.perRunUsd &&
    current.dailyUsd <= approval.dailyUsd &&
    current.monthlyUsd <= approval.monthlyUsd
  );
}

export function publicProviderState(state: ProviderState): PublicProviderState {
  if (state.mode !== "live") return state;
  return { mode: "live", model: state.model, refusalFallback: state.refusalFallback, source: state.source };
}
