import { migrationStatus } from "@corniversity/db/migration-status";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness and readiness for the web service: answers without a session (a deployment platform
 * polls it) and reveals nothing but whether the database answers and carries this build's
 * migrations (the worker applies them; until then the web service is not ready). Never caches.
 */
export async function GET(): Promise<Response> {
  const startedAt = Date.now();
  try {
    await db().execute(sql`select 1`);
    const migrations = await migrationStatus(db());
    if (!migrations.ok) {
      return NextResponse.json(
        {
          ok: false,
          database: "ok",
          migrations: "pending",
          applied: migrations.applied,
          expected: migrations.expected,
          at: new Date().toISOString(),
        },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
    return NextResponse.json(
      { ok: true, database: "ok", migrations: "current", latencyMs: Date.now() - startedAt, at: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, database: "unreachable", at: new Date().toISOString() },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
