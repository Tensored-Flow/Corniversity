"use client";

import { useActionState } from "react";

/** Opens another arXiv version (fields `assetId`, `version`): it navigates to that version, or returns a registered refusal. */
export type OpenArxivVersion = (state: { error: string } | null, form: FormData) => Promise<{ error: string } | null>;

/**
 * *A newer version exists: Open vN*. A refusal is shown beside the button, in place: the reader is not
 * reloaded, so the PDF on screen stays and is not fetched from arXiv again.
 */
export function NewerVersionForm({
  action,
  assetId,
  version,
  label,
}: {
  action: OpenArxivVersion;
  assetId: string;
  version: number;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-x-2">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="version" value={version} />
      <span>A newer version exists:</span>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-6 items-center text-brass underline underline-offset-4 disabled:cursor-wait disabled:opacity-60"
      >
        Open {label}
      </button>
      {state ? (
        <span role="alert" className="text-rust">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
