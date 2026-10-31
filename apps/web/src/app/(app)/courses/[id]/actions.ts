"use server";
import { getCourseDetail } from "@corniversity/db/services/catalogue";
import { EnrolmentError, enrol, setEnrolmentStatus } from "@corniversity/db/services/enrolment";
import { previewCourseLoad, recordLoadPreviewSeen } from "@corniversity/db/services/study";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export interface EnrolState {
  error?: string;
  ok?: boolean;
  /** Shown when the course would go beyond the chosen load; enrolling then needs the preview acknowledged. */
  preview?: { currentHours: number; addedHours: number; totalHours: number; ceiling: number | null; reason: string };
}

const EnrolInput = z.object({
  courseId: z.string().regex(/^[A-Z]{3}-\d{3}$/),
  mode: z.enum(["enrolled", "audit", "reading_seminar"]),
});

export async function enrolAction(_prev: EnrolState, formData: FormData): Promise<EnrolState> {
  const session = await requireSession();
  const parsed = EnrolInput.safeParse({ courseId: formData.get("courseId"), mode: formData.get("mode") });
  if (!parsed.success) return { error: "Choose a course mode." };
  const detail = await getCourseDetail(db(), parsed.data.courseId);
  if (!detail) return { error: "Course not found." };
  const preview = await previewCourseLoad(db(), session.user.id, detail.version.workload.typical, parsed.data.mode);
  if (!preview.allowed) {
    if (formData.get("loadPreviewSeen") !== "on") {
      return {
        preview: {
          currentHours: preview.current.weeklyHours,
          addedHours: preview.addedWeeklyHours,
          totalHours: preview.totalWeeklyHours,
          ceiling: preview.weeklyHoursCeiling,
          reason: preview.reason ?? "This goes beyond the course load you chose.",
        },
      };
    }
    await recordLoadPreviewSeen(db(), session.user.id);
  }
  try {
    await enrol(db(), { ownerId: session.user.id, courseId: parsed.data.courseId, mode: parsed.data.mode });
  } catch (error) {
    if (error instanceof EnrolmentError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/courses/${parsed.data.courseId}`);
  revalidatePath("/studies");
  return { ok: true };
}

export async function withdrawAction(_prev: EnrolState, formData: FormData): Promise<EnrolState> {
  const session = await requireSession();
  const enrolmentId = String(formData.get("enrolmentId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  if (!enrolmentId) return { error: "Nothing to withdraw from." };
  await setEnrolmentStatus(db(), session.user.id, enrolmentId, "withdrawn");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/studies");
  return { ok: true };
}
