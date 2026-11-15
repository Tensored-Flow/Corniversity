// Starts a throw-away embedded PostgreSQL cluster for the db integration tests and applies the
// migrations. The port comes from CORNIVERSITY_TEST_PG_PORT (default 5438) and the cluster folder
// carries the port, so several checkouts can run their suites at the same time; vitest.config.ts
// builds DATABASE_URL from the same setting, so tests create their own connections.
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { createDb } from "../src/client";
import { runMigrations } from "../src/migrate";
import { TEST_PORT, testDatabaseUrl } from "./port";

export { TEST_PORT };
export const TEST_DATABASE_URL = testDatabaseUrl();

const dir = resolve(process.env.TEMP ?? process.env.TMPDIR ?? ".", `corniversity-test-pg-${TEST_PORT}`);

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
  await pg.createDatabase("corniversity_test");
  const handle = createDb(TEST_DATABASE_URL, { max: 2 });
  await runMigrations(handle);
  await handle.close();
  return async () => {
    await pg.stop();
    rmSync(dir, { recursive: true, force: true });
  };
}
