import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { KnownEntry } from "./scan";

/**
 * Companion configuration lives in the user's profile, never in the library folder (which may
 * be synced or shared) and never in the repository. The token is the only secret; it is written
 * with owner-only permissions where the platform honours them.
 */
export const CompanionConfig = z.object({
  server: z.string().url(),
  token: z.string().min(10),
  deviceName: z.string().min(1),
  pairingId: z.string().min(1),
  roots: z.array(z.string().min(1)).min(1),
  pairedAt: z.string(),
});
export type CompanionConfig = z.infer<typeof CompanionConfig>;

export interface CompanionState {
  files: Record<string, KnownEntry>;
  lastSyncAt?: string;
  lastSummary?: string;
  lastHeartbeat?: { at: string; ok: boolean; detail?: string };
}

export const VERSION = "0.1.0";

export function configDir(): string {
  if (process.env.CORNIVERSITY_COMPANION_HOME) return process.env.CORNIVERSITY_COMPANION_HOME;
  if (process.env.APPDATA) return join(process.env.APPDATA, "Corniversity");
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "corniversity");
}
export const configPath = () => join(configDir(), "companion.json");
export const statePath = () => join(configDir(), "companion-state.json");
export const pausePath = () => join(configDir(), "companion.paused");

/** Plain http would send the device token in clear; it is allowed only for a server on this computer. */
export function assertSafeServerUrl(server: string): URL {
  const url = new URL(server);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new Error(`refusing to pair with ${server}: use an https:// address (plain http is allowed only for localhost)`);
  }
  return url;
}

export function defaultRoot(): string {
  return process.env.CORNIVERSITY_DATA_ROOT ?? join(homedir(), "Documents", "Corniversity-Library");
}

export function loadConfig(): CompanionConfig | null {
  const path = configPath();
  if (!existsSync(path)) return null;
  const parsed = CompanionConfig.safeParse(JSON.parse(readFileSync(path, "utf8")));
  return parsed.success ? parsed.data : null;
}

export function saveConfig(config: CompanionConfig): void {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(config, null, 2), { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(configPath(), 0o600);
  } catch {
    // Windows ignores POSIX modes; the profile directory is already private to the user.
  }
}

export function removeConfig(): void {
  rmSync(configPath(), { force: true });
  rmSync(statePath(), { force: true });
  rmSync(pausePath(), { force: true });
}

export function loadState(): CompanionState {
  const path = statePath();
  if (!existsSync(path)) return { files: {} };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<CompanionState>;
    return { files: raw.files ?? {}, lastSyncAt: raw.lastSyncAt, lastSummary: raw.lastSummary, lastHeartbeat: raw.lastHeartbeat };
  } catch {
    return { files: {} };
  }
}

export function saveState(state: CompanionState): void {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(statePath(), JSON.stringify(state, null, 2), "utf8");
}

export function isPaused(): boolean {
  return existsSync(pausePath());
}

export function setPaused(paused: boolean): void {
  mkdirSync(configDir(), { recursive: true });
  if (paused) writeFileSync(pausePath(), new Date().toISOString(), "utf8");
  else rmSync(pausePath(), { force: true });
}
