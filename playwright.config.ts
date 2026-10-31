import { defineConfig, devices } from "@playwright/test";

const AUTH_STATE = "tests/e2e/.auth/owner.json";

/**
 * End-to-end journeys run against the local stack (embedded Postgres + web + worker) with the
 * fixture AI provider. Start the stack first: `pnpm db:local`, `pnpm dev`. A setup project signs
 * the owner in once and the journey projects reuse that session; specs that need an anonymous
 * browser opt out with `test.use({ storageState: { cookies: [], origins: [] } })`. Screenshots
 * land in docs/qa/screenshots and are referenced from docs/QA_REPORT.md.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "desktop",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, storageState: AUTH_STATE },
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, storageState: AUTH_STATE },
    },
  ],
});
