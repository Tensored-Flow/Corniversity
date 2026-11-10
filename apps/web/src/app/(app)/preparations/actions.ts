"use server";
import { getEnv } from "@corniversity/db/env";
import {
  cancelPreparation,
  confirmPreparation,
  createPreparationRequest,
  PreparationError,
  publishDraft,
  rejectDraft,
  resumePreparation,
} from "@corniversity/db/services/preparation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Creates a proposal (a draft request); nothing runs until it is confirmed. */
export async function createPreparationAction(form: FormData): Promise<void> {
  const session = await requireSession();
  const courseId = text(form, "courseId");
  let id: string;
  try {
    const request = await createPreparationRequest(db(), getEnv(), session.user.id, {
      courseId,
      intake: {
        goal: text(form, "goal"),
        depth: text(form, "depth"),
        weeklyHours: Number(text(form, "weeklyHours")),
        preferredSources: text(form, "preferredSources"),
        balance: text(form, "balance"),
        assessment: text(form, "assessment"),
        materials: text(form, "materials"),
        bufferUnits: Number(text(form, "bufferUnits")),
      },
      budgetUsd: Number(text(form, "budgetUsd")),
      autoPrepare: false,
    });
    id = request.id;
  } catch (error) {
    const message =
      error instanceof PreparationError
        ? error.message
        : error instanceof ZodError
          ? "Fill in every field: the goal needs a sentence."
          : null;
    if (message) redirect(`/courses/${encodeURIComponent(courseId)}/prepare?error=${encodeURIComponent(message)}`);
    throw error;
  }
  redirect(`/preparations/${id}`);
}

async function act(form: FormData, run: (ownerId: string, id: string) => Promise<void>): Promise<void> {
  const session = await requireSession();
  const id = text(form, "id");
  try {
    await run(session.user.id, id);
  } catch (error) {
    if (error instanceof PreparationError) redirect(`/preparations/${id}?error=${encodeURIComponent(error.message)}`);
    throw error;
  }
  revalidatePath(`/preparations/${id}`);
}

export async function confirmPreparationAction(form: FormData): Promise<void> {
  await act(form, (owner, id) => confirmPreparation(db(), owner, id));
}

export async function cancelPreparationAction(form: FormData): Promise<void> {
  await act(form, (owner, id) => cancelPreparation(db(), owner, id));
}

export async function resumePreparationAction(form: FormData): Promise<void> {
  await act(form, (owner, id) => resumePreparation(db(), owner, id));
}

export async function publishDraftAction(form: FormData): Promise<void> {
  await act(form, (owner) => publishDraft(db(), owner, text(form, "draftId")));
  revalidatePath("/catalogue");
}

export async function rejectDraftAction(form: FormData): Promise<void> {
  await act(form, (owner) => rejectDraft(db(), owner, text(form, "draftId"), text(form, "note")));
}
