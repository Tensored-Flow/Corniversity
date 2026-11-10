"use server";
import { createDeadline, StudyError, withdrawDeadline } from "@corniversity/db/services/study";
import {
  createCalendarToken,
  decideProposal,
  moveSession,
  proposeCatchUp,
  proposeRollingExtension,
  revokeCalendarTokens,
  setSessionLock,
  setSessionStatus,
} from "@corniversity/db/services/timetable";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { errorCode, errorHref } from "@/lib/notices";
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
  if (!result.ok) redirect(errorHref("/timetable", errorCode(result.reason)));
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
  const outcome = await decideProposal(db(), session.user.id, String(formData.get("proposalId") ?? ""), decision);
  revalidatePath("/timetable");
  revalidatePath("/campus");
  revalidatePath("/director");
  revalidatePath("/studies");
  const back = String(formData.get("returnTo") ?? "") === "/director" ? "/director" : "/timetable";
  if (outcome === "superseded") {
    redirect(errorHref(back, "route-was-proposed-earlier-focus"));
  }
  redirect(back);
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

export async function extendRollingAction(): Promise<void> {
  const session = await requireSession("/timetable");
  await proposeRollingExtension(db(), session.user.id);
  revalidatePath("/timetable");
  redirect("/timetable#proposals");
}

/** A deadline the learner sets; assessment and examination kinds only when switched on in Settings. */
export async function createDeadlineAction(formData: FormData): Promise<void> {
  const session = await requireSession("/timetable");
  const kind = String(formData.get("kind") ?? "");
  const title = String(formData.get("title") ?? "");
  const due = String(formData.get("dueAt") ?? "");
  const target = String(formData.get("target") ?? "");
  if (kind !== "assessment" && kind !== "examination" && kind !== "milestone") redirect(errorHref("/timetable", "unknown-deadline-kind"));
  const [targetKind, enrolmentId, exerciseId] = target.split(":");
  try {
    await createDeadline(db(), session.user.id, {
      kind,
      title,
      dueAt: new Date(due),
      enrolmentId: targetKind === "enrolment" || targetKind === "exercise" ? enrolmentId : undefined,
      exerciseId: targetKind === "exercise" ? exerciseId : undefined,
    });
  } catch (error) {
    if (error instanceof StudyError) redirect(errorHref("/timetable", errorCode(error.message), "#deadlines-heading"));
    throw error;
  }
  revalidatePath("/timetable");
  redirect("/timetable#deadlines-heading");
}

export async function withdrawDeadlineAction(formData: FormData): Promise<void> {
  const session = await requireSession("/timetable");
  await withdrawDeadline(db(), session.user.id, String(formData.get("deadlineId") ?? ""));
  revalidatePath("/timetable");
  redirect("/timetable#deadlines-heading");
}
