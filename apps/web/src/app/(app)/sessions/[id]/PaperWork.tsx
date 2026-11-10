"use client";
import { uncertainMarks } from "@corniversity/core/paper/transcription";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, Button, Notice } from "@/components/ui";
import {
  confirmTranscriptionAction,
  movePageAction,
  removePageAction,
  requestTranscriptionAction,
  rotatePageAction,
  saveTranscriptionAction,
  submitPaperAction,
  withdrawTranscriptionAction,
} from "./actions";

export interface PaperPage {
  id: string;
  position: number;
  mime: string;
  rotation: number;
  metadataStripped: boolean;
}

export interface PaperTranscription {
  version: number;
  text: string;
  source: "manual" | "model";
  confirmed: boolean;
}

interface Props {
  sessionId: string;
  exerciseId: string;
  pages: PaperPage[];
  transcriptions: PaperTranscription[];
  provider: { mode: "scripted" | "live" | "plan" | "blocked"; label: string; reason?: string };
  transcriptionJob: { status: string; error: string | null } | null;
  closed: boolean;
}

const MAX_SIDE = 2000;

/**
 * Re-encodes a photograph on this device before upload: the image is drawn on a canvas at most
 * 2,000 pixels on a side and saved as JPEG, which keeps the writing and drops the camera and
 * location metadata. The server strips metadata again and checks the real file type.
 */
async function reencode(file: File): Promise<Blob> {
  if (file.type === "application/pdf") return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("The photograph could not be read on this device."));
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The photograph could not be prepared."))), "image/jpeg", 0.88),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Paper work: pages beside their transcription. The transcription is what the review reads, so it
 * must be confirmed first; anything uncertain is marked [[?…]] and must be resolved. A model can
 * draft the transcription only with consent for these pages and an approved live model.
 */
export function PaperWork(props: Props) {
  const router = useRouter();
  const latest = props.transcriptions[0] ?? null;
  const [text, setText] = useState(latest?.text ?? "[page 1]\n");
  const [uploads, setUploads] = useState<{ name: string; state: "uploading" | "failed"; error?: string; file?: File }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [pending, startTransition] = useTransition();
  const marks = uncertainMarks(text);
  const dirty = text !== (latest?.text ?? "[page 1]\n");
  const canSubmit = props.pages.length > 0 && latest?.confirmed && !dirty && !props.closed;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "That did not work.");
      router.refresh();
    });

  async function upload(file: File) {
    setUploads((u) => [...u.filter((x) => x.name !== file.name), { name: file.name, state: "uploading" }]);
    try {
      const prepared = await reencode(file);
      const form = new FormData();
      form.set("sessionId", props.sessionId);
      form.set("exerciseId", props.exerciseId);
      form.set("file", prepared, file.type === "application/pdf" ? file.name : `${file.name.replace(/\.\w+$/, "")}.jpg`);
      const response = await fetch("/api/work-pages", { method: "POST", body: form });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Upload failed (${response.status}).`);
      setUploads((u) => u.filter((x) => x.name !== file.name));
      router.refresh();
    } catch (e) {
      setUploads((u) =>
        u.map((x) =>
          x.name === file.name
            ? { name: file.name, state: "failed", error: e instanceof Error ? e.message : "The upload was interrupted.", file }
            : x,
        ),
      );
    }
  }

  const pick = (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) void upload(f);
  };

  return (
    <section aria-labelledby="paper-heading" className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-5">
      <h2 id="paper-heading" className="text-lg text-ink">
        Paper work
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Photograph or scan your handwritten pages. Photographs are re-encoded on this device before upload, which removes location and
        camera details; the writing is kept. Pages are private to you.
      </p>
      {!props.closed ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-1.5 text-sm hover:bg-paper-3">
            Take a photograph
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files)} />
          </label>
          <label className="cursor-pointer rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-1.5 text-sm hover:bg-paper-3">
            Choose photographs or a PDF
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              multiple
              className="sr-only"
              onChange={(e) => pick(e.target.files)}
            />
          </label>
        </div>
      ) : null}
      {uploads.length ? (
        <ul className="mt-2 flex flex-col gap-1 text-xs" aria-live="polite">
          {uploads.map((u) => (
            <li key={u.name} className={u.state === "failed" ? "text-rust" : "text-ink-3"}>
              {u.state === "uploading" ? `Uploading ${u.name}…` : `${u.name}: ${u.error}`}{" "}
              {u.state === "failed" && u.file ? (
                <button type="button" className="underline" onClick={() => u.file && void upload(u.file)}>
                  Try again
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-ink">Pages ({props.pages.length})</h3>
          {props.pages.length === 0 ? <p className="mt-1 text-xs text-ink-3">No pages yet.</p> : null}
          <ol className="mt-2 flex flex-col gap-3">
            {props.pages.map((p, i) => (
              <li key={p.id} className="rounded-[var(--radius-control)] border border-stone bg-paper p-2">
                <div className="flex items-center justify-between gap-2 text-xs text-ink-3">
                  <span>
                    Page {i + 1} {p.metadataStripped ? "· metadata removed" : ""}
                  </span>
                  {!props.closed ? (
                    <span className="flex gap-1">
                      <button
                        type="button"
                        className="rounded border border-stone px-1.5"
                        aria-label={`Move page ${i + 1} earlier`}
                        disabled={i === 0 || pending}
                        onClick={() => run(() => movePageAction(props.sessionId, p.id, -1))}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="rounded border border-stone px-1.5"
                        aria-label={`Move page ${i + 1} later`}
                        disabled={i === props.pages.length - 1 || pending}
                        onClick={() => run(() => movePageAction(props.sessionId, p.id, 1))}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="rounded border border-stone px-1.5"
                        aria-label={`Rotate page ${i + 1}`}
                        disabled={pending}
                        onClick={() => run(() => rotatePageAction(props.sessionId, p.id, 1))}
                      >
                        ⟳
                      </button>
                      <button
                        type="button"
                        className="rounded border border-stone px-1.5"
                        aria-label={`Remove page ${i + 1}`}
                        disabled={pending}
                        onClick={() => run(() => removePageAction(props.sessionId, p.id))}
                      >
                        ✕
                      </button>
                    </span>
                  ) : null}
                </div>
                {p.mime === "application/pdf" ? (
                  <a className="mt-2 block text-sm underline" href={`/api/work-pages/${p.id}`}>
                    Download the PDF (it is not displayed here)
                  </a>
                ) : (
                  <div className="mt-2 flex justify-center overflow-hidden">
                    {/* biome-ignore lint/performance/noImgElement: private, authorised page images are served by the app's own route */}
                    <img
                      src={`/api/work-pages/${p.id}`}
                      alt={`Page ${i + 1} of your handwritten work`}
                      className="max-h-80 max-w-full object-contain"
                      style={{ transform: `rotate(${p.rotation}deg)` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-ink">Transcription</h3>
            {latest ? (
              <Badge tone={latest.confirmed ? "moss" : "neutral"}>
                v{latest.version} · {latest.source === "model" ? "model reading" : "written by you"} ·{" "}
                {latest.confirmed ? "confirmed" : "not confirmed"}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-ink-3">
            Write what the pages say, one written line per line, with LaTeX for mathematics. Mark anything you are unsure of as [[?…]], for
            example [[?ε or e]]; start each page with [page 2] and so on. The review reads this text, not the photograph.
          </p>
          <label htmlFor="transcription" className="sr-only">
            Transcription
          </label>
          <textarea
            id="transcription"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={props.closed}
            rows={12}
            spellCheck={false}
            className="mt-2 w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 font-mono text-sm leading-relaxed text-ink"
          />
          {marks.length ? (
            <div className="mt-2">
              <Notice tone="rust" title={`Please confirm ${marks.length === 1 ? "this symbol" : `these ${marks.length} symbols`}`}>
                <ul className="list-disc pl-4">
                  {marks.map((m) => (
                    <li key={`${m.line}-${m.text}`}>
                      line {m.line}: “{m.text}”
                    </li>
                  ))}
                </ul>
                Replace each [[?…]] with what you wrote. An uncertain reading is not a judgement of your mathematics.
              </Notice>
            </div>
          ) : null}
          {!props.closed ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !dirty}
                onClick={() => run(() => saveTranscriptionAction(props.sessionId, props.exerciseId, text))}
              >
                Save transcription
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending || marks.length > 0}
                onClick={() => run(() => confirmTranscriptionAction(props.sessionId, props.exerciseId, text))}
              >
                Confirm transcription
              </Button>
              <Button
                type="button"
                disabled={pending || !canSubmit}
                onClick={() => run(() => submitPaperAction(props.sessionId, props.exerciseId))}
              >
                Submit pages and transcription
              </Button>
            </div>
          ) : null}
          {props.transcriptions.length > 1 ? (
            <p className="mt-2 text-[0.7rem] text-ink-3">
              Earlier versions are kept:{" "}
              {props.transcriptions
                .slice(1)
                .map((t) => `v${t.version}${t.confirmed ? " (confirmed)" : ""}`)
                .join(", ")}
              .
            </p>
          ) : null}

          <div className="mt-4 rounded-[var(--radius-control)] border border-stone bg-paper p-3 text-sm">
            <p className="font-medium text-ink">A model reading of the pages</p>
            {props.provider.mode === "scripted" ? (
              <p className="mt-1 text-xs text-ink-2">
                Not available: no model is configured (scripted demo), and the scripted demo never reads images. Write the transcription
                yourself; everything else works the same.
              </p>
            ) : props.provider.mode === "blocked" ? (
              <p className="mt-1 text-xs text-ink-2">Not available: {props.provider.reason}</p>
            ) : (
              <>
                <label className="mt-2 flex items-start gap-2 text-xs text-ink-2">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                  <span>
                    Send these {props.pages.filter((p) => p.mime !== "application/pdf").length} page images to {props.provider.label} for a
                    draft transcription. They are sent once, for this reading, within your limits; you correct and confirm the result.
                  </span>
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending || !consent || props.pages.length === 0}
                    onClick={() => run(() => requestTranscriptionAction(props.sessionId, props.exerciseId, consent))}
                  >
                    Ask for a draft transcription
                  </Button>
                  {props.transcriptionJob?.status === "queued" ? (
                    <Button
                      type="button"
                      variant="quiet"
                      onClick={() => run(() => withdrawTranscriptionAction(props.sessionId, props.exerciseId))}
                    >
                      Withdraw consent (nothing will be sent)
                    </Button>
                  ) : null}
                </div>
              </>
            )}
            {props.transcriptionJob ? (
              <p className="mt-2 text-xs text-ink-3" aria-live="polite">
                Draft transcription: {props.transcriptionJob.status}
                {props.transcriptionJob.error ? ` (${props.transcriptionJob.error})` : ""}.
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {error ? (
        <div className="mt-3">
          <Notice tone="rust">{error}</Notice>
        </div>
      ) : null}
    </section>
  );
}
