/**
 * The response security headers, built here so the exact policy is unit-tested; next.config.ts
 * applies them. Scripts and styles are first-party; inline is still needed for the framework's
 * own bootstrap and (in development) eval for the hot-reload client. The browser may fetch from
 * this origin and from arxiv.org (the reader reads linked arXiv PDFs there) and nowhere else.
 * Nothing may frame the app, and no plug-in or foreign base URL is allowed.
 *
 * PDF.js decodes images, colour profiles and PostScript functions with WebAssembly inside its
 * worker. A worker runs under its own response's policy, so `'wasm-unsafe-eval'` is granted only
 * to responses under /pdfjs/ (the vendored worker and its assets), never to the pages.
 */

export interface PolicyOptions {
  /** Built or running for production: no `'unsafe-eval'` and HSTS. */
  production: boolean;
  /** The PDF.js worker's policy: adds `'wasm-unsafe-eval'` (WebAssembly only, not JS eval). */
  wasm?: boolean;
}

export function contentSecurityPolicy({ production, wasm = false }: PolicyOptions): string {
  const script = ["'self'", "'unsafe-inline'"];
  if (!production) script.push("'unsafe-eval'");
  if (wasm) script.push("'wasm-unsafe-eval'");
  return [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://arxiv.org",
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

/**
 * Header rules in order. Next applies every matching rule and a later rule's value for the same
 * key wins, so the /pdfjs/ rule replaces the page policy on the worker and its assets only. The
 * folder is versioned (/pdfjs/<version>/), so its files are cached as immutable.
 */
export function securityHeaders(production: boolean): HeaderRule[] {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        { key: "Content-Security-Policy", value: contentSecurityPolicy({ production }) },
        ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" }] : []),
      ],
    },
    {
      source: "/pdfjs/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy({ production, wasm: true }) },
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
  ];
}
