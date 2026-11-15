import "server-only";
import { getEnv } from "@corniversity/db/env";
import { scholarlyClientWithCache } from "@corniversity/db/scholarly/cache-pg";
import type { ScholarlyClient } from "@corniversity/db/scholarly/client";
import { openAlexBrowsingRefusal } from "@corniversity/db/services/paper-lists";
import { db } from "@/lib/db";

/**
 * The scholarly provider client for pages and actions: the environment's mode (fixture data is
 * refused in production), live responses cached in PostgreSQL. Web requests never call arXiv; its
 * records arrive through the worker.
 */
let client: ScholarlyClient | undefined;
export function scholarly(): ScholarlyClient {
  client ??= scholarlyClientWithCache(getEnv(), db());
  return client;
}

/** OpenAlex browsing (word searches, lists) refused on this server, with the sentence to show; null when allowed. */
export function browsingRefusal(): string | null {
  return openAlexBrowsingRefusal(getEnv(), scholarly());
}
