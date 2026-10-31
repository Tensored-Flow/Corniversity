import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import type { Client } from "pg";

/**
 * Logical backup and restore of the application database without pg_dump (the embedded
 * PostgreSQL bundle ships no client tools and production is reached only over a connection
 * string). Every table in the public schema is read in full; generated columns are skipped on
 * restore; bytea is base64; the pg-boss schema (queue state) is deliberately excluded.
 */

export interface BackupFile {
  format: "corniversity-backup/1";
  createdAt: string;
  databaseVersion: string;
  migrations: string[];
  tables: { name: string; columns: string[]; rowCount: number; rows: unknown[][] }[];
  checksum: string;
}

interface ColumnInfo {
  name: string;
  generated: boolean;
  dataType: string;
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

function encodeValue(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return { __bytea: value.toString("base64") };
  if (value instanceof Date) return { __date: value.toISOString() };
  return value;
}

function decodeValue(value: unknown, dataType: string): unknown {
  if (value && typeof value === "object" && "__bytea" in (value as Record<string, unknown>))
    return Buffer.from((value as { __bytea: string }).__bytea, "base64");
  if (value && typeof value === "object" && "__date" in (value as Record<string, unknown>)) return (value as { __date: string }).__date;
  if ((dataType === "jsonb" || dataType === "json") && value !== null && typeof value !== "string") return JSON.stringify(value);
  return value;
}

export async function createBackup(client: Client): Promise<BackupFile> {
  const order = await tablesInDependencyOrder(client);
  const version = await client.query<{ version: string }>("select version()");
  const migrations = await client
    .query<{ hash: string }>("select hash from drizzle.__drizzle_migrations order by created_at")
    .catch(() => ({ rows: [] as { hash: string }[] }));
  const tables: BackupFile["tables"] = [];
  const hash = createHash("sha256");
  for (const name of order) {
    const columns = (await listColumns(client, name)).filter((c) => !c.generated).map((c) => c.name);
    const result = await client.query({ text: `select ${columns.map((c) => `"${c}"`).join(", ")} from "${name}"`, rowMode: "array" });
    const rows = (result.rows as unknown[][]).map((row) => row.map(encodeValue));
    hash.update(`${name}:${rows.length};`);
    tables.push({ name, columns, rowCount: rows.length, rows });
  }
  return {
    format: "corniversity-backup/1",
    createdAt: new Date().toISOString(),
    databaseVersion: version.rows[0]?.version ?? "unknown",
    migrations: migrations.rows.map((m) => m.hash),
    tables,
    checksum: hash.digest("hex"),
  };
}

export function serialiseBackup(backup: BackupFile): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(backup), "utf8"));
}

export function parseBackup(data: Buffer): BackupFile {
  const text = data.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b])) ? gunzipSync(data).toString("utf8") : data.toString("utf8");
  const parsed = JSON.parse(text) as BackupFile;
  if (parsed.format !== "corniversity-backup/1")
    throw new Error(`unsupported backup format ${String((parsed as { format?: string }).format)}`);
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
 * foreign-key checks deferred by session_replication_role so insertion order cannot fail.
 * Tables absent from the current schema are reported and skipped.
 */
export async function restoreBackup(client: Client, backup: BackupFile): Promise<{ restored: number; skipped: string[] }> {
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
      const types = usable.map((c) => columns.find((col) => col.name === c)!.dataType);
      for (const row of t.rows) {
        const values = indexes.map((i, j) => decodeValue(row[i], types[j]!));
        await client.query(
          `insert into "${t.name}" (${usable.map((c) => `"${c}"`).join(", ")}) values (${usable.map((_, i) => `$${i + 1}`).join(", ")})`,
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
