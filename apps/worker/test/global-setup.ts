// A throw-away embedded PostgreSQL for the worker's handler tests, on its own port so the db
// package's tests can run at the same time (CORNIVERSITY_WORKER_TEST_PG_PORT, default 5439; the
// cluster folder carries the port). Migrations are applied once per run.
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createDb } from "@corniversity/db/client";
import { runMigrations } from "@corniversity/db/migrate";
import EmbeddedPostgres from "embedded-postgres";
import { TEST_PORT, testDatabaseUrl } from "./port";

export { TEST_PORT };
export const TEST_DATABASE_URL = testDatabaseUrl();

// embedded-postgres registers async-exit-hook when imported, which answers 'beforeExit' with
// process.exit(0) and so replaced the failure code vitest leaves in process.exitCode: a run with
// failing tests exited 0. Keep vitest's code.
let vitestExitCode: typeof process.exitCode;
process.on("beforeExit", () => {
  vitestExitCode ??= process.exitCode;
});
process.on("exit", () => {
  if (vitestExitCode) process.exitCode = vitestExitCode;
});

const dir = resolve(tmpdir(), `corniversity-test-pg-worker-${TEST_PORT}`);

export default async function setup(): Promise<() => Promise<void>> {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "corniversity",
    password: "corniversity",
    port: TEST_PORT,
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("corniversity_worker_test");
  const handle = createDb(TEST_DATABASE_URL, { max: 2 });
  await runMigrations(handle);
  await handle.close();
  return async () => {
    await pg.stop();
    rmSync(dir, { recursive: true, force: true });
  };
}
