// Starts a throw-away embedded PostgreSQL cluster for the db integration tests and applies the
// migrations. The URL is fixed in vitest.config.ts (test.env), so tests can create their own
// connections without sharing state through globals.
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { createDb } from "../src/client";
import { runMigrations } from "../src/migrate";

export const TEST_PORT = 5438;
export const TEST_DATABASE_URL = `postgres://corniversity:corniversity@127.0.0.1:${TEST_PORT}/corniversity_test`;

const dir = resolve(tmpdir(), "corniversity-test-pg");

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
