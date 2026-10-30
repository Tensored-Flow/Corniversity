import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      "packages/core",
      "packages/ai",
      "packages/content",
      "packages/db",
      "apps/worker",
      "apps/companion",
      "apps/web",
      "tests/academic-evals",
    ],
  },
});
