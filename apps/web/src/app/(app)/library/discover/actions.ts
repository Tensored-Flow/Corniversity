"use server";
import { getEnv } from "@corniversity/db/env";
import { DiscoverError, discoverClient, setDiscoverSubjects } from "@corniversity/db/services/discover";
import { importByIdentifier, ScholarlyError, saveWork } from "@corniversity/db/services/scholarly-works";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { type ErrorCode, errorCode, errorHref } from "@/lib/notices";
import { requireSession } from "@/lib/session";

/** Where a list's Save returns: Discover (keeping the surprise shown) or a subject room. Anything else is Discover. */
function returnPath(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  return /^\/library\/(discover(\?surprise=\d{1,4})?|subjects\/[a-z-]{1,60})$/.test(path) ? path : "/library/discover";
}

/** The id of the list the Save came from (a card's id), or null. */
function anchorOf(value: FormDataEntryValue | null): string | null {
  const anchor = typeof value === "string" ? value : "";
  return /^[a-z0-9-]{1,80}$/.test(anchor) ? anchor : null;
}

const withParam = (path: string, param: string) => `${path}${path.includes("?") ? "&" : "?"}${param}`;

/**
 * Save from a Discover list or a subject room: the server imports the paper by the identifier the row
 * carries (looked up again through the provider client and its cache; nothing from the browser is
 * written as a provider's report) and saves it. Either way it returns to the list (its fragment); a
 * failure also names the list (`at`), so the page shows the notice there, in view.
 */
export async function saveListedWorkAction(form: FormData): Promise<void> {
  const session = await requireSession("/library/discover");
  const back = returnPath(form.get("returnTo"));
  const anchor = anchorOf(form.get("anchor"));
  const hash = anchor ? `#${anchor}` : "";
  const failed = (code: ErrorCode) => errorHref(anchor ? withParam(back, `at=${anchor}`) : back, code, hash);
  const scheme = String(form.get("scheme") ?? "");
  const value = String(form.get("value") ?? "").trim();
  if ((scheme !== "openalex" && scheme !== "arxiv" && scheme !== "doi") || value === "" || value.length > 300)
    redirect(failed("identifier-not-valid"));
  const env = getEnv();
  const database = db();
  try {
    const imported = await importByIdentifier(database, session.user.id, discoverClient(env, database), { scheme, value }, { save: true });
    await saveWork(database, session.user.id, imported.workId);
  } catch (error) {
    if (error instanceof ScholarlyError) redirect(failed(errorCode(error.message)));
    throw error;
  }
  redirect(`${withParam(back, "saved=paper")}${hash}`);
}

/** The owner's subjects, from the checkbox form (none ticked is a choice too). */
export async function setSubjectsAction(form: FormData): Promise<void> {
  const session = await requireSession("/library/discover");
  const slugs = form.getAll("subject").map(String);
  try {
    await setDiscoverSubjects(db(), session.user.id, slugs);
  } catch (error) {
    if (error instanceof DiscoverError) redirect(errorHref("/library/discover", errorCode(error.message)));
    throw error;
  }
  redirect("/library/discover?saved=subjects");
}
