import "server-only";
import {
  type AttemptUsage,
  type ChatMessage,
  modelLabel,
  PRICING_VERSION,
  ProviderError,
  providerLabel,
  providerNameOf,
  type RoleName,
  turnNotes,
} from "@corniversity/ai";
import type { DbOrTx } from "@corniversity/db/client";
import type { Env } from "@corniversity/db/env";
import { planRun, type RunPlan } from "@corniversity/db/services/ai-runs";
import { finishProviderRun, type RunStatus, recordProviderRun } from "@corniversity/db/services/provider-config";
import { NextResponse } from "next/server";
import { personaStream } from "./persona-stream";

/** One persona turn to run: who speaks, for what, with which prompt and messages. */
export interface TurnInput {
  database: DbOrTx;
  ownerId: string;
  env: Env;
  role: RoleName;
  purpose: string;
  promptVersion: string;
  system: string;
  messages: ChatMessage[];
  /** Which scripted response the scripted demo uses; a live model ignores it. */
  scenario: string;
  /** Who is speaking, for notes such as "the tutor could not reply". */
  speaker: string;
  /** Names this provider call, so a repeated request cannot reserve or bill it twice. */
  idempotencyKey?: string;
  /** The run of the action that started this one (an earlier speaker in the same discussion). */
  parentRunId?: string;
}

type Runnable = Exclude<RunPlan, { kind: "refused" }>;
type Refused = Extract<RunPlan, { kind: "refused" }>;

interface Outcome {
  status: Exclude<RunStatus, "running">;
  errorText?: string;
  attempts: AttemptUsage[];
  model: string;
}

/** Everything the request sends, for the strict worst case: the system prompt and every message. */
const promptOf = (input: TurnInput) => ({
  text: `${input.system}\n${input.messages.map((m) => m.content).join("\n")}`,
  messages: input.messages.length + 1,
});

/**
 * Runs the turn on the planned provider, yielding its text and then any notes about how it was
 * produced. A provider failure is reported in the text and never replaced by a canned answer;
 * the usage of attempts that ran before a failure is kept so their cost is recorded.
 */
async function* produce(plan: Runnable, input: TurnInput): AsyncGenerator<string, Outcome, void> {
  try {
    const generator = plan.provider.streamText({
      role: input.role,
      purpose: input.purpose,
      system: input.system,
      messages: input.messages,
      maxTokens: plan.maxTokens,
      effort: plan.effort,
      scenario: input.scenario,
    });
    let next = await generator.next();
    while (!next.done) {
      yield next.value;
      next = await generator.next();
    }
    const result = next.value;
    for (const note of turnNotes(result)) yield note;
    return { status: result.stopReason === "refusal" ? "refused" : "ok", attempts: result.attempts, model: result.model };
  } catch (error) {
    const errorText = error instanceof ProviderError ? error.message : "The provider failed.";
    yield `\n\n*(${input.speaker} could not reply: ${errorText} Your work is saved; the sources and your notes remain available.)*`;
    // When the provider may have billed more than it reported (a broken stream, a lost
    // connection), the run stays held at its worst case until it is settled, never recorded free.
    const uncertain = !(error instanceof ProviderError) || error.billing === "uncertain";
    return {
      status: plan.kind === "live" && uncertain ? "unsettled" : "error",
      errorText,
      attempts: error instanceof ProviderError ? error.attempts : [],
      model: plan.model,
    };
  }
}

/** Finishes a live run's reservation with what it cost, or records a scripted run. */
async function record(input: TurnInput, plan: Runnable, outcome: Outcome, startedAt: Date): Promise<string> {
  if (plan.kind === "live") {
    await finishProviderRun(input.database, plan.runId, {
      status: outcome.status,
      model: outcome.model,
      error: outcome.errorText ?? null,
      attempts: outcome.attempts,
    });
    return plan.runId;
  }
  return recordProviderRun(input.database, {
    ownerId: input.ownerId,
    role: input.role,
    provider: "fixture",
    model: outcome.model,
    purpose: input.purpose,
    pricingVersion: PRICING_VERSION,
    promptVersion: input.promptVersion,
    status: outcome.status,
    error: outcome.errorText ?? null,
    attempts: outcome.attempts,
    worstCaseUsd: null,
    startedAt,
  });
}

async function recordRefusal(input: TurnInput, plan: Refused): Promise<void> {
  // A duplicate of a call already reserved records nothing new: the first reservation stands.
  if (plan.status === "duplicate") return;
  await recordProviderRun(input.database, {
    ownerId: input.ownerId,
    role: input.role,
    provider: providerNameOf(plan.state),
    model: plan.model,
    purpose: input.purpose,
    pricingVersion: PRICING_VERSION,
    promptVersion: input.promptVersion,
    status: plan.status,
    error: plan.reason,
    attempts: [],
    worstCaseUsd: plan.worstCaseUsd,
    startedAt: new Date(),
  });
}

/** The answer to a refused run: the reason, as the panels display it; nothing scripted in its place. */
function refusalResponse(plan: Refused): Response {
  return NextResponse.json(
    { error: plan.reason, message: plan.reason, code: plan.status },
    { status: plan.status === "budget_blocked" ? 402 : 409 },
  );
}

/**
 * A streamed persona turn for the tutor, the director and the reading room. The caller has
 * already stored the learner's message, so a refused or failed run loses nothing; `onFinish`
 * stores the reply with the id of the run that produced it, which is how every stored reply is
 * labelled scripted or live afterwards.
 */
export async function streamPersonaTurn(
  input: TurnInput & { prefix?: string; onFinish: (raw: string, runId: string) => Promise<void> },
): Promise<Response> {
  const plan = await planRun(input.database, input.ownerId, input.env, input.role, promptOf(input), {
    purpose: input.purpose,
    promptVersion: input.promptVersion,
    idempotencyKey: input.idempotencyKey,
    parentRunId: input.parentRunId,
  });
  if (plan.kind === "refused") {
    await recordRefusal(input, plan);
    return refusalResponse(plan);
  }
  const startedAt = new Date();
  // The turn runs to its end even if the learner leaves mid-reply: it has been billed, so it is
  // recorded, and the reply is stored for when they come back.
  const stream = personaStream({
    prefix: input.prefix,
    produce: () => produce(plan, input),
    finish: async (raw, outcome) => {
      const runId = await record(input, plan, outcome, startedAt);
      if (raw.trim().length > 0) await input.onFinish(raw, runId);
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
      "x-provider-mode": plan.kind,
      "x-provider-label": plan.state.mode === "plan" ? providerLabel(plan.state) : modelLabel(plan.model),
      ...(plan.kind === "live" && plan.warnings.length ? { "x-budget-warning": encodeURIComponent(plan.warnings.join(" ")) } : {}),
    },
  });
}

/** A persona turn collected whole, for discussions, where each participant speaks in turn. */
export async function collectPersonaText(
  input: TurnInput,
): Promise<
  { kind: "refused"; reason: string } | { kind: "done"; text: string; runId: string; status: RunStatus; mode: "scripted" | "live" }
> {
  const plan = await planRun(input.database, input.ownerId, input.env, input.role, promptOf(input), {
    purpose: input.purpose,
    promptVersion: input.promptVersion,
    idempotencyKey: input.idempotencyKey,
    parentRunId: input.parentRunId,
  });
  if (plan.kind === "refused") {
    await recordRefusal(input, plan);
    return { kind: "refused", reason: plan.reason };
  }
  const startedAt = new Date();
  let text = "";
  const generator = produce(plan, input);
  let next = await generator.next();
  while (!next.done) {
    text += next.value;
    next = await generator.next();
  }
  const runId = await record(input, plan, next.value, startedAt);
  return { kind: "done", text, runId, status: next.value.status, mode: plan.kind };
}
