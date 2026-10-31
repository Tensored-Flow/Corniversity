import { concept, course, courseVersion, learnerConceptOverride, prerequisiteRule } from "@corniversity/db/schema/index";
import { listDepartments } from "@corniversity/db/services/catalogue";
import { eq, inArray } from "drizzle-orm";
import { Notice, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { saveKnowledgeAction } from "../actions";
import { Fieldset, StepFooter, type StepProps } from "./shared";

export async function StepKnowledge({ userId, profile }: StepProps) {
  const answers = profile.onboardingAnswers;
  const departmentIds = answers.departmentIds ?? [];
  const interestIds = answers.interestCourseIds ?? [];
  const departments = (await listDepartments(db())).filter((d) => departmentIds.includes(d.id));

  // Concepts worth self-reporting: recommended concepts and prerequisite-rule concepts of the chosen courses.
  const versions = interestIds.length ? await db().select().from(courseVersion).where(inArray(courseVersion.courseId, interestIds)) : [];
  const rules = interestIds.length ? await db().select().from(prerequisiteRule).where(inArray(prerequisiteRule.courseId, interestIds)) : [];
  const conceptIds = new Set<string>();
  for (const v of versions.filter((v) => v.isCurrent)) for (const c of v.recommendedConceptIds) conceptIds.add(c);
  for (const r of rules) for (const alt of r.alternatives) for (const c of alt.conceptIds) conceptIds.add(c);
  const concepts = conceptIds.size
    ? await db()
        .select()
        .from(concept)
        .where(inArray(concept.id, [...conceptIds]))
    : [];
  const overrides = await db().select().from(learnerConceptOverride).where(eq(learnerConceptOverride.userId, userId));
  const known = new Set(overrides.filter((o) => o.claim === "known").map((o) => o.conceptId));
  const courses = interestIds.length ? await db().select().from(course).where(inArray(course.id, interestIds)) : [];

  return (
    <form action={saveKnowledgeAction} className="flex max-w-3xl flex-col gap-8">
      <Notice tone="slate">
        Nothing here is a test. Self-reports are recorded as such and shown as <em>unverified</em> until your work demonstrates them. An
        Imperial background is not assumed to mean mastery, and it is not assumed to mean gaps either.
      </Notice>

      {departments.length === 0 ? <p className="text-sm text-ink-2">No departments chosen yet; go back one step to choose some.</p> : null}
      {departments.map((d) => (
        <Fieldset
          key={d.id}
          legend={`${d.title}: what you already know`}
          hint="Courses taken, books read, topics you can do from memory. Free text; be as honest as you like."
        >
          <label htmlFor={`prior-${d.id}`} className="sr-only">{`${d.title}: what you already know`}</label>
          <Textarea
            id={`prior-${d.id}`}
            name={`prior:${d.id}`}
            rows={3}
            defaultValue={answers.priorKnowledge?.[d.id] ?? ""}
            className="min-h-20"
          />
        </Fieldset>
      ))}

      {concepts.length > 0 ? (
        <Fieldset
          legend="Concepts you can already work with"
          hint={`Drawn from the prerequisites and recommended background of ${courses.map((c) => c.id).join(", ")}. Tick what you can do today; leave the rest.`}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {concepts
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((c) => (
                <label
                  key={c.id}
                  className="flex items-start gap-3 rounded-[var(--radius-control)] border border-stone bg-paper-2 p-3 text-sm has-[:checked]:border-moss"
                >
                  <input
                    type="checkbox"
                    name="knownConceptIds"
                    value={c.id}
                    defaultChecked={known.has(c.id)}
                    className="mt-1 accent-[var(--moss)]"
                  />
                  <span>
                    <span className="block text-ink">{c.title}</span>
                    <span className="block text-xs text-ink-3">{c.description}</span>
                  </span>
                </label>
              ))}
          </div>
          <input type="hidden" name="allConceptIds" value={concepts.map((c) => c.id).join(",")} />
        </Fieldset>
      ) : null}

      <StepFooter step={3} />
    </form>
  );
}
