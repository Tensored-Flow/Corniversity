import { listDepartments } from "@corniversity/db/services/catalogue";
import { db } from "@/lib/db";
import { saveStyleAction } from "../actions";
import { Fieldset, StepFooter, type StepProps } from "./shared";

const STYLES = [
  { value: "proof_led", title: "Proof-led", body: "Definitions, theorems, proofs; examples after the structure is in place." },
  { value: "conceptual", title: "Conceptual", body: "Ideas and pictures first; formal detail when it is needed to settle a question." },
  { value: "computational", title: "Computational", body: "Compute, simulate, then explain what the computation shows." },
  { value: "experimental", title: "Experimental / data-led", body: "Start from data and measurements; build models to explain them." },
  { value: "mixed", title: "Mixed", body: "Let the tutor choose the representation that fits the question." },
] as const;

export async function StepStyle({ profile }: StepProps) {
  const departmentIds = profile.onboardingAnswers.departmentIds ?? [];
  const departments = (await listDepartments(db())).filter((d) => departmentIds.includes(d.id));
  return (
    <form action={saveStyleAction} className="flex max-w-3xl flex-col gap-8">
      <p className="text-sm text-ink-2">
        Chosen per subject, not as a permanent label. Tutors adapt the representation they reach for first; rigour is never reduced.
      </p>
      {departments.map((d) => (
        <Fieldset key={d.id} legend={d.title}>
          <div className="grid gap-2 sm:grid-cols-2">
            {STYLES.map((s) => (
              <label
                key={s.value}
                className="flex items-start gap-3 rounded-[var(--radius-control)] border border-stone bg-paper-2 p-3 text-sm has-[:checked]:border-brass"
              >
                <input
                  type="radio"
                  name={`style:${d.id}`}
                  value={s.value}
                  defaultChecked={(profile.learningStyles[d.id] ?? "mixed") === s.value}
                  className="mt-1 accent-[var(--brass)]"
                />
                <span>
                  <span className="block font-medium text-ink">{s.title}</span>
                  <span className="block text-xs text-ink-3">{s.body}</span>
                </span>
              </label>
            ))}
          </div>
        </Fieldset>
      ))}
      <StepFooter step={4} />
    </form>
  );
}
