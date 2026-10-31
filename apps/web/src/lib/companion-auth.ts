import "server-only";
import { authenticateDevice, type PairingRow } from "@corniversity/db/services/library";
import { NextResponse } from "next/server";
import { db } from "./db";

/**
 * Device authentication for the companion endpoints. The token is the one returned once at
 * pairing; only its SHA-256 is stored, so a database read never yields a usable credential,
 * and revoking the pairing in the Library ends access on the next request.
 */
export async function requireDevice(request: Request): Promise<{ pairing: PairingRow } | { response: NextResponse }> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { response: NextResponse.json({ error: "device_token_required" }, { status: 401 }) };
  const pairing = await authenticateDevice(db(), token);
  if (!pairing) return { response: NextResponse.json({ error: "device_token_invalid_or_revoked" }, { status: 401 }) };
  return { pairing };
}

const windows = new Map<string, { count: number; resetAt: number }>();

/**
 * Fixed-window limiter for the unauthenticated pairing endpoint. Per process, which is adequate
 * for a single-owner institution: a pairing code has 10^8 possibilities and lives ten minutes,
 * so even a modest cap makes guessing hopeless.
 */
export function withinRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
