"use server";
import { TIMEZONE_SUGGESTIONS } from "@corniversity/core/onboarding/steps";
import { getEnv } from "@corniversity/db/env";
import { deletePersonaMemory, purgePersonaMemory } from "@corniversity/db/services/community";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { getBudgetLimits, saveBudgetLimits, saveProviderSetting } from "@corniversity/db/services/provider-config";
import { updateProfileSettings } from "@corniversity/db/services/settings";
import { StudyError, updateStudyPreferences } from "@corniversity/db/services/study";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const YEAR = 60 * 60 * 24 * 365;

function done(section: string): never {
  revalidatePath("/settings");
  redirect(`/settings?saved=${section}#${section}`);
}

export async function updateProfileAction(form: FormData): Promise<void> {
  const session = await requireSession("/settings");
  const timezone = text(form, "timezone");
  const hours = Number(text(form, "weeklyHoursCeiling"));
  const rhythm = text(form, "studyRhythm");
  await updateProfileSettings(db(), session.user.id, {
    displayName: text(form, "displayName"),
    timezone:
      (TIMEZONE_SUGGESTIONS as readonly string[]).includes(timezone) || /^[A-Za-z_]+\/[A-Za-z_]+$/.test(timezone) ? timezone : undefined,
    goalsText: text(form, "goalsText") || null,
    weeklyHoursCeiling: Number.isFinite(hours) && hours > 0 ? Math.min(60, Math.round(hours)) : null,
    studyRhythm: ["term", "rolling", "reading_course"].includes(rhythm) ? (rhythm as "term" | "rolling" | "reading_course") : undefined,
  });
  done("profile");
}

export async function updateExperienceAction(form: FormData): Promise<void> {
  const session = await requireSession("/settings");
  const immersion = text(form, "immersion");
  const theme = text(form, "theme");
  const fontScale = Number(text(form, "fontScale") || "1");
  const jar = await cookies();
  jar.set("corniversity-theme", theme === "dark" ? "dark" : "light", { path: "/", maxAge: YEAR, sameSite: "lax" });
  jar.set("corniversity-font-scale", String(Number.isFinite(fontScale) ? Math.min(1.5, Math.max(0.875, fontScale)) : 1), {
    path: "/",
    maxAge: YEAR,
    sameSite: "lax",
  });
  const profile = await ensureProfile(db(), session.user.id);
  await updateProfileSettings(db(), session.user.id, {
    immersion: ["quiet", "collegiate", "full"].includes(immersion) ? (immersion as "quiet" | "collegiate" | "full") : undefined,
    theme: ["light", "dark", "system"].includes(theme) ? (theme as "light" | "dark" | "system") : undefined,
    socialLayerEnabled: form.get("socialLayerEnabled") === "1",
    notifications: { inApp: form.get("notifyInApp") === "1", email: form.get("notifyEmail") === "1" },
    accessibility: {
      ...profile.accessibility,
      reducedMotion: form.get("reducedMotion") === "1",
      highContrast: form.get("highContrast") === "1",
      fontScale: Number.isFinite(fontScale) ? fontScale : 1,
    },
  });
  done("experience");
}

export async function saveProviderAction(form: FormData): Promise<void> {
  const session = await requireSession("/settings");
  const provider = text(form, "provider") === "anthropic" ? "anthropic" : "fixture";
  const apiKey = text(form, "apiKey");
  const clearKey = form.get("clearKey") === "1";
  if (apiKey && apiKey.length < 20) redirect("/settings?error=The%20key%20looks%20too%20short%20to%20be%20an%20API%20key.#provider");
  await saveProviderSetting(db(), session.user.id, getEnv(), { provider, apiKey: apiKey || undefined, clearKey });
  done("provider");
}

export async function saveBudgetAction(form: FormData): Promise<void> {
  const session = await requireSession("/settings");
  const current = await getBudgetLimits(db(), session.user.id, getEnv());
  const num = (key: string, fallback: number) => {
    const v = Number(text(form, key));
    return Number.isFinite(v) && v > 0 ? Math.min(10_000, v) : fallback;
  };
  await saveBudgetLimits(db(), session.user.id, {
    perRunUsd: num("perRunUsd", current.perRunUsd),
    dailyUsd: num("dailyUsd", current.dailyUsd),
    monthlyUsd: num("monthlyUsd", current.monthlyUsd),
    hardStop: form.get("hardStop") === "1",
    warnFraction: current.warnFraction,
  });
  done("budgets");
}

export async function deleteMemoryAction(form: FormData): Promise<void> {
  const session = await requireSession("/settings");
  const id = text(form, "id");
  if (/^[0-9a-f-]{36}$/.test(id)) await deletePersonaMemory(db(), session.user.id, id);
  done("memory");
}

export async function purgeMemoryAction(form: FormData): Promise<void> {
  const session = await requireSession("/settings");
  const kind = text(form, "kind");
  await purgePersonaMemory(
    db(),
    session.user.id,
    ["academic", "preference", "social"].includes(kind) ? (kind as "academic" | "preference" | "social") : undefined,
  );
  done("memory");
}

/** Saves study preferences as explicit choices; a heavier load needs the workload preview ticked. */
export async function updateStudyPreferencesAction(form: FormData): Promise<void> {
  const session = await requireSession("/settings");
  const rhythm = text(form, "rhythm");
  const change = {
    rhythm: ["term", "rolling", "reading_course"].includes(rhythm) ? (rhythm as "term" | "rolling" | "reading_course") : undefined,
    weeklyAppointments: form.get("weeklyAppointments") === "on",
    hardDeadlines: form.get("hardDeadlines") === "on",
    examinations: form.get("examinations") === "on",
    mainCourseLimit: Number(text(form, "mainCourseLimit")) || undefined,
    exploratoryLimit: text(form, "exploratoryLimit") === "" ? undefined : Number(text(form, "exploratoryLimit")),
    heavierLoadPreviewedAt: form.get("previewSeen") === "on" ? new Date().toISOString() : undefined,
  };
  try {
    await updateStudyPreferences(db(), session.user.id, change);
  } catch (error) {
    if (error instanceof StudyError) {
      revalidatePath("/settings");
      redirect(`/settings?section=study&error=${encodeURIComponent(error.message)}#study`);
    }
    throw error;
  }
  revalidatePath("/timetable");
  done("study");
}
