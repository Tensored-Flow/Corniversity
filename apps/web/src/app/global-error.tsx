"use client";

/**
 * The last-resort failure state, shown when even the root layout cannot render (for example the
 * database is unreachable while a page needs it). It carries its own document because no layout
 * is available, and it offers the only two honest actions: retry, or come back later.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Georgia, serif", background: "#f8f5ee", color: "#2b2620", margin: 0 }}>
        <main style={{ maxWidth: "40rem", margin: "0 auto", padding: "4rem 1rem" }}>
          <p style={{ fontSize: "0.8rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#8a6a2b" }}>Corniversity</p>
          <h1 style={{ fontSize: "1.75rem", marginTop: "0.5rem" }}>The site cannot be shown right now</h1>
          <p style={{ lineHeight: 1.5 }}>
            Something on the server failed before the page could be prepared, most often because the database could not be reached. Nothing
            you have submitted is lost. Try again in a moment; if the problem continues, the server log holds the details
            {error.digest ? ` (reference ${error.digest})` : ""}.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1rem",
              background: "#8a6a2b",
              color: "#f8f5ee",
              border: 0,
              borderRadius: "0.375rem",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
