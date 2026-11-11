import { ensureProfile } from "@corniversity/db/services/onboarding";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { saveStepOneAction } from "./actions";
import { StepOneForm } from "./StepOneForm";

export const metadata = { title: "Welcome" };

/**
 * Orientation is one step: a name and a time zone, then the catalogue. The earlier twelve-step
 * orientation (interests, placement, plans, timetable) is no longer offered; its records stay.
 */
export default async function OnboardingPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const session = await requireSession(`/onboarding/${step}`);
  const profile = await ensureProfile(db(), session.user.id);
  if (profile.onboardingCompletedAt) redirect("/campus");
  if (step !== "1") redirect("/onboarding/1");

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-3xl text-ink">Welcome</h1>
      <p className="mt-2 text-sm text-ink-2">Two details, then pick your courses.</p>
      <div className="mt-6">
        <StepOneForm
          action={saveStepOneAction}
          initial={{
            displayName: profile.displayName,
            timezone: profile.timezone,
            reducedMotion: Boolean(profile.accessibility.reducedMotion),
            fontScale: profile.accessibility.fontScale ?? 1,
            highContrast: Boolean(profile.accessibility.highContrast),
            accessibilityNotes: profile.accessibility.notes ?? "",
          }}
        />
      </div>
    </div>
  );
}
