import { LibraryError, redeemPairingCode } from "@corniversity/db/services/library";
import { NextResponse } from "next/server";
import { z } from "zod";
import { clientKey, withinRateLimit } from "@/lib/companion-auth";
import { db } from "@/lib/db";

const Body = z.object({
  code: z.string().regex(/^\d{4}-\d{4}$/),
  deviceName: z.string().trim().min(1).max(80),
  roots: z.array(z.string().min(1).max(500)).max(8).default([]),
});

export const dynamic = "force-dynamic";

/**
 * Exchanges a one-time pairing code (created by the signed-in owner in the Library) for a
 * device token. No session is involved: the code is the credential, it is single-use and it
 * expires after ten minutes. The token is returned exactly once and stored only as a hash.
 */
export async function POST(request: Request): Promise<Response> {
  // Per client, and in total: a single owner pairs a handful of devices, so a burst of wrong
  // codes from anywhere is an attack, whatever addresses it claims.
  if (!withinRateLimit(`pair:${clientKey(request)}`, 10, 10 * 60_000) || !withinRateLimit("pair:all", 30, 10 * 60_000)) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const { token, pairing } = await redeemPairingCode(db(), parsed.data.code, parsed.data.deviceName, parsed.data.roots);
    return NextResponse.json({ token, pairingId: pairing.id, deviceName: pairing.name });
  } catch (error) {
    if (error instanceof LibraryError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
