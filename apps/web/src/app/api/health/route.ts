import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness and readiness for the web service: answers without a session (a deployment platform
 * polls it) and reveals nothing but whether the database answers. Never caches.
 */
export async function GET(): Promise<Response> {
  const startedAt = Date.now();
  try {
    await db().execute(sql`select 1`);
    return NextResponse.json(
      { ok: true, database: "ok", latencyMs: Date.now() - startedAt, at: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, database: "unreachable", at: new Date().toISOString() },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
