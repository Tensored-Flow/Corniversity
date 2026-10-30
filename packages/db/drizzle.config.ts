import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://corniversity:corniversity@127.0.0.1:5437/corniversity",
  },
  strict: true,
  verbose: false,
});
