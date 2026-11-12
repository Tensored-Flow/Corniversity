import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { defaultContentRoot, loadContent } from "@corniversity/content/load";
import { seedContent } from "@corniversity/content/seed";
import { preparationDraft } from "@corniversity/core/preparation/pipeline.fixture";
import { createDb } from "@corniversity/db/client";
import { getEnv } from "@corniversity/db/env";
import { stopBoss } from "@corniversity/db/queue";
import { user } from "@corniversity/db/schema/auth";
import {
  extractedPage,
  instructorArtifact,
  locator,
  passage,
  providerRun,
  resourceAsset,
  teachingUnit,
  unitDraft,
  unitExercise,
  unitPublication,
} from "@corniversity/db/schema/index";
import * as aiRuns from "@corniversity/db/services/ai-runs";
import * as libraryServices from "@corniversity/db/services/library";
import { setPermission } from "@corniversity/db/services/library";
import { confirmPreparation, createPreparationRequest, preparationView, publishDraft } from "@corniversity/db/services/preparation";
import {
  approvePaidUse,
  recordProviderRun,
  saveBudgetLimits,
  saveProviderSetting,
  withdrawPaidUseApproval,
} from "@corniversity/db/services/provider-config";
import { eq } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { HandlerContext } from "./index";
import { prepareHandler } from "./prepare";

/**
 * Course preparation through the real SDK against a local server speaking the
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

const PASSAGE_ID = randomUUID();
const ASSET_ID = randomUUID();
const SOURCE_TEXT =
  "A neural decoder maps population activity to a predicted variable. Fit the parameters and all preprocessing on training observations only. Select model capacity using validation data. Evaluate once on an untouched test set whose held-out unit matches the intended deployment: a trial, stimulus, session or animal. A random trial split cannot establish transfer to an unseen animal. Report the information available at inference and compare against an appropriate baseline. Predictive accuracy alone does not identify a causal mechanism.";
let received = "";
let replyMode: "valid" | "wrong-evidence" | "repetitive" = "valid";
const server = createServer(async (req, res) => {
  received = "";
  for await (const chunk of req) received += chunk.toString();
  calls += 1;
  const draft = preparationDraft(PASSAGE_ID, "nma-w1d5");
  if (replyMode === "wrong-evidence") {
    draft.sourceLocatorIds = ["fa21-l1-def14"]; // registered globally, not supplied to this run
    draft.sourcePassageIds = [randomUUID()];
  }
  if (replyMode === "repetitive")
    draft.lessonMarkdown =
      "A deep network maps population activity to a decoded variable; its capacity must be controlled by held-out evaluation. ".repeat(40);

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
  await handle.db
    .update(teachingUnit)
    .set({ objectives: preparationDraft().objectives.map((description) => ({ id: "o1", description })) })
    .where(eq(teachingUnit.id, UNIT));
  const [sourceLocation] = await handle.db.select().from(locator).where(eq(locator.id, "nma-w1d5"));
  await handle.db.insert(resourceAsset).values({
    id: ASSET_ID,
    ownerId: OWNER,
    filename: "permitted-decoding-notes.txt",
    mediaType: "text/plain",
    sizeBytes: SOURCE_TEXT.length,
    sha256: "c".repeat(64),
    status: "processed",
    origin: "web_upload",
    localOnly: false,
    sourceVersionId: sourceLocation!.sourceVersionId,
    confirmedTitle: "Test decoding reading",
    courseIds: ["NEU-220"],
  });
  const [page] = await handle.db
    .insert(extractedPage)
    .values({
      assetId: ASSET_ID,
      physicalIndex: 0,
      text: SOURCE_TEXT,
      charCount: SOURCE_TEXT.length,
      quality: { scannedSuspected: false, lowText: false, invisibleText: 0, imageCoverage: 0 },
    })
    .returning();
  await handle.db.insert(passage).values({ id: PASSAGE_ID, assetId: ASSET_ID, pageId: page!.id, ordinal: 0, text: SOURCE_TEXT });
  await setPermission(handle.db, OWNER, ASSET_ID, "external_ai", "allowed", "Authored local test fixture");
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
  await handle.db.delete(unitExercise).where(eq(unitExercise.unitId, UNIT));
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

describe("preparation with a local provider double", () => {
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

  it("never spends past the owner's daily limit, whatever the request's own budget", async () => {
    // Limits lowered below what was approved still stand (a lower limit needs no new approval).
    await saveBudgetLimits(handle.db, OWNER, { perRunUsd: 5, dailyUsd: 5, monthlyUsd: 100 });
    const spent = await recordProviderRun(handle.db, {
      ownerId: OWNER,
      role: "tutor",
      provider: "anthropic",
      model: "claude-opus-5-5",
      purpose: "earlier-today",
      pricingVersion: "test",
      promptVersion: "test",
      status: "ok",
      attempts: [
        { kind: "message", model: "claude-opus-5-5", inputTokens: 200_000, outputTokens: 200_000, cacheReadTokens: 0, cacheWriteTokens: 0 },
      ],
      startedAt: new Date(),
    });
    try {
      const request = await createPreparationRequest(handle.db, getEnv(), OWNER, {
        courseId: "NEU-220",
        intake,
        budgetUsd: 20,
        autoPrepare: false,
      });
      await confirmPreparation(handle.db, OWNER, request.id);
      calls = 0;
      const result = await prepareHandler(ctx, { idempotencyKey: `t:${request.id}`, ownerId: OWNER, requestId: request.id });
      expect(result).toMatchObject({ status: "blocked" });
      expect(calls).toBe(0);
      const view = await preparationView(handle.db, OWNER, request.id);
      expect(view!.stages.find((s) => s.stageKey === "unit_authoring")?.error).toMatch(/today|daily/i);
    } finally {
      await handle.db.delete(providerRun).where(eq(providerRun.id, spent));
      await saveBudgetLimits(handle.db, OWNER, { perRunUsd: 5, dailyUsd: 20, monthlyUsd: 100 });
    }
  });

  it("drafts nothing without the owner's approval of paid use", async () => {
    await withdrawPaidUseApproval(handle.db, OWNER);
    try {
      const request = await createPreparationRequest(handle.db, getEnv(), OWNER, {
        courseId: "NEU-220",
        intake,
        budgetUsd: 5,
        autoPrepare: false,
      });
      await confirmPreparation(handle.db, OWNER, request.id);
      calls = 0;
      const result = await prepareHandler(ctx, { idempotencyKey: `t:${request.id}`, ownerId: OWNER, requestId: request.id });
      expect(result).toMatchObject({ status: "blocked" });
      expect(calls).toBe(0);
      const view = await preparationView(handle.db, OWNER, request.id);
      expect(view!.stages.find((s) => s.stageKey === "unit_authoring")?.error).toMatch(/not been approved/);
    } finally {
      await approvePaidUse(handle.db, OWNER, getEnv());
    }
  });

  it("blocks a queued request after source consent is revoked, without creating a provider reservation", async () => {
    const request = await createPreparationRequest(handle.db, getEnv(), OWNER, {
      courseId: "NEU-220",
      intake,
      budgetUsd: 5,
      autoPrepare: false,
    });
    await confirmPreparation(handle.db, OWNER, request.id);
    await setPermission(handle.db, OWNER, ASSET_ID, "external_ai", "denied", "withdrawn before execution");
    calls = 0;
    try {
      const result = await prepareHandler(ctx, { idempotencyKey: `t:${request.id}`, ownerId: OWNER, requestId: request.id });
      expect(result).toMatchObject({ status: "blocked" });
      expect(calls).toBe(0);
      expect(
        await handle.db
          .select()
          .from(providerRun)
          .where(eq(providerRun.purpose, `prepare:${request.id}`)),
      ).toHaveLength(0);
      const view = await preparationView(handle.db, OWNER, request.id);
      expect(view!.stages.find((s) => s.stageKey === "unit_authoring")?.error).toMatch(/No permitted source passages/);
    } finally {
      await setPermission(handle.db, OWNER, ASSET_ID, "external_ai", "allowed", "restore test fixture consent");
    }
  });

  it("rejects globally valid but unsupplied citations and repetitive teaching", async () => {
    for (const mode of ["wrong-evidence", "repetitive"] as const) {
      replyMode = mode;
      const request = await createPreparationRequest(handle.db, getEnv(), OWNER, {
        courseId: "NEU-220",
        intake,
        budgetUsd: 5,
        autoPrepare: false,
      });
      await confirmPreparation(handle.db, OWNER, request.id);
      await prepareHandler(ctx, { idempotencyKey: `t:${request.id}`, ownerId: OWNER, requestId: request.id });
      const view = await preparationView(handle.db, OWNER, request.id);
      const draft = view!.drafts[0]!;
      expect(draft.status).toBe("failed_checks");
      const failed = draft.checks.filter((c) => c.result === "fail").map((c) => c.name);
      expect(failed).toContain(mode === "wrong-evidence" ? "supplied-source-passages" : "non-repetitive-teaching");
      if (mode === "wrong-evidence") expect(failed).toContain("verified-sources");
      await expect(publishDraft(handle.db, OWNER, draft.id)).rejects.toThrow(/passed every automatic check/);
    }
    replyMode = "valid";
  });

  it.each(["permission", "local-only", "deleted", "course", "edition", "passage", "check-error"])(
    "sends nothing when %s changes after source capture and provider admission",
    async (change) => {
      const [savedAsset] = await handle.db.select().from(resourceAsset).where(eq(resourceAsset.id, ASSET_ID));
      const [savedPassage] = await handle.db.select().from(passage).where(eq(passage.id, PASSAGE_ID));
      const request = await createPreparationRequest(handle.db, getEnv(), OWNER, {
        courseId: "NEU-220",
        intake,
        budgetUsd: 5,
        autoPrepare: false,
      });
      await confirmPreparation(handle.db, OWNER, request.id);
      const original = aiRuns.planRun;
      const admission = vi.spyOn(aiRuns, "planRun").mockImplementationOnce(async (...args) => {
        const plan = await original(...args);
        expect(plan.kind).toBe("live");
        if (change === "check-error")
          vi.spyOn(libraryServices, "sourcePassagesStillPermitted").mockRejectedValueOnce(new Error("transient query failure"));
        if (change === "permission") await setPermission(handle.db, OWNER, ASSET_ID, "external_ai", "denied", "Withdrawn during admission");
        if (change === "local-only") await handle.db.update(resourceAsset).set({ localOnly: true }).where(eq(resourceAsset.id, ASSET_ID));
        if (change === "deleted")
          await handle.db.update(resourceAsset).set({ deletedAt: new Date(), status: "deleted" }).where(eq(resourceAsset.id, ASSET_ID));
        if (change === "course") await handle.db.update(resourceAsset).set({ courseIds: [] }).where(eq(resourceAsset.id, ASSET_ID));
        if (change === "edition")
          await handle.db.update(resourceAsset).set({ sourceVersionId: null }).where(eq(resourceAsset.id, ASSET_ID));
        if (change === "passage") await handle.db.delete(passage).where(eq(passage.id, PASSAGE_ID));
        return plan;
      });
      calls = 0;
      try {
        expect(await prepareHandler(ctx, { idempotencyKey: `t:${request.id}`, ownerId: OWNER, requestId: request.id })).toMatchObject({
          status: "blocked",
        });
        expect(admission).toHaveBeenCalledOnce();
        expect(calls).toBe(0);
        const [reserved] = await handle.db
          .select()
          .from(providerRun)
          .where(eq(providerRun.purpose, `prepare:${request.id}`));
        expect(reserved).toMatchObject({ status: "blocked", costUsd: "0.000000" });
        expect(reserved!.finishedAt).not.toBeNull();
      } finally {
        admission.mockRestore();
        vi.restoreAllMocks();
        await handle.db.update(resourceAsset).set(savedAsset!).where(eq(resourceAsset.id, ASSET_ID));
        await handle.db.insert(passage).values(savedPassage!).onConflictDoNothing();
        await setPermission(handle.db, OWNER, ASSET_ID, "external_ai", "allowed", "Restore synthetic fixture");
      }
    },
  );

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
    expect(received).toContain(SOURCE_TEXT);
    expect(received).toContain(PASSAGE_ID);
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
    expect(published!.lessonMarkdown).toContain("What a decoder");

    const exercisesBefore = await handle.db.select().from(unitExercise).where(eq(unitExercise.unitId, UNIT));
    const referencesBefore = await handle.db.select().from(instructorArtifact).where(eq(instructorArtifact.unitId, UNIT));
    expect(exercisesBefore).toHaveLength(3);
    expect(referencesBefore).toHaveLength(3);

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
    expect(afterSeed!.lessonMarkdown).toContain("What a decoder");
    expect(await handle.db.select().from(unitExercise).where(eq(unitExercise.unitId, UNIT))).toEqual(exercisesBefore);
    expect(await handle.db.select().from(instructorArtifact).where(eq(instructorArtifact.unitId, UNIT))).toEqual(referencesBefore);
    // Restore the original description for other tests sharing the database.
    await seedContent(handle.db, bundle);
  });
});
