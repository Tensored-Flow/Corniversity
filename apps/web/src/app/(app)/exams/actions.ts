"use server";
import { ExamRuleError } from "@corniversity/core/exams/exam";
import { ExamError, saveExamAnswer, startExam, submitAtDeadline, submitExam } from "@corniversity/db/services/exams";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { examGrader } from "@/lib/exam-grader";
import { errorCode, errorHref } from "@/lib/notices";
import { requireSession } from "@/lib/session";

const UUID = /^[0-9a-f-]{36}$/;

export async function startExamAction(form: FormData): Promise<void> {
  const session = await requireSession();
  const courseId = String(form.get("courseId") ?? "");
  if (!/^[A-Z]{3}-\d{3}$/.test(courseId)) redirect("/campus");
  let examId = "";
  try {
    const started = await startExam(db(), session.user.id, courseId, {
      questions: Number(form.get("questions")),
      minutes: Number(form.get("minutes")),
    });
    examId = started.id;
  } catch (error) {
    if (error instanceof ExamError || error instanceof ExamRuleError) redirect(errorHref(`/courses/${courseId}`, errorCode(error.message)));
    throw error;
  }
  revalidatePath("/campus");
  redirect(`/exams/${examId}`);
}

/** Saves one answer while the exam runs; the reply says whether it was kept. */
export async function saveExamAnswerAction(examId: string, exerciseId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  if (!UUID.test(examId)) return { ok: false, error: "Exam not found." };
  try {
    await saveExamAnswer(db(), session.user.id, examId, exerciseId, text);
    return { ok: true };
  } catch (error) {
    if (error instanceof ExamError) return { ok: false, error: error.message };
    throw error;
  }
}

/**
 * Submits the exam. `reason=deadline` comes from the paper's clock reaching zero; it submits only
 * if the server agrees time is up, and otherwise reopens the paper with the server's time.
 */
export async function submitExamAction(form: FormData): Promise<void> {
  const session = await requireSession();
  const examId = String(form.get("examId") ?? "");
  if (!UUID.test(examId)) redirect("/campus");
  const grader = await examGrader(session.user.id);
  try {
    if (form.get("reason") === "deadline") await submitAtDeadline(db(), session.user.id, examId, grader);
    else await submitExam(db(), session.user.id, examId, grader);
  } catch (error) {
    if (error instanceof ExamError) redirect("/campus");
    throw error;
  }
  revalidatePath("/campus");
  redirect(`/exams/${examId}`);
}
