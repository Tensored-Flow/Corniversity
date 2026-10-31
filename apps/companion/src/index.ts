import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { hostname } from "node:os";
import { basename, join, resolve } from "node:path";
import { watch } from "chokidar";
import { Command } from "commander";
import { CompanionClient, CompanionError, type PendingTask } from "./client";
import {
  type CompanionConfig,
  type CompanionState,
  configPath,
  defaultRoot,
  isPaused,
  loadConfig,
  loadState,
  removeConfig,
  saveConfig,
  saveState,
  setPaused,
  VERSION,
} from "./config";
import { pdfCandidateMetadata } from "./pdf-meta";
import {
  DEPARTMENT_FOLDERS,
  departmentHint,
  fileFacts,
  hashFile,
  isCandidate,
  mediaTypeFor,
  pathHint,
  planFor,
  type SyncOutcome,
  summarise,
  waitForStable,
  walk,
} from "./scan";

/**
 * The desktop companion. It is the only thing that can see the drop folder on this computer:
 * it registers each file's bibliographic facts with the university, and sends the bytes of a
 * file only after the owner has granted private storage for that item in the Library. It calls
 * out over HTTPS; nothing listens on this machine, and nothing starts at login unless you set
 * that up yourself.
 */

const log = (message: string) => console.log(`[${new Date().toLocaleTimeString("en-GB", { hour12: false })}] ${message}`);
const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));
const unauthorised = (error: unknown) => error instanceof CompanionError && error.kind === "unauthorised";

function requireConfig(): CompanionConfig {
  const config = loadConfig();
  if (!config) {
    console.error(
      `Not paired. Create a code under Library → Desktop sync, then run:\n  pnpm library:pair -- --server <url> --code <code>\n(configuration file: ${configPath()})`,
    );
    process.exit(2);
  }
  return config;
}

function inboxFor(root: string): string {
  const inbox = join(root, "inbox");
  return existsSync(inbox) ? inbox : root;
}

function pendingCount(state: CompanionState): number {
  return Object.values(state.files).filter((f) => f.status === "upload_requested").length;
}

async function registerFiles(
  config: CompanionConfig,
  state: CompanionState,
  client: CompanionClient,
  options: { dryRun: boolean; patient: boolean },
): Promise<SyncOutcome[]> {
  const outcomes: SyncOutcome[] = [];
  for (const root of config.roots) {
    for await (const file of walk(inboxFor(root))) {
      if (!isCandidate(file)) continue;
      const key = resolve(file);
      const hint = pathHint(root, file);
      const facts = await fileFacts(file).catch(() => null);
      if (!facts) continue;
      const plan = planFor(facts, state.files[key]);
      if (plan.action === "skip_unchanged") {
        outcomes.push({ path: hint, action: "skip_unchanged", detail: plan.reason });
        continue;
      }
      if (options.dryRun) {
        outcomes.push({ path: hint, action: "would_register", detail: `${plan.reason}; metadata only, no file contents` });
        continue;
      }
      const stable = await waitForStable(file, options.patient ? {} : { intervalMs: 400, rounds: 1, maxWaitMs: 10_000 });
      if (!stable) {
        outcomes.push({ path: hint, action: "unstable", detail: "still being written; it will be picked up when it settles" });
        continue;
      }
      try {
        const sha256 = await hashFile(file);
        const mediaType = mediaTypeFor(file);
        const candidateMetadata = mediaType === "application/pdf" ? await pdfCandidateMetadata(file) : {};
        const response = await client.register({
          filename: basename(file),
          mediaType,
          sizeBytes: stable.size,
          sha256,
          candidateMetadata,
          localPathHint: hint,
          departmentHint: departmentHint(root, file),
        });
        state.files[key] = { sha256, size: stable.size, mtimeMs: stable.mtimeMs, assetId: response.assetId, status: response.status };
        outcomes.push({ path: hint, action: plan.action, detail: `${response.outcome} (${response.status})` });
      } catch (error) {
        if (unauthorised(error)) throw error;
        outcomes.push({ path: hint, action: "error", detail: describe(error) });
      }
    }
  }
  return outcomes;
}

async function uploadTask(state: CompanionState, client: CompanionClient, task: PendingTask): Promise<SyncOutcome> {
  const entry = Object.entries(state.files).find(([, e]) => e.sha256 === task.sha256);
  const hint = task.localPathHint ?? task.sha256.slice(0, 12);
  if (!entry)
    return {
      path: hint,
      action: "error",
      detail: "the university is waiting for this file, but it is not under the configured roots any more",
    };
  const [absolutePath, known] = entry;
  try {
    const bytes = await readFile(absolutePath);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== task.sha256)
      return { path: hint, action: "error", detail: "the file changed since it was registered; it will be re-registered on the next sync" };
    const result = await client.upload(task.assetId, bytes, basename(absolutePath), mediaTypeFor(absolutePath));
    state.files[absolutePath] = { ...known, status: result.status, uploadedAt: new Date().toISOString() };
    return { path: hint, action: "upload", detail: `${result.outcome} (${result.status})` };
  } catch (error) {
    if (unauthorised(error)) throw error;
    return { path: hint, action: "error", detail: describe(error) };
  }
}

async function heartbeat(state: CompanionState, client: CompanionClient, watching: boolean, paused = false): Promise<PendingTask[]> {
  try {
    const { pending } = await client.heartbeat({
      watching,
      paused,
      pendingFiles: pendingCount(state),
      version: VERSION,
      reportedAt: new Date().toISOString(),
    });
    state.lastHeartbeat = { at: new Date().toISOString(), ok: true };
    for (const task of pending) {
      const entry = Object.entries(state.files).find(([, e]) => e.sha256 === task.sha256);
      if (entry) state.files[entry[0]] = { ...entry[1], status: "upload_requested" };
    }
    return pending;
  } catch (error) {
    state.lastHeartbeat = { at: new Date().toISOString(), ok: false, detail: describe(error) };
    if (unauthorised(error)) throw error;
    return [];
  }
}

async function syncOnce(
  config: CompanionConfig,
  state: CompanionState,
  options: { dryRun: boolean; watching: boolean },
): Promise<SyncOutcome[]> {
  const client = new CompanionClient(config.server, config.token);
  const outcomes = await registerFiles(config, state, client, { dryRun: options.dryRun, patient: options.watching });
  if (!options.dryRun) {
    const pending = await heartbeat(state, client, options.watching);
    for (const task of pending) outcomes.push(await uploadTask(state, client, task));
    state.lastSyncAt = new Date().toISOString();
    state.lastSummary = summarise(outcomes);
    saveState(state);
  }
  return outcomes;
}

function report(outcomes: SyncOutcome[]): void {
  log(summarise(outcomes));
  for (const o of outcomes) {
    if (o.action === "skip_unchanged") continue;
    log(`  ${o.action}: ${o.path} — ${o.detail}`);
  }
}

const program = new Command()
  .name("corniversity-companion")
  .description(
    "Desktop companion for Corniversity: pairs this computer, watches the library inbox, registers files and uploads only what you have permitted.",
  )
  .version(VERSION);

program
  .command("pair")
  .description("Pair this computer with a one-time code from Library → Desktop sync")
  .requiredOption("--server <url>", "your Corniversity address, e.g. http://localhost:3000 or https://your-university.up.railway.app")
  .requiredOption("--code <code>", "the one-time pairing code (1234-5678)")
  .option("--name <name>", "a name for this computer", hostname())
  .option("--root <path...>", "library root folder(s); the inbox inside is watched", [defaultRoot()])
  .action(async (options: { server: string; code: string; name: string; root: string[] }) => {
    const roots = options.root.map((r) => resolve(r));
    for (const root of roots) {
      for (const department of DEPARTMENT_FOLDERS) mkdirSync(join(root, "inbox", department), { recursive: true });
      for (const folder of ["originals", "processed", "exports", "requests", "quarantine"])
        mkdirSync(join(root, folder), { recursive: true });
    }
    try {
      const client = new CompanionClient(options.server, null);
      const result = await client.pair(options.code.trim(), options.name, roots);
      saveConfig({
        server: options.server,
        token: result.token,
        deviceName: result.deviceName,
        pairingId: result.pairingId,
        roots,
        pairedAt: new Date().toISOString(),
      });
      log(`Paired as "${result.deviceName}" with ${options.server}.`);
      log(`Configuration: ${configPath()} (the device token lives here; revoke it any time from the Library).`);
      log(`Library root(s): ${roots.join(", ")} — put files in inbox/<department>/.`);
      log("Next: pnpm library:sync -- --dry-run   then   pnpm library:watch");
    } catch (error) {
      console.error(`Pairing failed: ${describe(error)}`);
      process.exit(1);
    }
  });

program
  .command("sync")
  .description("Scan the inbox once: register new files (metadata only) and send any uploads the owner has permitted")
  .option("--dry-run", "list what would be registered without contacting the university", false)
  .action(async (options: { dryRun: boolean }) => {
    const config = requireConfig();
    const state = loadState();
    try {
      const outcomes = await syncOnce(config, state, { dryRun: options.dryRun, watching: false });
      report(outcomes);
      if (options.dryRun) log("Dry run: nothing was sent. Uploads are decided by the university after you grant private storage per item.");
    } catch (error) {
      console.error(`Sync stopped: ${describe(error)}`);
      process.exit(1);
    }
  });

program
  .command("watch")
  .description("Keep watching the inbox; sends a heartbeat so the Library can show 'desktop sync online'. Ctrl+C stops it.")
  .option("--interval <seconds>", "heartbeat interval in seconds", "60")
  .action(async (options: { interval: string }) => {
    const config = requireConfig();
    const state = loadState();
    const client = new CompanionClient(config.server, config.token);
    const inboxes = config.roots.map(inboxFor);
    let running = false;
    let queued = false;

    const shutdown = async (code = 0) => {
      clearInterval(timer);
      await watcher.close().catch(() => undefined);
      await client
        .heartbeat({ watching: false, pendingFiles: pendingCount(state), version: VERSION, reportedAt: new Date().toISOString() })
        .catch(() => undefined);
      saveState(state);
      log("stopped; the Library will show desktop sync as offline");
      process.exit(code);
    };

    const runSync = async () => {
      if (running) {
        queued = true;
        return;
      }
      running = true;
      try {
        if (isPaused()) log("paused (pnpm library:resume to continue); files are not being registered");
        else report(await syncOnce(config, state, { dryRun: false, watching: true }));
      } catch (error) {
        if (unauthorised(error)) {
          log(describe(error));
          await shutdown(3);
        } else log(`sync failed: ${describe(error)} (will retry)`);
      } finally {
        running = false;
        if (queued) {
          queued = false;
          void runSync();
        }
      }
    };

    const tick = async () => {
      try {
        const pending = await heartbeat(state, client, !isPaused(), isPaused());
        if (pending.length > 0 && !isPaused()) await runSync();
      } catch (error) {
        if (unauthorised(error)) {
          log(describe(error));
          await shutdown(3);
        }
      }
    };

    const watcher = watch(inboxes, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
      depth: 8,
      followSymlinks: false,
    });
    let debounce: NodeJS.Timeout | undefined;
    const schedule = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void runSync(), 1500);
    };
    watcher
      .on("add", schedule)
      .on("change", schedule)
      .on("error", (error) => log(`watcher error: ${describe(error)}`));
    const timer = setInterval(() => void tick(), Math.max(15, Number(options.interval) || 60) * 1000);
    process.on("SIGINT", () => void shutdown());
    process.on("SIGTERM", () => void shutdown());

    log(`watching ${inboxes.join(", ")} for ${config.server} as "${config.deviceName}" (Ctrl+C to stop)`);
    await runSync();
  });

program
  .command("status")
  .description("Show pairing, roots, pause state, last sync and whether the device token is still valid")
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      console.log(`Not paired (no ${configPath()}).`);
      return;
    }
    const state = loadState();
    console.log(`Server:         ${config.server}`);
    console.log(`Device:         ${config.deviceName}`);
    console.log(`Roots:          ${config.roots.join(", ")}`);
    console.log(`Paused:         ${isPaused() ? "yes" : "no"}`);
    console.log(`Known files:    ${Object.keys(state.files).length} (${pendingCount(state)} waiting for permitted upload)`);
    console.log(`Last sync:      ${state.lastSyncAt ?? "never"}${state.lastSummary ? ` — ${state.lastSummary}` : ""}`);
    console.log(
      `Last heartbeat: ${state.lastHeartbeat ? `${state.lastHeartbeat.at} (${state.lastHeartbeat.ok ? "ok" : state.lastHeartbeat.detail})` : "never"}`,
    );
    try {
      const me = await new CompanionClient(config.server, config.token).whoami();
      console.log(`Token:          valid; the university knows this device as "${me.deviceName}" with ${me.pending} upload(s) waiting`);
    } catch (error) {
      console.log(`Token:          ${describe(error)}`);
    }
  });

program
  .command("pause")
  .description("Stop registering and uploading until 'resume' (the watcher keeps reporting that it is paused)")
  .action(() => {
    setPaused(true);
    log("paused");
  });

program
  .command("resume")
  .description("Resume after a pause")
  .action(() => {
    setPaused(false);
    log("resumed");
  });

program
  .command("unpair")
  .description("Forget the device token on this computer (also revoke the pairing in Library → Desktop sync)")
  .action(() => {
    removeConfig();
    log("local pairing removed; revoke the device in the Library to invalidate the token server-side");
  });

// pnpm forwards the literal `--`: `pnpm --filter … start -- pair …` delivers it before the command
// name and `pnpm library:pair -- --server …` delivers it just after. Commander would treat every
// option behind it as a positional argument, so drop a separator in either place. No companion
// command takes a positional argument, so nothing legitimate is lost.
const userArguments = process.argv.slice(2);
while (userArguments[0] === "--") userArguments.shift();
if (userArguments[1] === "--") userArguments.splice(1, 1);
await program.parseAsync([...process.argv.slice(0, 2), ...userArguments]);
