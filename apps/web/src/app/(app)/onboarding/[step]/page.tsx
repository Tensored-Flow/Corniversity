import { getOnboardingStep, ONBOARDING_STEPS } from "@corniversity/core/onboarding/steps";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { notFound, redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { saveStepOneAction } from "./actions";
import { StepOneForm } from "./StepOneForm";
import { StepConfirm } from "./steps/StepConfirm";
import { StepInterests } from "./steps/StepInterests";
import { StepKnowledge } from "./steps/StepKnowledge";
import { StepMeet } from "./steps/StepMeet";
import { StepModes } from "./steps/StepModes";
import { StepPlacement } from "./steps/StepPlacement";
import { StepPlans } from "./steps/StepPlans";
import { StepRhythm } from "./steps/StepRhythm";
import { StepStyle } from "./steps/StepStyle";
import { StepTime } from "./steps/StepTime";
import { StepTimetable } from "./steps/StepTimetable";

export const metadata = { title: "Orientation" };

const ERRORS: Record<string, string> = {
  choose_department: "Choose at least one department or course before continuing.",
  choose_plan: "Choose one of the plans to continue.",
  no_availability: "Add at least one availability window so a timetable can be built.",
  infeasible: "The proposed timetable does not fit. Adjust your hours or courses, or accept the shortfall.",
  complete:
    "Orientation is already complete, so this step changes nothing. Change courses on their own pages, the timetable on the Timetable page, and your route with the director.",
  invalid: "Something in the form was not valid. Please check and try again.",
  not_offered: "A course in this plan is not offered in the mode chosen for it. Choose one of the modes it offers; nothing was enrolled.",
};

export default async function OnboardingStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { step } = await params;
  const { error, saved } = await searchParams;
  const number = Number(step);
  const def = Number.isInteger(number) ? getOnboardingStep(number) : undefined;
  if (!def) notFound();

  const session = await requireSession(`/onboarding/${number}`);
  const profile = await ensureProfile(db(), session.user.id);
  // Step 12 (meet the college) is always open once the plan is confirmed; other steps are
  // sequential: a learner may revisit earlier steps but not skip ahead.
  if (!profile.onboardingCompletedAt && number > profile.onboardingStep) redirect(`/onboarding/${profile.onboardingStep}`);

  const common = { userId: session.user.id, profile };
  const completed = Boolean(profile.onboardingCompletedAt);
  // After orientation, the plan-building steps are shown for reference only; their actions refuse.
  const planStep = number >= 8 && number <= 11;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[220px_1fr]">
      <ol aria-label="Orientation steps" className="hidden lg:block">
        {ONBOARDING_STEPS.map((s) => {
          const state = s.number < profile.onboardingStep ? "done" : s.number === number ? "current" : "todo";
          return (
            <li key={s.number} className="flex items-start gap-3 py-1.5 text-sm">
              <span
                aria-hidden="true"
                className={[
                  "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs",
                  state === "done"
                    ? "border-moss bg-moss-soft text-moss"
                    : state === "current"
                      ? "border-brass bg-brass-soft text-brass-strong"
                      : "border-stone-2 text-ink-3",
                ].join(" ")}
              >
                {s.number}
              </span>
              <span className={state === "current" ? "text-ink" : "text-ink-3"}>{s.title}</span>
            </li>
          );
        })}
      </ol>
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-brass">
          Orientation · step {def.number} of {ONBOARDING_STEPS.length}
        </p>
        <h1 className="mt-1 text-3xl text-ink">{def.title}</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-2">{def.purpose}</p>
        {error ? (
          <div className="mt-4">
            <Notice tone="rust">{ERRORS[error] ?? ERRORS.invalid}</Notice>
          </div>
        ) : null}
        {saved !== undefined ? (
          <div className="mt-4">
            <Notice tone="moss" title="Saved">
              {Number(saved) > 0 ? `${saved} newly chosen programme${saved === "1" ? " is" : "s are"} now followed. ` : ""}
              Nothing else changed: no programme was unfollowed or resumed and nothing was enrolled. Orientation is already complete, so
              there is no plan to confirm again.
            </Notice>
          </div>
        ) : null}
        {completed && planStep ? (
          <div className="mt-4">
            <Notice tone="neutral" title="Orientation is complete">
              This step built your first plan. It no longer changes anything: courses are added or withdrawn on their own pages, the
              timetable is changed on the Timetable page, and the director drafts routes for you to confirm.
            </Notice>
          </div>
        ) : null}
        <div className="mt-8">
          {number === 1 ? (
            <StepOneForm
              action={saveStepOneAction}
              initial={{
                displayName: profile.displayName,
                timezone: profile.timezone,
                immersion: profile.immersion,
                reducedMotion: Boolean(profile.accessibility.reducedMotion),
                fontScale: profile.accessibility.fontScale ?? 1,
                highContrast: Boolean(profile.accessibility.highContrast),
                accessibilityNotes: profile.accessibility.notes ?? "",
              }}
            />
          ) : null}
          {number === 2 ? <StepInterests {...common} /> : null}
          {number === 3 ? <StepKnowledge {...common} /> : null}
          {number === 4 ? <StepStyle {...common} /> : null}
          {number === 5 ? <StepTime {...common} /> : null}
          {number === 6 ? <StepRhythm {...common} /> : null}
          {number === 7 ? <StepPlacement {...common} /> : null}
          {number === 8 && !completed ? <StepPlans {...common} /> : null}
          {number === 9 && !completed ? <StepModes {...common} /> : null}
          {number === 10 && !completed ? <StepTimetable {...common} /> : null}
          {number === 11 && !completed ? <StepConfirm {...common} /> : null}
          {number === 12 ? <StepMeet {...common} /> : null}
        </div>
      </div>
    </div>
  );
}
