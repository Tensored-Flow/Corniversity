import { estimateWeeklyMinutes } from "@corniversity/core/scheduling/engine";
import { Input, Notice } from "@/components/ui";
import { saveTimeAction } from "../actions";
import { Fieldset, minutesToTime, StepFooter, type StepProps, WEEKDAYS } from "./shared";

/**
 * Known recurring commitments from 30 October 2026, offered as editable suggestions only.
 * They are never assumed current and never written to any external calendar.
 */
export const COMMITMENT_SUGGESTIONS = [
  { key: "algocourse", title: "Algocourse", weekday: 4, startMinute: 18 * 60, endMinute: 20 * 60 },
  { key: "badminton-sat", title: "Badminton", weekday: 6, startMinute: 19 * 60, endMinute: 22 * 60 },
  { key: "badminton-sun", title: "Badminton", weekday: 7, startMinute: 19 * 60, endMinute: 22 * 60 },
];

export function StepTime({ profile }: StepProps) {
  const answers = profile.onboardingAnswers;
  const availability = answers.availability ?? [];
  const commitments = answers.commitments ?? [];
  const weeklyHours = answers.weeklyHours ?? profile.weeklyHoursCeiling ?? 8;
  const freeMinutes = estimateWeeklyMinutes(
    availability.map((a) => ({ weekday: a.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7, startMinute: a.startMinute, endMinute: a.endMinute })),
    commitments.map((c, i) => ({
      id: String(i),
      title: c.title,
      weekday: c.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      startMinute: c.startMinute,
      endMinute: c.endMinute,
      protected: c.protected,
    })),
    10,
  );
  const usable = Math.min(freeMinutes, weeklyHours * 60);

  return (
    <form action={saveTimeAction} className="flex max-w-3xl flex-col gap-8">
      <Fieldset
        legend="Weekly availability"
        hint="Times you are usually free to study, in your timezone. Leave a day blank if it is not available. Sessions are placed inside these windows and nowhere else."
      >
        <div className="grid gap-2">
          {WEEKDAYS.map((d) => {
            const existing = availability.find((a) => a.weekday === d.value);
            return (
              <div key={d.value} className="grid grid-cols-[7rem_1fr_1fr] items-center gap-2 text-sm">
                <span className="text-ink">{d.label}</span>
                <label htmlFor={`start-${d.value}`} className="flex items-center gap-2">
                  <span className="sr-only">{d.label} start</span>
                  <Input
                    id={`start-${d.value}`}
                    type="time"
                    name={`start:${d.value}`}
                    defaultValue={existing ? minutesToTime(existing.startMinute) : ""}
                    step={900}
                  />
                </label>
                <label htmlFor={`end-${d.value}`} className="flex items-center gap-2">
                  <span className="sr-only">{d.label} end</span>
                  <Input
                    id={`end-${d.value}`}
                    type="time"
                    name={`end:${d.value}`}
                    defaultValue={existing ? minutesToTime(existing.endMinute) : ""}
                    step={900}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </Fieldset>

      <Fieldset
        legend="Fixed commitments"
        hint="Suggestions from what you mentioned on 30 October 2026; untick anything that has changed. Protected commitments are never scheduled over. Nothing here touches an external calendar."
      >
        <div className="grid gap-2">
          {COMMITMENT_SUGGESTIONS.map((c) => {
            const chosen = commitments.some((x) => x.title === c.title && x.weekday === c.weekday);
            return (
              <label
                key={c.key}
                className="flex items-center gap-3 rounded-[var(--radius-control)] border border-stone bg-paper-2 p-3 text-sm has-[:checked]:border-brass"
              >
                <input
                  type="checkbox"
                  name="suggested"
                  value={c.key}
                  defaultChecked={chosen || commitments.length === 0}
                  className="accent-[var(--brass)]"
                />
                <span className="text-ink">{c.title}</span>
                <span className="text-ink-3">
                  {WEEKDAYS.find((w) => w.value === c.weekday)?.label} {minutesToTime(c.startMinute)}–{minutesToTime(c.endMinute)}
                </span>
              </label>
            );
          })}
          {[0, 1].map((i) => {
            const custom = commitments.filter((c) => !COMMITMENT_SUGGESTIONS.some((s) => s.title === c.title && s.weekday === c.weekday))[
              i
            ];
            return (
              <div key={i} className="grid grid-cols-[1fr_7rem_6rem_6rem] items-center gap-2 text-sm">
                <Input name={`custom-title:${i}`} placeholder="Another commitment (optional)" defaultValue={custom?.title ?? ""} />
                <select
                  name={`custom-day:${i}`}
                  defaultValue={custom?.weekday ?? ""}
                  className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-2"
                >
                  <option value="">Day</option>
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label.slice(0, 3)}
                    </option>
                  ))}
                </select>
                <Input type="time" name={`custom-start:${i}`} defaultValue={custom ? minutesToTime(custom.startMinute) : ""} />
                <Input type="time" name={`custom-end:${i}`} defaultValue={custom ? minutesToTime(custom.endMinute) : ""} />
              </div>
            );
          })}
        </div>
      </Fieldset>

      <Fieldset legend="Weekly workload ceiling" hint="The timetable never plans more than this per week, even when more time is free.">
        <div className="flex items-center gap-3">
          <label htmlFor="weeklyHours" className="sr-only">
            Weekly workload ceiling in hours
          </label>
          <Input id="weeklyHours" type="number" name="weeklyHours" min={2} max={40} step={1} defaultValue={weeklyHours} className="w-28" />
          <span className="text-sm text-ink-2">hours a week</span>
        </div>
      </Fieldset>

      <Notice tone="neutral" title="What this buys">
        {availability.length === 0 ? (
          <span>Add some availability and continue; the preview updates when you return to this step.</span>
        ) : (
          <span>
            About {Math.round(freeMinutes / 60)} free hours a week after commitments, capped at {weeklyHours} ⇒ roughly{" "}
            {Math.round(usable / 60)} usable hours. A prepared unit of a demanding course takes about 4 hours, so a ten-week term fits about{" "}
            {Math.floor(((usable / 60) * 10) / 4)} units, or one full course plus a reading seminar at the default pace.
          </span>
        )}
      </Notice>

      <StepFooter step={5} />
    </form>
  );
}
