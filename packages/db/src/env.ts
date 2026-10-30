import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";

/**
 * Loads the repository-root .env (searching upwards from cwd) once, then validates the
 * variables the server side needs. Fails fast with a readable message instead of a stack
 * trace deep inside a database driver.
 */
let loaded = false;
export function loadRootEnv(startDir = process.cwd()): void {
  if (loaded) return;
  loaded = true;
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

const EnvSchema = z.object({
  INSTITUTION_NAME: z.string().min(1).default("Corniversity"),
  DEFAULT_TIMEZONE: z.string().min(1).default("Europe/London"),
  DEPLOYMENT_MODE: z.enum(["local", "production"]).default("local"),
  DATABASE_URL: z.string().url(),
  CORNIVERSITY_DATA_ROOT: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  OWNER_EMAIL: z.string().email(),
  OWNER_BOOTSTRAP_CODE: z.string().min(8),
  AI_PROVIDER: z.enum(["fixture", "anthropic"]).default("fixture"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL_DEFAULT: z.string().default("claude-opus-5-5"),
  AI_BUDGET_PER_RUN_USD: z.coerce.number().positive().default(0.5),
  AI_BUDGET_DAILY_USD: z.coerce.number().positive().default(3),
  AI_BUDGET_MONTHLY_USD: z.coerce.number().positive().default(40),
  BLOB_STORE: z.enum(["fs", "pg"]).default("fs"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(200),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});
export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;
export function getEnv(): Env {
  if (cached) return cached;
  loadRootEnv();
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example.`);
  }
  if (parsed.data.DEPLOYMENT_MODE === "production") {
    const placeholders = ["change-me", "example.com"];
    for (const key of ["BETTER_AUTH_SECRET", "OWNER_EMAIL", "OWNER_BOOTSTRAP_CODE"] as const) {
      const value = parsed.data[key];
      if (placeholders.some((p) => value.includes(p))) {
        throw new Error(`${key} still holds a placeholder value; refusing to start in production.`);
      }
    }
    if (!parsed.data.BETTER_AUTH_URL.startsWith("https://")) {
      throw new Error("BETTER_AUTH_URL must use https in production.");
    }
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: reset the cache after mutating process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}
