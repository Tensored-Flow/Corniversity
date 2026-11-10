"use server";
import { answerBridgeCheck, BridgeError, getVisit, returnFromBridge } from "@corniversity/db/services/bridges";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

/** Keeps the self-check answer as a note, then shows the guidance. Not assessed; no evidence. */
export async function answerBridgeCheckAction(formData: FormData): Promise<void> {
  const auth = await requireSession();
  const visitId = String(formData.get("visitId") ?? "");
  const visit = await getVisit(db(), auth.user.id, visitId);
  if (!visit) redirect("/campus");
  try {
    await answerBridgeCheck(db(), auth.user.id, visitId, String(formData.get("answer") ?? ""));
  } catch (error) {
    if (!(error instanceof BridgeError)) throw error;
  }
  revalidatePath(`/bridges/${visit.conceptId}`);
  redirect(`/bridges/${visit.conceptId}?visit=${visit.id}`);
}

/** Back to exactly where the bridge was opened from. */
export async function returnFromBridgeAction(formData: FormData): Promise<void> {
  const auth = await requireSession();
  const path = await returnFromBridge(db(), auth.user.id, String(formData.get("visitId") ?? ""));
  redirect(path ?? "/campus");
}
