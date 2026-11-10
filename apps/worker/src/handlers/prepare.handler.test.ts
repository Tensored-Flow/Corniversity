import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { defaultContentRoot, loadContent } from "@corniversity/content/load";
import { seedContent } from "@corniversity/content/seed";
import { createDb } from "@corniversity/db/client";
import { getEnv } from "@corniversity/db/env";
import { stopBoss } from "@corniversity/db/queue";
import { user } from "@corniversity/db/schema/auth";
import { instructorArtifact, providerRun, teachingUnit, unitDraft, unitExercise, unitPublication } from "@corniversity/db/schema/index";
import { confirmPreparation, createPreparationRequest, preparationView, publishDraft } from "@corniversity/db/services/preparation";
import { approvePaidUse, saveBudgetLimits, saveProviderSetting } from "@corniversity/db/services/provider-config";
import { eq, inArray } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { HandlerContext } from "./index";
import { prepareHandler } from "./prepare";

/**
 * Course preparation with a live model, through the real SDK against a local server speaking the
 * documented wire format (nothing leaves the machine; nothing here says how good a real draft is).
 * It checks the budget gate, the draft and its checks, the owner's publication and that the
 * content seeder never restores the outline of a published unit.
 */
const OWNER = `prepare-live-${randomUUID()}`;
const UNIT = "NEU-220-u05";
const KEY = "sk-ant-prepare-test-0000000000000";
const bundle = loadContent(defaultContentRoot());
let handle: ReturnType<typeof createDb>;
let ctx: HandlerContext;
let calls = 0;

const lesson = `## Decoding with deep networks\n\n${"A deep network maps population activity to a decoded variable; its capacity must be controlled by held-out evaluation. ".repeat(40)}\n\nThe loss is $L(\\theta) = \\sum_i \\ell(y_i, f_\\theta(x_i))$.`;
const server = createServer(async (req, res) => {
  for await (const _ of req) {
    // drain
  }
  calls += 1;
  const draft = {
    lessonMarkdown: lesson,
    objectives: ["Explain how a decoder is evaluated on held-out trials."],
    sourceLocatorIds: ["nma-w1d5"],
    exercises: [
      {
        title: "Held-out evaluation",
        kind: "explanation",
        promptMarkdown: "Explain why a decoder's training accuracy can mislead, and design a held-out evaluation for it.",
        hintLadder: ["What does the decoder see during training that it will not see in use?"],
        criteria: [
          { criterion: "Identifies overfitting as the risk.", weight: 0.5 },
          { criterion: "Proposes a split that matches the intended use.", weight: 0.5 },
        ],
        referenceSolution:
          "Training accuracy rewards memorising noise; evaluation must use trials withheld from fitting, split by session if use is across sessions.",
        stage: "independent",
      },
    ],
    misconceptions: [
      { claim: "Higher training accuracy means a better decoder.", correction: "Only held-out performance speaks to generalisation." },
    ],
  };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      id: "msg_prepare",
      type: "message",
      role: "assistant",
      model: "claude-opus-5-5",
      content: [{ type: "text", text: JSON.stringify(draft) }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 3000, output_tokens: 2500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    }),
  );
});

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 3 });
  await seedContent(handle.db, bundle);
  await handle.db.insert(user).values({ id: OWNER, name: "Prepare Test", email: `${OWNER}@example.test` });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await saveBudgetLimits(handle.db, OWNER, { perRunUsd: 5, dailyUsd: 20, monthlyUsd: 100 });
  await saveProviderSetting(handle.db, OWNER, getEnv(), {
    provider: "anthropic",
    model: "claude-opus-5-5",
    apiKey: KEY,
    refusalFallback: false,
  });
  await approvePaidUse(handle.db, OWNER, getEnv());
  ctx = { db: handle.db, env: getEnv(), boss: {} as PgBoss };
});

afterAll(async () => {
  delete process.env.ANTHROPIC_BASE_URL;
  await handle.db.delete(unitPublication).where(eq(unitPublication.ownerId, OWNER));
  await handle.db.delete(instructorArtifact).where(eq(instructorArtifact.unitId, UNIT));
  await handle.db.delete(unitExercise).where(inArray(unitExercise.id, [`${UNIT}-p1-ex1`]));
  await handle.db.delete(unitDraft).where(eq(unitDraft.ownerId, OWNER));
  await handle.db.delete(providerRun).where(eq(providerRun.ownerId, OWNER));
  await handle.db.delete(user).where(eq(user.id, OWNER));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await stopBoss();
  await handle.close();
});

const intake = {
  goal: "Learn neural decoding properly, from the course book.",
  depth: "rigorous",
  weeklyHours: 5,
  preferredSources: "",
  balance: "balanced",
  assessment: "feedback",
  materials: "",
  bufferUnits: 1,
};

describe("preparation with a live model", () => {
  it("refuses a model step whose worst case exceeds the request's budget, before anything is sent", async () => {
    const request = await createPreparationRequest(handle.db, getEnv(), OWNER, {
      courseId: "NEU-220",
      intake,
      budgetUsd: 0.05,
      autoPrepare: false,
    });
    await confirmPreparation(handle.db, OWNER, request.id);
    calls = 0;
    const result = await prepareHandler(ctx, { idempotencyKey: `t:${request.id}`, ownerId: OWNER, requestId: request.id });
    expect(result).toMatchObject({ status: "blocked" });
    expect(calls).toBe(0);
    const view = await preparationView(handle.db, OWNER, request.id);
    expect(view!.stages.find((s) => s.stageKey === "unit_authoring")?.error).toMatch(/budget is left/);
    const runs = await handle.db
      .select()
      .from(providerRun)
      .where(eq(providerRun.purpose, `prepare:${request.id}`));
    expect(runs.every((r) => r.status === "budget_blocked" && Number(r.costUsd) === 0)).toBe(true);
  });

  it("drafts the next outlined unit, checks it, and publishes it only when the owner does; re-seeding keeps it", async () => {
    const request = await createPreparationRequest(handle.db, getEnv(), OWNER, {
      courseId: "NEU-220",
      intake,
      budgetUsd: 5,
      autoPrepare: false,
    });
    await confirmPreparation(handle.db, OWNER, request.id);
    calls = 0;
    const result = await prepareHandler(ctx, { idempotencyKey: `t:${request.id}`, ownerId: OWNER, requestId: request.id });
    expect(calls).toBe(1);
    expect(result).toMatchObject({ status: "awaiting_review" });
    const view = await preparationView(handle.db, OWNER, request.id);
    const [draft] = view!.drafts;
    expect(draft).toMatchObject({ unitId: UNIT, status: "checked" });
    expect(draft!.checks.every((c) => c.result === "pass")).toBe(true);
    const [beforePublish] = await handle.db.select().from(teachingUnit).where(eq(teachingUnit.id, UNIT));
    expect(beforePublish?.status).toBe("draft"); // nothing published by the pipeline itself

    await publishDraft(handle.db, OWNER, draft!.id);
    const [published] = await handle.db.select().from(teachingUnit).where(eq(teachingUnit.id, UNIT));
    expect(published).toMatchObject({ status: "ready" });
    expect(published!.lessonMarkdown).toContain("Decoding with deep networks");

    // A changed course makes a new course version; the published unit keeps its content.
    const changed = {
      ...bundle,
      courses: bundle.courses.map((c) =>
        c.spec.id === "NEU-220" ? { ...c, spec: { ...c.spec, description: `${c.spec.description} (revised)` } } : c,
      ),
    };
    const report = await seedContent(handle.db, changed);
    expect(report.courseVersionsCreated).toBeGreaterThanOrEqual(1);
    const [afterSeed] = await handle.db.select().from(teachingUnit).where(eq(teachingUnit.id, UNIT));
    expect(afterSeed).toMatchObject({ status: "ready" });
    expect(afterSeed!.lessonMarkdown).toContain("Decoding with deep networks");
    // Restore the original description for other tests sharing the database.
    await seedContent(handle.db, bundle);
  });
});
