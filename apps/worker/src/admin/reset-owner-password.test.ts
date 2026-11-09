import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createDb } from "@corniversity/db/client";
import { account, session, user } from "@corniversity/db/schema/auth";
import { appSetting, auditEvent } from "@corniversity/db/schema/index";
import { completeBootstrap } from "@corniversity/db/services/bootstrap";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The recovery command end to end, as an administrator would run it in the worker container:
 * the real script, started with tsx, reading the new password from standard input, against a
 * throw-away database. The stored hash must then verify with the auth library the website uses.
 */
const OWNER = `cli-owner-${randomUUID()}`;
const repo = resolve(import.meta.dirname, "../../../..");
let handle: ReturnType<typeof createDb>;

function runCommand(stdin: string): Promise<{ code: number | null; out: string }> {
  return new Promise((done) => {
    const child = spawn(
      process.execPath,
      [resolve(repo, "node_modules/tsx/dist/cli.mjs"), "apps/worker/src/admin/reset-owner-password.ts", "--password-stdin"],
      {
        cwd: repo,
        env: { ...process.env, DEPLOYMENT_MODE: "local" },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let out = "";
    child.stdout.on("data", (d) => {
      out += d;
    });
    child.stderr.on("data", (d) => {
      out += d;
    });
    child.on("close", (code) => done({ code, out }));
    child.stdin.end(stdin);
  });
}

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  await handle.db.insert(user).values({ id: OWNER, name: "CLI Owner", email: "owner@example.test", role: "owner" });
  await handle.db.insert(account).values({
    id: `acc-${OWNER}`,
    accountId: OWNER,
    providerId: "credential",
    userId: OWNER,
    password: await hashPassword("the-old-password-123"),
  });
  await handle.db
    .insert(session)
    .values({ id: `s-${OWNER}`, token: `t-${OWNER}`, userId: OWNER, expiresAt: new Date(Date.now() + 86_400_000) });
  await completeBootstrap(handle.db, OWNER);
});

afterAll(async () => {
  await handle.db.delete(auditEvent).where(eq(auditEvent.ownerId, OWNER));
  await handle.db.delete(user).where(eq(user.id, OWNER));
  await handle.db.delete(appSetting).where(eq(appSetting.key, "bootstrap"));
  await handle.close();
});

describe("the recovery command", () => {
  it("refuses mismatched passwords and changes nothing", async () => {
    const { code, out } = await runCommand("a-brand-new-password-1\na-brand-new-password-2\n");
    expect(code).toBe(1);
    expect(out).toMatch(/do not match/);
    const [row] = await handle.db.select().from(account).where(eq(account.userId, OWNER));
    expect(await verifyPassword({ hash: row!.password!, password: "the-old-password-123" })).toBe(true);
  }, 120_000);

  it("sets a password the website's auth library accepts, and signs the owner out", async () => {
    const { code, out } = await runCommand("a-brand-new-password-1\na-brand-new-password-1\n");
    expect(out).toMatch(/Password reset for owner@example\.test; 1 session signed out/);
    expect(code).toBe(0);
    const [row] = await handle.db.select().from(account).where(eq(account.userId, OWNER));
    expect(await verifyPassword({ hash: row!.password!, password: "a-brand-new-password-1" })).toBe(true);
    expect(await verifyPassword({ hash: row!.password!, password: "the-old-password-123" })).toBe(false);
    expect(await handle.db.select().from(session).where(eq(session.userId, OWNER))).toEqual([]);
    expect(out).not.toContain("a-brand-new-password-1");
  }, 120_000);
});
