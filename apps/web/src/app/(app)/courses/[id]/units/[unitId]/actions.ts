"use server";
import { getUnitDetail } from "@corniversity/db/services/catalogue";
import { LearningError, runningExamFor, startOrResumeSession } from "@corniversity/db/services/learning";
import { activityFor } from "@corniversity/db/services/sheets";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { errorCode, errorHref } from "@/lib/notices";
import { requireSession } from "@/lib/session";

export async function startActivityAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const unitId = String(formData.get("unitId") ?? "");
  const activityId = String(formData.get("activityId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  const scheduledSessionId = String(formData.get("scheduledSessionId") ?? "") || undefined;
  try {
    const { session: learning } = await startOrResumeSession(db(), { ownerId: session.user.id, unitId, activityId, scheduledSessionId });
    redirect(`/sessions/${learning.id}`);
  } catch (error) {
    if (error instanceof LearningError) {
      redirect(errorHref(`/courses/${courseId}/units/${unitId}`, errorCode(error.message)));
    }
    throw error;
  }
}

/** Opens a unit's work: a problem in the session of the activity that holds it, or else the unit's tutorial. */
export async function startUnitWorkAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const unitId = String(formData.get("unitId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  const detail = await getUnitDetail(db(), unitId);
  if (!detail || detail.course.id !== courseId) redirect("/campus");
  const requested = String(formData.get("exerciseId") ?? "");
  const exerciseId = detail.exercises.some((e) => e.id === requested) ? requested : undefined;
  const held = exerciseId ? await runningExamFor(db(), session.user.id, exerciseId) : null;
  if (held) redirect(`/exams/${held.id}`);
  const activityId = activityFor(detail.unit.activities, exerciseId);
  if (!activityId) redirect(errorHref(`/courses/${courseId}/units/${unitId}`, "not-completed"));
  let target = "";
  try {
    const { session: learning } = await startOrResumeSession(db(), { ownerId: session.user.id, unitId, activityId });
    target = `/sessions/${learning.id}${exerciseId ? `?exercise=${encodeURIComponent(exerciseId)}` : ""}`;
  } catch (error) {
    if (error instanceof LearningError) redirect(errorHref(`/courses/${courseId}/units/${unitId}`, errorCode(error.message)));
    throw error;
  }
  redirect(target);
}
