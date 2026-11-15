import { SUBJECTS, type SubjectDefinition } from "@corniversity/core";
import { Button } from "@/components/ui";
import { setSubjectsAction } from "../actions";

function SubjectBox({ subject, checked }: { subject: SubjectDefinition; checked: boolean }) {
  return (
    <label className="flex items-start gap-2 py-0.5 text-sm text-ink">
      <input
        type="checkbox"
        name="subject"
        value={subject.slug}
        defaultChecked={checked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brass"
      />
      <span>{subject.name}</span>
    </label>
  );
}

/** The owner's subjects as a checkbox form (a plain form: it works without JavaScript). */
export function SubjectsForm({ chosen }: { chosen: readonly string[] }) {
  const primary = SUBJECTS.filter((s) => s.primary);
  const others = SUBJECTS.filter((s) => !s.primary).sort((a, b) => a.name.localeCompare(b.name, "en"));
  const names = SUBJECTS.filter((s) => chosen.includes(s.slug)).map((s) => s.name);
  return (
    <section aria-labelledby="subjects-heading" className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4">
      <h2 id="subjects-heading" className="text-lg text-ink">
        Your subjects
      </h2>
      <p className="mt-1 text-sm text-ink-2">{names.length > 0 ? names.join(", ") : "None chosen."}</p>
      <details className="mt-2" open={chosen.length === 0}>
        <summary className="cursor-pointer text-sm text-brass underline underline-offset-4">Choose subjects</summary>
        <form action={setSubjectsAction} className="mt-3 flex flex-col gap-4">
          <fieldset>
            <legend className="text-sm font-medium text-ink">Primary subjects (with New on arXiv)</legend>
            <div className="mt-1 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
              {primary.map((s) => (
                <SubjectBox key={s.slug} subject={s} checked={chosen.includes(s.slug)} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium text-ink">Other OpenAlex fields</legend>
            <div className="mt-1 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((s) => (
                <SubjectBox key={s.slug} subject={s} checked={chosen.includes(s.slug)} />
              ))}
            </div>
          </fieldset>
          <div>
            <Button type="submit">Save subjects</Button>
          </div>
        </form>
      </details>
    </section>
  );
}
