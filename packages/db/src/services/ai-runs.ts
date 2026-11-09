import {
  createProvider,
  decideBudget,
  type ModelProvider,
  type PublicProviderState,
  publicProviderState,
  ROLE_CONTRACTS,
  type RoleName,
  worstCaseRunUsd,
} from "@corniversity/ai";
import type { DbOrTx } from "../client";
import type { Env } from "../env";
import { getBudgetLimits, getSpend, resolveProviderState } from "./provider-config";

type Effort = "low" | "medium" | "high";

export type RunPlan =
  | { kind: "scripted"; provider: ModelProvider; model: "fixture"; effort: Effort; maxTokens: number; state: PublicProviderState }
  | {
      kind: "live";
      provider: ModelProvider;
      model: string;
      effort: Effort;
      maxTokens: number;
      worstCaseUsd: number;
      warnings: string[];
      state: PublicProviderState;
    }
  | {
      kind: "refused";
      status: "blocked" | "budget_blocked";
      reason: string;
      model: string;
      worstCaseUsd: number | null;
      state: PublicProviderState;
    };

/**
 * Everything a route or the worker needs before a model call, decided in one place: the
 * provider state, the role's effort and output allowance, the worst case of the run and the
 * budget decision. A blocked provider or a crossed limit refuses the run with its reason; it
 * never turns into a scripted reply. `inputText` is everything that will be sent (system prompt
 * and messages), for the worst-case estimate.
 */
export async function planRun(
  db: DbOrTx,
  ownerId: string,
  env: Env,
  role: RoleName,
  inputText: string,
  options: { fixtureRoot?: string } = {},
): Promise<RunPlan> {
  const state = await resolveProviderState(db, ownerId, env);
  const contract = ROLE_CONTRACTS[role];
  const { effort, maxOutputTokens: maxTokens } = contract.limits;
  const view = publicProviderState(state);
  if (state.mode === "scripted") {
    return {
      kind: "scripted",
      provider: createProvider({ provider: "fixture", fixtureRoot: options.fixtureRoot }),
      model: "fixture",
      effort,
      maxTokens,
      state: view,
    };
  }
  if (state.mode === "blocked") {
    return { kind: "refused", status: "blocked", reason: state.reason, model: state.model, worstCaseUsd: null, state: view };
  }
  const worstCaseUsd = worstCaseRunUsd(state.model, inputText, maxTokens, state.refusalFallback);
  const decision = decideBudget(
    await getBudgetLimits(db, ownerId, env),
    await getSpend(db, ownerId),
    worstCaseUsd,
    contract.limits.maxRunUsd,
  );
  if (!decision.allowed) {
    return { kind: "refused", status: "budget_blocked", reason: decision.reason, model: state.model, worstCaseUsd, state: view };
  }
  return {
    kind: "live",
    provider: createProvider({ provider: "anthropic", apiKey: state.apiKey, model: state.model, refusalFallback: state.refusalFallback }),
    model: state.model,
    effort,
    maxTokens,
    worstCaseUsd,
    warnings: decision.warnings,
    state: view,
  };
}
