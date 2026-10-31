import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FsBlobStore } from "../blob";
import { createDb } from "../client";
import { stopBoss } from "../queue";
import { user } from "../schema/auth";
import { annotation, resourceAsset } from "../schema/library";
import { jobRecord } from "../schema/operations";
import {
  authenticateDevice,
  confirmMetadata,
  createAnnotation,
  createPairingCode,
  deleteAsset,
  getAsset,
  getPermissions,
  isAllowed,
  LibraryError,
  pendingUploadTasks,
  permittedPassagesForCourse,
  type RequestRow,
  receiveUpload,
  redeemPairingCode,
  registerLocalAsset,
  renderRequestsMarkdown,
  requestIngestion,
  revokePairing,
  saveReadingProgress,
  setPermission,
  validateUpload,
} from "./library";

/**
 * Integration tests for the library boundary: validation at quarantine, deduplication by hash,
 * separate processing permissions that default to unknown, local-only registration through a
 * paired device, and the acquisition-request export. They run against the throw-away embedded
 * PostgreSQL started by test/global-setup.ts.
 */
const OWNER = "library-test-owner";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1");

let handle: ReturnType<typeof createDb>;
let dataRoot: string;
let blobs: FsBlobStore;

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 3 });
  dataRoot = mkdtempSync(join(tmpdir(), "corniversity-library-"));
  blobs = new FsBlobStore(dataRoot);
  await handle.db.insert(user).values({ id: OWNER, name: "Library Test", email: "library-test@example.test" }).onConflictDoNothing();
});

afterAll(async () => {
  await stopBoss();
  await handle.close();
  rmSync(dataRoot, { recursive: true, force: true });
});

describe("validateUpload (the quarantine boundary)", () => {
  it("accepts a file with a real PDF signature", () => {
    expect(validateUpload(PDF, "application/pdf", "notes.pdf", 1_000_000).mediaType).toBe("application/pdf");
  });
  it("refuses a file named .pdf that lacks the signature", () => {
    expect(() => validateUpload(Buffer.from("MZ\u0090\u0000 not a pdf"), "application/pdf", "trojan.pdf", 1_000_000)).toThrowError(
      /signature/,
    );
  });
  it("refuses executables, notebooks and scripts as library assets", () => {
    for (const name of ["run.exe", "notebook.ipynb", "macro.docm", "script.js", "archive.zip"]) {
      expect(() => validateUpload(Buffer.from("x"), "application/octet-stream", name, 1_000_000)).toThrow(LibraryError);
    }
  });
  it("refuses oversize files, empty files and path-like names", () => {
    expect(() => validateUpload(PDF, "application/pdf", "big.pdf", 10)).toThrowError(/limit/);
    expect(() => validateUpload(Buffer.alloc(0), "text/plain", "empty.txt", 1000)).toThrowError(/empty/);
    expect(() => validateUpload(PDF, "application/pdf", "../escape.pdf", 1_000_000)).toThrowError(/filename/);
    expect(() => validateUpload(PDF, "application/pdf", "sub/dir.pdf", 1_000_000)).toThrowError(/filename/);
  });
});

describe("uploads, deduplication and processing permissions", () => {
  let assetId = "";

  it("stores the bytes once and reports a duplicate for the same content under another name", async () => {
    const first = await receiveUpload(handle.db, blobs, {
      ownerId: OWNER,
      filename: "norms.pdf",
      mediaType: "application/pdf",
      data: PDF,
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    const second = await receiveUpload(handle.db, blobs, {
      ownerId: OWNER,
      filename: "norms-copy.pdf",
      mediaType: "application/pdf",
      data: PDF,
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    expect(first.outcome).toBe("stored");
    expect(first.asset.status).toBe("quarantined");
    expect(second.outcome).toBe("duplicate");
    expect(second.asset.id).toBe(first.asset.id);
    expect(await blobs.exists(first.asset.storageKey!)).toBe(true);
    assetId = first.asset.id;
  });

  it("every processing permission starts unknown (reference only)", async () => {
    const permissions = await getPermissions(handle.db, OWNER, assetId);
    expect(Object.values(permissions).every((p) => p.status === "unknown")).toBe(true);
    expect(await isAllowed(handle.db, OWNER, assetId, "external_ai")).toBe(false);
  });

  it("refuses ingestion until the metadata is confirmed and extraction is allowed", async () => {
    const unconfirmed = await requestIngestion(handle.db, OWNER, assetId);
    expect(unconfirmed.queued).toBe(false);
    expect(unconfirmed.reason).toMatch(/confirm the metadata/i);

    const confirmed = await confirmMetadata(handle.db, OWNER, assetId, {
      title: "Notes on norms",
      authors: ["Leon"],
      courseIds: ["MAT-230"],
    });
    expect(confirmed.status).toBe("validated");

    const unpermitted = await requestIngestion(handle.db, OWNER, assetId);
    expect(unpermitted.queued).toBe(false);
    expect(unpermitted.reason).toMatch(/not permitted/);
  });

  it("a permitted request queues exactly one job for the file (idempotent)", async () => {
    await setPermission(handle.db, OWNER, assetId, "local_extract", "allowed", "my own notes");
    const first = await requestIngestion(handle.db, OWNER, assetId);
    expect(first.queued).toBe(true);
    const second = await requestIngestion(handle.db, OWNER, assetId);
    expect(second.queued).toBe(false);
    expect(second.reason).toMatch(/already being processed/i);
    const jobs = (await handle.db.select().from(jobRecord).where(eq(jobRecord.kind, "ingest-asset"))).filter(
      (j) => (j.payload as { assetId?: string }).assetId === assetId,
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.idempotencyKey).toContain("ingest:");
  });

  it("a denial takes effect at once and is recorded with its basis", async () => {
    await setPermission(handle.db, OWNER, assetId, "external_ai", "allowed", "CC licence");
    expect(await isAllowed(handle.db, OWNER, assetId, "external_ai")).toBe(true);
    await setPermission(handle.db, OWNER, assetId, "external_ai", "denied", "licence unclear after all");
    expect(await isAllowed(handle.db, OWNER, assetId, "external_ai")).toBe(false);
    const permissions = await getPermissions(handle.db, OWNER, assetId);
    expect(permissions.external_ai).toEqual({ status: "denied", basis: "licence unclear after all" });
  });

  it("nothing from an unprocessed item reaches tutoring evidence", async () => {
    expect(await permittedPassagesForCourse(handle.db, OWNER, "MAT-230", "norm")).toEqual([]);
  });

  it("deleting removes the bytes and leaves annotations visibly in need of repair", async () => {
    const note = await createAnnotation(handle.db, OWNER, {
      assetId,
      physicalIndex: 0,
      noteMarkdown: "check the triangle inequality here",
    });
    expect(note.mappingStatus).toBe("needs_repair"); // no extracted page exists yet
    const key = (await getAsset(handle.db, OWNER, assetId))!.storageKey!;
    await deleteAsset(handle.db, blobs, OWNER, assetId);
    expect(await blobs.exists(key)).toBe(false);
    expect(await getAsset(handle.db, OWNER, assetId)).toBeNull();
    const [row] = await handle.db.select().from(annotation).where(eq(annotation.id, note.id));
    expect(row?.assetId).toBeNull();
    expect(row?.mappingStatus).toBe("needs_repair");
  });
});

describe("desktop companion pairing and local-only registration", () => {
  let token = "";
  let pairingId = "";
  const localFile = {
    ownerId: OWNER,
    filename: "lee-riemannian.pdf",
    mediaType: "application/pdf",
    sizeBytes: 12_345,
    sha256: "a".repeat(64),
    candidateMetadata: { title: "Introduction to Riemannian Manifolds", pageCount: 437 },
    localPathHint: "inbox/mathematics/lee-riemannian.pdf",
  };

  it("redeems a pairing code once and authenticates the device by hashed token", async () => {
    const { code } = await createPairingCode(handle.db, OWNER);
    expect(code).toMatch(/^\d{4}-\d{4}$/);
    const redeemed = await redeemPairingCode(handle.db, code, "Leon's desktop", ["C:/Users/leon/Documents/Corniversity-Library"]);
    token = redeemed.token;
    pairingId = redeemed.pairing.id;
    expect(token.startsWith("cvt_")).toBe(true);
    expect(redeemed.pairing.tokenHash).not.toContain(token.slice(4, 24));
    expect((await authenticateDevice(handle.db, token))?.id).toBe(pairingId);
    await expect(redeemPairingCode(handle.db, code, "second device", [])).rejects.toThrowError(/not valid/);
  });

  it("rejects unknown codes and malformed tokens", async () => {
    await expect(redeemPairingCode(handle.db, "0000-0000", "x", [])).rejects.toThrow(LibraryError);
    expect(await authenticateDevice(handle.db, "cvt_not-a-real-token")).toBeNull();
    expect(await authenticateDevice(handle.db, "something-else")).toBeNull();
  });

  it("registers a local-only file with metadata only; granting private storage requests the upload", async () => {
    const registered = await registerLocalAsset(handle.db, { ...localFile, devicePairingId: pairingId });
    expect(registered.outcome).toBe("registered");
    expect(registered.asset.status).toBe("registered_local");
    expect(registered.asset.storageKey).toBeNull();
    expect(registered.asset.localOnly).toBe(true);

    const again = await registerLocalAsset(handle.db, { ...localFile, devicePairingId: pairingId });
    expect(again.outcome).toBe("known");
    expect(await pendingUploadTasks(handle.db, pairingId, OWNER)).toEqual([]);

    const refused = await requestIngestion(handle.db, OWNER, registered.asset.id);
    expect(refused.queued).toBe(false);
    expect(refused.reason).toMatch(/not been stored/);

    await setPermission(handle.db, OWNER, registered.asset.id, "private_cloud_store", "allowed", "my own copy, private storage only");
    expect((await getAsset(handle.db, OWNER, registered.asset.id))!.status).toBe("upload_requested");
    const tasks = await pendingUploadTasks(handle.db, pairingId, OWNER);
    expect(tasks.map((t) => t.assetId)).toContain(registered.asset.id);
    expect(tasks[0]!.localPathHint).toBe(localFile.localPathHint);
  });

  it("revoking the pairing ends the token's access", async () => {
    await revokePairing(handle.db, OWNER, pairingId);
    expect(await authenticateDevice(handle.db, token)).toBeNull();
  });
});

describe("acquisition request export", () => {
  it("renders the list with the minimum permission, folder and legitimate links", () => {
    const row: RequestRow = {
      id: "00000000-0000-4000-8000-000000000001",
      ownerId: OWNER,
      courseId: "MAT-261",
      unitIds: ["MAT-261-u03"],
      title: "Introduction to Riemannian Manifolds",
      authors: "John M. Lee",
      edition: "2nd edition (2018)",
      isbn: null,
      why: "Named as the primary text of the course.",
      essential: true,
      chaptersNeeded: ["Chapter 2: Riemannian metrics"],
      links: [{ label: "Publisher", url: "https://example.org/publisher" }],
      openAlternative: null,
      acceptedFormats: ["pdf"],
      destinationFolder: "inbox/mathematics",
      caveats: "Commercial textbook; reference-only by default.",
      minPermission: "local_read",
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const markdown = renderRequestsMarkdown([row], "Corniversity", [
      {
        key: "x",
        title: "Another book",
        authors: "A. Author",
        courseId: "PHY-210",
        why: "w",
        essential: false,
        chaptersNeeded: [],
        links: [],
        acceptedFormats: ["pdf"],
        destinationFolder: "inbox/physics",
        caveats: "Access status: commercial.",
        minPermission: "local_read",
      },
    ]);
    expect(markdown).toContain("# Corniversity: books and materials to obtain");
    expect(markdown).toContain("## Introduction to Riemannian Manifolds — John M. Lee (2nd edition (2018))");
    expect(markdown).toContain("- Minimum processing permission needed: local_read");
    expect(markdown).toContain("destination folder: inbox/mathematics");
    expect(markdown).toContain("Sections needed (verified): Chapter 2: Riemannian metrics");
    expect(markdown).toContain("## Suggested by the catalogue");
    expect(markdown).toContain("**Another book**");
  });
});

describe("ownership and repeated extraction", () => {
  it("refuses permission changes and reading progress for an asset the caller does not own", async () => {
    const [asset] = await handle.db.select().from(resourceAsset).where(eq(resourceAsset.ownerId, OWNER)).limit(1);
    expect(asset).toBeDefined();
    await expect(setPermission(handle.db, "someone-else", asset!.id, "external_ai", "allowed", "x")).rejects.toThrow(/not found/i);
    await expect(saveReadingProgress(handle.db, "someone-else", asset!.id, 3)).rejects.toThrow(/not found/i);
  });

  it("re-extracting a processed item creates a new job instead of reusing the finished one", async () => {
    const stored = await receiveUpload(handle.db, blobs, {
      ownerId: OWNER,
      filename: "re-extract.pdf",
      mediaType: "application/pdf",
      data: Buffer.concat([PDF, Buffer.from("% re-extract copy", "latin1")]),
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    const asset = stored.asset;
    await confirmMetadata(handle.db, OWNER, asset.id, { title: "Re-extract", authors: ["Leon"], courseIds: ["MAT-230"] });
    await setPermission(handle.db, OWNER, asset.id, "local_extract", "allowed", "my own notes");
    expect((await requestIngestion(handle.db, OWNER, asset.id)).queued).toBe(true);
    // The worker finished; the learner asks for a fresh extraction of the processed item.
    await handle.db.update(resourceAsset).set({ status: "processed" }).where(eq(resourceAsset.id, asset.id));
    const again = await requestIngestion(handle.db, OWNER, asset.id);
    expect(again.queued).toBe(true);
    const jobs = (await handle.db.select().from(jobRecord).where(eq(jobRecord.kind, "ingest-asset"))).filter(
      (j) => (j.payload as { assetId?: string }).assetId === asset.id,
    );
    expect(jobs).toHaveLength(2);
    expect(jobs.some((j) => j.idempotencyKey.endsWith("#r1"))).toBe(true);
    expect((await getAsset(handle.db, OWNER, asset.id))!.status).toBe("processing");
  });

  it("withdrawing private storage removes the stored copy and derived text at once", async () => {
    const stored = await receiveUpload(handle.db, blobs, {
      ownerId: OWNER,
      filename: "withdrawn.pdf",
      mediaType: "application/pdf",
      data: Buffer.concat([PDF, Buffer.from("% withdrawn copy\n", "latin1")]),
      origin: "web_upload",
      maxBytes: 1_000_000,
    });
    expect(stored.outcome).toBe("stored");
    const key = stored.asset.storageKey!;
    expect(await blobs.exists(key)).toBe(true);
    await expect(setPermission(handle.db, OWNER, stored.asset.id, "private_cloud_store", "denied", "changed my mind")).rejects.toThrow(
      /blob store/,
    );
    await setPermission(handle.db, OWNER, stored.asset.id, "private_cloud_store", "denied", "changed my mind", blobs);
    expect(await blobs.exists(key)).toBe(false);
    expect(await getAsset(handle.db, OWNER, stored.asset.id)).toBeNull();
  });
});
