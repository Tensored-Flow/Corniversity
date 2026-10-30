"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EnrolmentError, enrol, setEnrolmentStatus } from "@corniversity/db/services/enrolment";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export interface EnrolState {
  error?: string;
  ok?: boolean;
}

const EnrolInput = z.object({
  courseId: z.string().regex(/^[A-Z]{3}-\d{3}$/),
  mode: z.enum(["enrolled", "audit", "reading_seminar"]),
});

export async function enrolAction(_prev: EnrolState, formData: FormData): Promise<EnrolState> {
  const session = await requireSession();
  const parsed = EnrolInput.safeParse({ courseId: formData.get("courseId"), mode: formData.get("mode") });
  if (!parsed.success) return { error: "Choose a course mode." };
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
