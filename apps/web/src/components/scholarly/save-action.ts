"use server";
import { importByIdentifier, requestIntegrityCheckIfDue, ScholarlyError } from "@corniversity/db/services/scholarly-works";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { errorCode } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import { scholarly } from "./client";
import { paperHref, previewHref } from "./format";

const text = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();

/** A return path inside the Library (Find or a paper page), or null. */
function safeBack(raw: string): string | null {
  if (!raw.startsWith("/library/") || raw.startsWith("//") || raw.includes("\\") || raw.length > 2000) return null;
  return raw;
}

/** `path` with `key=value` in its query (replacing an earlier one, and any error), before its #fragment. */
function withParam(path: string, key: string, value: string): string {
  const [base, hash = ""] = path.split("#");
  const cleaned = base!.replace(new RegExp(`([?&])(${key}|error)=[^&]*&?`, "g"), "$1").replace(/[?&]$/, "");
  return `${cleaned}${cleaned.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}${hash ? `#${hash}` : ""}`;
}

/**
 * *Save to library* for a paper named by an identifier (a preview's DOI, arXiv id or W, or a list
 * row's W): imports it (OpenAlex's record through the provider cache; an arXiv id also queues its
 * arXiv record for the worker), saves it, queues the Crossref integrity check when the paper has a
 * publisher DOI, and opens the paper page; from a list it returns to that list instead. The
 * browser sends only the identifier, never a record.
 */
export async function saveWorkAction(form: FormData): Promise<void> {
  const session = await requireSession("/library/find");
  const scheme = text(form, "scheme");
  const value = text(form, "value").slice(0, 400);
  const back = safeBack(text(form, "back"));
  const origin = back ?? (scheme === "doi" || scheme === "arxiv" || scheme === "openalex" ? previewHref(scheme, value) : "/library/find");
  if (scheme !== "doi" && scheme !== "arxiv" && scheme !== "openalex")
    redirect(withParam(origin, "error", errorCode("That identifier is not valid.")));
  let workId: string;
  try {
    workId = (await importByIdentifier(db(), session.user.id, scholarly(), { scheme, value })).workId;
  } catch (error) {
    if (error instanceof ScholarlyError) redirect(withParam(origin, "error", errorCode(error.message)));
    throw error;
  }
  try {
    await requestIntegrityCheckIfDue(db(), session.user.id, workId);
  } catch (error) {
    // The paper is saved either way; a check that could not be queued does not undo that.
    console.warn("[library] integrity check not queued:", error instanceof Error ? error.message : String(error));
  }
  revalidatePath("/library");
  redirect(back ? withParam(back, "saved", workId) : paperHref(workId));
}
