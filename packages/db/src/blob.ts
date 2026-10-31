import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { eq } from "drizzle-orm";
import type { DbOrTx } from "./client";
import { assetBlob } from "./schema/library";

/**
 * Private binary storage for original files. Two drivers behind one interface:
 *  - `fs`: files under <data root>/originals, used in local mode (the server is the device).
 *  - `pg`: bytea rows in PostgreSQL, used in production so web and worker share one durable,
 *    backed-up store without a volume bound to a single service.
 * Keys are opaque and generated here; callers never supply paths.
 */
export interface BlobStore {
  readonly driver: "fs" | "pg";
  put(data: Buffer, options?: { key?: string }): Promise<{ key: string; sha256: string; sizeBytes: number }>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

const KEY_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

function newKey(): string {
  return randomUUID();
}

function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key)) throw new Error("invalid blob key");
}

export function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export class FsBlobStore implements BlobStore {
  readonly driver = "fs" as const;
  private readonly root: string;
  constructor(dataRoot: string) {
    this.root = resolve(dataRoot, "originals");
  }
  private pathFor(key: string): string {
    assertKey(key);
    const path = resolve(this.root, key.slice(0, 2), key);
    if (!path.startsWith(this.root + sep)) throw new Error("blob path escaped the store");
    return path;
  }
  async put(data: Buffer, options: { key?: string } = {}) {
    const key = options.key ?? newKey();
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error; // immutable originals: never overwrite
    });
    return { key, sha256: sha256Hex(data), sizeBytes: data.byteLength };
  }
  async get(key: string) {
    try {
      return await readFile(this.pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  async delete(key: string) {
    await rm(this.pathFor(key), { force: true });
  }
  async exists(key: string) {
    try {
      await stat(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }
}

export class PgBlobStore implements BlobStore {
  readonly driver = "pg" as const;
  constructor(private readonly db: DbOrTx) {}
  async put(data: Buffer, options: { key?: string } = {}) {
    const key = options.key ?? newKey();
    assertKey(key);
    await this.db.insert(assetBlob).values({ storageKey: key, data, sizeBytes: data.byteLength }).onConflictDoNothing();
    return { key, sha256: sha256Hex(data), sizeBytes: data.byteLength };
  }
  async get(key: string) {
    assertKey(key);
    const rows = await this.db.select({ data: assetBlob.data }).from(assetBlob).where(eq(assetBlob.storageKey, key)).limit(1);
    return rows[0]?.data ?? null;
  }
  async delete(key: string) {
    assertKey(key);
    await this.db.delete(assetBlob).where(eq(assetBlob.storageKey, key));
  }
  async exists(key: string) {
    assertKey(key);
    const rows = await this.db.select({ k: assetBlob.storageKey }).from(assetBlob).where(eq(assetBlob.storageKey, key)).limit(1);
    return rows.length > 0;
  }
}

export function createBlobStore(driver: "fs" | "pg", db: DbOrTx, dataRoot: string): BlobStore {
  return driver === "pg" ? new PgBlobStore(db) : new FsBlobStore(dataRoot);
}
