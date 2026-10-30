import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";
import { getEnv } from "./env";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Transaction;

export interface DbHandle {
  db: Database;
  pool: pg.Pool;
  close(): Promise<void>;
}

export function createDb(connectionString: string, options: { max?: number } = {}): DbHandle {
  const pool = new pg.Pool({
    connectionString,
    max: options.max ?? 8,
    // Postgres BIGINT comes back as a string by default; our bigint columns use mode "number".
  });
  pool.on("error", (error) => {
    console.error("[db] idle client error", error.message);
  });
  const db = drizzle(pool, { schema, casing: "snake_case" });
  return {
    db,
    pool,
    close: () => pool.end(),
  };
}

let shared: DbHandle | undefined;

/** Process-wide handle for the web app and worker. Scripts and tests create their own. */
export function getDb(): DbHandle {
  if (!shared) {
    shared = createDb(getEnv().DATABASE_URL);
  }
  return shared;
}

export async function closeDb(): Promise<void> {
  if (shared) {
    await shared.close();
    shared = undefined;
  }
}
