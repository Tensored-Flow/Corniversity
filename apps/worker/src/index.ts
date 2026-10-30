import { closeDb, getDb } from "@corniversity/db/client";
import { getEnv } from "@corniversity/db/env";
import { QUEUES } from "@corniversity/db/jobs";
import { runMigrations } from "@corniversity/db/migrate";
import { getBoss, stopBoss } from "@corniversity/db/queue";
import { registerHandlers } from "./handlers/index";
import { startHealthServer } from "./health";

/**
 * The durable worker. It applies pending migrations (idempotent; the web app only enqueues),
 * registers one handler per queue, exposes a small health endpoint so a deployment platform can
 * tell it is alive, and shuts down gracefully.
 */
async function main() {
  const env = getEnv();
  const handle = getDb();
  const migrated = await runMigrations(handle);
  console.log(`[worker] migrations ok (pgvector ${migrated.pgvector ? "on" : "off"})`);

  const boss = await getBoss({ supervise: true });
  await registerHandlers(boss, handle.db, env);
  console.log(`[worker] listening on queues: ${Object.values(QUEUES).join(", ")}`);

  const health = startHealthServer(Number(process.env.WORKER_HEALTH_PORT ?? 3100), () => ({
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
