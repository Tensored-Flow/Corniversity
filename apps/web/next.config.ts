import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/csp";

// The whole monorepo shares one .env at the repository root.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

// The security headers and the content security policy are built in src/lib/csp.ts (unit-tested).
// HSTS is sent only when the deployment is https. These headers are fixed when the app is built,
// so the deployment image says it is building for production (CORNIVERSITY_BUILD_TARGET) while its
// runtime settings arrive only at start.
const production = process.env.DEPLOYMENT_MODE === "production" || process.env.CORNIVERSITY_BUILD_TARGET === "production";

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
  // The owner's local installation (`pnpm local:owner`) runs its own development server beside
  // the one the journeys use, so it compiles into its own folder.
  distDir: process.env.CORNIVERSITY_NEXT_DIST_DIR ?? ".next",
  output: "standalone",
  outputFileTracingRoot: resolve(process.cwd(), "../../"),
  // The fixture provider reads its scripted responses from disk at run time, which file tracing
  // cannot see; carry the folder into the standalone build (it lands at packages/ai/fixtures).
  outputFileTracingIncludes: { "/**": ["../../packages/ai/fixtures/**/*"] },
  async headers() {
    return securityHeaders(production);
  },
};

export default nextConfig;
