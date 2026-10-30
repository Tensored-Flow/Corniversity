import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// The whole monorepo shares one .env at the repository root.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@corniversity/core",
    "@corniversity/db",
    "@corniversity/ai",
    "@corniversity/content",
  ],
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
        ],
      },
    ];
  },
};

export default nextConfig;
