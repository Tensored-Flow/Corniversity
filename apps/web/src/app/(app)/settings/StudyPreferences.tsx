import { MAX_EXPLORATORY_COURSES, MAX_MAIN_COURSES } from "@corniversity/core";
import { activeLoad, getStudyPreferences } from "@corniversity/db/services/study";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import { db } from "@/lib/db";
import { updateStudyPreferencesAction } from "./actions";

/**
 * Study rhythm and assessment, with what is a default and what was chosen. Raising the course
 * load shows the workload preview first; switching to term mode changes nothing else.
 */
export async function StudyPreferences({ ownerId, error }: { ownerId: string; error?: string }) {
  const [{ preferences, explicit }, load] = await Promise.all([getStudyPreferences(db(), ownerId), activeLoad(db(), ownerId)]);
  const chosen = (k: string) => (explicit.includes(k as never) ? <Badge tone="brass">your choice</Badge> : <Badge>default</Badge>);
  return (
    <Card as="section" id="study" aria-labelledby="study-heading">
      <h2 id="study-heading" className="text-lg text-ink">
        Study rhythm and assessment
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Defaults for a new learner: rolling study, one main course with up to one lighter course alongside, weekly study appointments, and
        no hard deadlines or examinations. They are starting points, not limits.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-rust">
          {error}
        </p>
      ) : null}
      <form action={updateStudyPreferencesAction} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Rhythm" htmlFor="sp-rhythm">
          <Select id="sp-rhythm" name="rhythm" defaultValue={preferences.rhythm}>
            <option value="rolling">Rolling, self-paced: no completion date</option>
            <option value="term">Formal terms with a reading week</option>
            <option value="reading_course">A focused reading course</option>
          </Select>
        </Field>
        <div className="flex items-end gap-2 text-xs">{chosen("rhythm")}</div>
        <fieldset className="flex flex-col gap-2 text-sm sm:col-span-2">
          <legend className="text-sm font-medium text-ink">Appointments and assessment</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="weeklyAppointments" defaultChecked={preferences.weeklyAppointments} /> Weekly study appointments on
            the timetable {chosen("weeklyAppointments")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="hardDeadlines" defaultChecked={preferences.hardDeadlines} /> Hard deadlines for assessed work, set
            by you {chosen("hardDeadlines")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="examinations" defaultChecked={preferences.examinations} /> Examinations {chosen("examinations")}
          </label>
          <span className="text-xs text-ink-3">
            Term mode does not switch on examinations, and a timetable never creates deadlines: each is its own choice.
          </span>
        </fieldset>
        <Field label="Main courses at a time" htmlFor="sp-main">
          <Select id="sp-main" name="mainCourseLimit" defaultValue={String(preferences.mainCourseLimit)}>
            {Array.from({ length: MAX_MAIN_COURSES }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lighter courses alongside" htmlFor="sp-light">
          <Select id="sp-light" name="exploratoryLimit" defaultValue={String(preferences.exploratoryLimit)}>
            {Array.from({ length: MAX_EXPLORATORY_COURSES + 1 }, (_, i) => i).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <div className="rounded-[var(--radius-panel)] border border-stone bg-paper p-3 text-xs text-ink-2 sm:col-span-2">
          <p className="font-medium text-ink">Workload preview</p>
          <p className="mt-1">
            You take {load.main} main and {load.exploratory} lighter course{load.exploratory === 1 ? "" : "s"} now, about {load.weeklyHours}{" "}
            hours a week by the plan's estimate. Each further main course adds roughly its catalogue workload spread over ten weeks (usually
            5 to 9 hours a week), a lighter one about 40% of that. A heavier load than the defaults applies only after you confirm you have
            read this.
          </p>
          <label className="mt-2 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="previewSeen" /> I have read the workload preview
          </label>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">Save study preferences</Button>
        </div>
      </form>
    </Card>
  );
}
