"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui";

/**
 * Web upload. The file goes to the quarantine endpoint; on success the browser moves to the
 * item page to confirm metadata. Errors from validation (wrong signature, size, type) are shown
 * verbatim, and a duplicate is reported as such rather than stored twice.
 */
export function UploadForm({ maxMb }: { maxMb: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    if (file.size > maxMb * 1_048_576) {
      setError(`The file is larger than the ${maxMb} MB limit.`);
      return;
    }
    setError(null);
    setState("uploading");
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/library/upload", { method: "POST", body });
    const json = (await response.json().catch(() => ({}))) as { assetId?: string; outcome?: string; error?: string };
    if (!response.ok || !json.assetId) {
      setError(json.error ?? `Upload failed (${response.status}).`);
      setState("idle");
      return;
    }
    router.push(`/library/items/${json.assetId}?saved=${json.outcome === "duplicate" ? "duplicate" : "uploaded"}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="upload-file" className="text-sm font-medium text-ink">
          File (PDF, Markdown or plain text; up to {maxMb} MB)
        </label>
        <input
          id="upload-file"
          name="file"
          type="file"
          accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"
          className="block w-full text-sm text-ink file:mr-3 file:rounded-[var(--radius-control)] file:border file:border-stone-2 file:bg-paper-2 file:px-3 file:py-2 file:text-sm file:text-ink"
          disabled={state === "uploading"}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-rust">
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={state === "uploading"}>
          {state === "uploading" ? "Uploading…" : "Upload to quarantine"}
        </Button>
      </div>
    </form>
  );
}
