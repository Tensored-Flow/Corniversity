import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBackup, parseBackup, restoreBackup, serialiseBackup } from "./backup";
import { createDb } from "./client";
import { runMigrations } from "./migrate";

/**
 * Backup and restore the way a recovery happens: a snapshot of the shared test database is
 * restored into a freshly created, freshly migrated database. A stored original (bytea) must
 * come back byte for byte through the sidecar files, a calendar date must come back as the same
 * day whatever the host's time zone, and a tampered document must be refused.
 */
const SOURCE_URL = process.env.DATABASE_URL!;
const RESTORE_DB = "corniversity_restore_test";
const RESTORE_URL = SOURCE_URL.replace(/\/[^/]+$/, `/${RESTORE_DB}`);
const source = new Client({ connectionString: SOURCE_URL });
let target: Client;
const OWNER = `backup-owner-${randomUUID()}`;
const STORAGE_KEY = `backup-test-${randomUUID()}`;
const DAY = "2026-10-31";
const original = randomBytes(1_000_003);
let sidecarDir = "";

beforeAll(async () => {
  await source.connect();
  await source.query(`drop database if exists ${RESTORE_DB}`);
  await source.query(`create database ${RESTORE_DB}`);
  const handle = createDb(RESTORE_URL, { max: 2 });
  await runMigrations(handle);
  await handle.close();
  target = new Client({ connectionString: RESTORE_URL });
  await target.connect();

  const now = new Date();
  await source.query(
    `insert into "user" (id, name, email, email_verified, role, created_at, updated_at) values ($1, $2, $3, true, 'learner', $4, $4)`,
    [OWNER, "Backup Test", `${OWNER}@example.test`, now],
  );
  await source.query(`insert into day_off (owner_id, date, note) values ($1, $2::date, 'backup test')`, [OWNER, DAY]);
  await source.query(`insert into asset_blob (storage_key, data, size_bytes) values ($1, $2, $3)`, [
    STORAGE_KEY,
    original,
    original.byteLength,
  ]);
  sidecarDir = mkdtempSync(join(tmpdir(), "corniversity-backup-"));
});

afterAll(async () => {
  await source.query(`delete from asset_blob where storage_key = $1`, [STORAGE_KEY]);
  await source.query(`delete from "user" where id = $1`, [OWNER]);
  await target.end();
  await source.query(`drop database if exists ${RESTORE_DB}`);
  await source.end();
  rmSync(sidecarDir, { recursive: true, force: true });
});

describe("logical backup and restore into a fresh database", () => {
  it("keeps binary originals out of the document and restores them byte for byte", async () => {
    const backup = await createBackup(source, { sidecarDir });
    expect(backup.format).toBe("corniversity-backup/2");
    expect(backup.blobs?.count).toBeGreaterThanOrEqual(1);
    expect(readdirSync(join(sidecarDir, "asset_blob")).length).toBeGreaterThanOrEqual(1);
    const document = serialiseBackup(backup);
    // The document never carries the bytes themselves: a megabyte of random data would not compress below this.
    expect(document.byteLength).toBeLessThan(original.byteLength / 2);

    const parsed = parseBackup(document);
    const blobTable = parsed.tables.find((t) => t.name === "asset_blob")!;
    const keyIndex = blobTable.columns.indexOf("storage_key");
    const dataIndex = blobTable.columns.indexOf("data");
    const row = blobTable.rows.find((r) => r[keyIndex] === STORAGE_KEY)!;
    expect((row[dataIndex] as { __file: string }).__file).toMatch(/^asset_blob\/[0-9a-f]{64}\.bin$/);

    const result = await restoreBackup(target, parsed, { sidecarDir });
    expect(result.skipped).toEqual([]);
    expect(result.restored).toBeGreaterThan(0);

    const restored = await target.query<{ data: Buffer; size_bytes: string }>(
      `select data, size_bytes from asset_blob where storage_key = $1`,
      [STORAGE_KEY],
    );
    expect(restored.rows[0]!.data.equals(original)).toBe(true);
    expect(Number(restored.rows[0]!.size_bytes)).toBe(original.byteLength);
  });

  it("restores a calendar date as the same day regardless of the host time zone", async () => {
    const backup = await createBackup(source, { sidecarDir });
    const dayOff = backup.tables.find((t) => t.name === "day_off")!;
    const dateIndex = dayOff.columns.indexOf("date");
    const ownerIndex = dayOff.columns.indexOf("owner_id");
    const row = dayOff.rows.find((r) => r[ownerIndex] === OWNER)!;
    // Stored as the text PostgreSQL printed, not as a shifted ISO timestamp.
    expect(row[dateIndex]).toBe(DAY);

    await restoreBackup(target, parseBackup(serialiseBackup(backup)), { sidecarDir });
    const after = await target.query<{ day: string }>(`select to_char(date, 'YYYY-MM-DD') as day from day_off where owner_id = $1`, [
      OWNER,
    ]);
    expect(after.rows[0]!.day).toBe(DAY);
  });

  it("refuses a document whose tables no longer match its checksum", async () => {
    const backup = await createBackup(source, { sidecarDir });
    const tampered = JSON.parse(JSON.stringify(backup)) as typeof backup;
    const dayOff = tampered.tables.find((t) => t.name === "day_off")!;
    dayOff.rows.push([randomUUID(), OWNER, "2027-01-01", "forged"]);
    dayOff.rowCount += 1;
    expect(() => parseBackup(Buffer.from(JSON.stringify(tampered), "utf8"))).toThrow(/checksum/);
  });
});
