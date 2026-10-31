"use client";
import { TIMEZONE_SUGGESTIONS } from "@corniversity/core/onboarding/steps";
import { useActionState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import type { StepState } from "./actions";

interface Initial {
  displayName: string;
  timezone: string;
  immersion: "quiet" | "collegiate" | "full";
  reducedMotion: boolean;
  fontScale: number;
  highContrast: boolean;
  accessibilityNotes: string;
}

const IMMERSION = [
  {
    value: "quiet",
    title: "Quiet study",
    body: "Courses, tutors, library, notebook and records. No classmates, societies or common room.",
  },
  {
    value: "collegiate",
    title: "Collegiate",
    body: "Everything in quiet study, plus faculty with personalities, office hours and optional seminars.",
  },
  {
    value: "full",
    title: "Full campus",
    body: "Also optional AI classmates, societies and a common room. Nothing happens while you are away.",
  },
] as const;

export function StepOneForm({
  action,
  initial,
}: {
  action: (prev: StepState, formData: FormData) => Promise<StepState>;
  initial: Initial;
}) {
  const [state, formAction, pending] = useActionState(action, {} as StepState);
  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6" noValidate>
      <Field label="What should we call you?" htmlFor="displayName" error={state.fieldErrors?.displayName}>
        <Input id="displayName" name="displayName" defaultValue={initial.displayName} required />
      </Field>

      <Field
        label="Timezone"
        htmlFor="timezone"
        error={state.fieldErrors?.timezone}
        hint="Used for your timetable and calendar export. Any IANA zone name works."
      >
        <Input id="timezone" name="timezone" list="tz-list" defaultValue={initial.timezone} required />
        <datalist id="tz-list">
          {TIMEZONE_SUGGESTIONS.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-ink">How much campus life would you like?</legend>
        <p className="text-xs text-ink-3">All three settings expose the same courses, tools and records. Change it any time.</p>
        {IMMERSION.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4 has-[:checked]:border-brass has-[:checked]:bg-brass-soft/40"
          >
            <input
              type="radio"
              name="immersion"
              value={option.value}
              defaultChecked={initial.immersion === option.value}
              className="mt-1 accent-[var(--brass)]"
            />
            <span>
              <span className="block font-medium text-ink">{option.title}</span>
              <span className="block text-sm text-ink-2">{option.body}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-ink">Accessibility</legend>
        <label className="flex items-center gap-3 text-sm text-ink">
          <input type="checkbox" name="reducedMotion" defaultChecked={initial.reducedMotion} className="accent-[var(--brass)]" />
          Reduce motion (the measured and reading surfaces are already still)
        </label>
        <label className="flex items-center gap-3 text-sm text-ink">
          <input type="checkbox" name="highContrast" defaultChecked={initial.highContrast} className="accent-[var(--brass)]" />
          Prefer higher contrast
        </label>
        <Field label="Base text size" htmlFor="fontScale" hint="1.0 is the default; 1.25 is a quarter larger.">
          <Select id="fontScale" name="fontScale" defaultValue={String(initial.fontScale)}>
            <option value="0.875">Smaller (0.875)</option>
            <option value="1">Default (1.0)</option>
            <option value="1.125">Larger (1.125)</option>
            <option value="1.25">Large (1.25)</option>
            <option value="1.5">Largest (1.5)</option>
          </Select>
        </Field>
        <Field
          label="Anything else we should know?"
          htmlFor="accessibilityNotes"
          hint="Optional. Read by the system when preparing materials, not by any person."
        >
          <Textarea id="accessibilityNotes" name="accessibilityNotes" defaultValue={initial.accessibilityNotes} rows={3} />
        </Field>
      </fieldset>

      {state.error ? <Notice tone="rust">{state.error}</Notice> : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-3">Saved when you continue. You can come back to any step.</span>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
