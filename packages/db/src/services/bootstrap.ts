import { timingSafeEqual } from "node:crypto";
import { count, eq } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { appSetting, user } from "../schema/index";

const BOOTSTRAP_KEY = "bootstrap";

export async function isBootstrapComplete(db: DbOrTx): Promise<boolean> {
  const [row] = await db.select().from(appSetting).where(eq(appSetting.key, BOOTSTRAP_KEY)).limit(1);
  if (row && (row.value as { completed?: boolean }).completed) return true;
  const counts = await db.select({ users: count() }).from(user);
  return (counts[0]?.users ?? 0) > 0;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface BootstrapInput {
  email: string;
  code: string;
  env: { OWNER_EMAIL: string; OWNER_BOOTSTRAP_CODE: string };
}

/**
 * Single-owner bootstrap. Account creation is permitted only when no account exists yet, the
 * email is the configured owner email, and the one-time code matches. Any other sign-up is
 * refused with a reason that does not leak which condition failed.
 */
export async function assertBootstrapAllowed(db: DbOrTx, input: BootstrapInput): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (await isBootstrapComplete(db)) {
    return { ok: false, reason: "Sign-up is closed. This institution has one owner account." };
  }
  const emailOk = input.email.trim().toLowerCase() === input.env.OWNER_EMAIL.trim().toLowerCase();
  const codeOk = input.code.length > 0 && safeEqual(input.code, input.env.OWNER_BOOTSTRAP_CODE);
  if (!emailOk || !codeOk) {
    return { ok: false, reason: "The owner email or bootstrap code is not correct." };
  }
  return { ok: true };
}

export async function completeBootstrap(db: DbOrTx, ownerUserId: string): Promise<void> {
  await db
    .insert(appSetting)
    .values({ key: BOOTSTRAP_KEY, value: { completed: true, ownerUserId, completedAt: new Date().toISOString() } })
    .onConflictDoUpdate({
      target: appSetting.key,
      set: { value: { completed: true, ownerUserId, completedAt: new Date().toISOString() } },
    });
}

export async function getOwnerUserId(db: DbOrTx): Promise<string | null> {
  const [row] = await db.select().from(appSetting).where(eq(appSetting.key, BOOTSTRAP_KEY)).limit(1);
  const value = row?.value as { ownerUserId?: string } | undefined;
  return value?.ownerUserId ?? null;
}
