// Logical backup of the application database to <CORNIVERSITY_DATA_ROOT>/exports/backups.
// Usage: pnpm backup [--out <file.json.gz>]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { loadRootEnv } from "../packages/db/src/env";
import { createBackup, serialiseBackup } from "./backup-lib";

loadRootEnv();
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const dataRoot = process.env.CORNIVERSITY_DATA_ROOT ?? resolve(process.cwd(), "..", "Corniversity-Library");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile =
  outIndex >= 0 && args[outIndex + 1]
    ? resolve(args[outIndex + 1]!)
    : resolve(dataRoot, "exports", "backups", `corniversity-${stamp}.json.gz`);

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const backup = await createBackup(client);
  mkdirSync(resolve(outFile, ".."), { recursive: true });
  const bytes = serialiseBackup(backup);
  writeFileSync(outFile, bytes);
  const rows = backup.tables.reduce((s, t) => s + t.rowCount, 0);
  console.log(`backup written: ${outFile}`);
  console.log(
    `${backup.tables.length} tables, ${rows} rows, ${(bytes.byteLength / 1024).toFixed(1)} KiB, ${backup.migrations.length} migrations recorded, checksum ${backup.checksum.slice(0, 12)}`,
  );
  console.log(
    "Note: the queue schema (pgboss) and files stored outside the database (BLOB_STORE=fs originals) are not included; back up the data root alongside.",
  );
} finally {
  await client.end();
}
