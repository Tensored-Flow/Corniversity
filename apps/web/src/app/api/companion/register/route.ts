import { registerLocalAsset } from "@corniversity/db/services/library";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDevice } from "@/lib/companion-auth";
import { db } from "@/lib/db";

const Body = z.object({
  filename: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((s) => !/[\\/]|\.\./.test(s), "filename must be a bare name"),
  mediaType: z.enum(["application/pdf", "text/markdown", "text/plain"]),
  sizeBytes: z.number().int().min(0),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  candidateMetadata: z
    .object({
      title: z.string().max(300).optional(),
      author: z.string().max(300).optional(),
      pageCount: z.number().int().min(0).optional(),
      producer: z.string().max(300).optional(),
    })
    .default({}),
  localPathHint: z.string().max(500),
  departmentHint: z.string().max(40).optional(),
});

export const dynamic = "force-dynamic";

/**
 * Registers a file the companion has seen. Only bibliographic facts arrive here; the bytes stay
 * on the device until the owner grants private storage for the item, at which point the next
 * heartbeat lists it as pending and the companion uploads it.
 */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireDevice(request);
  if ("response" in authed) return authed.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  const { asset, outcome } = await registerLocalAsset(db(), {
    ownerId: authed.pairing.userId,
    devicePairingId: authed.pairing.id,
    filename: parsed.data.filename,
    mediaType: parsed.data.mediaType,
    sizeBytes: parsed.data.sizeBytes,
    sha256: parsed.data.sha256,
    candidateMetadata: parsed.data.candidateMetadata,
    localPathHint: parsed.data.localPathHint,
  });
  const storage = asset.storageKey ? "stored" : asset.status === "upload_requested" ? "requested" : "none";
  return NextResponse.json({ assetId: asset.id, status: asset.status, outcome, storage });
}
