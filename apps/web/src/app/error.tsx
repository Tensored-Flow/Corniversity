"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * The failure state for a page that threw on the server or the client. It says what is known
 * (something went wrong on our side), what is not (the cause is not shown), and gives two ways
 * out. The error is logged by Next on the server; nothing about it is sent anywhere else.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[page error]", error.digest ?? error.message);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center px-4 py-12">
      <p className="text-sm uppercase tracking-[0.18em] text-brass">Something went wrong</p>
      <h1 className="mt-2 text-3xl text-ink">This page could not be shown</h1>
      <p className="mt-3 text-sm text-ink-2">
        An error occurred on our side while preparing the page. Your work is saved as you go, so nothing you submitted is lost. You can try
        again, or go back to the campus; if it keeps happening, the server log holds the details
        {error.digest ? ` (reference ${error.digest})` : ""}.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-[var(--radius-control)] bg-brass px-4 py-2 text-sm font-medium text-paper focus-visible:outline-2"
        >
          Try again
        </button>
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
