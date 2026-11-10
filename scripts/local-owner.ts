/**
 * The owner's local installation: Corniversity on this computer for real study, kept apart from
 * the development stack the automated journeys use. It has its own database (`corniversity_owner`
 * in the local cluster), its own data folder and its own address, http://127.0.0.1:3300, so test
 * runs never touch the owner's records and the owner's records never appear in tests.
 *
 * This is the installation where teaching through the owner's own ChatGPT plan is available
 * (OpenAI documents plan usage for locally hosted apps; the hosted site does not offer it).
 *
 *   window 1: pnpm db:local
 *   window 2: pnpm local:owner          (start; Ctrl+C stops both processes)
 *             pnpm local:owner backup   (a backup of this installation, records and uploads together)
 *
 * It reads the repository's .env for the database cluster, the server secret and the owner email
 * (never printing them), creates the owner database if it is missing, then starts the worker
 * (which applies migrations and seeds the institution's content) and the web app. Uploads are kept
 * in the database (BLOB_STORE=pg, as on the hosted site), so one backup holds records and uploads.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import pg from "pg";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = 3300;
const WORKER_HEALTH_PORT = 3301;
const DATABASE = "corniversity_owner";

const envFile = join(ROOT, ".env");
if (!existsSync(envFile)) {
  console.error("No .env at the repository root. Copy .env.example to .env and fill it in first (see README).");
  process.exit(1);
}
process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL || !process.env.CORNIVERSITY_DATA_ROOT) {
  console.error("The .env needs DATABASE_URL (the local cluster) and CORNIVERSITY_DATA_ROOT.");
  process.exit(1);
}
const cluster = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost", "[::1]"].includes(cluster.hostname)) {
  console.error("DATABASE_URL does not point at a database on this computer; the owner's local installation only uses the local cluster.");
  process.exit(1);
}
const ownerUrl = new URL(cluster);
ownerUrl.pathname = `/${DATABASE}`;
const admin = new URL(cluster);
admin.pathname = "/postgres";

const client = new pg.Client({ connectionString: admin.toString() });
try {
  await client.connect();
} catch {
  console.error("The local database cluster is not running. Start it in another window with: pnpm db:local");
  process.exit(1);
}
const exists = await client.query("select 1 from pg_database where datname = $1", [DATABASE]);
if (exists.rowCount === 0) {
  await client.query(`create database ${DATABASE}`);
  console.log(`[owner] created the database ${DATABASE} in the local cluster`);
}
await client.end();

const dataRoot = join(process.env.CORNIVERSITY_DATA_ROOT, "owner-installation");
mkdirSync(dataRoot, { recursive: true });

const env: NodeJS.ProcessEnv = {
  ...process.env,
  DEPLOYMENT_MODE: "local",
  DATABASE_URL: ownerUrl.toString(),
  BETTER_AUTH_URL: `http://127.0.0.1:${PORT}`,
  PORT: String(PORT),
  WORKER_HEALTH_PORT: String(WORKER_HEALTH_PORT),
  CORNIVERSITY_DATA_ROOT: dataRoot,
  BLOB_STORE: "pg",
  SEED_CONTENT_ON_START: "1",
  CORNIVERSITY_NEXT_DIST_DIR: ".next-owner",
};

const shell = process.platform === "win32";
if (process.argv[2] === "backup") {
  // Written under the installation's data folder; copy the file and its .blobs folder off this computer.
  const backup = spawn("pnpm", ["backup"], { cwd: ROOT, env, stdio: "inherit", shell });
  backup.on("exit", (code) => process.exit(code ?? 1));
} else {
  start();
}

function start() {
  const children = [
    spawn("pnpm", ["--filter", "@corniversity/worker", "dev"], { cwd: ROOT, env, stdio: "inherit", shell }),
    spawn("pnpm", ["--filter", "@corniversity/web", "exec", "next", "dev", "--webpack", "-p", String(PORT), "-H", "127.0.0.1"], {
      cwd: ROOT,
      env,
      stdio: "inherit",
      shell,
    }),
  ];
  console.log(
    `[owner] starting: open http://127.0.0.1:${PORT} (first time: create your account at /join with the bootstrap code from .env)`,
  );
  console.log(`[owner] teaching through your ChatGPT plan: http://127.0.0.1:${PORT}/settings#chatgpt-plan`);

  const stop = () => {
    for (const child of children) if (!child.killed) child.kill();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  for (const child of children) child.on("exit", stop);
}
