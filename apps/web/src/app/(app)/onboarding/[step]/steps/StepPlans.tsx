import { candidatePlans } from "@corniversity/db/services/programme";
import { ReadinessBadge } from "@/components/Readiness";
import { Badge, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { choosePlanAction } from "../actions";
import { StepFooter, type StepProps } from "./shared";

export async function StepPlans({ userId, profile }: StepProps) {
  const answers = profile.onboardingAnswers;
  const plans = await candidatePlans(db(), userId, answers, answers.rhythm === "reading_course" ? 8 : 10);
  const weeklyHours = answers.weeklyHours ?? profile.weeklyHoursCeiling ?? 8;

  return (
    <form action={choosePlanAction} className="flex max-w-3xl flex-col gap-6">
      <p className="text-sm text-ink-2">
        Candidate first terms built from your interests and the courses that are actually prepared. Workload is an estimate from each
        course's own figures; the next step builds the real timetable and says whether it fits your {weeklyHours} hours a week.
      </p>
      {plans.length === 0 ? (
        <Notice tone="neutral" title="No plan can be built yet">
          None of the courses you chose has prepared units. Go back and add a prepared course (the catalogue marks them "Teaching ready"),
          or continue with an audit-only reading course from the catalogue later.
        </Notice>
      ) : null}
      <div className="flex flex-col gap-4">
        {plans.map((p, i) => (
          <label
            key={p.id}
            className="block cursor-pointer rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-5 has-[:checked]:border-brass has-[:checked]:bg-brass-soft/30"
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="planId"
                value={p.id}
                defaultChecked={answers.chosenPlanId ? answers.chosenPlanId === p.id : i === 0}
                className="mt-1.5 accent-[var(--brass)]"
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg text-ink">{p.title}</h2>
                  {i === 0 ? <Badge tone="brass">default</Badge> : null}
                  <span className="text-xs text-ink-3">
                    about {p.estimatedWeeklyHours.typical} h/week ({p.estimatedWeeklyHours.minimum}–{p.estimatedWeeklyHours.maximum})
                  </span>
                  {p.estimatedWeeklyHours.typical > weeklyHours ? <Badge tone="rust">over your ceiling</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-ink-2">{p.description}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {p.courses.map((c) => (
                    <li key={c.courseId} className="rounded-[var(--radius-control)] border border-stone bg-paper p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-ink-3">{c.courseId}</span>
                        <span className="text-ink">{c.title}</span>
                        <Badge>{c.role}</Badge>
                        <Badge tone="brass">{c.mode.replace("_", " ")}</Badge>
                        <ReadinessBadge readiness={c.readiness} />
                      </div>
                      <p className="mt-1 text-xs text-ink-3">
                        {c.preparedUnits} of {c.totalUnits} units prepared · about {c.typicalHours} hours over the course
                      </p>
                      {c.prerequisites.length ? (
                        <ul className="mt-1 text-xs">
                          {c.prerequisites.map((r) => (
                            <li key={r.ruleId} className={r.satisfied ? "text-moss" : r.strength === "hard" ? "text-rust" : "text-ink-3"}>
                              {r.satisfied ? "✓" : "○"} {r.strength} prerequisite: {r.description}{" "}
                              {r.satisfied
                                ? `(${r.basis === "evidence" ? "demonstrated" : "self-reported, unverified"})`
                                : "(unverified; audit is always possible)"}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {p.warnings.length ? (
                  <ul className="mt-2 list-disc pl-5 text-xs text-rust">
                    {p.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </label>
        ))}
      </div>
      <StepFooter step={8} continueLabel="Choose this plan" />
    </form>
  );
}
