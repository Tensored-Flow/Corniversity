import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FsBlobStore } from "../blob";
import { createDb } from "../client";
import { user } from "../schema/auth";
import { notebookEntry } from "../schema/learning";
import { readingProgress } from "../schema/library";
import { scholarlyVersion, scholarlyWork } from "../schema/scholarly";
import type { ScholarlySubject } from "../scholarly/types";
import { createAnnotation, listReadingNotes, receiveUpload } from "./library";
import { createEntry, deleteEntry, getEntry, libraryNoteSubjects, NotebookError, notesPaper, paperNotes, updateEntry } from "./notebook";

/**
 * Library notes: paper notes are notebook entries linked to one of the owner's papers; the
 * notebook's library view lists them with the reading notes, by paper, by the paper's OpenAlex
 * field and by words. Another owner's papers and notes are never found.
 */
const OTHER = "notebook-test-other";
let handle: ReturnType<typeof createDb>;
let dataRoot: string;
let blobs: FsBlobStore;
let owner = "";

const field = (id: string, name: string): ScholarlySubject => ({ id, name, level: "field", score: 0.9 });

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  dataRoot = mkdtempSync(join(tmpdir(), "corniversity-notebook-"));
  blobs = new FsBlobStore(dataRoot);
  owner = `notebook-owner-${randomUUID().slice(0, 8)}`;
  await handle.db
    .insert(user)
    .values([
      { id: owner, name: "Notebook", email: `${owner}@example.test` },
      { id: OTHER, name: "Notebook Other", email: "notebook-other@example.test" },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await handle.db.delete(readingProgress).where(eq(readingProgress.ownerId, owner));
  await handle.close();
  rmSync(dataRoot, { recursive: true, force: true });
});

async function paper(ownerId: string, title: string, subjects: ScholarlySubject[] = []) {
  const [row] = await handle.db.insert(scholarlyWork).values({ ownerId, title, subjects, savedAt: new Date() }).returning();
  return row!;
}

/** A stored file of the paper, so annotations on it count as the paper's notes. */
async function paperFile(workId: string, label: string) {
  const { asset } = await receiveUpload(handle.db, blobs, {
    ownerId: owner,
    filename: `${label}.pdf`,
    mediaType: "application/pdf",
    data: Buffer.from(`%PDF-1.4\n% ${label} ${randomUUID()}\n%%EOF\n`, "latin1"),
    origin: "web_upload",
    maxBytes: 1_000_000,
  });
  const [version] = await handle.db
    .insert(scholarlyVersion)
    .values({ ownerId: owner, workId, label: "Your copy", source: "owner" })
    .returning();
  await handle.db.execute(sql`update resource_asset set scholarly_version_id = ${version!.id} where id = ${asset.id}`);
  return asset;
}

describe("paper notes", () => {
  it("links a note to the owner's paper (a merged paper's survivor), and never to another owner's", async () => {
    const survivor = await paper(owner, "Survivor");
    const merged = await paper(owner, "Merged away");
    await handle.db.update(scholarlyWork).set({ mergedIntoId: survivor.id }).where(eq(scholarlyWork.id, merged.id));
    const theirs = await paper(OTHER, "Theirs");

    const note = await createEntry(handle.db, owner, {
      title: "Why it works",
      bodyMarkdown: "The map $x \\mapsto x^2$ is convex.",
      kind: "note",
      scholarlyWorkId: survivor.id,
    });
    expect(note.scholarlyWorkId).toBe(survivor.id);
    expect(
      (await createEntry(handle.db, owner, { title: "Via tombstone", bodyMarkdown: "x", kind: "note", scholarlyWorkId: merged.id }))
        .scholarlyWorkId,
    ).toBe(survivor.id);
    for (const id of [theirs.id, randomUUID(), "not-a-uuid"]) {
      await expect(createEntry(handle.db, owner, { title: "x", bodyMarkdown: "x", kind: "note", scholarlyWorkId: id })).rejects.toThrow(
        new NotebookError("not_found", "Paper not found."),
      );
    }
    // A free note (no paper) still works; editing keeps a paper note's link.
    expect(
      (await createEntry(handle.db, owner, { title: "Free", bodyMarkdown: "A free thought.", kind: "question" })).scholarlyWorkId,
    ).toBeNull();
    expect((await updateEntry(handle.db, owner, note.id, { bodyMarkdown: "Edited $y$." }))!.scholarlyWorkId).toBe(survivor.id);

    expect(await notesPaper(handle.db, owner, merged.id)).toEqual({ id: survivor.id, title: "Survivor" });
    expect(await notesPaper(handle.db, owner, theirs.id)).toBeNull();
    expect(await notesPaper(handle.db, OTHER, survivor.id)).toBeNull();
    await deleteEntry(handle.db, owner, note.id);
    expect(await getEntry(handle.db, owner, note.id)).toBeNull();
    await handle.db.delete(notebookEntry).where(eq(notebookEntry.ownerId, owner));
  });

  it("lists paper notes and reading notes by paper, OpenAlex field and words; another owner sees none", async () => {
    const physics = await paper(owner, "Large N limits", [field("31", "Physics and Astronomy")]);
    const cs = await paper(owner, "Attention", [field("17", "Computer Science")]);
    const quiet = await paper(owner, "No notes here", [field("26", "Mathematics")]);
    const file = await paperFile(cs.id, "attention");
    await createEntry(handle.db, owner, {
      title: "Coupling",
      bodyMarkdown: "The coupling $g^2 N$ stays fixed.",
      kind: "note",
      scholarlyWorkId: physics.id,
    });
    await new Promise((r) => setTimeout(r, 10));
    await createEntry(handle.db, owner, { title: "Heads", bodyMarkdown: "Several attention heads.", kind: "note", scholarlyWorkId: cs.id });
    await createEntry(handle.db, owner, { title: "Unlinked", bodyMarkdown: "Several attention heads, no paper.", kind: "note" });
    await createAnnotation(handle.db, owner, { assetId: file.id, physicalIndex: 0, kind: "bookmark" });
    await createAnnotation(handle.db, owner, { assetId: file.id, physicalIndex: 1, noteMarkdown: "Softmax over the keys." });

    expect((await paperNotes(handle.db, owner)).map((n) => [n.entry.title, n.workTitle])).toEqual([
      ["Heads", "Attention"],
      ["Coupling", "Large N limits"],
    ]);
    expect((await paperNotes(handle.db, owner, { workId: physics.id })).map((n) => n.entry.title)).toEqual(["Coupling"]);
    expect((await paperNotes(handle.db, owner, { subject: "17" })).map((n) => n.entry.title)).toEqual(["Heads"]);
    expect((await paperNotes(handle.db, owner, { query: "attention heads" })).map((n) => n.entry.title)).toEqual(["Heads"]);
    expect(await paperNotes(handle.db, owner, { workId: quiet.id })).toEqual([]);
    expect(await paperNotes(handle.db, owner, { subject: "fields/17" })).toEqual([]);
    expect(await paperNotes(handle.db, owner, { workId: "x" })).toEqual([]);

    // Reading notes by the paper's field: the Attention file's notes, not the physics paper's.
    expect((await listReadingNotes(handle.db, owner, { subject: "17" })).map((n) => n.kind).sort()).toEqual(["bookmark", "note"]);
    expect(await listReadingNotes(handle.db, owner, { subject: "31" })).toEqual([]);
    expect(await listReadingNotes(handle.db, owner, { subject: "17; drop table" })).toEqual([]);
    expect((await listReadingNotes(handle.db, owner, { subject: "17", query: "softmax" })).map((n) => n.note)).toEqual([
      "Softmax over the keys.",
    ]);
    expect((await listReadingNotes(handle.db, owner, { workId: cs.id, kind: "bookmark" })).map((n) => n.page)).toEqual([1]);

    // The subject filter offers the fields of papers with notes only.
    expect(await libraryNoteSubjects(handle.db, owner)).toEqual([
      { id: "17", name: "Computer Science" },
      { id: "31", name: "Physics and Astronomy" },
    ]);

    expect(await paperNotes(handle.db, OTHER)).toEqual([]);
    expect(await paperNotes(handle.db, OTHER, { workId: physics.id })).toEqual([]);
    expect(await listReadingNotes(handle.db, OTHER, { subject: "17" })).toEqual([]);
    expect(await libraryNoteSubjects(handle.db, OTHER)).toEqual([]);
    await handle.db.delete(notebookEntry).where(eq(notebookEntry.ownerId, owner));
  });
});

describe("entry bodies", () => {
  it("refuses a body over 50,000 characters whole instead of cutting it, counting a form's line breaks once", async () => {
    const tooLong = "x".repeat(50_001);
    await expect(createEntry(handle.db, owner, { title: "Too long", bodyMarkdown: tooLong, kind: "note" })).rejects.toThrow(
      new NotebookError("invalid", "The entry is longer than 50,000 characters; shorten it, or split it into two entries."),
    );
    // A form sends CRLF: 25,000 lines of "a" and a break are 50,000 characters in the box, as they are kept.
    const kept = await createEntry(handle.db, owner, { title: "At the limit", bodyMarkdown: "a\r\n".repeat(25_000), kind: "note" });
    expect(kept.bodyMarkdown).toBe("a\n".repeat(25_000));
    await expect(updateEntry(handle.db, owner, kept.id, { bodyMarkdown: `${kept.bodyMarkdown}!` })).rejects.toThrow(NotebookError);
    expect((await getEntry(handle.db, owner, kept.id))?.bodyMarkdown).toBe(kept.bodyMarkdown);
    await handle.db.delete(notebookEntry).where(eq(notebookEntry.ownerId, owner));
  });
});
