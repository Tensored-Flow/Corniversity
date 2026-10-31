// Restores a logical backup. Dry run by default; pass --yes to replace the current contents.
// Usage: pnpm restore <file.json.gz> [--yes]
// Stored originals are read from <file>.blobs/ next to the document and verified by hash.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { parseBackup, planRestore, readTemporalColumnsAsText, restoreBackup } from "../packages/db/src/backup";
import { loadRootEnv } from "../packages/db/src/env";

loadRootEnv();
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: pnpm restore <file.json.gz> [--yes]");
  process.exit(2);
}
const confirm = args.includes("--yes");
const backupPath = resolve(file);
const backup = parseBackup(readFileSync(backupPath));
const sidecarDir = `${backupPath}.blobs`;
if (backup.blobs && backup.blobs.count > 0 && !existsSync(sidecarDir)) {
  console.error(`this backup has ${backup.blobs.count} stored originals but ${sidecarDir} is missing; restore both together`);
  process.exit(2);
}

readTemporalColumnsAsText();
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const plan = await planRestore(client, backup);
  console.log(
    `backup from ${backup.createdAt} (${backup.databaseVersion.split(",")[0]}), ${backup.tables.length} tables, checksum ${backup.checksum.slice(0, 12)}${
      backup.blobs ? `, ${backup.blobs.count} stored originals` : ""
    }`,
  );
  for (const t of plan.tables)
    console.log(
      `  ${t.name.padEnd(28)} backup ${String(t.backupRows).padStart(6)}  current ${String(t.currentRows).padStart(6)}${t.missingInDatabase ? "  (table missing in this database: skipped)" : ""}`,
    );
  if (plan.extraTables.length)
    console.log(`tables present here but absent from the backup (left untouched): ${plan.extraTables.join(", ")}`);
  if (!confirm) {
    console.log("\nDry run only. Re-run with --yes to replace the current contents of the tables above (inside one transaction).");
    process.exit(0);
  }
  const result = await restoreBackup(client, backup, { sidecarDir });
  console.log(`restored ${result.restored} rows${result.skipped.length ? `; skipped tables: ${result.skipped.join(", ")}` : ""}`);
  console.log(
    "Restart the worker so queue state and schedules are rebuilt; originals stored on disk (BLOB_STORE=fs) must be restored from the data root backup.",
  );
} finally {
  await client.end();
}
