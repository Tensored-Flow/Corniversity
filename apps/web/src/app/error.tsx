"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { isConnectionFailure } from "./_error/connection";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const BUTTON = "rounded-[var(--radius-control)] bg-brass px-4 py-2 text-sm font-medium text-paper focus-visible:outline-2";

/**
 * The failure state for a page that threw on the server or the client. When the browser could not
 * reach the server (offline, or the connection dropped while a form was being sent), it says so: what
 * was last sent may not have arrived, and reloading once back online shows what was saved. Otherwise it
 * says what is known (an error on our side), not the cause, and gives two ways out. It never claims that
 * nothing was lost. The error is logged by Next on the server; nothing about it is sent anywhere else.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const unreachable = isConnectionFailure(error, online);
  useEffect(() => {
    console.error("[page error]", error.digest ?? error.message);
  }, [error]);
  return (
    <main id="main" className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center px-4 py-12">
      {unreachable ? (
        <>
          <p className="text-sm uppercase tracking-[0.18em] text-brass">No connection</p>
          <h1 className="mt-2 text-3xl text-ink">The server could not be reached</h1>
          <p className="mt-3 text-sm text-ink-2">
            Your browser could not reach the server (it is offline, or the connection dropped), so what you last sent may not have arrived.
            When you are back online, reload the page to see what was saved before sending anything again.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm uppercase tracking-[0.18em] text-brass">Something went wrong</p>
          <h1 className="mt-2 text-3xl text-ink">This page could not be shown</h1>
          <p className="mt-3 text-sm text-ink-2">
            An error occurred on our side while preparing the page. You can try again, or go back to the campus; if it keeps happening, the
            server log holds the details
            {error.digest ? ` (reference ${error.digest})` : ""}.
          </p>
        </>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {unreachable ? (
          <button type="button" onClick={() => window.location.reload()} className={BUTTON}>
            Reload
          </button>
        ) : (
          <button type="button" onClick={reset} className={BUTTON}>
            Try again
          </button>
        )}
        <Link
          href="/campus"
          className="rounded-[var(--radius-control)] border border-stone px-4 py-2 text-sm text-ink hover:bg-paper-3 focus-visible:outline-2"
        >
          Back to the campus
        </Link>
      </div>
    </main>
  );
}
