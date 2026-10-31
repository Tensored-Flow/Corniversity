"use server";
import { type ExportKind, requestExport } from "@corniversity/db/services/records";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

const KINDS: ExportKind[] = ["full", "notebook", "records", "alter_markdown"];

export async function requestExportAction(form: FormData): Promise<void> {
  const session = await requireSession("/records");
  const kind = String(form.get("kind") ?? "");
  if (!KINDS.includes(kind as ExportKind)) redirect("/records");
  await requestExport(db(), session.user.id, kind as ExportKind);
  revalidatePath("/records");
  redirect("/records?requested=1");
}
