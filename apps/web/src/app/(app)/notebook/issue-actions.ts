"use server";
import { createLearnerIssue, deleteIssue, IssueError, respondToIssue } from "@corniversity/db/services/learning-issues";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { errorCode, errorHref } from "@/lib/notices";
import { requireSession } from "@/lib/session";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(): void {
  revalidatePath("/notebook");
  revalidatePath("/studies");
}

/** The learner's response to an issue: confirm (with corrected wording), revisit, dispute, resolve or reopen. */
export async function respondIssueAction(form: FormData): Promise<void> {
  const session = await requireSession("/notebook");
  const id = text(form, "id");
  const kind = text(form, "kind");
  try {
    switch (kind) {
      case "confirm":
        await respondToIssue(db(), session.user.id, id, { kind: "confirm", statement: text(form, "statement") || undefined });
        break;
      case "revisit":
        await respondToIssue(db(), session.user.id, id, { kind: "revisit" });
        break;
      case "dispute":
        await respondToIssue(db(), session.user.id, id, { kind: "dispute", note: text(form, "note") });
        break;
      case "resolve":
        await respondToIssue(db(), session.user.id, id, { kind: "resolve", note: text(form, "note") });
        break;
      case "reopen":
        await respondToIssue(db(), session.user.id, id, { kind: "reopen" });
        break;
      default:
        return;
    }
  } catch (error) {
    if (error instanceof IssueError) redirect(errorHref("/notebook", errorCode(error.message), "#issues-heading"));
    throw error;
  }
  refresh();
}

export async function deleteIssueAction(form: FormData): Promise<void> {
  const session = await requireSession("/notebook");
  try {
    await deleteIssue(db(), session.user.id, text(form, "id"));
  } catch (error) {
    if (!(error instanceof IssueError)) throw error;
  }
  refresh();
}

export async function createIssueAction(form: FormData): Promise<void> {
  const session = await requireSession("/notebook");
  try {
    await createLearnerIssue(db(), session.user.id, { statement: text(form, "statement"), exerciseId: text(form, "exerciseId") || null });
  } catch (error) {
    if (error instanceof IssueError) redirect(errorHref("/notebook", errorCode(error.message), "#issues-heading"));
    throw error;
  }
  refresh();
}
