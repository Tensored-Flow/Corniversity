import { type AssetReport, checkAiAssets } from "@corniversity/ai/assets";
import { migrationStatus } from "@corniversity/db/migration-status";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// The assets ship with the build and cannot change while it runs, so they are checked once.
let assets: AssetReport | undefined;
function aiAssets() {
  assets ??= checkAiAssets();
  return {
    ok: assets.ok,
    scripted: `${assets.fixtures.loaded} of ${assets.fixtures.required}`,
    ...(assets.fixtures.missing.length ? { missing: assets.fixtures.missing } : {}),
    prompts: assets.prompts,
  };
}

/**
 * Liveness and readiness for the web service: answers without a session (a deployment platform
 * polls it) and reveals nothing but whether the database answers and carries this build's
 * migrations (the worker applies them; until then the web service is not ready), and whether the
 * prompt and scripted-response assets load (counts, role names and prompt versions only; never
 * their text or where they are stored). Never caches.
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
      {
        ok: true,
        database: "ok",
        migrations: "current",
        aiAssets: aiAssets(),
        latencyMs: Date.now() - startedAt,
        at: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, database: "unreachable", at: new Date().toISOString() },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
