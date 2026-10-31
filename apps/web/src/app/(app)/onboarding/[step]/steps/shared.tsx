import type { LearnerProfileRow } from "@corniversity/db/services/onboarding";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";

export interface StepProps {
  userId: string;
  profile: LearnerProfileRow;
}

/** Shared footer: back link, a sentence about saving, and the continue button. */
export function StepFooter({
  step,
  continueLabel = "Continue",
  pending = false,
  extra,
}: {
  step: number;
  continueLabel?: string;
  pending?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-stone pt-4">
      <div className="flex items-center gap-4 text-sm">
        {step > 1 ? (
          <Link href={`/onboarding/${step - 1}`} className="text-ink-2 hover:text-ink">
            ← Back
          </Link>
        ) : null}
        <span className="text-xs text-ink-3">Saved when you continue. You can come back to any step.</span>
      </div>
      <div className="flex items-center gap-3">
        {extra}
        <Button type="submit" disabled={pending}>
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}

export function Fieldset({ legend, hint, children }: { legend: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      {hint ? <p className="-mt-1 text-xs text-ink-3">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

export const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function timeToMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 24 || mm > 59) return null;
  return h * 60 + mm;
}
