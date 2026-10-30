"use server";
import { redirect } from "next/navigation";
import { LearningError, startOrResumeSession } from "@corniversity/db/services/learning";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export async function startActivityAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const unitId = String(formData.get("unitId") ?? "");
  const activityId = String(formData.get("activityId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  try {
    const { session: learning } = await startOrResumeSession(db(), { ownerId: session.user.id, unitId, activityId });
    redirect(`/sessions/${learning.id}`);
  } catch (error) {
    if (error instanceof LearningError) {
      redirect(`/courses/${courseId}/units/${unitId}?error=${encodeURIComponent(error.code)}`);
    }
    throw error;
  }
}
