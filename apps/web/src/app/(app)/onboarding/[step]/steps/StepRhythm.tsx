import { nextMonday } from "@corniversity/db/services/programme";
import { Input } from "@/components/ui";
import { saveRhythmAction } from "../actions";
import { Fieldset, StepFooter, type StepProps } from "./shared";

const RHYTHMS = [
  {
    value: "term",
    title: "Term-based",
    body: "Ten teaching weeks, a reading week, a synthesis week. A clear arc with an end-of-term review.",
  },
  { value: "rolling", title: "Rolling, self-paced", body: "No fixed end; units are scheduled continuously at your weekly pace." },
  {
    value: "reading_course",
    title: "A focused reading course",
    body: "Eight weeks on one subject, reading-led, with a tutor but no assessed work unless you ask.",
  },
] as const;

export function StepRhythm({ profile }: StepProps) {
  const answers = profile.onboardingAnswers;
  const defaultStart = answers.termStart ?? nextMonday(profile.timezone).toISODate() ?? "";
  return (
    <form action={saveRhythmAction} className="flex max-w-3xl flex-col gap-8">
      <Fieldset legend="Study rhythm">
        <div className="grid gap-2">
          {RHYTHMS.map((r) => (
            <label
              key={r.value}
              className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4 has-[:checked]:border-brass"
            >
              <input
                type="radio"
                name="rhythm"
                value={r.value}
                defaultChecked={(answers.rhythm ?? "term") === r.value}
                className="mt-1 accent-[var(--brass)]"
              />
              <span>
                <span className="block font-medium text-ink">{r.title}</span>
                <span className="block text-sm text-ink-2">{r.body}</span>
              </span>
            </label>
          ))}
        </div>
      </Fieldset>
      <Fieldset legend="Start date" hint="Defaults to next Monday in your timezone. External course dates never apply here.">
        <label htmlFor="termStart" className="sr-only">
          Start date
        </label>
        <Input id="termStart" type="date" name="termStart" defaultValue={defaultStart} className="w-56" />
      </Fieldset>
      <StepFooter step={6} />
    </form>
  );
}
