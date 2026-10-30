import "server-only";
import { getDb } from "@corniversity/db/client";

/** Shared database handle for server components, actions and route handlers. */
export function db() {
  return getDb().db;
}
