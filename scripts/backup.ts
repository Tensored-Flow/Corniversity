// Logical backup of the application database to <CORNIVERSITY_DATA_ROOT>/exports/backups.
// Usage: pnpm backup [--out <file.json.gz>]
// The document is small; stored originals are written beside it in <file>.blobs/ and both are
// needed to restore. Keep them together.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { createBackup, serialiseBackup } from "../packages/db/src/backup";
import { loadRootEnv } from "../packages/db/src/env";

loadRootEnv();
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const dataRoot = process.env.CORNIVERSITY_DATA_ROOT ?? resolve(process.cwd(), "..", "Corniversity-Library");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile =
  outIndex >= 0 && args[outIndex + 1]
    ? resolve(args[outIndex + 1]!)
    : resolve(dataRoot, "exports", "backups", `corniversity-${stamp}.json.gz`);
const sidecarDir = `${outFile}.blobs`;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  mkdirSync(resolve(outFile, ".."), { recursive: true });
  const backup = await createBackup(client, { sidecarDir });
  const bytes = serialiseBackup(backup);
  writeFileSync(outFile, bytes);
  const rows = backup.tables.reduce((s, t) => s + t.rowCount, 0);
  console.log(`backup written: ${outFile}`);
  console.log(
    `${backup.tables.length} tables, ${rows} rows, ${(bytes.byteLength / 1024).toFixed(1)} KiB document, ${backup.migrations.length} migrations recorded, checksum ${backup.checksum.slice(0, 12)}`,
  );
  if (backup.blobs && backup.blobs.count > 0) {
    console.log(
      `${backup.blobs.count} stored originals, ${(backup.blobs.bytes / 1024 / 1024).toFixed(1)} MiB, written beside the document in ${sidecarDir}`,
    );
  }
  console.log(
    "Note: the queue schema (pgboss) and files stored outside the database (BLOB_STORE=fs originals) are not included; back up the data root alongside.",
  );
} finally {
  await client.end();
}
