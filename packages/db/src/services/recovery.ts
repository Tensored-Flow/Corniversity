import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { account, session, user } from "../schema/auth";
import { auditEvent } from "../schema/index";
import { getOwnerUserId } from "./bootstrap";

export class RecoveryError extends Error {}

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;

/** The same bounds the sign-in form enforces; checked before anything is hashed or stored. */
export function checkNewPassword(password: string, repeated: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) throw new RecoveryError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (password.length > MAX_PASSWORD_LENGTH) throw new RecoveryError(`Use at most ${MAX_PASSWORD_LENGTH} characters.`);
  if (password !== repeated) throw new RecoveryError("The two passwords do not match.");
}

/**
 * Administrative recovery of the single owner's password, for a deployment without email. It
 * runs only where the database can be reached directly (a shell in the hosting platform's
 * worker container, or the hosting machine), never through the website, so there is no public
 * recovery route. It replaces the hash on the owner's password credential, signs the owner out
 * everywhere, and records the event; it creates no account and does not reopen sign-up.
 */
export async function resetOwnerPassword(db: DbOrTx, passwordHash: string): Promise<{ email: string; sessionsRevoked: number }> {
  const ownerId = (await getOwnerUserId(db)) ?? (await db.select({ id: user.id }).from(user).where(eq(user.role, "owner")).limit(1))[0]?.id;
  if (!ownerId) throw new RecoveryError("No owner account exists yet. Create it through the website first.");
  const [owner] = await db.select({ email: user.email }).from(user).where(eq(user.id, ownerId)).limit(1);
  if (!owner) throw new RecoveryError("The recorded owner account no longer exists.");
  const updated = await db
    .update(account)
    .set({ password: passwordHash, updatedAt: new Date() })
    .where(and(eq(account.userId, ownerId), eq(account.providerId, "credential")))
    .returning({ id: account.id });
  if (updated.length === 0) throw new RecoveryError("The owner has no password credential to reset.");
  const revoked = await db.delete(session).where(eq(session.userId, ownerId)).returning({ id: session.id });
  await db.insert(auditEvent).values({
    ownerId,
    actor: "system",
    action: "owner:password-reset",
    entity: "user",
    entityId: ownerId,
    details: { sessionsRevoked: revoked.length, via: "administrative recovery command" },
  });
  return { email: owner.email, sessionsRevoked: revoked.length };
}
