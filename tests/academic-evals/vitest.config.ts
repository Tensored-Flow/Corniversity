import { defineConfig } from "vitest/config";
export default defineConfig({ test: { name: "academic-evals", include: ["**/*.eval.test.ts"] } });
