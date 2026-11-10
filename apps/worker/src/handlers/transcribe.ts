import {
  type AttemptUsage,
  buildTranscriberSystemPrompt,
  outputSchemaText,
  PRICING_VERSION,
  ProviderError,
  providerNameOf,
  ROLE_CONTRACTS,
  TRANSCRIBER_PROMPT_VERSION,
  TranscriptionDraftSchema,
} from "@corniversity/ai";
import { createBlobStore } from "@corniversity/db/blob";
import { TranscribePagesPayload } from "@corniversity/db/jobs";
import { attempt, unitExercise } from "@corniversity/db/schema/index";
import { planRun } from "@corniversity/db/services/ai-runs";
import { saveTranscription, transcriptionConsentStands } from "@corniversity/db/services/paper-work";
import { finishProviderRun, type RunStatus, recordProviderRun } from "@corniversity/db/services/provider-config";
import { eq } from "drizzle-orm";
import { type HandlerContext, NonRetryableError } from "./index";

/**
 * A model transcription of the learner's paper pages. Before anything is sent the worker checks,
 * now and not when the job was queued, that the learner's consent for exactly these pages still
 * stands. The scripted demo cannot read images, so it refuses rather than offering a made-up
 * reading. A reading is saved as an unconfirmed transcription version for the learner to correct.
 */
export async function transcribeHandler(ctx: HandlerContext, raw: unknown): Promise<Record<string, unknown>> {
  const payload = TranscribePagesPayload.parse(raw);
  const db = ctx.db;
  const consent = await transcriptionConsentStands(db, payload);
  if (!consent.ok) throw new NonRetryableError(consent.reason);
  const [a] = await db.select().from(attempt).where(eq(attempt.id, payload.attemptId)).limit(1);
  if (!a || a.ownerId !== payload.ownerId) throw new NonRetryableError("The attempt no longer exists.");
  const [exercise] = await db.select().from(unitExercise).where(eq(unitExercise.id, a.exerciseId)).limit(1);

  const blobs = createBlobStore(ctx.env.BLOB_STORE, db, ctx.env.CORNIVERSITY_DATA_ROOT);
  const images: { mediaType: "image/jpeg" | "image/png"; base64: string }[] = [];
  for (const page of consent.pages) {
    if (page.mime === "application/pdf") continue;
    const bytes = await blobs.get(page.blobKey);
    if (!bytes) throw new NonRetryableError("A page's file is missing; nothing was sent.");
    images.push({ mediaType: page.mime, base64: bytes.toString("base64") });
  }
  if (images.length === 0) throw new NonRetryableError("There are no page images to read.");

  const system = buildTranscriberSystemPrompt({
    institutionName: ctx.env.INSTITUTION_NAME,
    exercisePrompt: exercise?.promptMarkdown ?? "(not available)",
    pageCount: images.length,
  });
  const instruction = "Transcribe these pages, in order, following the rules.";
  const promptVersion = `${TRANSCRIBER_PROMPT_VERSION};role:${ROLE_CONTRACTS.transcriber.version}`;
  const plan = await planRun(
    db,
    payload.ownerId,
    ctx.env,
    "transcriber",
    { text: `${system}\n${instruction}\n${outputSchemaText(TranscriptionDraftSchema)}`, messages: 1, images: images.length },
    { purpose: "transcribe-pages", promptVersion, idempotencyKey: `transcribe:${payload.consentId}` },
  );
  if (plan.kind === "scripted") {
    throw new NonRetryableError(
      "No transcription model is configured: the scripted demo cannot read images. Transcribe the pages yourself.",
    );
  }
  if (plan.kind === "refused") {
    if (plan.status !== "duplicate") {
      await recordProviderRun(db, {
        ownerId: payload.ownerId,
        role: "transcriber",
        provider: providerNameOf(plan.state),
        model: plan.model,
        purpose: "transcribe-pages",
        pricingVersion: PRICING_VERSION,
        promptVersion,
        status: plan.status,
        error: plan.reason,
        attempts: [],
        worstCaseUsd: plan.worstCaseUsd,
        startedAt: new Date(),
      });
    }
    throw new NonRetryableError(plan.reason);
  }

  let status: Exclude<RunStatus, "running"> = "ok";
  let error: string | null = null;
  let attempts: AttemptUsage[] = [];
  let model = plan.model;
  let draft: { text: string; notes: string[] } | null = null;
  try {
    const result = await plan.provider.generateStructured({
      role: "transcriber",
      purpose: "transcribe-pages",
      system,
      messages: [{ role: "user", content: instruction }],
      images,
      schema: TranscriptionDraftSchema,
      schemaName: "TranscriptionDraft",
      maxTokens: plan.maxTokens,
      effort: plan.effort,
    });
    draft = result.object;
    attempts = result.attempts;
    model = result.model;
  } catch (e) {
    if (!(e instanceof ProviderError)) throw e;
    status = e.billing === "uncertain" ? "unsettled" : e.kind === "refused" ? "refused" : "error";
    error = e.message;
    attempts = e.attempts;
  }
  await finishProviderRun(db, plan.runId, { status, model, error, attempts });
  if (!draft) throw new NonRetryableError(error ?? "The transcription failed.");
  const notes = draft.notes.length ? `\n\n<!-- notes from the transcription: ${draft.notes.join(" | ").replace(/--/g, "–")} -->` : "";
  const version = await saveTranscription(db, {
    ownerId: payload.ownerId,
    attemptId: payload.attemptId,
    text: `${draft.text}${notes}`,
    source: "model",
    providerRunId: plan.runId,
  });
  return { transcriptionVersion: version.version, uncertain: version.uncertain.length, providerRunId: plan.runId };
}
