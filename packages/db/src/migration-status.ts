import { sql } from "drizzle-orm";
import journal from "../drizzle/meta/_journal.json";
import type { DbOrTx } from "./client";

/** The number of migrations this build ships; the health check compares it with the database. */
export const expectedMigrations = journal.entries.length;

/**
 * Whether the database carries every migration this build knows. The web app does not migrate
 * (the worker does, on start), so its health check reports not-ready until the schema is current
 * instead of serving pages against an older one. Kept apart from the migrator so the web bundle
 * never loads it.
 */
export async function migrationStatus(db: DbOrTx): Promise<{ applied: number; expected: number; ok: boolean }> {
  let applied = 0;
  try {
    const result = await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    applied = Number((result.rows[0] as { n?: number } | undefined)?.n ?? 0);
  } catch {
    applied = 0;
  }
  return { applied, expected: expectedMigrations, ok: applied >= expectedMigrations };
}
