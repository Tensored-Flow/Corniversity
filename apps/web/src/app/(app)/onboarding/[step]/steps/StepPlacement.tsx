import { concept, course } from "@corniversity/db/schema/index";
import { assessPrerequisites } from "@corniversity/db/services/programme";
import { inArray } from "drizzle-orm";
import { Badge, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { savePlacementAction } from "../actions";
import { Fieldset, StepFooter, type StepProps } from "./shared";

export async function StepPlacement({ userId, profile }: StepProps) {
  const interestIds = profile.onboardingAnswers.interestCourseIds ?? [];
  const courses = interestIds.length ? await db().select().from(course).where(inArray(course.id, interestIds)) : [];
  const assessments = await Promise.all(courses.map(async (c) => ({ course: c, rules: await assessPrerequisites(db(), userId, c.id) })));
  const conceptIds = new Set<string>();
  const { prerequisiteRule } = await import("@corniversity/db/schema/index");
  const rules = interestIds.length ? await db().select().from(prerequisiteRule).where(inArray(prerequisiteRule.courseId, interestIds)) : [];
  for (const r of rules) for (const alt of r.alternatives) for (const c of alt.conceptIds) conceptIds.add(c);
  const concepts = conceptIds.size
    ? await db()
        .select()
        .from(concept)
        .where(inArray(concept.id, [...conceptIds]))
    : [];
  const conceptTitle = (id: string) => concepts.find((c) => c.id === id)?.title ?? id;

  return (
    <form action={savePlacementAction} className="flex max-w-3xl flex-col gap-8">
      <Notice tone="slate" title="Why these checks exist">
        Each prerequisite below is there because a course assumes it on day one. Nothing is a gate except the rare hard prerequisites, and
        even those can be audited. If you skip a check, readiness is simply marked unverified; you can still start, and your first tutorials
        will show what is true.
      </Notice>
      {assessments.length === 0 ? <p className="text-sm text-ink-2">No courses chosen yet.</p> : null}
      {assessments.map(({ course: c, rules: rs }) => (
        <Fieldset key={c.id} legend={`${c.id} ${c.title}`}>
          {rs.length === 0 ? <p className="text-sm text-ink-2">No prerequisites recorded for this course.</p> : null}
          {rs.map((r) => {
            const rule = rules.find((x) => x.id === r.ruleId);
            return (
              <div key={r.ruleId} className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.strength === "hard" ? "rust" : "neutral"}>{r.strength}</Badge>
                  {r.satisfied ? (
                    <Badge tone={r.basis === "evidence" ? "moss" : "brass"}>
                      {r.basis === "evidence" ? "demonstrated" : "self-reported, unverified"}
                    </Badge>
                  ) : (
                    <Badge>unverified</Badge>
                  )}
                </div>
                <p className="mt-2 text-ink-2">{r.description}</p>
                {r.satisfied ? (
                  <p className="mt-1 text-xs text-ink-3">Satisfied by: {r.satisfiedBy}</p>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    <p className="text-xs text-ink-3">Ways to satisfy it:</p>
                    {rule?.alternatives.map((alt, i) => (
                      <label
                        key={i}
                        className="flex items-start gap-3 rounded-[var(--radius-control)] border border-stone bg-paper p-2 has-[:checked]:border-brass"
                      >
                        <input type="radio" name={`rule:${r.ruleId}`} value={String(i)} className="mt-1 accent-[var(--brass)]" />
                        <span>
                          <span className="block text-ink">{alt.label}</span>
                          {alt.conceptIds.length ? (
                            <span className="block text-xs text-ink-3">
                              I can do this today: {alt.conceptIds.map(conceptTitle).join("; ")} (recorded as self-reported, unverified)
                            </span>
                          ) : null}
                          {alt.courseIds.length ? (
                            <span className="block text-xs text-ink-3">Take {alt.courseIds.join(", ")} first or alongside.</span>
                          ) : null}
                          {alt.bridgeCourseId ? (
                            <span className="block text-xs text-ink-3">Or the targeted bridge {alt.bridgeCourseId}.</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                    <label className="flex items-center gap-3 rounded-[var(--radius-control)] border border-dashed border-stone-2 p-2 text-ink-2">
                      <input type="radio" name={`rule:${r.ruleId}`} value="skip" defaultChecked className="accent-[var(--brass)]" />
                      Skip for now; leave readiness unverified
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </Fieldset>
      ))}
      <input type="hidden" name="ruleIds" value={rules.map((r) => r.id).join(",")} />
      <StepFooter step={7} continueLabel="Continue to plans" />
    </form>
  );
}
