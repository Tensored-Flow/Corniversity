import { defineConfig } from "vitest/config";

// Integration tests run against a throw-away embedded PostgreSQL started by test/global-setup.ts.
export default defineConfig({
  test: {
    name: "db",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    // The files share one database, so the root scripts run them one at a time
    // (--no-file-parallelism); Vitest ignores fileParallelism in a project's own config.
    testTimeout: 60_000,
    hookTimeout: 180_000,
    env: {
      DATABASE_URL: "postgres://corniversity:corniversity@127.0.0.1:5438/corniversity_test",
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
      OWNER_EMAIL: "owner@example.test",
      OWNER_BOOTSTRAP_CODE: "test-bootstrap-code",
      CORNIVERSITY_DATA_ROOT: "C:/Users/leona/AppData/Local/Temp/corniversity-test-data",
      NODE_ENV: "test",
    },
  },
});
