import "server-only";
import { getEnv } from "@corniversity/db/env";
import { locator } from "@corniversity/db/schema/index";
import { confirmMetadata, listSourceRegistry, receiveUpload, requestIngestion, setPermission } from "@corniversity/db/services/library";
import { eq } from "drizzle-orm";
import { blobs } from "./blobs";
import { db } from "./db";

export interface ImportableFile {
  url: string;
  fileLabel: string;
}

/** Distinct PDF files a source version points at, in the order they first appear in its locators. */
export function importableFiles(locators: { payload: { kind: string; url?: string; fileLabel?: string } }[]): ImportableFile[] {
  const seen = new Map<string, ImportableFile>();
  for (const l of locators) {
    if (l.payload.kind !== "pdf" || !l.payload.url) continue;
    if (!seen.has(l.payload.url))
      seen.set(l.payload.url, { url: l.payload.url, fileLabel: l.payload.fileLabel ?? l.payload.url.split("/").pop() ?? "file" });
  }
  return [...seen.values()];
}

/**
 * Imports one open-licensed PDF named by a verified locator. The URL must be https, on a host
 * the source registry allow-lists for that version, and exactly one the registry points at;
 * redirects are not followed. The licence recorded in the registry becomes the basis of the
 * item's permissions, and sharing stays off because the material is still third-party.
 */
export async function importOpenResource(
  ownerId: string,
  sourceId: string,
  url: string,
): Promise<{ ok: true; assetId: string; outcome: string } | { ok: false; reason: string }> {
  const database = db();
  const entry = (await listSourceRegistry(database)).find((e) => e.source.id === sourceId);
  if (!entry) return { ok: false, reason: "Unknown source." };
  if (!entry.version.importAllowed)
    return { ok: false, reason: "The source registry does not permit importing this source; it stays reference-only." };
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return { ok: false, reason: "Malformed URL." };
  }
  if (target.protocol !== "https:") return { ok: false, reason: "Only https URLs are imported." };
  if (!entry.version.importHosts.includes(target.hostname))
    return { ok: false, reason: `${target.hostname} is not an allow-listed host for this source.` };
  const locators = await database.select().from(locator).where(eq(locator.sourceVersionId, entry.version.id));
  const match = locators.find((l) => l.payload.kind === "pdf" && l.payload.url === target.toString());
  if (!match) return { ok: false, reason: "That URL is not a verified locator of this source." };

  const env = getEnv();
  const maxBytes = env.MAX_UPLOAD_MB * 1_048_576;
  let response: Response;
  try {
    response = await fetch(target, {
      redirect: "manual",
      headers: { "user-agent": "corniversity-library/0.1 (private study; open-licence import)" },
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    return { ok: false, reason: `Download failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (response.status >= 300 && response.status < 400)
    return { ok: false, reason: `The host answered with a redirect (${response.status}); redirects are not followed.` };
  if (!response.ok) return { ok: false, reason: `Download failed (${response.status}).` };
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { ok: false, reason: `The file is larger than the ${env.MAX_UPLOAD_MB} MB limit.` };
  const data = Buffer.from(await response.arrayBuffer());
  if (data.byteLength > maxBytes) return { ok: false, reason: `The file is larger than the ${env.MAX_UPLOAD_MB} MB limit.` };

  const filename = decodeURIComponent(target.pathname.split("/").pop() || "download.pdf").replace(/[\\/]|\.\./g, "_");
  const result = await receiveUpload(database, blobs(), {
    ownerId,
    filename,
    mediaType: "application/pdf",
    data,
    origin: "open_import",
    maxBytes,
  });
  if (result.outcome === "stored") {
    const fileLabel = match.payload.kind === "pdf" ? match.payload.fileLabel : undefined;
    const title = fileLabel ? `${entry.source.title}: ${fileLabel}` : entry.source.title;
    await confirmMetadata(database, ownerId, result.asset.id, {
      title,
      authors: entry.source.authors,
      edition: entry.version.label,
      courseIds: entry.courses.map((c) => c.id),
      sourceVersionId: entry.version.id,
    });
    const basis = `${entry.version.licence}; import permitted by the source registry (verified ${entry.version.verifiedAt})`;
    for (const action of ["local_read", "local_extract", "private_cloud_store", "external_ai"] as const) {
      await setPermission(database, ownerId, result.asset.id, action, "allowed", basis);
    }
    await setPermission(
      database,
      ownerId,
      result.asset.id,
      "share",
      "denied",
      "Third-party material; sharing and export stay off by default.",
    );
    await requestIngestion(database, ownerId, result.asset.id);
  }
  return { ok: true, assetId: result.asset.id, outcome: result.outcome };
}
