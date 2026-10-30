import { notFound, redirect } from "next/navigation";
import { ONBOARDING_STEPS, getOnboardingStep } from "@corniversity/core/onboarding/steps";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { StepOneForm } from "./StepOneForm";
import { saveStepOneAction } from "./actions";

export const metadata = { title: "Orientation" };

export default async function OnboardingStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const number = Number(step);
  const def = Number.isInteger(number) ? getOnboardingStep(number) : undefined;
  if (!def) notFound();

  const session = await requireSession(`/onboarding/${number}`);
  const profile = await ensureProfile(db(), session.user.id);
  if (profile.onboardingCompletedAt) redirect("/campus");
  // Steps may be revisited, but not skipped ahead.
  if (number > profile.onboardingStep) redirect(`/onboarding/${profile.onboardingStep}`);

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
                  "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem]",
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
          ) : (
            <div className="rounded-[var(--radius-panel)] border border-dashed border-stone-2 bg-paper-2 p-6 text-sm text-ink-2">
              This step is being built (Milestone 3). Your progress so far is saved; you can return to it
              from the Campus page.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
