// A throw-away embedded PostgreSQL for the worker's handler tests, on its own port so the db
// package's tests can run at the same time. Migrations are applied once per run.
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { createDb } from "@corniversity/db/client";
import { runMigrations } from "@corniversity/db/migrate";

export const TEST_PORT = 5439;
export const TEST_DATABASE_URL = `postgres://corniversity:corniversity@127.0.0.1:${TEST_PORT}/corniversity_worker_test`;

const dir = resolve(process.env.TEMP ?? process.env.TMPDIR ?? ".", "corniversity-test-pg-worker");

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
