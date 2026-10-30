// Starts (or stops) an embedded PostgreSQL 17 cluster for local development.
// No Docker required. Data persists under <CORNIVERSITY_DATA_ROOT>/postgres.
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const dataRoot = process.env.CORNIVERSITY_DATA_ROOT ?? resolve(process.cwd(), "..", "Corniversity-Library");
const databaseUrl = process.env.DATABASE_URL ?? "postgres://corniversity:corniversity@127.0.0.1:5437/corniversity";
const url = new URL(databaseUrl);
const port = Number(url.port || 5432);
const user = decodeURIComponent(url.username || "postgres");
const password = decodeURIComponent(url.password || "password");
const database = url.pathname.replace(/^\//, "") || "corniversity";
const clusterDir = resolve(dataRoot, "postgres", "cluster");
const pidFile = resolve(dataRoot, "postgres", "db-local.pid");
const stop = process.argv.includes("--stop");

async function main() {
  mkdirSync(resolve(dataRoot, "postgres"), { recursive: true });
  const pg = new EmbeddedPostgres({
    databaseDir: clusterDir,
    user,
    password,
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: (m) => process.stdout.write(typeof m === "string" ? m : String(m)),
    onError: (m) => process.stderr.write(typeof m === "string" ? m : String(m)),
  });

  if (stop) {
    if (existsSync(pidFile)) {
      try {
        await pg.stop();
      } catch (error) {
        console.error("stop failed:", error);
      }
      rmSync(pidFile, { force: true });
    }
    console.log("embedded postgres stopped");
    return;
  }

  if (!existsSync(resolve(clusterDir, "PG_VERSION"))) {
    console.log(`initialising cluster at ${clusterDir}`);
    await pg.initialise();
  }
  await pg.start();
  writeFileSync(pidFile, String(process.pid));

  const client = pg.getPgClient();
  await client.connect();
  const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
  if (existing.rowCount === 0) {
    await pg.createDatabase(database);
    console.log(`created database ${database}`);
  }
  await client.end();

  console.log(`embedded postgres ready on ${url.hostname}:${port} (database ${database})`);
  console.log("press Ctrl+C to stop");

  const shutdown = async () => {
    console.log("\nstopping embedded postgres…");
    await pg.stop();
    rmSync(pidFile, { force: true });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // keep the process alive
  setInterval(() => {}, 1 << 30);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
