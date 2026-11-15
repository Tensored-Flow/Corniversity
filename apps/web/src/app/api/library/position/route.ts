import { LibraryError, saveReadingPosition } from "@corniversity/db/services/library";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ERROR_NOTICES, errorCode } from "@/lib/notices";
import { requireApiSession } from "@/lib/session";
import { refuseUnlessReaderRequest } from "../annotations/guard";
import { TabSequences } from "./sequence";

export const dynamic = "force-dynamic";

const Body = z.strictObject({
  assetId: z.string().uuid(),
  // Validated, clamped and ordered on the server clock by the service (core PositionSaveSchema).
  position: z.unknown(),
  changedAgoMs: z.number(),
  tab: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  seq: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
});

const sequences = new TabSequences();

/**
 * Saves the Page view's reading position (contract §3): the reader sends where it is and how long
 * ago it last moved; the service orders saves on the database server's clock. A save that arrives
 * after a later one from the same reader tab is dropped. The reader sends it with `fetch` and
 * `keepalive` when the page is hidden, so the answer is short.
 */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const refused = refuseUnlessReaderRequest(request);
  if (refused) return refused;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const ownerId = authed.session.user.id;
  const { assetId, position, changedAgoMs, tab, seq } = parsed.data;
  if (!sequences.accept(`${ownerId}:${assetId}:${tab}`, seq)) return NextResponse.json({ accepted: false, reason: "out_of_order" });
  try {
    const saved = await saveReadingPosition(db(), ownerId, assetId, { position, changedAgoMs });
    return NextResponse.json({ accepted: saved.accepted });
  } catch (error) {
    if (!(error instanceof LibraryError)) throw error;
    const status = error.code === "not_found" ? 404 : 400;
    return NextResponse.json({ error: error.code, message: ERROR_NOTICES[errorCode(error.message)] }, { status });
  }
}
