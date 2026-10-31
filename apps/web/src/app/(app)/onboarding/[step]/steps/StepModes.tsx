import { course, courseVersion, teachingUnit } from "@corniversity/db/schema/index";
import { inArray } from "drizzle-orm";
import { Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { saveModesAction } from "../actions";
import { Fieldset, StepFooter, type StepProps } from "./shared";

const MODES = [
  { value: "enrolled", title: "Enrolled", body: "Lectures, tutorials, assessed work, timetable and records. Needs prepared units." },
  { value: "audit", title: "Audit", body: "Readings and lectures without assessed work. Ignores prerequisites." },
  {
    value: "reading_seminar",
    title: "Reading seminar",
    body: "Reading-led, lighter rhythm alongside a core course; office hours available.",
  },
] as const;

export async function StepModes({ profile }: StepProps) {
  const chosen = profile.onboardingAnswers.chosenPlan;
  if (!chosen) {
    return <Notice tone="rust">Choose a plan first (step 8).</Notice>;
  }
  const ids = chosen.courses.map((c) => c.courseId);
  const courses = await db().select().from(course).where(inArray(course.id, ids));
  const versions = await db().select().from(courseVersion).where(inArray(courseVersion.courseId, ids));
  const units = versions.length
    ? await db()
        .select({ v: teachingUnit.courseVersionId, status: teachingUnit.status })
        .from(teachingUnit)
        .where(
          inArray(
            teachingUnit.courseVersionId,
            versions.filter((v) => v.isCurrent).map((v) => v.id),
          ),
        )
    : [];
  const modes = profile.onboardingAnswers.modes ?? {};
  return (
    <form action={saveModesAction} className="flex max-w-3xl flex-col gap-8">
      {chosen.courses.map((c) => {
        const row = courses.find((x) => x.id === c.courseId);
        const version = versions.find((v) => v.courseId === c.courseId && v.isCurrent);
        const prepared = version ? units.filter((u) => u.v === version.id && u.status === "ready").length : 0;
        const current = modes[c.courseId] ?? c.mode;
        return (
          <Fieldset
            key={c.courseId}
            legend={`${c.courseId} ${row?.title ?? ""}`}
            hint={
              prepared > 0
                ? `${prepared} prepared unit(s); any mode is possible.`
                : "No prepared units yet: enrolment is not offered until the course is prepared."
            }
          >
            <div className="grid gap-2 sm:grid-cols-3">
              {MODES.map((m) => {
                const offered = version?.modesOffered.includes(m.value) ?? false;
                const disabled = !offered || (m.value === "enrolled" && prepared === 0);
                return (
                  <label
                    key={m.value}
                    className={[
                      "flex items-start gap-3 rounded-[var(--radius-control)] border border-stone bg-paper-2 p-3 text-sm has-[:checked]:border-brass",
                      disabled ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name={`mode:${c.courseId}`}
                      value={m.value}
                      defaultChecked={!disabled && current === m.value}
                      disabled={disabled}
                      className="mt-1 accent-[var(--brass)]"
                    />
                    <span>
                      <span className="block font-medium text-ink">{m.title}</span>
                      <span className="block text-xs text-ink-3">{m.body}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Fieldset>
        );
      })}
      <StepFooter step={9} continueLabel="Build the timetable" />
    </form>
  );
}
