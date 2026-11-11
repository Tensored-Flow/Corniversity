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

/**
 * What the owner approved for teaching through their own ChatGPT plan: the model and a finite
 * number of requests a day and a month (UTC). Plan usage is not billed per request here, but it
 * draws on the plan's own limits and, where the plan has one, its credits balance.
 */
export interface PlanUseApproval {
  model: string;
  dailyRequests: number;
  monthlyRequests: number;
  approvedAt: string;
}

export const PLAN_REQUEST_CEILINGS = { dailyRequests: 200, monthlyRequests: 3000 } as const;
export const DEFAULT_PLAN_LIMITS = { dailyRequests: 30, monthlyRequests: 300 } as const;

export type BlockedCode =
  | "no_key"
  | "key_unreadable"
  | "unsupported_model"
  | "not_approved"
  | "approval_outdated"
  | "plan_unavailable_here"
  | "plan_not_connected"
  | "plan_reconnect"
  | "plan_no_model"
  | "plan_not_approved"
  | "plan_approval_outdated"
  | "plan_paused";

/**
 * Which provider a learner's runs use. There are four states and no silent movement between
 * them: the scripted demo (no model, nothing sent anywhere), a live model on the API key the
 * owner approved for paid use, the owner's own ChatGPT plan within the request limits they
 * approved (local installation only), or blocked, when a live model was chosen but cannot run.
 * A blocked state never falls back to scripted responses or to another provider; the learner is
 * told why and what to change.
 */
export type ProviderState =
  | { mode: "scripted"; reason: "not_configured" | "owner_chose_scripted" }
  | { mode: "live"; apiKey: string; model: string; refusalFallback: boolean; source: "owner_setting" | "environment" }
  | { mode: "plan"; model: string; dailyRequests: number; monthlyRequests: number }
  | { mode: "blocked"; code: BlockedCode; reason: string; model: string };

/** The state without the key, for pages and logs. */
export type PublicProviderState =
  | { mode: "scripted"; reason: "not_configured" | "owner_chose_scripted" }
  | { mode: "live"; model: string; refusalFallback: boolean; source: "owner_setting" | "environment" }
  | { mode: "plan"; model: string; dailyRequests: number; monthlyRequests: number }
  | { mode: "blocked"; code: BlockedCode; reason: string; model: string };

/** What decides whether the owner's ChatGPT plan may teach. */
export interface PlanStateInput {
  /** Null when this installation may use plan usage (local, on a loopback address); else why not. */
  unavailableReason: string | null;
  /** Saved credentials with plan permission for this owner; `reconnect` when they can no longer be used. */
  connection: "connected" | "missing" | "reconnect";
  model: string | null;
  approval: PlanUseApproval | null;
  limits: { dailyRequests: number; monthlyRequests: number };
  /** Why plan requests are paused (a usage limit, or plan usage not available), until the owner resumes. */
  pausedReason: string | null;
}

export interface ProviderStateInput {
  setting: {
    provider: "fixture" | "anthropic" | "chatgpt_plan";
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
  /** Needed only when the owner chose their ChatGPT plan. */
  plan?: PlanStateInput;
}

export const BLOCKED_REASON: Record<BlockedCode, string> = {
  no_key: "A live model is selected but no API key is stored. Add one in Settings, or choose the scripted demo.",
  key_unreadable: "The stored API key can no longer be read (the server secret changed). Enter the key again in Settings.",
  unsupported_model: "The chosen model is not one Corniversity supports. Choose a model in Settings.",
  not_approved: "A live model is configured but paid use has not been approved. Approve it, with your limits, in Settings.",
  approval_outdated: "The model, the fallback setting or a spending limit changed after paid use was approved. Approve again in Settings.",
  plan_unavailable_here: "Your ChatGPT plan works only in the local installation on your own computer.",
  plan_not_connected: "Your ChatGPT plan is chosen but not connected. Continue with ChatGPT in Settings.",
  plan_reconnect: "The ChatGPT sign-in can no longer be used. Continue with ChatGPT in Settings to sign in again.",
  plan_no_model: "Choose a model from your ChatGPT account in Settings.",
  plan_not_approved: "Your ChatGPT plan is connected but its use has not been approved. Approve it, with request limits, in Settings.",
  plan_approval_outdated: "The model or a request limit changed after plan use was approved. Approve again in Settings.",
  plan_paused: "Requests through your ChatGPT plan are paused. Resume them in Settings when you are ready.",
};

/**
 * The owner's ChatGPT plan may teach when this installation is local, the plan is connected, a
 * model is chosen and the owner approved its use with request limits that still cover the
 * settings, and nothing has paused it.
 */
export function decidePlanState(plan: PlanStateInput | undefined): ProviderState {
  const model = plan?.model ?? "chatgpt-plan";
  const blocked = (code: BlockedCode, reason = BLOCKED_REASON[code]): ProviderState => ({ mode: "blocked", code, reason, model });
  if (!plan || plan.unavailableReason) return blocked("plan_unavailable_here");
  if (plan.connection === "missing") return blocked("plan_not_connected");
  if (plan.connection === "reconnect") return blocked("plan_reconnect");
  if (!plan.model) return blocked("plan_no_model");
  if (plan.pausedReason) return blocked("plan_paused", `${BLOCKED_REASON.plan_paused} (${plan.pausedReason})`);
  if (!plan.approval) return blocked("plan_not_approved");
  if (!planApprovalCovers(plan.approval, { model: plan.model, ...plan.limits })) return blocked("plan_approval_outdated");
  return { mode: "plan", model: plan.model, ...plan.limits };
}

/** An approval covers the settings when the model is the approved one and no request limit is higher. */
export function planApprovalCovers(
  approval: PlanUseApproval,
  current: { model: string; dailyRequests: number; monthlyRequests: number },
): boolean {
  return (
    approval.model === current.model &&
    current.dailyRequests <= approval.dailyRequests &&
    current.monthlyRequests <= approval.monthlyRequests
  );
}

export class PlanLimitError extends Error {}

/** Request limits: whole numbers, at least 1, within the ceilings, the daily limit not above the monthly one. */
export function validatePlanLimits(input: { dailyRequests: number; monthlyRequests: number }): {
  dailyRequests: number;
  monthlyRequests: number;
} {
  for (const key of ["dailyRequests", "monthlyRequests"] as const) {
    const v = input[key];
    if (!Number.isInteger(v) || v < 1) throw new PlanLimitError("Every request limit must be a whole number of at least 1.");
    if (v > PLAN_REQUEST_CEILINGS[key]) {
      throw new PlanLimitError(
        `The ${key === "dailyRequests" ? "daily" : "monthly"} limit can be at most ${PLAN_REQUEST_CEILINGS[key]} requests.`,
      );
    }
  }
  if (input.dailyRequests > input.monthlyRequests) throw new PlanLimitError("The daily request limit cannot exceed the monthly one.");
  return { dailyRequests: input.dailyRequests, monthlyRequests: input.monthlyRequests };
}

export function decideProviderState(input: ProviderStateInput): ProviderState {
  const { setting, env, limits } = input;
  if (setting?.provider === "fixture") return { mode: "scripted", reason: "owner_chose_scripted" };
  if (setting?.provider === "chatgpt_plan") return decidePlanState(input.plan);
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

/** The provider a state names, for records: a blocked plan is still the plan, never "anthropic". */
export function providerNameOf(state: ProviderState | PublicProviderState): "fixture" | "anthropic" | "chatgpt_plan" {
  if (state.mode === "scripted") return "fixture";
  if (state.mode === "plan" || (state.mode === "blocked" && state.code.startsWith("plan_"))) return "chatgpt_plan";
  return "anthropic";
}

export function publicProviderState(state: ProviderState): PublicProviderState {
  if (state.mode !== "live") return state;
  return { mode: "live", model: state.model, refusalFallback: state.refusalFallback, source: state.source };
}
