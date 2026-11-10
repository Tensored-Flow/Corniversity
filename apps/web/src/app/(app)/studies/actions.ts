"use server";
import {
  ReviewError,
  type ReviewOutcome,
  reviewItem,
  saveReviewSettings,
  setItemStatus,
  snoozeItem,
} from "@corniversity/db/services/revision";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { errorCode, errorHref } from "@/lib/notices";
import { requireSession } from "@/lib/session";

const UUID = /^[0-9a-f-]{36}$/;

export async function reviewRevisionAction(form: FormData): Promise<void> {
  const session = await requireSession("/studies");
  const id = String(form.get("id") ?? "");
  const outcome = String(form.get("outcome") ?? "");
  if (!UUID.test(id) || !["recalled", "shaky", "forgot"].includes(outcome)) return;
  await reviewItem(db(), session.user.id, id, outcome as ReviewOutcome);
  revalidatePath("/studies");
}

export async function snoozeReviewAction(form: FormData): Promise<void> {
  const session = await requireSession("/studies");
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return;
  await snoozeItem(db(), session.user.id, id, 3);
  revalidatePath("/studies");
}

export async function archiveReviewAction(form: FormData): Promise<void> {
  const session = await requireSession("/studies");
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return;
  await setItemStatus(db(), session.user.id, id, "archived");
  revalidatePath("/studies");
}

/** Saves only what the learner chose: the weekly number, pause, and the days kept free. */
export async function saveReviewSettingsAction(form: FormData): Promise<void> {
  const session = await requireSession("/studies");
  try {
    await saveReviewSettings(db(), session.user.id, {
      budgetPerWeek: Number(form.get("budgetPerWeek")),
      paused: form.get("paused") === "1",
      restWeekdays: form.getAll("restWeekdays").map(Number),
    });
  } catch (error) {
    if (error instanceof ReviewError) redirect(errorHref("/studies", errorCode(error.message), "#revision"));
    throw error;
  }
  revalidatePath("/studies");
}
