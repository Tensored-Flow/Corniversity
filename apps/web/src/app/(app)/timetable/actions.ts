"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createCalendarToken,
  decideProposal,
  moveSession,
  proposeCatchUp,
  revokeCalendarTokens,
  setSessionLock,
  setSessionStatus,
} from "@corniversity/db/services/timetable";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export async function setSessionStatusAction(formData: FormData): Promise<void> {
  const session = await requireSession("/timetable");
  const id = String(formData.get("sessionId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["planned", "completed", "attempted", "cancelled"].includes(status)) return;
  await setSessionStatus(db(), session.user.id, id, status as never);
  revalidatePath("/timetable");
  revalidatePath("/campus");
}

export async function toggleLockAction(formData: FormData): Promise<void> {
  const session = await requireSession("/timetable");
  await setSessionLock(db(), session.user.id, String(formData.get("sessionId") ?? ""), formData.get("locked") === "1");
  revalidatePath("/timetable");
}

export async function moveSessionAction(formData: FormData): Promise<void> {
  const session = await requireSession("/timetable");
  const id = String(formData.get("sessionId") ?? "");
  const newStart = String(formData.get("newStart") ?? "");
  const result = await moveSession(db(), session.user.id, id, newStart);
  if (!result.ok) redirect(`/timetable?error=${encodeURIComponent(result.reason)}`);
  revalidatePath("/timetable");
  revalidatePath("/campus");
}

export async function catchUpAction(): Promise<void> {
  const session = await requireSession("/timetable");
  await proposeCatchUp(db(), session.user.id);
  revalidatePath("/timetable");
}

export async function decideProposalAction(formData: FormData): Promise<void> {
  const session = await requireSession("/timetable");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "confirmed" && decision !== "rejected") return;
  await decideProposal(db(), session.user.id, String(formData.get("proposalId") ?? ""), decision);
  revalidatePath("/timetable");
  revalidatePath("/campus");
}

export async function createCalendarLinkAction(formData: FormData): Promise<void> {
  const session = await requireSession("/timetable");
  const detail = formData.get("detail") === "full" ? "full" : "minimal";
  const token = await createCalendarToken(db(), session.user.id, detail);
  redirect(`/timetable?token=${encodeURIComponent(token)}`);
}

export async function revokeCalendarLinksAction(): Promise<void> {
  const session = await requireSession("/timetable");
  await revokeCalendarTokens(db(), session.user.id);
  revalidatePath("/timetable");
}
