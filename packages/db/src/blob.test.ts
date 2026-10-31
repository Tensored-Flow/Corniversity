import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { FsBlobStore } from "./blob";

/**
 * The file-system blob store must be impossible to steer outside its root: keys are generated
 * UUIDs, anything else is refused before a path is built, and originals are never overwritten.
 */
const root = mkdtempSync(join(tmpdir(), "corniversity-blob-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("FsBlobStore", () => {
  const store = new FsBlobStore(root);
  it("stores and reads back bytes under a generated key, reporting hash and size", async () => {
    const data = Buffer.from("%PDF-1.4 test");
    const stored = await store.put(data);
    expect(stored.key).toMatch(/^[a-f0-9-]{36}$/);
    expect(stored.sizeBytes).toBe(data.byteLength);
    expect(stored.sha256).toHaveLength(64);
    expect((await store.get(stored.key))?.equals(data)).toBe(true);
    expect(await store.exists(stored.key)).toBe(true);
  });
  it("refuses keys that are not generated UUIDs, so no caller can name a path", async () => {
    for (const bad of ["../../etc/passwd", "..\\..\\windows\\system32", "a/b", "", "0123456789abcdef", "C:\\secrets"]) {
      await expect(store.get(bad)).rejects.toThrow(/invalid blob key/);
      await expect(store.delete(bad)).rejects.toThrow(/invalid blob key/);
      await expect(store.put(Buffer.from("x"), { key: bad })).rejects.toThrow(/invalid blob key/);
    }
  });
  it("never overwrites an existing original", async () => {
    const first = await store.put(Buffer.from("first"));
    await store.put(Buffer.from("second"), { key: first.key });
    expect((await store.get(first.key))?.toString()).toBe("first");
  });
  it("returns null for a missing key and tolerates deleting it twice", async () => {
    const key = "00000000-0000-4000-8000-000000000000";
    expect(await store.get(key)).toBeNull();
    await store.delete(key);
    await store.delete(key);
    expect(await store.exists(key)).toBe(false);
  });
});
