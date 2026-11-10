import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "../../test/fixtures";
import { createBlobStore } from "../blob";
import { createDb } from "../client";
import { stopBoss } from "../queue";
import { jobRecord, submissionVersion } from "../schema/index";
import { getOrCreateAttempt } from "./learning";
import {
  addWorkPage,
  confirmTranscription,
  listTranscriptions,
  listWorkPages,
  moveWorkPage,
  PaperWorkError,
  removeWorkPage,
  requestModelTranscription,
  rotateWorkPage,
  saveTranscription,
  submitPaperAttempt,
  transcriptionConsentStands,
  withdrawTranscriptionConsent,
  workPageFile,
} from "./paper-work";

/**
 * Paper work against PostgreSQL: pages stored privately without their metadata, transcriptions
 * confirmed before review and versioned, submissions keeping exactly what was sent, and nothing
 * sent for transcription without consent that still stands when the job runs.
 */
let handle: ReturnType<typeof createDb>;
let fx: Fixture;
const graderConfig = { provider: "fixture", model: "fixture", promptVersion: "test", roleVersion: "test" };

const seg = (marker: number, payload: number[]) => [
  0xff,
  marker,
  ((payload.length + 2) >> 8) & 0xff,
  (payload.length + 2) & 0xff,
  ...payload,
];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const photo = (tag: string) =>
  new Uint8Array([
    0xff,
    0xd8,
    ...seg(0xe1, ascii(`Exif\0\0GPSLatitude 51.4988N ${tag}`)),
    ...seg(0xc0, [8, 0, 4, 0, 3, 1, 1, 0x11, 0]),
    ...seg(0xda, [1, 1, 0, 0, 0x3f, 0]),
    0x01,
    0x02,
    0xff,
    0xd9,
  ]);

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  fx = await createFixture(handle.db, "paper");
});

afterAll(async () => {
  await fx.cleanup();
  await stopBoss();
  await handle.close();
});

describe("paper pages", () => {
  it("stores photographs without their location metadata, in order, for the owner only", async () => {
    const blobs = createBlobStore("pg", handle.db, "unused");
    const a = await getOrCreateAttempt(handle.db, { ownerId: fx.ownerId, exerciseId: fx.exerciseId });
    const first = await addWorkPage(handle.db, blobs, {
      ownerId: fx.ownerId,
      attemptId: a.id,
      bytes: photo("p1"),
      filename: "IMG 0001.jpg",
    });
    const second = await addWorkPage(handle.db, blobs, { ownerId: fx.ownerId, attemptId: a.id, bytes: photo("p2") });
    expect(first).toMatchObject({ position: 1, mime: "image/jpeg", metadataStripped: true, width: 3, height: 4 });
    const { bytes } = await workPageFile(handle.db, blobs, fx.ownerId, first.id);
    expect(bytes.toString("latin1")).not.toContain("GPSLatitude");
    await expect(workPageFile(handle.db, blobs, "someone-else", first.id)).rejects.toThrow(PaperWorkError);
    await expect(addWorkPage(handle.db, blobs, { ownerId: "someone-else", attemptId: a.id, bytes: photo("x") })).rejects.toThrow(
      /not found/,
    );
    await expect(
      addWorkPage(handle.db, blobs, { ownerId: fx.ownerId, attemptId: a.id, bytes: new TextEncoder().encode("<svg onload=alert(1)>") }),
    ).rejects.toThrow(/Only photographs/);
    await moveWorkPage(handle.db, fx.ownerId, second.id, -1);
    await rotateWorkPage(handle.db, fx.ownerId, first.id, 1);
    const pages = await listWorkPages(handle.db, fx.ownerId, a.id);
    expect(pages.map((p) => p.id)).toEqual([second.id, first.id]);
    expect(pages.find((p) => p.id === first.id)?.rotation).toBe(90);
  });
});

describe("transcription and submission", () => {
  it("refuses review until an ambiguous symbol is confirmed, then submits that version with its pages", async () => {
    const a = await getOrCreateAttempt(handle.db, { ownerId: fx.ownerId, exerciseId: fx.exerciseId });
    await saveTranscription(handle.db, { ownerId: fx.ownerId, attemptId: a.id, text: "[page 1]\nLet [[?ε or e]] > 0 and choose δ = ε/2." });
    await expect(confirmTranscription(handle.db, fx.ownerId, a.id)).rejects.toThrow(/confirm this symbol/);
    await expect(submitPaperAttempt(handle.db, { ownerId: fx.ownerId, attemptId: a.id, graderConfig })).rejects.toThrow(
      /Confirm the transcription/,
    );
    await saveTranscription(handle.db, { ownerId: fx.ownerId, attemptId: a.id, text: "[page 1]\nLet ε > 0 and choose δ = ε/2." });
    const confirmed = await confirmTranscription(handle.db, fx.ownerId, a.id);
    expect(confirmed).toMatchObject({ version: 2 });
    expect(confirmed.confirmedAt).not.toBeNull();
    const submitted = await submitPaperAttempt(handle.db, { ownerId: fx.ownerId, attemptId: a.id, graderConfig });
    const [sv] = await handle.db.select().from(submissionVersion).where(eq(submissionVersion.id, submitted.submissionVersionId));
    expect(sv).toMatchObject({ contentKind: "paper", transcriptionVersionId: confirmed.id, contentMarkdown: confirmed.text });
    expect(sv!.pageIds).toHaveLength(2);
    expect(sv!.assistanceDisclosed.note).toMatch(/transcription v2/);

    // A later correction is a new version; the submission still names the version it sent.
    await saveTranscription(handle.db, { ownerId: fx.ownerId, attemptId: a.id, text: "[page 1]\nLet ε > 0 and choose δ = ε/3." });
    expect((await listTranscriptions(handle.db, fx.ownerId, a.id))[0]).toMatchObject({ version: 3, confirmedAt: null });
    const [still] = await handle.db.select().from(submissionVersion).where(eq(submissionVersion.id, submitted.submissionVersionId));
    expect(still!.transcriptionVersionId).toBe(confirmed.id);
  });

  it("keeps a submitted page's bytes when the page is removed from the editor", async () => {
    const blobs = createBlobStore("pg", handle.db, "unused");
    const a = await getOrCreateAttempt(handle.db, { ownerId: fx.ownerId, exerciseId: fx.exerciseId });
    const [page] = await listWorkPages(handle.db, fx.ownerId, a.id);
    await removeWorkPage(handle.db, blobs, fx.ownerId, page!.id);
    expect((await listWorkPages(handle.db, fx.ownerId, a.id)).map((p) => p.id)).not.toContain(page!.id);
    expect(await blobs.exists(page!.blobKey)).toBe(true);
  });
});

describe("model transcription consent", () => {
  it("sends nothing without consent, and a withdrawn consent stops a queued job", async () => {
    const a = await getOrCreateAttempt(handle.db, { ownerId: fx.ownerId, exerciseId: fx.exerciseId });
    await expect(
      requestModelTranscription(handle.db, { ownerId: fx.ownerId, attemptId: a.id, consent: false, providerLabel: "Anthropic" }),
    ).rejects.toThrow(/Tick the box/);
    const { consentId } = await requestModelTranscription(handle.db, {
      ownerId: fx.ownerId,
      attemptId: a.id,
      consent: true,
      providerLabel: "Anthropic",
    });
    const [job] = await handle.db
      .select()
      .from(jobRecord)
      .where(and(eq(jobRecord.ownerId, fx.ownerId), eq(jobRecord.kind, "transcribe-pages")));
    expect(job).toBeDefined();
    const pageIds = (job!.payload as { pageIds: string[] }).pageIds;
    expect(await transcriptionConsentStands(handle.db, { ownerId: fx.ownerId, attemptId: a.id, consentId, pageIds })).toMatchObject({
      ok: true,
    });
    await withdrawTranscriptionConsent(handle.db, fx.ownerId, a.id);
    expect(await transcriptionConsentStands(handle.db, { ownerId: fx.ownerId, attemptId: a.id, consentId, pageIds })).toEqual({
      ok: false,
      reason: "Consent to send these pages was withdrawn, so nothing was sent.",
    });
  });
});
