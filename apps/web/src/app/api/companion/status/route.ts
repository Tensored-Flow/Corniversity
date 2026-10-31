import { NextResponse } from "next/server";
import { z } from "zod";
import { pendingUploadTasks, reportDeviceStatus } from "@corniversity/db/services/library";
import { requireDevice } from "@/lib/companion-auth";
import { db } from "@/lib/db";

const Heartbeat = z.object({
  watching: z.boolean(),
  paused: z.boolean().optional(),
  pendingFiles: z.number().int().min(0),
  version: z.string().max(40),
  reportedAt: z.string().max(40),
});

export const dynamic = "force-dynamic";

/** Heartbeat from the watcher: records the device's state and returns the uploads the owner has permitted. */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireDevice(request);
  if ("response" in authed) return authed.response;
  const parsed = Heartbeat.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  await reportDeviceStatus(db(), authed.pairing.id, parsed.data);
  const pending = await pendingUploadTasks(db(), authed.pairing.id, authed.pairing.userId);
  return NextResponse.json({ pending, serverTime: new Date().toISOString() });
}

/** Token check for `companion status`; it does not change the watching state. */
export async function GET(request: Request): Promise<Response> {
  const authed = await requireDevice(request);
  if ("response" in authed) return authed.response;
  const pending = await pendingUploadTasks(db(), authed.pairing.id, authed.pairing.userId);
  return NextResponse.json({ deviceName: authed.pairing.name, roots: authed.pairing.roots, pending: pending.length, serverTime: new Date().toISOString() });
}
