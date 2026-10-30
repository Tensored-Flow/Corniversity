import { listCatalogue, listDepartments } from "@corniversity/db/services/catalogue";
import { ReadinessBadge } from "@/components/Readiness";
import { Badge, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { saveInterestsAction } from "../actions";
import { Fieldset, StepFooter, type StepProps } from "./shared";

export async function StepInterests({ profile }: StepProps) {
  const [departments, entries] = await Promise.all([listDepartments(db()), listCatalogue(db())]);
  const answers = profile.onboardingAnswers;
  const chosenDepartments = new Set(answers.departmentIds ?? []);
  const chosenCourses = new Set(answers.interestCourseIds ?? []);
  return (
    <form action={saveInterestsAction} className="flex max-w-3xl flex-col gap-8">
      <Fieldset legend="Departments" hint="Choose as many as you like; the director will keep the first term manageable.">
        <div className="grid gap-2 sm:grid-cols-2">
          {departments.map((d) => (
            <label key={d.id} className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-3 has-[:checked]:border-brass">
              <input type="checkbox" name="departmentIds" value={d.id} defaultChecked={chosenDepartments.has(d.id)} className="mt-1 accent-[var(--brass)]" />
              <span>
                <span className="block font-medium text-ink">{d.title}</span>
                <span className="block text-xs text-ink-2 line-clamp-2">{d.identity}</span>
              </span>
            </label>
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="Courses that interest you" hint="Prepared courses can be taken in full now; the others can be audited or read, and are prepared through the content pipeline before they are taught.">
        <div className="max-h-[22rem] overflow-y-auto rounded-[var(--radius-panel)] border border-stone">
          {departments.map((d) => {
            const mine = entries.filter((e) => e.departments.includes(d.id));
            return (
              <div key={d.id} className="border-b border-stone last:border-b-0">
                <p className="bg-paper-3 px-3 py-1.5 text-xs uppercase tracking-wide text-ink-3">{d.title}</p>
                <ul>
                  {mine.map((e) => (
                    <li key={e.course.id}>
                      <label className="flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-paper-2">
                        <input type="checkbox" name="interestCourseIds" value={e.course.id} defaultChecked={chosenCourses.has(e.course.id)} className="accent-[var(--brass)]" />
                        <span className="font-mono text-xs text-ink-3">{e.course.id}</span>
                        <span className="flex-1 text-ink">{e.course.title}</span>
                        {e.course.launch ? <Badge tone="brass">launch</Badge> : null}
                        <ReadinessBadge readiness={e.version.readiness} />
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Fieldset>

      <Fieldset legend="In your own words" hint="What do you want to understand by the end of the first term, and why? Curiosity counts.">
        <label htmlFor="goalsText" className="sr-only">
          In your own words
        </label>
        <Textarea id="goalsText" name="goalsText" rows={4} defaultValue={answers.goalsText ?? profile.goalsText ?? ""} className="min-h-24" />
      </Fieldset>

      <StepFooter step={2} />
    </form>
  );
}
