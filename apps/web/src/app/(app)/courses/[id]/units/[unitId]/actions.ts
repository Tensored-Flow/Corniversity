"use server";
import { LearningError, startOrResumeSession } from "@corniversity/db/services/learning";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
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
      redirect(`/courses/${courseId}/units/${unitId}?error=${encodeURIComponent(error.code)}`);
    }
    throw error;
  }
}
