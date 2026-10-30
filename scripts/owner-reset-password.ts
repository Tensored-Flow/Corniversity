// Resets the owner's password from the hosting machine. Email delivery is optional in
// Corniversity, so this is the recovery path. Usage: pnpm owner:reset-password
// Reads the new password from stdin without echo.
import { createInterface } from "node:readline";
import { eq } from "drizzle-orm";
import { createDb } from "@corniversity/db/client";
import { getEnv } from "@corniversity/db/env";
import { account, user } from "@corniversity/db/schema/auth";
import { getOwnerUserId } from "@corniversity/db/services/bootstrap";
import { hashPassword } from "better-auth/crypto";

async function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const stdout = process.stdout as NodeJS.WriteStream & { _muted?: boolean };
    const original = stdout.write.bind(stdout);
    rl.question(prompt, (answer) => {
      stdout.write = original;
      original("\n");
      rl.close();
      resolve(answer);
    });
    // Mute echo after the prompt has been printed.
    stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
      if (typeof chunk === "string" && chunk !== prompt && !chunk.startsWith(prompt)) return true;
      return (original as (...args: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof stdout.write;
  });
}

async function main() {
  const env = getEnv();
  const handle = createDb(env.DATABASE_URL, { max: 1 });
  try {
    const ownerId = await getOwnerUserId(handle.db);
    if (!ownerId) {
      console.error("No owner account exists yet. Create it through the website first.");
      process.exit(1);
    }
    const [owner] = await handle.db.select({ email: user.email }).from(user).where(eq(user.id, ownerId));
    console.log(`Owner account: ${owner?.email ?? ownerId}`);
    const password = await askHidden("New password (at least 12 characters): ");
    if (password.length < 12) {
      console.error("Password too short.");
      process.exit(1);
    }
    const confirm = await askHidden("Repeat the new password: ");
    if (confirm !== password) {
      console.error("Passwords did not match.");
      process.exit(1);
    }
    const hash = await hashPassword(password);
    const updated = await handle.db
      .update(account)
      .set({ password: hash })
      .where(eq(account.userId, ownerId))
      .returning({ id: account.id });
    if (updated.length === 0) {
      console.error("No credential account row found for the owner.");
      process.exit(1);
    }
    console.log("Password updated. Existing sessions remain valid until they expire; sign out everywhere from Settings if needed.");
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
