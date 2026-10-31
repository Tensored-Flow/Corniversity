import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb, type DbHandle } from "./client";
import { getEnv } from "./env";

const here = dirname(fileURLToPath(import.meta.url));
export const migrationsFolder = resolve(here, "..", "drizzle");

/**
 * Applies SQL migrations, then performs the optional steps a static migration cannot decide:
 * pgvector is only present on some PostgreSQL images, so the embedding table is created when
 * the extension is available and skipped (with a recorded reason) when it is not.
 */
export async function runMigrations(handle: DbHandle): Promise<{ pgvector: boolean }> {
  await migrate(handle.db, { migrationsFolder });

  const available = await handle.db.execute(sql`select 1 from pg_available_extensions where name = 'vector'`);
  let pgvector = false;
  if (available.rows.length > 0) {
    try {
      await handle.db.execute(sql`create extension if not exists vector`);
      await handle.db.execute(sql`
        create table if not exists passage_embedding (
          passage_id uuid primary key references passage(id) on delete cascade,
          model text not null,
          dims integer not null,
          embedding vector(1024) not null,
          created_at timestamptz not null default now()
        )`);
      pgvector = true;
    } catch (error) {
      console.warn("[migrate] pgvector present but could not be enabled:", (error as Error).message);
    }
  }
  await handle.db.execute(sql`
    insert into app_setting (key, value) values ('capabilities', ${JSON.stringify({ pgvector })}::jsonb)
    on conflict (key) do update set value = excluded.value, updated_at = now()`);
  return { pgvector };
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const env = getEnv();
  const handle = createDb(env.DATABASE_URL, { max: 2 });
  runMigrations(handle)
    .then(({ pgvector }) => {
      console.log(`migrations applied (pgvector: ${pgvector ? "enabled" : "not available; full-text search only"})`);
      return handle.close();
    })
    .catch(async (error) => {
      console.error("migration failed:", error);
      await handle.close();
      process.exit(1);
    });
}
