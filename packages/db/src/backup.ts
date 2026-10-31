import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { type Client, types } from "pg";

/**
 * Logical backup and restore of the application database without pg_dump (the embedded
 * PostgreSQL bundle ships no client tools and production is reached only over a connection
 * string).
 *
 * Format 2: every table in the public schema is read inside one REPEATABLE READ snapshot;
 * generated columns are skipped on restore; the pg-boss schema (queue state) is excluded.
 * Dates and timestamps travel as the text PostgreSQL printed, never as JavaScript Dates, so a
 * backup taken on a UTC+1 host restores the same calendar day. Binary columns (the stored
 * originals in `asset_blob`) are never held in the JSON document: each value is streamed one
 * row at a time into a sidecar directory next to the backup file and referenced by content hash,
 * so the document stays small however many books are stored. Format 1 files (inline base64,
 * ISO dates) are still readable.
 */

export const BACKUP_FORMAT = "corniversity-backup/2";

export interface BackupTable {
  name: string;
  columns: string[];
  rowCount: number;
  rows: unknown[][];
}

export interface BackupFile {
  format: "corniversity-backup/2" | "corniversity-backup/1";
  createdAt: string;
  databaseVersion: string;
  migrations: string[];
  tables: BackupTable[];
  /** Format 2: the binary values written beside the document. */
  blobs?: { count: number; bytes: number };
  checksum: string;
}

interface ColumnInfo {
  name: string;
  generated: boolean;
  dataType: string;
}

interface FileRef {
  __file: string;
  sha256: string;
  bytes: number;
}

/** Date-like columns are read as the text PostgreSQL printed (see the module comment). */
export function readTemporalColumnsAsText(): void {
  for (const oid of [1082, 1114, 1184]) types.setTypeParser(oid, (value: string) => value);
}

export async function listTables(client: Client): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
  );
  return result.rows.map((r) => r.table_name);
}

export async function listColumns(client: Client, table: string): Promise<ColumnInfo[]> {
  const result = await client.query<{ column_name: string; is_generated: string; data_type: string }>(
    "select column_name, is_generated, data_type from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position",
    [table],
  );
  return result.rows.map((r) => ({ name: r.column_name, generated: r.is_generated === "ALWAYS", dataType: r.data_type }));
}

async function primaryKeyColumns(client: Client, table: string): Promise<string[]> {
  const result = await client.query<{ column_name: string }>(
    `select kcu.column_name
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu
       on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
     where tc.table_schema = 'public' and tc.table_name = $1 and tc.constraint_type = 'PRIMARY KEY'
     order by kcu.ordinal_position`,
    [table],
  );
  return result.rows.map((r) => r.column_name);
}

/** Tables ordered so that referenced tables come before the tables that reference them. */
export async function tablesInDependencyOrder(client: Client): Promise<string[]> {
  const tables = await listTables(client);
  const result = await client.query<{ child: string; parent: string }>(`
    select tc.table_name as child, ccu.table_name as parent
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`);
  const parents = new Map<string, Set<string>>();
  for (const t of tables) parents.set(t, new Set());
  for (const row of result.rows) if (row.child !== row.parent) parents.get(row.child)?.add(row.parent);
  const ordered: string[] = [];
  const done = new Set<string>();
  while (ordered.length < tables.length) {
    let progressed = false;
    for (const t of tables) {
      if (done.has(t)) continue;
      if ([...(parents.get(t) ?? [])].every((p) => done.has(p) || !tables.includes(p))) {
        ordered.push(t);
        done.add(t);
        progressed = true;
      }
    }
    if (!progressed) {
      // cycles: fall back to name order
      for (const t of tables) {
        if (!done.has(t)) {
          ordered.push(t);
          done.add(t);
        }
      }
    }
  }
  return ordered;
}

function quoteAll(columns: string[]): string {
  return columns.map((c) => `"${c}"`).join(", ");
}

function isFileRef(value: unknown): value is FileRef {
  return Boolean(value) && typeof value === "object" && "__file" in (value as Record<string, unknown>);
}

/**
 * Writes one binary value into the sidecar directory, named by its content hash so identical
 * bytes are stored once, and returns the reference kept in the document.
 */
function writeBlob(sidecarDir: string, table: string, data: Buffer): FileRef {
  const sha256 = createHash("sha256").update(data).digest("hex");
  const relative = `${table}/${sha256}.bin`;
  const target = join(sidecarDir, relative);
  if (!existsSync(target)) {
    mkdirSync(join(sidecarDir, table), { recursive: true });
    writeFileSync(target, data);
  }
  return { __file: relative, sha256, bytes: data.byteLength };
}

function readBlob(sidecarDir: string, ref: FileRef): Buffer {
  const path = join(sidecarDir, ref.__file);
  if (!existsSync(path)) throw new Error(`backup is missing binary file ${ref.__file} (expected under ${sidecarDir})`);
  const data = readFileSync(path);
  const sha256 = createHash("sha256").update(data).digest("hex");
  if (sha256 !== ref.sha256) throw new Error(`binary file ${ref.__file} does not match its recorded hash; refusing to restore it`);
  return data;
}

function decodeValue(value: unknown, dataType: string, sidecarDir: string | undefined): unknown {
  if (isFileRef(value)) {
    if (!sidecarDir) throw new Error("this backup has binary files beside it; pass the sidecar directory");
    return readBlob(sidecarDir, value);
  }
  if (value && typeof value === "object" && "__bytea" in (value as Record<string, unknown>))
    return Buffer.from((value as { __bytea: string }).__bytea, "base64");
  if (value && typeof value === "object" && "__date" in (value as Record<string, unknown>)) return (value as { __date: string }).__date;
  if ((dataType === "jsonb" || dataType === "json") && value !== null && typeof value !== "string") return JSON.stringify(value);
  return value;
}

function tableDigest(hash: ReturnType<typeof createHash>, table: BackupTable): void {
  hash.update(`${table.name}:${table.rowCount}:${JSON.stringify(table.columns)}:${JSON.stringify(table.rows)};`);
}

/**
 * Reads every table inside one read-only REPEATABLE READ transaction, so the document is a
 * consistent snapshot even while the application is running. Tables with binary columns are
 * read one row at a time by primary key and their binary values go to `sidecarDir`.
 */
export async function createBackup(client: Client, options: { sidecarDir: string }): Promise<BackupFile> {
  readTemporalColumnsAsText();
  const hash = createHash("sha256");
  const tables: BackupTable[] = [];
  let blobCount = 0;
  let blobBytes = 0;
  await client.query("begin isolation level repeatable read read only");
  try {
    const order = await tablesInDependencyOrder(client);
    const version = await client.query<{ version: string }>("select version()");
    const migrations = await client
      .query<{ hash: string }>("select hash from drizzle.__drizzle_migrations order by created_at")
      .catch(() => ({ rows: [] as { hash: string }[] }));
    for (const name of order) {
      const columnInfo = (await listColumns(client, name)).filter((c) => !c.generated);
      const columns = columnInfo.map((c) => c.name);
      const binaryColumns = columnInfo.filter((c) => c.dataType === "bytea").map((c) => c.name);
      let rows: unknown[][];
      if (binaryColumns.length === 0) {
        const result = await client.query({ text: `select ${quoteAll(columns)} from "${name}"`, rowMode: "array" });
        rows = result.rows as unknown[][];
      } else {
        const keyColumns = await primaryKeyColumns(client, name);
        if (keyColumns.length === 0) throw new Error(`table ${name} has binary columns but no primary key; cannot stream it`);
        const keys = await client.query({
          text: `select ${quoteAll(keyColumns)} from "${name}" order by ${quoteAll(keyColumns)}`,
          rowMode: "array",
        });
        rows = [];
        for (const key of keys.rows as unknown[][]) {
          const where = keyColumns.map((c, i) => `"${c}" = $${i + 1}`).join(" and ");
          const one = await client.query({
            text: `select ${quoteAll(columns)} from "${name}" where ${where}`,
            values: key,
            rowMode: "array",
          });
          const row = (one.rows[0] as unknown[] | undefined) ?? [];
          rows.push(
            row.map((value, index) => {
              if (Buffer.isBuffer(value) && binaryColumns.includes(columns[index]!)) {
                const ref = writeBlob(options.sidecarDir, name, value);
                blobCount += 1;
                blobBytes += ref.bytes;
                return ref;
              }
              return value;
            }),
          );
        }
      }
      const table = { name, columns, rowCount: rows.length, rows };
      tableDigest(hash, table);
      tables.push(table);
    }
    await client.query("commit");
    return {
      format: BACKUP_FORMAT,
      createdAt: new Date().toISOString(),
      databaseVersion: version.rows[0]?.version ?? "unknown",
      migrations: migrations.rows.map((m) => m.hash),
      tables,
      blobs: { count: blobCount, bytes: blobBytes },
      checksum: hash.digest("hex"),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  }
}

export function serialiseBackup(backup: BackupFile): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(backup), "utf8"));
}

/** Parses a backup document and, for format 2, refuses one whose tables do not match its checksum. */
export function parseBackup(data: Buffer): BackupFile {
  const text = data.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b])) ? gunzipSync(data).toString("utf8") : data.toString("utf8");
  const parsed = JSON.parse(text) as BackupFile;
  if (parsed.format !== BACKUP_FORMAT && parsed.format !== "corniversity-backup/1")
    throw new Error(`unsupported backup format ${String((parsed as { format?: string }).format)}`);
  if (parsed.format === BACKUP_FORMAT) {
    const hash = createHash("sha256");
    for (const table of parsed.tables) tableDigest(hash, table);
    if (hash.digest("hex") !== parsed.checksum) throw new Error("backup checksum does not match its contents; refusing to use it");
  }
  return parsed;
}

export interface RestorePlan {
  tables: { name: string; backupRows: number; currentRows: number; missingInDatabase: boolean }[];
  missingTables: string[];
  extraTables: string[];
}

export async function planRestore(client: Client, backup: BackupFile): Promise<RestorePlan> {
  const existing = await listTables(client);
  const tables = [];
  for (const t of backup.tables) {
    const present = existing.includes(t.name);
    const count = present ? Number((await client.query<{ n: string }>(`select count(*) as n from "${t.name}"`)).rows[0]?.n ?? 0) : 0;
    tables.push({ name: t.name, backupRows: t.rowCount, currentRows: count, missingInDatabase: !present });
  }
  return {
    tables,
    missingTables: tables.filter((t) => t.missingInDatabase).map((t) => t.name),
    extraTables: existing.filter((e) => !backup.tables.some((t) => t.name === e)),
  };
}

/**
 * Replaces the contents of every table present in the backup, inside one transaction, with
 * foreign-key checks disabled by session_replication_role (which needs a superuser or a role
 * with SET privilege, as the Railway default role has) so insertion order cannot fail. Tables
 * absent from the current schema are reported and skipped. Binary values are read from
 * `sidecarDir` and verified against their recorded hashes before insertion.
 */
export async function restoreBackup(
  client: Client,
  backup: BackupFile,
  options: { sidecarDir?: string } = {},
): Promise<{ restored: number; skipped: string[] }> {
  const existing = await listTables(client);
  const skipped: string[] = [];
  let restored = 0;
  await client.query("begin");
  try {
    await client.query("set local session_replication_role = replica");
    for (const t of [...backup.tables].reverse()) if (existing.includes(t.name)) await client.query(`delete from "${t.name}"`);
    for (const t of backup.tables) {
      if (!existing.includes(t.name)) {
        skipped.push(t.name);
        continue;
      }
      const columns = await listColumns(client, t.name);
      const usable = t.columns.filter((c) => columns.some((col) => col.name === c && !col.generated));
      const indexes = usable.map((c) => t.columns.indexOf(c));
      const dataTypes = usable.map((c) => columns.find((col) => col.name === c)!.dataType);
      for (const row of t.rows) {
        const values = indexes.map((i, j) => decodeValue(row[i], dataTypes[j]!, options.sidecarDir));
        await client.query(
          `insert into "${t.name}" (${quoteAll(usable)}) values (${usable.map((_, i) => `$${i + 1}`).join(", ")})`,
          values,
        );
        restored += 1;
      }
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
  return { restored, skipped };
}
