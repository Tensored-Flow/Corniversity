// Administrative recovery of the owner's password, for a deployment without email. It runs only
// where the database is reachable directly, never through the website:
//   on Railway: `railway ssh --service worker`, then in that shell
//               `node node_modules/tsx/dist/cli.mjs apps/worker/src/admin/reset-owner-password.ts`
//   locally:    `pnpm owner:reset-password`
// The new password is read twice without echo, or, with --password-stdin, as two lines on
// standard input (for scripted use; never pass a password as an argument, where shells keep it).
// It replaces the owner's password, signs the owner out everywhere and records the event.
import { createInterface } from "node:readline";
import { createDb } from "@corniversity/db/client";
import { getEnv } from "@corniversity/db/env";
import { checkNewPassword, RecoveryError, resetOwnerPassword } from "@corniversity/db/services/recovery";
import { hashPassword } from "better-auth/crypto";

async function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const stdout = process.stdout as NodeJS.WriteStream;
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

async function readFromStdin(): Promise<[string, string]> {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const [first = "", second = ""] = raw.split(/\r?\n/);
  return [first, second];
}

async function main(): Promise<void> {
  const env = getEnv();
  const [password, repeated] = process.argv.includes("--password-stdin")
    ? await readFromStdin()
    : [await askHidden("New password (at least 12 characters): "), await askHidden("Repeat the new password: ")];
  const handle = createDb(env.DATABASE_URL, { max: 1 });
  try {
    checkNewPassword(password, repeated);
    const result = await resetOwnerPassword(handle.db, await hashPassword(password));
    console.log(
      `Password reset for ${result.email}; ${result.sessionsRevoked} session${result.sessionsRevoked === 1 ? "" : "s"} signed out. Sign in again with the new password.`,
    );
  } catch (error) {
    if (!(error instanceof RecoveryError)) throw error;
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
