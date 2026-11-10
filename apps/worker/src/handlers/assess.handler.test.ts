import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { defaultContentRoot, loadContent } from "@corniversity/content/load";
import { seedContent } from "@corniversity/content/seed";
import { hiddenRuns, WITHHELD } from "@corniversity/core/checks/leakage";
import { createDb } from "@corniversity/db/client";
import { getEnv } from "@corniversity/db/env";
import { stopBoss } from "@corniversity/db/queue";
import { user } from "@corniversity/db/schema/auth";
import { assessmentRun, attempt, evidenceEvent, instructorArtifact, providerRun, unitExercise } from "@corniversity/db/schema/index";
import { fileReview, getOrCreateAttempt, submitAttempt } from "@corniversity/db/services/learning";
import { approvePaidUse, saveBudgetLimits, saveProviderSetting } from "@corniversity/db/services/provider-config";
import { and, eq, inArray } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assessHandler } from "./assess";
import type { HandlerContext } from "./index";

/**
 * The assessment job against PostgreSQL. A live model runs through the real SDK pointed at a
 * local server that answers in the documented wire format, so no request leaves the machine and
 * nothing here says how a real model judges: it checks what the job sends, records and stores.
 */
const SCRIPTED_OWNER = `assess-scripted-${randomUUID()}`;
const LIVE_OWNER = `assess-live-${randomUUID()}`;
const EXERCISE = "MAT-230-u01-ex1";
const TEST_EXERCISE = `MAT-230-u01-snapshot-${randomUUID().slice(0, 8)}`;
const KEY = "sk-ant-assess-test-0000000000";
const bundle = loadContent(defaultContentRoot());

let handle: ReturnType<typeof createDb>;
let ctx: HandlerContext;
let mode: "answer" | "unauthorised" = "answer";
let answer: Record<string, unknown> = {};
let received: { system: string }[] = [];
const server = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || "{}") as { system?: { text: string }[] };
  received.push({ system: (body.system ?? []).map((b) => b.text).join("\n") });
  if (mode === "unauthorised") {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      id: "msg_assess",
      type: "message",
      role: "assistant",
      model: "claude-opus-5-5",
      content: [{ type: "text", text: JSON.stringify(answer) }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 2000, output_tokens: 600, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    }),
  );
});

const judgement = (summary: string) => ({
  verdict: "revision_requested",
  confidence: 0.8,
  summary,
  firstGap: null,
  checks: [{ criterionId: "c1", status: "partially_met", comment: "The family of functions is well chosen." }],
  strengths: ["A clear construction."],
  nextStep: "State the inequality you are refuting.",
  alternateApproachRecognised: false,
  hypothesesChecked: [],
  citationTags: [],
});

const graderConfig = { provider: "fixture", model: "fixture", promptVersion: "test", roleVersion: "test" };

async function submitAndAssess(ownerId: string, exerciseId: string, content: string) {
  const a = await getOrCreateAttempt(handle.db, { ownerId, exerciseId });
  const submitted = await submitAttempt(handle.db, { ownerId, attemptId: a.id, contentMarkdown: content, graderConfig });
  const payload = {
    idempotencyKey: `assess:test:${submitted.assessmentRunId}`,
    ownerId,
    submissionVersionId: submitted.submissionVersionId,
    assessmentRunId: submitted.assessmentRunId,
  };
  return { submitted, payload };
}

async function runOf(id: string) {
  const [run] = await handle.db.select().from(assessmentRun).where(eq(assessmentRun.id, id));
  const [recorded] = run?.providerRunId ? await handle.db.select().from(providerRun).where(eq(providerRun.id, run.providerRunId)) : [];
  return { run: run!, recorded };
}

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 3 });
  await seedContent(handle.db, bundle);
  for (const id of [SCRIPTED_OWNER, LIVE_OWNER]) {
    await handle.db.insert(user).values({ id, name: "Assess Test", email: `${id}@example.test` });
  }
  await saveBudgetLimits(handle.db, LIVE_OWNER, { perRunUsd: 1, dailyUsd: 3, monthlyUsd: 40 });
  await saveProviderSetting(handle.db, LIVE_OWNER, getEnv(), {
    provider: "anthropic",
    model: "claude-opus-5-5",
    apiKey: KEY,
    refusalFallback: true,
  });
  await approvePaidUse(handle.db, LIVE_OWNER, getEnv());
  const [source] = await handle.db.select().from(unitExercise).where(eq(unitExercise.id, EXERCISE));
  await handle.db.insert(unitExercise).values({ ...source!, id: TEST_EXERCISE, promptMarkdown: "ORIGINAL PROMPT: compare the two norms." });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  ctx = { db: handle.db, env: getEnv(), boss: {} as PgBoss };
}, 180_000);

afterAll(async () => {
  delete process.env.ANTHROPIC_BASE_URL;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const owners = [SCRIPTED_OWNER, LIVE_OWNER];
  await handle.db.delete(evidenceEvent).where(inArray(evidenceEvent.ownerId, owners));
  await handle.db.delete(attempt).where(inArray(attempt.ownerId, owners));
  await handle.db.delete(unitExercise).where(eq(unitExercise.id, TEST_EXERCISE));
  await stopBoss();
  await handle.close();
});

describe("assessment without a model", () => {
  it("is labelled scripted, gives no verdict and keeps the exercise as it was answered", async () => {
    const { submitted, payload } = await submitAndAssess(
      SCRIPTED_OWNER,
      EXERCISE,
      "Since all norms are equivalent, nothing is special here.",
    );
    await assessHandler(ctx, payload);
    const { run, recorded } = await runOf(submitted.assessmentRunId);
    expect(run.status).toBe("needs_review");
    expect(run.graderConfig.provider).toBe("fixture");
    expect(recorded).toMatchObject({ provider: "fixture", status: "ok", costUsd: "0.000000" });
    const [exercise] = await handle.db.select().from(unitExercise).where(eq(unitExercise.id, EXERCISE));
    expect(run.exerciseSnapshot).toMatchObject({ promptMarkdown: exercise!.promptMarkdown, rubricVersion: exercise!.rubricVersion });
  });
});

describe("assessment by a live model", () => {
  it("records the run at what it cost, and stores the feedback labelled with the model", async () => {
    mode = "answer";
    answer = judgement("The construction works; the unboundedness of the ratio still needs saying.");
    const { submitted, payload } = await submitAndAssess(LIVE_OWNER, EXERCISE, "Let f_n(x) = x^n. Then the sup norm is 1.");
    await assessHandler(ctx, payload);
    const { run, recorded } = await runOf(submitted.assessmentRunId);
    expect(["feedback_ready", "needs_review"]).toContain(run.status);
    expect(run.graderConfig).toMatchObject({ provider: "anthropic", model: "claude-opus-5-5" });
    expect(run.feedback?.summary).toContain("the unboundedness of the ratio");
    // 2000*$4/M + 600*$20/M = $0.02, finished rather than left holding its worst case.
    expect(recorded).toMatchObject({ provider: "anthropic", status: "ok", inputTokens: 2000, outputTokens: 600 });
    expect(Number(recorded!.costUsd)).toBeCloseTo(0.02, 9);
    expect(Number(recorded!.worstCaseUsd)).toBeGreaterThan(0.6);
    expect(recorded!.finishedAt).not.toBeNull();
  });

  it("withholds feedback that repeats the reference solution", async () => {
    const [reference] = await handle.db
      .select()
      .from(instructorArtifact)
      .where(and(eq(instructorArtifact.exerciseId, EXERCISE), eq(instructorArtifact.kind, "reference_solution")));
    const [exercise] = await handle.db.select().from(unitExercise).where(eq(unitExercise.id, EXERCISE));
    const content = "Let g_n be a sequence of continuous functions.";
    const [run10] = hiddenRuns(reference!.markdown, [exercise!.promptMarkdown, content]);
    answer = judgement(`The reference argument is: ${run10}.`);
    const { submitted, payload } = await submitAndAssess(LIVE_OWNER, EXERCISE, content);
    await assessHandler(ctx, payload);
    const { run } = await runOf(submitted.assessmentRunId);
    expect(run.feedback?.summary).toContain(WITHHELD);
    expect(run.feedback?.summary).not.toContain(run10!);
  });

  it("fails with the provider's reason when the key is rejected, and costs nothing", async () => {
    mode = "unauthorised";
    const { submitted, payload } = await submitAndAssess(LIVE_OWNER, EXERCISE, "Another attempt.");
    await assessHandler(ctx, payload);
    const { run, recorded } = await runOf(submitted.assessmentRunId);
    expect(run).toMatchObject({ status: "failed", error: "The Anthropic API key was rejected." });
    expect(run.feedback).toBeNull();
    expect(recorded).toMatchObject({ status: "error", costUsd: "0.000000" });
    mode = "answer";
  });

  it("is refused by the limits before anything is sent", async () => {
    await saveBudgetLimits(handle.db, LIVE_OWNER, { perRunUsd: 0.01, dailyUsd: 0.01, monthlyUsd: 0.01 });
    received = [];
    const { submitted, payload } = await submitAndAssess(LIVE_OWNER, EXERCISE, "One more attempt.");
    await assessHandler(ctx, payload);
    const { run, recorded } = await runOf(submitted.assessmentRunId);
    expect(received).toHaveLength(0);
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/per-run limit/);
    expect(recorded).toMatchObject({ status: "budget_blocked", costUsd: "0.000000" });
    await saveBudgetLimits(handle.db, LIVE_OWNER, { perRunUsd: 1, dailyUsd: 3, monthlyUsd: 40 });
  });

  it("assesses against the exercise as answered, after the exercise is repaired, and a regrade keeps it", async () => {
    answer = judgement("Assessed.");
    const { submitted, payload } = await submitAndAssess(LIVE_OWNER, TEST_EXERCISE, "Let f_n(x) = x^n.");
    await handle.db
      .update(unitExercise)
      .set({ promptMarkdown: "REPAIRED PROMPT: something else.", rubricVersion: 99 })
      .where(eq(unitExercise.id, TEST_EXERCISE));
    received = [];
    await assessHandler(ctx, payload);
    expect(received[0]?.system).toContain("ORIGINAL PROMPT: compare the two norms.");
    expect(received[0]?.system).not.toContain("REPAIRED PROMPT");
    const { run } = await runOf(submitted.assessmentRunId);
    expect(run.exerciseSnapshot?.promptMarkdown).toBe("ORIGINAL PROMPT: compare the two norms.");
    expect(run.rubricVersion).not.toBe(99);
    await fileReview(handle.db, { ownerId: LIVE_OWNER, assessmentRunId: run.id, kind: "regrade", note: "Please look again." });
    const runs = await handle.db.select().from(assessmentRun).where(eq(assessmentRun.submissionVersionId, submitted.submissionVersionId));
    const regrade = runs.find((r) => r.id !== run.id);
    expect(regrade?.exerciseSnapshot).toEqual(run.exerciseSnapshot);
    expect(regrade?.rubricVersion).toBe(run.rubricVersion);
  });
});
