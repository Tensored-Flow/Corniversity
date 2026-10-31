import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { backoffDelay, departmentHint, hashFile, isCandidate, mediaTypeFor, pathHint, planFor, summarise, waitForStable } from "./scan";

const root = mkdtempSync(join(tmpdir(), "corniversity-companion-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("file selection", () => {
  it("accepts PDF, Markdown and text; refuses temporary, hidden and other files", () => {
    expect(isCandidate("C:/lib/inbox/lee.pdf")).toBe(true);
    expect(isCandidate("notes.MD")).toBe(true);
    expect(isCandidate("notes.txt")).toBe(true);
    expect(isCandidate("~$lee.pdf")).toBe(false);
    expect(isCandidate("lee.pdf.crdownload")).toBe(false);
    expect(isCandidate("lee.pdf.part")).toBe(false);
    expect(isCandidate(".hidden.pdf")).toBe(false);
    expect(isCandidate("script.js")).toBe(false);
    expect(isCandidate("notebook.ipynb")).toBe(false);
  });
  it("maps extensions to the media types the server accepts", () => {
    expect(mediaTypeFor("a.PDF")).toBe("application/pdf");
    expect(mediaTypeFor("a.md")).toBe("text/markdown");
    expect(mediaTypeFor("a.txt")).toBe("text/plain");
  });
});

describe("path reporting", () => {
  it("reports paths relative to the root with forward slashes", () => {
    expect(pathHint(root, join(root, "inbox", "mathematics", "lee.pdf"))).toBe("inbox/mathematics/lee.pdf");
  });
  it("derives the department from the inbox subfolder only when it is one of the six", () => {
    expect(departmentHint(root, join(root, "inbox", "mathematics", "lee.pdf"))).toBe("mathematics");
    expect(departmentHint(root, join(root, "physics", "tong.pdf"))).toBe("physics");
    expect(departmentHint(root, join(root, "inbox", "misc", "x.pdf"))).toBeUndefined();
    expect(departmentHint(root, join(root, "inbox", "x.pdf"))).toBeUndefined();
    expect(departmentHint(root, join(root, "mathematics"))).toBeUndefined();
  });
});

describe("local deduplication plan", () => {
  const facts = { path: "a.pdf", size: 10, mtimeMs: 1000 };
  it("registers new files, skips unchanged ones and re-hashes changed ones", () => {
    expect(planFor(facts, undefined).action).toBe("register");
    expect(planFor(facts, { sha256: "x", size: 10, mtimeMs: 1000, status: "registered_local" }).action).toBe("skip_unchanged");
    expect(planFor(facts, { sha256: "x", size: 11, mtimeMs: 1000, status: "registered_local" }).action).toBe("rehash");
    expect(planFor(facts, { sha256: "x", size: 10, mtimeMs: 2000, status: "registered_local" }).action).toBe("rehash");
  });
});

describe("retries", () => {
  it("backs off exponentially and caps", () => {
    expect([1, 2, 3, 4].map((n) => backoffDelay(n))).toEqual([1000, 2000, 4000, 8000]);
    expect(backoffDelay(20)).toBe(60_000);
  });
});

describe("stability and hashing", () => {
  it("waits until a growing file stops changing, then reports its final size", async () => {
    const file = join(root, "growing.pdf");
    writeFileSync(file, "%PDF-1.4\n");
    const pending = waitForStable(file, { intervalMs: 60, rounds: 2, maxWaitMs: 5000 });
    await new Promise((r) => setTimeout(r, 30));
    await appendFile(file, "more bytes\n");
    const facts = await pending;
    expect(facts?.size).toBe(Buffer.byteLength("%PDF-1.4\nmore bytes\n"));
  });
  it("hashes file contents with SHA-256", async () => {
    const file = join(root, "hash.txt");
    writeFileSync(file, "abc");
    expect(await hashFile(file)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("returns null for a file that disappears", async () => {
    expect(await waitForStable(join(root, "missing.pdf"), { intervalMs: 10, rounds: 1, maxWaitMs: 100 })).toBeNull();
  });
});

describe("batch summary", () => {
  it("counts each outcome", () => {
    const text = summarise([
      { path: "a", action: "register", detail: "" },
      { path: "b", action: "skip_unchanged", detail: "" },
      { path: "c", action: "upload", detail: "" },
      { path: "d", action: "error", detail: "" },
    ]);
    expect(text).toBe("4 file(s): 1 registered, 1 uploaded, 1 unchanged, 0 still changing, 1 error(s)");
  });
});
