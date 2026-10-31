import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative, sep } from "node:path";

/**
 * Pure helpers for the desktop companion: which files count, how paths are reported to the
 * server (relative, forward slashes, never absolute), when a file is stable enough to hash,
 * and how a sync batch is summarised. Kept free of network and configuration so they can be
 * unit-tested on any platform.
 */

export const ACCEPTED_EXTENSIONS = new Set([".pdf", ".md", ".txt"]);
export const DEPARTMENT_FOLDERS = [
  "mathematics",
  "physics",
  "chemistry",
  "computer-science-ai",
  "neuroscience",
  "cognitive-science",
] as const;
/** Folders under the data root that are never scanned: they hold derived or private material, not drop-folder input. */
export const RESERVED_FOLDERS = new Set(["originals", "processed", "exports", "requests", "quarantine", "postgres", "node_modules"]);
const TEMPORARY_PATTERNS = [/^~\$/, /\.(tmp|part|partial|crdownload|download)$/i, /^\./];

export function isCandidate(filePath: string): boolean {
  const name = basename(filePath);
  if (TEMPORARY_PATTERNS.some((p) => p.test(name))) return false;
  return ACCEPTED_EXTENSIONS.has(extname(name).toLowerCase());
}

export function mediaTypeFor(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".pdf":
      return "application/pdf";
    case ".md":
      return "text/markdown";
    default:
      return "text/plain";
  }
}

/** `inbox/mathematics/lee.pdf`: the path relative to the root with forward slashes. */
export function pathHint(root: string, filePath: string): string {
  return relative(root, filePath).split(sep).join("/");
}

/** The department folder a file sits in, when it is one of the known six; otherwise undefined. */
export function departmentHint(root: string, filePath: string): string | undefined {
  const parts = pathHint(root, filePath).split("/");
  const start = parts[0] === "inbox" ? 1 : 0;
  const folder = parts[start];
  if (parts.length <= start + 1 || !folder) return undefined;
  return (DEPARTMENT_FOLDERS as readonly string[]).includes(folder) ? folder : undefined;
}

export interface FileFacts {
  path: string;
  size: number;
  mtimeMs: number;
}

export interface KnownEntry {
  sha256: string;
  size: number;
  mtimeMs: number;
  assetId?: string;
  status: string;
  uploadedAt?: string;
  lastError?: string;
}

export type PlanAction = "register" | "rehash" | "skip_unchanged";

/** Deduplication starts locally: an unchanged file is never re-hashed, let alone re-sent. */
export function planFor(facts: FileFacts, known: KnownEntry | undefined): { action: PlanAction; reason: string } {
  if (!known) return { action: "register", reason: "new file" };
  if (known.size === facts.size && known.mtimeMs === facts.mtimeMs)
    return { action: "skip_unchanged", reason: "unchanged since the last sync" };
  return { action: "rehash", reason: "size or modification time changed" };
}

/** Exponential back-off without jitter (deterministic for tests): 1s, 2s, 4s, … capped. */
export function backoffDelay(attempt: number, baseMs = 1000, maxMs = 60_000): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
}

export async function fileFacts(filePath: string): Promise<FileFacts> {
  const s = await stat(filePath);
  return { path: filePath, size: s.size, mtimeMs: s.mtimeMs };
}

export function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * A file is stable when its size and modification time are unchanged across `rounds`
 * consecutive checks `intervalMs` apart. A download or copy that is still in progress keeps
 * changing and is left alone until it settles; null means it never did within `maxWaitMs`.
 */
export async function waitForStable(
  filePath: string,
  options: { intervalMs?: number; rounds?: number; maxWaitMs?: number } = {},
): Promise<FileFacts | null> {
  const intervalMs = options.intervalMs ?? 1500;
  const rounds = options.rounds ?? 2;
  const maxWaitMs = options.maxWaitMs ?? 120_000;
  const started = Date.now();
  let previous = await fileFacts(filePath).catch(() => null);
  if (!previous) return null;
  let steady = 0;
  while (Date.now() - started < maxWaitMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const current = await fileFacts(filePath).catch(() => null);
    if (!current) return null;
    if (current.size === previous.size && current.mtimeMs === previous.mtimeMs) {
      steady += 1;
      if (steady >= rounds) return current;
    } else {
      steady = 0;
    }
    previous = current;
  }
  return null;
}

/** Recursively lists regular files; symbolic links are never followed (no escapes out of the root). */
export async function* walk(dir: string, isRoot = true): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isRoot && RESERVED_FOLDERS.has(entry.name)) continue;
      yield* walk(full, false);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

export interface SyncOutcome {
  path: string;
  action: PlanAction | "upload" | "error" | "unstable" | "would_register" | "would_upload";
  detail: string;
}

export function summarise(outcomes: SyncOutcome[]): string {
  const count = (action: SyncOutcome["action"]) => outcomes.filter((o) => o.action === action).length;
  const parts = [
    `${count("register") + count("rehash")} registered`,
    `${count("upload")} uploaded`,
    `${count("skip_unchanged")} unchanged`,
    `${count("unstable")} still changing`,
    `${count("error")} error(s)`,
  ];
  const dry = count("would_register") + count("would_upload");
  if (dry) parts.unshift(`${dry} would change (dry run)`);
  return `${outcomes.length} file(s): ${parts.join(", ")}`;
}
