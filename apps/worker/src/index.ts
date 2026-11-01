import { closeDb, getDb } from "@corniversity/db/client";
import { getEnv } from "@corniversity/db/env";
import { QUEUES } from "@corniversity/db/jobs";
import { runMigrations } from "@corniversity/db/migrate";
import { getBoss, stopBoss } from "@corniversity/db/queue";
import { registerHandlers } from "./handlers/index";
import { startHealthServer } from "./health";
import { seedContentIfRequested } from "./seed-on-start";

/**
 * The durable worker. It applies pending migrations (idempotent; the web app only enqueues),
 * seeds the institution's content when the deployment sets SEED_CONTENT_ON_START=1,
 * registers one handler per queue, exposes a small health endpoint so a deployment platform can
 * tell it is alive, and shuts down gracefully.
 */
async function main() {
  const env = getEnv();
  const handle = getDb();
  const migrated = await runMigrations(handle);
  console.log(`[worker] migrations ok (pgvector ${migrated.pgvector ? "on" : "off"})`);
  const seeded = await seedContentIfRequested(handle.db, process.env.SEED_CONTENT_ON_START);
  if (seeded)
    console.log(
      `[worker] content seeded: ${seeded.courseVersionsCreated} course versions created, ${seeded.courseVersionsUnchanged} unchanged`,
    );

  const boss = await getBoss({ supervise: true });
  await registerHandlers(boss, handle.db, env);
  console.log(`[worker] listening on queues: ${Object.values(QUEUES).join(", ")}`);

  // Railway health-checks the port it injects as PORT (the deploy script sets both to 3100), so
  // PORT is honoured only on the platform; locally the shared root .env's PORT belongs to the web
  // app, and the worker keeps 3100 unless WORKER_HEALTH_PORT says otherwise.
  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
  const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? (onRailway ? process.env.PORT : undefined) ?? 3100);
  const health = startHealthServer(healthPort, () => ({
    ok: true,
    queues: Object.values(QUEUES),
    pgvector: migrated.pgvector,
  }));

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received; stopping`);
    health.close();
    await stopBoss();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("[worker] fatal", error);
  process.exit(1);
});
