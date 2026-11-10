"use server";
import { createEntry, deleteEntry, NotebookError, setResolved, updateEntry } from "@corniversity/db/services/notebook";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { errorCode, errorHref } from "@/lib/notices";
import { requireSession } from "@/lib/session";

const UUID = /^[0-9a-f-]{36}$/;
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const tags = (form: FormData) =>
  text(form, "tags")
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

function fail(path: string, message: string): never {
  redirect(errorHref(path, errorCode(message)));
}

export async function createEntryAction(form: FormData): Promise<void> {
  const session = await requireSession("/notebook");
  const courseId = text(form, "courseId");
  if (!text(form, "body").trim()) fail("/notebook", "Write the entry itself; a title on its own is not kept.");
  try {
    const entry = await createEntry(db(), session.user.id, {
      title: text(form, "title"),
      bodyMarkdown: text(form, "body"),
      kind: text(form, "kind") || "note",
      tags: tags(form),
      courseId: /^[A-Z]{3}-\d{3}$/.test(courseId) ? courseId : null,
    });
    revalidatePath("/notebook");
    redirect(`/notebook/${entry.id}`);
  } catch (error) {
    if (error instanceof NotebookError) fail("/notebook", error.message);
    throw error;
  }
}

export async function updateEntryAction(form: FormData): Promise<void> {
  const session = await requireSession("/notebook");
  const id = text(form, "id");
  if (!UUID.test(id)) redirect("/notebook");
  const courseId = text(form, "courseId");
  try {
    await updateEntry(db(), session.user.id, id, {
      title: text(form, "title"),
      bodyMarkdown: text(form, "body"),
      kind: text(form, "kind") || "note",
      tags: tags(form),
      courseId: courseId ? (/^[A-Z]{3}-\d{3}$/.test(courseId) ? courseId : null) : null,
    });
  } catch (error) {
    if (error instanceof NotebookError) fail(`/notebook/${id}`, error.message);
    throw error;
  }
  revalidatePath("/notebook");
  revalidatePath(`/notebook/${id}`);
  redirect(`/notebook/${id}?saved=1`);
}

export async function toggleResolvedAction(form: FormData): Promise<void> {
  const session = await requireSession("/notebook");
  const id = text(form, "id");
  if (!UUID.test(id)) redirect("/notebook");
  await setResolved(db(), session.user.id, id, form.get("resolved") === "1");
  revalidatePath("/notebook");
  revalidatePath(`/notebook/${id}`);
}

export async function deleteEntryAction(form: FormData): Promise<void> {
  const session = await requireSession("/notebook");
  const id = text(form, "id");
  if (!UUID.test(id)) redirect("/notebook");
  if (form.get("confirm") !== "1") fail(`/notebook/${id}`, "Tick the confirmation box to delete this entry.");
  try {
    await deleteEntry(db(), session.user.id, id);
  } catch (error) {
    if (error instanceof NotebookError) fail(`/notebook/${id}`, error.message);
    throw error;
  }
  revalidatePath("/notebook");
  redirect("/notebook?deleted=1");
}
