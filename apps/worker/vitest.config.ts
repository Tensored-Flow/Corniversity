import { defineConfig } from "vitest/config";

// Handler tests run against a throw-away embedded PostgreSQL (test/global-setup.ts); pure
// tests (segmentation) run in the same project without touching it.
export default defineConfig({
  test: {
    name: "worker",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    // The files share one database, so the root scripts run them one at a time
    // (--no-file-parallelism); Vitest ignores fileParallelism in a project's own config.
    testTimeout: 60_000,
    hookTimeout: 180_000,
    env: {
      DATABASE_URL: "postgres://corniversity:corniversity@127.0.0.1:5439/corniversity_worker_test",
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
      OWNER_EMAIL: "owner@example.test",
      OWNER_BOOTSTRAP_CODE: "test-bootstrap-code",
      CORNIVERSITY_DATA_ROOT: "C:/Users/leona/AppData/Local/Temp/corniversity-worker-test-data",
      NODE_ENV: "test",
    },
  },
});
