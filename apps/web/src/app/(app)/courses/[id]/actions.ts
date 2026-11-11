"use server";
import { getCourseDetail } from "@corniversity/db/services/catalogue";
import { EnrolmentError, enrol, setEnrolmentStatus } from "@corniversity/db/services/enrolment";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { errorCode, errorHref } from "@/lib/notices";
import { requireSession } from "@/lib/session";

const COURSE_ID = /^[A-Z]{3}-\d{3}$/;

/** Takes a course in full where it is offered so (otherwise in the mode it offers); there is no cap on how many. */
export async function takeCourseAction(form: FormData): Promise<void> {
  const session = await requireSession();
  const courseId = String(form.get("courseId") ?? "");
  if (!COURSE_ID.test(courseId)) redirect("/catalogue");
  const detail = await getCourseDetail(db(), courseId);
  if (!detail) redirect("/catalogue");
  const offered = detail.version.modesOffered as ("enrolled" | "audit" | "reading_seminar")[];
  const mode = offered.includes("enrolled") ? "enrolled" : (offered[0] ?? "enrolled");
  try {
    await enrol(db(), { ownerId: session.user.id, courseId, mode });
  } catch (error) {
    if (error instanceof EnrolmentError) redirect(errorHref(`/courses/${courseId}`, errorCode(error.message)));
    throw error;
  }
  revalidatePath("/campus");
  revalidatePath("/catalogue");
  redirect(form.get("from") === "catalogue" ? "/catalogue" : `/courses/${courseId}`);
}

export async function leaveCourseAction(form: FormData): Promise<void> {
  const session = await requireSession();
  const courseId = String(form.get("courseId") ?? "");
  const enrolmentId = String(form.get("enrolmentId") ?? "");
  if (!COURSE_ID.test(courseId) || !/^[0-9a-f-]{36}$/.test(enrolmentId)) redirect("/campus");
  await setEnrolmentStatus(db(), session.user.id, enrolmentId, "withdrawn");
  revalidatePath("/campus");
  redirect(`/courses/${courseId}`);
}
