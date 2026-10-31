import { getEnv } from "@corniversity/db/env";
import { getAsset, isAllowed, LibraryError, receiveUpload, requestIngestion, sha256 } from "@corniversity/db/services/library";
import { NextResponse } from "next/server";
import { blobs } from "@/lib/blobs";
import { requireDevice } from "@/lib/companion-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Receives the bytes of one registered item. Accepted only when the owner has granted private
 * storage for that exact item, and only when the bytes hash to what was registered, so a file
 * swapped on the desktop after registration cannot slip in under an approved identity.
 */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireDevice(request);
  if ("response" in authed) return authed.response;
  const env = getEnv();
  const maxBytes = env.MAX_UPLOAD_MB * 1_048_576;
  const assetId = request.headers.get("x-asset-id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(assetId)) return NextResponse.json({ error: "asset id required" }, { status: 400 });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return NextResponse.json({ error: `file exceeds the ${env.MAX_UPLOAD_MB} MB limit` }, { status: 413 });

  const database = db();
  const asset = await getAsset(database, authed.pairing.userId, assetId);
  if (!asset) return NextResponse.json({ error: "unknown asset" }, { status: 404 });
  if (asset.storageKey) return NextResponse.json({ status: asset.status, outcome: "already_stored" });
  if (!(await isAllowed(database, authed.pairing.userId, asset.id, "private_cloud_store"))) {
    return NextResponse.json({ error: "private storage has not been granted for this item" }, { status: 403 });
  }
  const data = Buffer.from(await request.arrayBuffer());
  if (data.byteLength > maxBytes) return NextResponse.json({ error: `file exceeds the ${env.MAX_UPLOAD_MB} MB limit` }, { status: 413 });
  if (sha256(data) !== asset.sha256) return NextResponse.json({ error: "the bytes do not match the registered checksum" }, { status: 409 });

  try {
    const filename = decodeURIComponent(request.headers.get("x-filename") ?? asset.filename);
    const result = await receiveUpload(database, blobs(), {
      ownerId: authed.pairing.userId,
      filename: /[\\/]|\.\./.test(filename) ? asset.filename : filename,
      mediaType: asset.mediaType,
      data,
      origin: "companion",
      maxBytes,
      devicePairingId: authed.pairing.id,
    });
    let status = result.asset.status;
    // Metadata the owner confirmed before the bytes arrived still holds; extraction follows only if permitted.
    if (result.asset.confirmedTitle && (await isAllowed(database, authed.pairing.userId, asset.id, "local_extract"))) {
      const queued = await requestIngestion(database, authed.pairing.userId, asset.id);
      if (queued.queued) status = "processing";
    }
    return NextResponse.json({ status, outcome: result.outcome });
  } catch (error) {
    if (error instanceof LibraryError) return NextResponse.json({ error: error.message }, { status: 422 });
    throw error;
  }
}
