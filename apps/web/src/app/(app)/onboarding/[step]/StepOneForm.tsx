"use client";
import { TIMEZONE_SUGGESTIONS } from "@corniversity/core/onboarding/steps";
import { useActionState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import type { StepState } from "./actions";

interface Initial {
  displayName: string;
  timezone: string;
  reducedMotion: boolean;
  fontScale: number;
  highContrast: boolean;
  accessibilityNotes: string;
}

/** The one orientation step: a name and a time zone. Display preferences live in Settings. */
export function StepOneForm({
  action,
  initial,
}: {
  action: (prev: StepState, formData: FormData) => Promise<StepState>;
  initial: Initial;
}) {
  const [state, formAction, pending] = useActionState(action, {} as StepState);
  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5" noValidate>
      <Field label="Your name" htmlFor="displayName" error={state.fieldErrors?.displayName}>
        <Input id="displayName" name="displayName" defaultValue={initial.displayName} required />
      </Field>
      <Field label="Time zone" htmlFor="timezone" error={state.fieldErrors?.timezone}>
        <Input id="timezone" name="timezone" list="tz-list" defaultValue={initial.timezone} required />
        <datalist id="tz-list">
          {TIMEZONE_SUGGESTIONS.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
      </Field>
      <input type="hidden" name="immersion" value="quiet" />
      {initial.reducedMotion ? <input type="hidden" name="reducedMotion" value="on" /> : null}
      {initial.highContrast ? <input type="hidden" name="highContrast" value="on" /> : null}
      <input type="hidden" name="fontScale" value={String(initial.fontScale)} />
      <input type="hidden" name="accessibilityNotes" value={initial.accessibilityNotes} />
      {state.error ? <Notice tone="rust">{state.error}</Notice> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Pick courses"}
        </Button>
      </div>
    </form>
  );
}
