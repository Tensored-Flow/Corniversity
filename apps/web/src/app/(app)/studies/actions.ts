"use server";
import { type ReviewOutcome, reviewItem } from "@corniversity/db/services/revision";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export async function reviewRevisionAction(form: FormData): Promise<void> {
  const session = await requireSession("/studies");
  const id = String(form.get("id") ?? "");
  const outcome = String(form.get("outcome") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id) || !["recalled", "shaky", "forgot"].includes(outcome)) return;
  await reviewItem(db(), session.user.id, id, outcome as ReviewOutcome);
  revalidatePath("/studies");
}
