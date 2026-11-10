import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { defaultContentRoot, loadContent } from "@corniversity/content/load";
import { seedContent } from "@corniversity/content/seed";
import { createBlobStore } from "@corniversity/db/blob";
import { createDb } from "@corniversity/db/client";
import { getEnv } from "@corniversity/db/env";
import { stopBoss } from "@corniversity/db/queue";
import { user } from "@corniversity/db/schema/auth";
import { providerRun } from "@corniversity/db/schema/index";
import { getOrCreateAttempt } from "@corniversity/db/services/learning";
import {
  addWorkPage,
  listTranscriptions,
  requestModelTranscription,
  withdrawTranscriptionConsent,
} from "@corniversity/db/services/paper-work";
import { approvePaidUse, saveBudgetLimits, saveProviderSetting } from "@corniversity/db/services/provider-config";
import { eq, inArray } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { HandlerContext } from "./index";
import { transcribeHandler } from "./transcribe";

/**
 * Model transcription of paper pages. The live path runs through the real SDK against a local
 * server speaking the documented wire format, so nothing leaves the machine and nothing here says
 * how well a real model reads handwriting: it checks consent, what is sent, and what is stored.
 */
const SCRIPTED_OWNER = `transcribe-scripted-${randomUUID()}`;
const LIVE_OWNER = `transcribe-live-${randomUUID()}`;
const EXERCISE = "MAT-230-u01-ex1";
const KEY = "sk-ant-transcribe-test-000000000";
const bundle = loadContent(defaultContentRoot());

let handle: ReturnType<typeof createDb>;
let ctx: HandlerContext;
let received: { imageBlocks: number; hasGps: boolean }[] = [];
const server = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || "{}") as { messages?: { content: unknown }[] };
  const last = body.messages?.at(-1)?.content;
  const blocks = Array.isArray(last) ? (last as { type: string; source?: { data: string } }[]) : [];
  const images = blocks.filter((b) => b.type === "image");
  received.push({
    imageBlocks: images.length,
    hasGps: images.some((b) =>
      Buffer.from(b.source?.data ?? "", "base64")
        .toString("latin1")
        .includes("GPSLatitude"),
    ),
  });
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      id: "msg_transcribe",
      type: "message",
      role: "assistant",
      model: "claude-opus-5-5",
      content: [{ type: "text", text: JSON.stringify({ text: "[page 1]\nLet [[?ε or e]] > 0.", notes: ["The second line is faint."] }) }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1500, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    }),
  );
});

const seg = (marker: number, payload: number[]) => [
  0xff,
  marker,
  ((payload.length + 2) >> 8) & 0xff,
  (payload.length + 2) & 0xff,
  ...payload,
];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const photo = () =>
  new Uint8Array([
    0xff,
    0xd8,
    ...seg(0xe1, ascii("Exif\0\0GPSLatitude 51.4988N")),
    ...seg(0xc0, [8, 0, 4, 0, 3, 1, 1, 0x11, 0]),
    ...seg(0xda, [1, 1, 0, 0, 0x3f, 0]),
    0x01,
    0xff,
    0xd9,
  ]);

async function withPage(ownerId: string) {
  const a = await getOrCreateAttempt(handle.db, { ownerId, exerciseId: EXERCISE });
  await addWorkPage(handle.db, createBlobStore(getEnv().BLOB_STORE, handle.db, getEnv().CORNIVERSITY_DATA_ROOT), {
    ownerId,
    attemptId: a.id,
    bytes: photo(),
  });
  return a;
}

async function payloadFor(ownerId: string, attemptId: string) {
  const { consentId } = await requestModelTranscription(handle.db, { ownerId, attemptId, consent: true, providerLabel: "Anthropic" });
  const { listWorkPages } = await import("@corniversity/db/services/paper-work");
  const pages = await listWorkPages(handle.db, ownerId, attemptId);
  return { idempotencyKey: `transcribe:test:${consentId}`, ownerId, attemptId, consentId, pageIds: pages.map((p) => p.id) };
}

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 3 });
  await seedContent(handle.db, bundle);
  for (const id of [SCRIPTED_OWNER, LIVE_OWNER]) {
    await handle.db.insert(user).values({ id, name: "Transcribe Test", email: `${id}@example.test` });
  }
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await saveBudgetLimits(handle.db, LIVE_OWNER, { perRunUsd: 2, dailyUsd: 5, monthlyUsd: 40 });
  await saveProviderSetting(handle.db, LIVE_OWNER, getEnv(), {
    provider: "anthropic",
    model: "claude-opus-5-5",
    apiKey: KEY,
    refusalFallback: false,
  });
  await approvePaidUse(handle.db, LIVE_OWNER, getEnv());
  ctx = { db: handle.db, env: getEnv(), boss: {} as PgBoss };
});

afterAll(async () => {
  delete process.env.ANTHROPIC_BASE_URL;
  await handle.db.delete(providerRun).where(inArray(providerRun.ownerId, [SCRIPTED_OWNER, LIVE_OWNER]));
  await handle.db.delete(user).where(inArray(user.id, [SCRIPTED_OWNER, LIVE_OWNER]));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await stopBoss();
  await handle.close();
});

describe("transcription without a model", () => {
  it("refuses rather than inventing a reading, and stores no transcription", async () => {
    const a = await withPage(SCRIPTED_OWNER);
    const payload = await payloadFor(SCRIPTED_OWNER, a.id);
    await expect(transcribeHandler(ctx, payload)).rejects.toThrow(/scripted demo cannot read images/);
    expect(await listTranscriptions(handle.db, SCRIPTED_OWNER, a.id)).toHaveLength(0);
  });
});

describe("transcription by a live model", () => {
  it("sends nothing once consent is withdrawn, even though the job was queued", async () => {
    const a = await withPage(LIVE_OWNER);
    const payload = await payloadFor(LIVE_OWNER, a.id);
    await withdrawTranscriptionConsent(handle.db, LIVE_OWNER, a.id);
    received = [];
    await expect(transcribeHandler(ctx, payload)).rejects.toThrow(/withdrawn/);
    expect(received).toHaveLength(0);
  });

  it("sends the stripped page images and saves the reading as an unconfirmed model transcription", async () => {
    const a = await getOrCreateAttempt(handle.db, { ownerId: LIVE_OWNER, exerciseId: EXERCISE });
    const payload = await payloadFor(LIVE_OWNER, a.id);
    received = [];
    const result = await transcribeHandler(ctx, payload);
    expect(received).toEqual([{ imageBlocks: 1, hasGps: false }]);
    expect(result).toMatchObject({ transcriptionVersion: 1, uncertain: 1 });
    const [latest] = await listTranscriptions(handle.db, LIVE_OWNER, a.id);
    expect(latest).toMatchObject({ source: "model", confirmedAt: null });
    expect(latest!.text).toContain("[[?ε or e]]");
    const [run] = await handle.db.select().from(providerRun).where(eq(providerRun.id, latest!.providerRunId!));
    expect(run).toMatchObject({ role: "transcriber", status: "ok" });
    expect(Number(run!.worstCaseUsd)).toBeGreaterThan(0);
  });
});
