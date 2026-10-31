import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// The whole monorepo shares one .env at the repository root.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

// Scripts and styles are first-party; inline is still needed for the framework's own bootstrap
// and (in development) eval for the hot-reload client. Nothing may frame the app, and no
// plug-in or foreign base URL is allowed. HSTS is sent only when the deployment is https.
const production = process.env.DEPLOYMENT_MODE === "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Browser console forwarding writes a log under .next on every page load, which invalidated the
  // page on this monorepo layout; it stays off. Turbopack's development server still reloads
  // pages in a loop here, so `pnpm dev` runs the webpack development server instead.
  experimental: { browserDebugInfoInTerminal: false },
  // Development server only: keep compiled pages for the session instead of discarding all but a
  // few after a minute, which made every return to a page a fresh compile of many seconds.
  onDemandEntries: { maxInactiveAge: 60 * 60 * 1000, pagesBufferLength: 200 },
  transpilePackages: ["@corniversity/core", "@corniversity/db", "@corniversity/ai", "@corniversity/content"],
  serverExternalPackages: ["pg", "pg-boss", "@anthropic-ai/sdk", "unpdf"],
  poweredByHeader: false,
  output: "standalone",
  outputFileTracingRoot: resolve(process.cwd(), "../../"),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
