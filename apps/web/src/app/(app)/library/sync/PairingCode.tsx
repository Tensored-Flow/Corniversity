"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import { type PairingCodeState, createPairingCodeAction } from "../actions";

/** Creates a one-time pairing code and shows it once; it never appears in a URL or a log line. */
export function PairingCode({ server }: { server: string }) {
  const [state, action, pending] = useActionState<PairingCodeState, FormData>(createPairingCodeAction, null);
  return (
    <div className="flex flex-col gap-3">
      <form action={action}>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create a pairing code"}
        </Button>
      </form>
      {state && "code" in state ? (
        <div className="rounded-[var(--radius-panel)] border border-brass/40 bg-brass-soft p-4">
          <p className="text-sm text-ink">Pairing code (valid for 10 minutes, single use):</p>
          <p className="mt-1 font-mono text-3xl tracking-widest text-ink" aria-live="polite">
            {state.code}
          </p>
          <p className="mt-2 text-xs text-ink-2">On your desktop, in PowerShell at the repository:</p>
          <pre className="mt-1 overflow-x-auto rounded bg-paper p-2 font-mono text-xs text-ink">{`pnpm library:pair -- --server ${server} --code ${state.code} --name "My desktop"`}</pre>
        </div>
      ) : null}
      {state && "error" in state ? <p className="text-sm text-rust">{state.error}</p> : null}
    </div>
  );
}
