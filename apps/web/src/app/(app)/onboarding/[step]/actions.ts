"use server";
import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { learnerConceptOverride, learnerProfile, peerMembership, prerequisiteRule } from "@corniversity/db/schema/index";
import { enrol, listEnrolments, setEnrolmentStatus } from "@corniversity/db/services/enrolment";
import { completeOnboarding, saveOnboardingStep, saveStepOne } from "@corniversity/db/services/onboarding";
import { candidatePlans, ensureTerm, saveAvailability, setConceptSelfReport } from "@corniversity/db/services/programme";
import { confirmPlan, discardProposedPlans, proposePlan } from "@corniversity/db/services/timetable";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { COMMITMENT_SUGGESTIONS } from "./steps/StepTime";
import { timeToMinutes } from "./steps/shared";

export interface StepState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const StepOneInput = z.object({
  displayName: z.string().trim().min(1, "Please tell us what to call you.").max(80),
  timezone: z
    .string()
    .trim()
    .min(1)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-GB", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "That is not a recognised timezone."),
  immersion: z.enum(["quiet", "collegiate", "full"]),
  reducedMotion: z.boolean(),
  fontScale: z.coerce.number().min(0.875).max(1.5),
  highContrast: z.boolean(),
  accessibilityNotes: z.string().trim().max(1000).optional(),
});

export async function saveStepOneAction(_prev: StepState, formData: FormData): Promise<StepState> {
  const session = await requireSession("/onboarding/1");
  const parsed = StepOneInput.safeParse({
    displayName: formData.get("displayName"),
    timezone: formData.get("timezone"),
    immersion: formData.get("immersion"),
    reducedMotion: formData.get("reducedMotion") === "on",
    fontScale: formData.get("fontScale") ?? "1",
    highContrast: formData.get("highContrast") === "on",
    accessibilityNotes: formData.get("accessibilityNotes") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }
  await saveStepOne(db(), session.user.id, parsed.data);
  redirect("/onboarding/2");
}

function all(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String).filter(Boolean);
}

export async function saveInterestsAction(formData: FormData): Promise<void> {
  const session = await requireSession("/onboarding/2");
  const departmentIds = all(formData, "departmentIds");
  const interestCourseIds = all(formData, "interestCourseIds").filter((id) => /^[A-Z]{3}-\d{3}$/.test(id));
  const goalsText = String(formData.get("goalsText") ?? "").trim().slice(0, 4000);
  if (departmentIds.length === 0 && interestCourseIds.length === 0) redirect("/onboarding/2?error=choose_department");
  // Courses imply their departments.
  if (interestCourseIds.length) {
    const { course } = await import("@corniversity/db/schema/index");
    const rows = await db().select({ d: course.primaryDepartmentId }).from(course).where(inArray(course.id, interestCourseIds));
    for (const r of rows) if (!departmentIds.includes(r.d)) departmentIds.push(r.d);
  }
  await saveOnboardingStep(db(), session.user.id, 2, { departmentIds, interestCourseIds, goalsText }, { goalsText });
  redirect("/onboarding/3");
}

export async function saveKnowledgeAction(formData: FormData): Promise<void> {
  const session = await requireSession("/onboarding/3");
  const priorKnowledge: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("prior:")) priorKnowledge[key.slice(6)] = String(value).trim().slice(0, 4000);
  }
  const allIds = String(formData.get("allConceptIds") ?? "").split(",").filter(Boolean);
  const known = all(formData, "knownConceptIds");
  await db().transaction(async (tx) => {
    if (allIds.length) {
      await tx.delete(learnerConceptOverride).where(and(eq(learnerConceptOverride.userId, session.user.id), inArray(learnerConceptOverride.conceptId, allIds)));
    }
    await setConceptSelfReport(tx, session.user.id, known, true, "orientation step 3: self-reported as already known");
    await saveOnboardingStep(tx, session.user.id, 3, { priorKnowledge });
  });
  redirect("/onboarding/4");
}

export async function saveStyleAction(formData: FormData): Promise<void> {
  const session = await requireSession("/onboarding/4");
  const learningStyles: Record<string, "proof_led" | "conceptual" | "computational" | "experimental" | "mixed"> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("style:")) {
      const v = String(value);
      if (["proof_led", "conceptual", "computational", "experimental", "mixed"].includes(v)) learningStyles[key.slice(6)] = v as never;
    }
  }
  await saveOnboardingStep(db(), session.user.id, 4, { learningStyles }, { learningStyles });
  redirect("/onboarding/5");
}

export async function saveTimeAction(formData: FormData): Promise<void> {
  const session = await requireSession("/onboarding/5");
  const availability: { weekday: number; startMinute: number; endMinute: number }[] = [];
  for (let d = 1; d <= 7; d++) {
    const start = timeToMinutes(String(formData.get(`start:${d}`) ?? ""));
    const end = timeToMinutes(String(formData.get(`end:${d}`) ?? ""));
    if (start !== null && end !== null && end > start) availability.push({ weekday: d, startMinute: start, endMinute: end });
  }
  if (availability.length === 0) redirect("/onboarding/5?error=no_availability");
  const commitments: { title: string; weekday: number; startMinute: number; endMinute: number; protected: boolean }[] = [];
  for (const key of all(formData, "suggested")) {
    const s = COMMITMENT_SUGGESTIONS.find((c) => c.key === key);
    if (s) commitments.push({ title: s.title, weekday: s.weekday, startMinute: s.startMinute, endMinute: s.endMinute, protected: true });
  }
  for (const i of [0, 1]) {
    const title = String(formData.get(`custom-title:${i}`) ?? "").trim();
    const day = Number(formData.get(`custom-day:${i}`));
    const start = timeToMinutes(String(formData.get(`custom-start:${i}`) ?? ""));
    const end = timeToMinutes(String(formData.get(`custom-end:${i}`) ?? ""));
    if (title && day >= 1 && day <= 7 && start !== null && end !== null && end > start) {
      commitments.push({ title: title.slice(0, 80), weekday: day, startMinute: start, endMinute: end, protected: true });
    }
  }
  const weeklyHours = Math.min(40, Math.max(2, Number(formData.get("weeklyHours")) || 8));
  const answers = { availability, commitments, weeklyHours };
  await db().transaction(async (tx) => {
    await saveOnboardingStep(tx, session.user.id, 5, answers, { weeklyHoursCeiling: weeklyHours });
    const profile = await tx.select().from(learnerProfile).where(eq(learnerProfile.userId, session.user.id)).limit(1);
    await saveAvailability(tx, session.user.id, profile[0]?.onboardingAnswers ?? answers);
  });
  redirect("/onboarding/6");
}

export async function saveRhythmAction(formData: FormData): Promise<void> {
  const session = await requireSession("/onboarding/6");
  const rhythm = String(formData.get("rhythm") ?? "term");
  const termStart = String(formData.get("termStart") ?? "");
  if (!["term", "rolling", "reading_course"].includes(rhythm) || !/^\d{4}-\d{2}-\d{2}$/.test(termStart)) redirect("/onboarding/6?error=invalid");
  await saveOnboardingStep(db(), session.user.id, 6, { rhythm: rhythm as never, termStart }, { studyRhythm: rhythm as never });
  redirect("/onboarding/7");
}

export async function savePlacementAction(formData: FormData): Promise<void> {
  const session = await requireSession("/onboarding/7");
  const ruleIds = String(formData.get("ruleIds") ?? "").split(",").filter(Boolean);
  const rules = ruleIds.length ? await db().select().from(prerequisiteRule).where(inArray(prerequisiteRule.id, ruleIds)) : [];
  const placement: Record<string, "passed" | "skipped" | "attempted"> = {};
  const known: string[] = [];
  for (const rule of rules) {
    const choice = String(formData.get(`rule:${rule.id}`) ?? "skip");
    if (choice === "skip") {
      placement[rule.id] = "skipped";
      continue;
    }
    const alt = rule.alternatives[Number(choice)];
    if (alt?.conceptIds.length) {
      known.push(...alt.conceptIds);
      placement[rule.id] = "attempted"; // self-reported; a real check would set "passed"
    } else {
      placement[rule.id] = "skipped";
    }
  }
  await db().transaction(async (tx) => {
    await setConceptSelfReport(tx, session.user.id, [...new Set(known)], true, "orientation step 7: self-reported readiness (unverified)");
    await saveOnboardingStep(tx, session.user.id, 7, { placement });
  });
  redirect("/onboarding/8");
}

export async function choosePlanAction(formData: FormData): Promise<void> {
  const session = await requireSession("/onboarding/8");
  const planId = String(formData.get("planId") ?? "");
  const [profile] = await db().select().from(learnerProfile).where(eq(learnerProfile.userId, session.user.id)).limit(1);
  if (!profile) redirect("/onboarding/8?error=invalid");
  const plans = await candidatePlans(db(), session.user.id, profile.onboardingAnswers, profile.onboardingAnswers.rhythm === "reading_course" ? 8 : 10);
  const chosen = plans.find((p) => p.id === planId);
  if (!chosen) redirect("/onboarding/8?error=choose_plan");
  const modes: Record<string, "enrolled" | "audit" | "reading_seminar"> = {};
  for (const c of chosen.courses) modes[c.courseId] = c.mode;
  await saveOnboardingStep(db(), session.user.id, 8, {
    chosenPlanId: chosen.id,
    chosenPlan: { id: chosen.id, title: chosen.title, courses: chosen.courses.map((c) => ({ courseId: c.courseId, role: c.role, mode: c.mode })) },
    modes,
  });
  redirect("/onboarding/9");
}

export async function saveModesAction(formData: FormData): Promise<void> {
  const session = await requireSession("/onboarding/9");
  const [profile] = await db().select().from(learnerProfile).where(eq(learnerProfile.userId, session.user.id)).limit(1);
  const chosen = profile?.onboardingAnswers.chosenPlan;
  if (!chosen) redirect("/onboarding/8?error=choose_plan");
  const modes: Record<string, "enrolled" | "audit" | "reading_seminar"> = {};
  for (const c of chosen.courses) {
    const v = String(formData.get(`mode:${c.courseId}`) ?? c.mode);
    modes[c.courseId] = (["enrolled", "audit", "reading_seminar"].includes(v) ? v : c.mode) as never;
  }
  await db().transaction(async (tx) => {
    await saveOnboardingStep(tx, session.user.id, 9, { modes });
    // Create the term and enrolments now so the timetable preview is real; the plan itself is
    // only proposed until step 11 confirms it.
    const answers = { ...profile!.onboardingAnswers, modes };
    const termRow = await ensureTerm(tx, session.user.id, answers, profile!.timezone);
    const existing = await listEnrolments(tx, session.user.id);
    for (const c of chosen.courses) {
      const current = existing.find((e) => e.course.id === c.courseId && e.enrolment.status !== "withdrawn");
      if (current && current.enrolment.mode !== modes[c.courseId]) {
        await setEnrolmentStatus(tx, session.user.id, current.enrolment.id, "withdrawn");
        await enrol(tx, { ownerId: session.user.id, courseId: c.courseId, mode: modes[c.courseId]!, termId: termRow.id, idempotencyKey: `enrol:${session.user.id}:${c.courseId}:${modes[c.courseId]}` });
      } else if (!current) {
        await enrol(tx, { ownerId: session.user.id, courseId: c.courseId, mode: modes[c.courseId]!, termId: termRow.id, idempotencyKey: `enrol:${session.user.id}:${c.courseId}:${modes[c.courseId]}` });
      }
    }
    // Withdraw from courses no longer in the plan (made during onboarding only).
    for (const e of existing) {
      if (e.enrolment.status === "active" && !chosen.courses.some((c) => c.courseId === e.course.id) && e.enrolment.termId === termRow.id) {
        await setEnrolmentStatus(tx, session.user.id, e.enrolment.id, "withdrawn");
      }
    }
    await discardProposedPlans(tx, session.user.id, termRow.id);
    await proposePlan(tx, session.user.id, termRow);
  });
  redirect("/onboarding/10");
}

export async function acceptTimetableAction(formData: FormData): Promise<void> {
  const session = await requireSession("/onboarding/10");
  const planId = String(formData.get("planId") ?? "");
  if (!planId) redirect("/onboarding/10?error=invalid");
  await saveOnboardingStep(db(), session.user.id, 10, {});
  redirect(`/onboarding/11?plan=${planId}`);
}

export async function confirmPlanAction(formData: FormData): Promise<void> {
  const session = await requireSession("/onboarding/11");
  const planId = String(formData.get("planId") ?? "");
  if (!planId) redirect("/onboarding/10?error=invalid");
  await db().transaction(async (tx) => {
    await confirmPlan(tx, session.user.id, planId);
    await saveOnboardingStep(tx, session.user.id, 11, {});
    await completeOnboarding(tx, session.user.id);
  });
  redirect("/welcome");
}

export async function saveMeetAction(formData: FormData): Promise<void> {
  const session = await requireSession("/onboarding/12");
  const peers = all(formData, "peerPersonaIds");
  const next = String(formData.get("next") ?? "/campus");
  await db().transaction(async (tx) => {
    await tx.delete(peerMembership).where(eq(peerMembership.ownerId, session.user.id));
    if (peers.length) await tx.insert(peerMembership).values(peers.map((personaId) => ({ ownerId: session.user.id, personaId, enabled: true })));
    await saveOnboardingStep(tx, session.user.id, 12, { peerPersonaIds: peers });
  });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/campus");
}
