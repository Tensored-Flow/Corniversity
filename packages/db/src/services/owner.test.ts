import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { account, session, user } from "../schema/auth";
import { appSetting, auditEvent } from "../schema/index";
import { assertBootstrapAllowed, completeBootstrap, isBootstrapComplete } from "./bootstrap";
import { checkNewPassword, RecoveryError, resetOwnerPassword } from "./recovery";

/**
 * The single owner, against PostgreSQL: setup needs the owner email and the one-time code; once
 * an owner exists setup is closed on the server, the code is never accepted again, a restart
 * does not reopen it, and two racing submissions cannot both create an owner. Then the
 * administrative recovery path, which runs only with direct database access. (These share one
 * file because the database allows a single owner; the owner is removed again at the end.)
 */
const OWNER = `owner-${randomUUID()}`;
const RIVAL = `rival-${randomUUID()}`;
const LEARNER = `learner-${randomUUID()}`;
const env = { OWNER_EMAIL: "owner@example.test", OWNER_BOOTSTRAP_CODE: "test-bootstrap-code" };
let handle: ReturnType<typeof createDb>;

beforeAll(() => {
  handle = createDb(process.env.DATABASE_URL!, { max: 3 });
});

afterAll(async () => {
  const ids = [OWNER, RIVAL, LEARNER];
  await handle.db.delete(auditEvent).where(inArray(auditEvent.ownerId, ids));
  await handle.db.delete(user).where(inArray(user.id, ids));
  await handle.db.delete(appSetting).where(eq(appSetting.key, "bootstrap"));
  await handle.close();
});

describe("owner setup", () => {
  it("before an owner exists, needs the owner email and the right code, and nobody can sign up without a configured code", async () => {
    expect(await isBootstrapComplete(handle.db)).toBe(false);
    const wrongEmail = await assertBootstrapAllowed(handle.db, { email: "someone@example.test", code: env.OWNER_BOOTSTRAP_CODE, env });
    const wrongCode = await assertBootstrapAllowed(handle.db, { email: env.OWNER_EMAIL, code: "guess", env });
    expect(wrongEmail).toEqual(wrongCode);
    expect(wrongEmail.ok).toBe(false);
    const noCode = await assertBootstrapAllowed(handle.db, {
      email: env.OWNER_EMAIL,
      code: "anything",
      env: { OWNER_EMAIL: env.OWNER_EMAIL },
    });
    expect(noCode).toMatchObject({ ok: false, reason: expect.stringMatching(/no bootstrap code/) });
    expect(await assertBootstrapAllowed(handle.db, { email: "OWNER@example.test ", code: env.OWNER_BOOTSTRAP_CODE, env })).toEqual({
      ok: true,
    });
  });

  it("lets only one of two simultaneous owner accounts be created, whatever their email casing", async () => {
    const results = await Promise.allSettled([
      handle.db.insert(user).values({ id: OWNER, name: "Owner", email: "owner@example.test", role: "owner" }),
      handle.db.insert(user).values({ id: RIVAL, name: "Rival", email: "Owner@Example.test", role: "owner" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String((rejected.reason as { cause?: { code?: string } }).cause?.code ?? rejected.reason)).toMatch(/23505|duplicate|unique/i);
    const owners = await handle.db.select().from(user).where(eq(user.role, "owner"));
    expect(owners).toHaveLength(1);
    // Keep whichever won as the owner for the rest of the file.
    if (owners[0]!.id !== OWNER) {
      await handle.db.delete(user).where(eq(user.id, owners[0]!.id));
      await handle.db.insert(user).values({ id: OWNER, name: "Owner", email: "owner@example.test", role: "owner" });
    }
  });

  it("once the owner exists, refuses the correct code again, stays closed for a fresh connection, and needs no code any more", async () => {
    await completeBootstrap(handle.db, OWNER);
    const reuse = await assertBootstrapAllowed(handle.db, { email: env.OWNER_EMAIL, code: env.OWNER_BOOTSTRAP_CODE, env });
    expect(reuse).toEqual({ ok: false, reason: "Sign-up is closed. This institution has one owner account." });
    // A restart is a new process with a new connection: the state lives in the database.
    const restarted = createDb(process.env.DATABASE_URL!, { max: 1 });
    expect(await isBootstrapComplete(restarted.db)).toBe(true);
    await restarted.close();
    // Even without the setting row, the owner account alone keeps setup closed.
    const [setting] = await handle.db.select().from(appSetting).where(eq(appSetting.key, "bootstrap"));
    await handle.db.delete(appSetting).where(eq(appSetting.key, "bootstrap"));
    expect(await isBootstrapComplete(handle.db)).toBe(true);
    await handle.db.insert(appSetting).values(setting!);
    // With the code removed from the deployment, setup stays closed for the right reason.
    expect(
      await assertBootstrapAllowed(handle.db, { email: env.OWNER_EMAIL, code: "", env: { OWNER_EMAIL: env.OWNER_EMAIL } }),
    ).toMatchObject({
      reason: expect.stringMatching(/Sign-up is closed/),
    });
  });
});

describe("administrative recovery", () => {
  it("checks the new password the way the sign-in form does", () => {
    expect(() => checkNewPassword("short", "short")).toThrow(RecoveryError);
    expect(() => checkNewPassword("long-enough-password", "long-enough-passw0rd")).toThrow(/do not match/);
    expect(() => checkNewPassword("long-enough-password", "long-enough-password")).not.toThrow();
  });

  it("replaces only the owner's password credential, signs the owner out everywhere and leaves others alone", async () => {
    await handle.db.insert(user).values({ id: LEARNER, name: "Learner", email: `${LEARNER}@example.test` });
    await handle.db.insert(account).values([
      { id: `acc-${OWNER}`, accountId: OWNER, providerId: "credential", userId: OWNER, password: "old-hash" },
      { id: `acc-${LEARNER}`, accountId: LEARNER, providerId: "credential", userId: LEARNER, password: "learner-hash" },
    ]);
    const expires = new Date(Date.now() + 86_400_000);
    await handle.db.insert(session).values([
      { id: `s1-${OWNER}`, token: `t1-${OWNER}`, userId: OWNER, expiresAt: expires },
      { id: `s2-${OWNER}`, token: `t2-${OWNER}`, userId: OWNER, expiresAt: expires },
      { id: `s-${LEARNER}`, token: `t-${LEARNER}`, userId: LEARNER, expiresAt: expires },
    ]);
    const usersBefore = (await handle.db.select().from(user)).length;

    const result = await resetOwnerPassword(handle.db, "new-hash");
    expect(result).toEqual({ email: "owner@example.test", sessionsRevoked: 2 });
    const [ownerAccount] = await handle.db.select().from(account).where(eq(account.userId, OWNER));
    expect(ownerAccount?.password).toBe("new-hash");
    const [learnerAccount] = await handle.db.select().from(account).where(eq(account.userId, LEARNER));
    expect(learnerAccount?.password).toBe("learner-hash");
    expect(await handle.db.select().from(session).where(eq(session.userId, OWNER))).toEqual([]);
    expect(await handle.db.select().from(session).where(eq(session.userId, LEARNER))).toHaveLength(1);
    expect((await handle.db.select().from(user)).length).toBe(usersBefore);
    expect(await isBootstrapComplete(handle.db)).toBe(true);
    const audit = await handle.db.select().from(auditEvent).where(eq(auditEvent.ownerId, OWNER));
    expect(audit.map((a) => a.action)).toContain("owner:password-reset");
  });

  it("refuses when there is no owner, rather than creating one", async () => {
    await handle.db.delete(appSetting).where(eq(appSetting.key, "bootstrap"));
    await handle.db.update(user).set({ role: "learner" }).where(eq(user.id, OWNER));
    await expect(resetOwnerPassword(handle.db, "another-hash")).rejects.toThrow(/No owner account exists/);
    expect(await handle.db.select().from(user).where(eq(user.role, "owner"))).toEqual([]);
  });
});
