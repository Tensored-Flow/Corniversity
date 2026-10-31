// Post-deploy and local health check: database, web and worker. Exit code 0 only when all answer.
// Usage: pnpm health [--web http://localhost:3000] [--worker http://localhost:3100]
import { Client } from "pg";
import { loadRootEnv } from "../packages/db/src/env";

loadRootEnv();
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1]! : fallback;
};
const webUrl = option("--web", process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
const workerUrl = option("--worker", process.env.WORKER_HEALTH_URL ?? "http://localhost:3100");

async function checkDatabase(): Promise<string> {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });
  await client.connect();
  try {
    const tables = await client.query("select count(*)::int as n from information_schema.tables where table_schema = 'public'");
    const migrations = await client
      .query("select count(*)::int as n from drizzle.__drizzle_migrations")
      .catch(() => ({ rows: [{ n: "unknown" }] }));
    return `ok (${tables.rows[0]?.n} tables, ${migrations.rows[0]?.n} migrations applied)`;
  } finally {
    await client.end();
  }
}

async function checkHttp(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const body = (await response.json().catch(() => ({}))) as { ok?: boolean };
  if (!response.ok || body.ok !== true) throw new Error(`HTTP ${response.status}`);
  return "ok";
}

const checks: [string, () => Promise<string>][] = [
  ["database", checkDatabase],
  ["web", () => checkHttp(new URL("/api/health", webUrl).toString())],
  ["worker", () => checkHttp(new URL("/health", workerUrl).toString())],
];
let failed = 0;
for (const [name, check] of checks) {
  try {
    console.log(`${name.padEnd(9)} ${await check()}`);
  } catch (error) {
    failed += 1;
    console.log(`${name.padEnd(9)} FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }
}
process.exit(failed === 0 ? 0 : 1);
