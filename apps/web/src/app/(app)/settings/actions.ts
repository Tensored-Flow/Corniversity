"use server";
import { BudgetLimitError, isSupportedModel, PlanLimitError } from "@corniversity/ai";
import { TIMEZONE_SUGGESTIONS } from "@corniversity/core/onboarding/steps";
import { getEnv } from "@corniversity/db/env";
import {
  approvePlanUse,
  disconnectPlan,
  PlanSettingError,
  PlanSignInError,
  resumePlanUse,
  savePlanSettings,
  startPlanSignIn,
  withdrawPlanApproval,
} from "@corniversity/db/services/chatgpt-plan";
import { deletePersonaMemory, purgePersonaMemory } from "@corniversity/db/services/community";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import {
  approvePaidUse,
  ProviderSettingError,
  SettlementError,
  saveBudgetLimits,
  saveProviderSetting,
  settleUnsettledRun,
  withdrawPaidUseApproval,
} from "@corniversity/db/services/provider-config";
import { updateProfileSettings } from "@corniversity/db/services/settings";
import { StudyError, updateStudyPreferences } from "@corniversity/db/services/study";
import { allowVoiceDictation, withdrawVoiceDictation } from "@corniversity/db/services/voice";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { errorCode, errorHref } from "@/lib/notices";
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

/**
 * Saves the provider, model, key, refusal fallback and limits together, then records approval of
 * paid use when the owner ticked it. Approval snapshots exactly what was saved, so a later change
 * of model or a higher limit leaves live runs blocked until it is approved again.
 */
export async function saveLiveTutoringAction(form: FormData): Promise<void> {
  const session = await requireSession("/settings");
  const env = getEnv();
  const chosen = text(form, "provider");
  const provider = chosen === "anthropic" || chosen === "chatgpt_plan" ? chosen : "fixture";
  const apiKey = text(form, "apiKey");
  const model = text(form, "model");
  if (apiKey && apiKey.length < 20) redirect(errorHref("/settings", "key-looks-too-short-api", "#provider"));
  try {
    await saveBudgetLimits(db(), session.user.id, {
      perRunUsd: Number(text(form, "perRunUsd")),
      dailyUsd: Number(text(form, "dailyUsd")),
      monthlyUsd: Number(text(form, "monthlyUsd")),
    });
    await saveProviderSetting(db(), session.user.id, env, {
      provider,
      apiKey: apiKey || undefined,
      clearKey: form.get("clearKey") === "1",
      model: isSupportedModel(model) ? model : undefined,
      refusalFallback: form.get("refusalFallback") === "1",
    });
    if (provider === "anthropic" && form.get("approvePaidUse") === "1") await approvePaidUse(db(), session.user.id, env);
  } catch (error) {
    if (error instanceof BudgetLimitError || error instanceof ProviderSettingError) {
      redirect(errorHref("/settings", errorCode(error.message), "#provider"));
    }
    throw error;
  }
  done("provider");
}

/** Back to the ChatGPT plan card with a notice code (`plan`) or an error code (`planError`). */
function planDone(query: string): never {
  revalidatePath("/settings");
  redirect(`/settings?${query}#chatgpt-plan`);
}

/** Starts the owner's sign-in with OpenAI (local installation only): the browser goes to OpenAI's page. */
export async function startPlanSignInAction(form: FormData): Promise<void> {
  const session = await requireSession("/settings");
  let url: string;
  try {
    url = await startPlanSignIn(session.user.id, getEnv(), { otherAccount: form.get("otherAccount") === "1" });
  } catch (error) {
    if (error instanceof PlanSignInError) planDone(`planError=${errorCode(error.message)}`);
    throw error;
  }
  redirect(url);
}

export async function disconnectPlanAction(): Promise<void> {
  const session = await requireSession("/settings");
  const { revoked } = await disconnectPlan(db(), getEnv(), session.user.id);
  planDone(`plan=${revoked ? "signed-out" : "signed-out-unconfirmed"}`);
}

/** Saves the plan's model and request limits, then records approval when the owner ticked it. */
export async function savePlanSettingsAction(form: FormData): Promise<void> {
  const session = await requireSession("/settings");
  try {
    await savePlanSettings(db(), session.user.id, {
      model: text(form, "planModel") || null,
      dailyRequests: Number(text(form, "planDailyRequests")),
      monthlyRequests: Number(text(form, "planMonthlyRequests")),
    });
    if (form.get("approvePlanUse") === "1") await approvePlanUse(db(), getEnv(), session.user.id);
  } catch (error) {
    if (error instanceof PlanLimitError || error instanceof PlanSettingError) planDone(`planError=${errorCode(error.message)}`);
    throw error;
  }
  planDone("plan=saved");
}

export async function withdrawPlanApprovalAction(): Promise<void> {
  const session = await requireSession("/settings");
  await withdrawPlanApproval(db(), session.user.id);
  planDone("plan=saved");
}

export async function resumePlanUseAction(): Promise<void> {
  const session = await requireSession("/settings");
  await resumePlanUse(db(), session.user.id);
  planDone("plan=resumed");
}

export async function withdrawApprovalAction(): Promise<void> {
  const session = await requireSession("/settings");
  await withdrawPaidUseApproval(db(), session.user.id);
  done("provider");
}

/**
 * Settles a run whose cost the provider could not report, with the amount the owner read in the
 * provider console. Until then it counts at its worst case; the settlement is audited.
 */
export async function settleRunAction(form: FormData): Promise<void> {
  const session = await requireSession("/settings");
  const runId = text(form, "runId");
  if (!/^[0-9a-f-]{36}$/.test(runId)) redirect(errorHref("/settings", "unknown-run", "#provider"));
  try {
    await settleUnsettledRun(db(), session.user.id, runId, { amountUsd: Number(text(form, "amountUsd")), note: text(form, "note") });
  } catch (error) {
    if (error instanceof SettlementError) redirect(errorHref("/settings", errorCode(error.message), "#provider"));
    throw error;
  }
  done("provider");
}

/** Dictation is allowed only with the box ticked, after reading where the audio goes. */
export async function allowVoiceAction(form: FormData): Promise<void> {
  const session = await requireSession("/settings");
  if (form.get("understood") !== "1") redirect(errorHref("/settings", "tick-box-allow-dictation", "#voice"));
  await allowVoiceDictation(db(), session.user.id);
  done("voice");
}

export async function withdrawVoiceAction(): Promise<void> {
  const session = await requireSession("/settings");
  await withdrawVoiceDictation(db(), session.user.id);
  done("voice");
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
      redirect(errorHref("/settings?section=study", errorCode(error.message), "#study"));
    }
    throw error;
  }
  revalidatePath("/timetable");
  done("study");
}
