// The worker's embedded test PostgreSQL port: CORNIVERSITY_WORKER_TEST_PG_PORT, default 5439 (the
// db package uses 5438). Shared by the global setup and vitest.config.ts.
const raw = process.env.CORNIVERSITY_WORKER_TEST_PG_PORT;
const parsed = raw ? Number(raw) : 5439;
if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 65535)
  throw new Error("CORNIVERSITY_WORKER_TEST_PG_PORT must be a port number between 1024 and 65535.");

export const TEST_PORT = parsed;

export function testDatabaseUrl(port = TEST_PORT): string {
  return `postgres://corniversity:corniversity@127.0.0.1:${port}/corniversity_worker_test`;
}
