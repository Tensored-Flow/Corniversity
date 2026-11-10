import { getCourseDetail } from "@corniversity/db/services/catalogue";
import { listPreparations, MAX_BUFFER_UNITS, PREPARATION_BUDGET_CEILING_USD } from "@corniversity/db/services/preparation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { errorNotice } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import { createPreparationAction } from "../../../preparations/actions";

/**
 * Asking for a course to be prepared: the learner's goal and preferences and a finite budget.
 * Submitting creates a proposal only; nothing runs, is spent or is enrolled until it is confirmed.
 */
export default async function PreparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const auth = await requireSession(`/courses/${id}/prepare`);
  const detail = await getCourseDetail(db(), id);
  if (!detail) notFound();
  const outlined = detail.units.filter((u) => u.status !== "ready");
  const previous = await listPreparations(db(), auth.user.id, id);
  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="text-sm uppercase tracking-[0.18em] text-brass">Course preparation</p>
      <h1 className="mt-1 text-3xl text-ink">
        {detail.course.id} {detail.course.title}
      </h1>
      <p className="mt-2 max-w-prose text-sm text-ink-2">
        {detail.units.length} units in the syllabus, {detail.units.length - outlined.length} prepared, {outlined.length} outlined.
        Preparation inspects the course's verified sources, maps its concepts and prerequisites, lists what you would need to obtain, and
        can draft the next outlined units with a live model for you to read and publish. It never enrols you and never replaces a prepared
        lesson.
      </p>
      {error ? (
        <div className="mt-4">
          <Notice tone="rust">{errorNotice(error)}</Notice>
        </div>
      ) : null}
      {previous.length ? (
        <Card className="mt-5">
          <h2 className="text-lg text-ink">Earlier requests for this course</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {previous.map((p) => (
              <li key={p.id}>
                <Link href={`/preparations/${p.id}`} className="text-brass underline underline-offset-4">
                  {p.createdAt.toISOString().slice(0, 10)}: {p.status.replace(/_/g, " ")}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {detail.units.length === 0 ? (
        <Card className="mt-5">
          <p className="text-sm text-ink-2">
            This course has no syllabus yet, so there is no outlined unit to draft. Its sources are still leads; a syllabus comes first.
          </p>
        </Card>
      ) : outlined.length === 0 ? (
        <Card className="mt-5">
          <p className="text-sm text-ink-2">Every unit of this course is prepared; there is nothing to draft.</p>
        </Card>
      ) : (
        <Card className="mt-5">
          <form action={createPreparationAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="courseId" value={detail.course.id} />
            <div className="sm:col-span-2">
              <Field label="What you want from this course" htmlFor="goal">
                <Textarea
                  id="goal"
                  name="goal"
                  rows={3}
                  required
                  minLength={10}
                  placeholder="e.g. study it seriously from the textbook, with a weekly problem class"
                />
              </Field>
            </div>
            <Field label="Depth" htmlFor="depth">
              <Select id="depth" name="depth" defaultValue="rigorous">
                <option value="survey">A survey</option>
                <option value="standard">Standard</option>
                <option value="rigorous">Rigorous (proofs and derivations in full)</option>
              </Select>
            </Field>
            <Field label="Hours a week for this course" htmlFor="weeklyHours">
              <Input id="weeklyHours" name="weeklyHours" type="number" min={1} max={40} defaultValue={5} />
            </Field>
            <Field label="Balance" htmlFor="balance">
              <Select id="balance" name="balance" defaultValue="balanced">
                <option value="more_lecture">More lecture-style explanation</option>
                <option value="balanced">Balanced</option>
                <option value="more_reading">More reading from the sources</option>
              </Select>
            </Field>
            <Field label="Assessment" htmlFor="assessment">
              <Select id="assessment" name="assessment" defaultValue="feedback">
                <option value="none">None: practice only</option>
                <option value="feedback">Feedback on submitted work</option>
                <option value="self_test">Self-tests</option>
              </Select>
            </Field>
            <Field label="Sources you prefer (optional)" htmlFor="preferredSources">
              <Input id="preferredSources" name="preferredSources" placeholder="a textbook or lecture series" />
            </Field>
            <Field label="Materials you already have (optional)" htmlFor="materials">
              <Input id="materials" name="materials" placeholder="e.g. a library copy of the textbook" />
            </Field>
            <Field label={`Units to prepare now (1 to ${Math.min(MAX_BUFFER_UNITS, outlined.length)})`} htmlFor="bufferUnits">
              <Input
                id="bufferUnits"
                name="bufferUnits"
                type="number"
                min={1}
                max={Math.min(MAX_BUFFER_UNITS, outlined.length)}
                defaultValue={1}
              />
            </Field>
            <Field label={`Budget for this preparation (USD, at most $${PREPARATION_BUDGET_CEILING_USD})`} htmlFor="budgetUsd">
              <Input
                id="budgetUsd"
                name="budgetUsd"
                type="number"
                step="0.01"
                min={0.01}
                max={PREPARATION_BUDGET_CEILING_USD}
                defaultValue={2}
              />
            </Field>
            <p className="text-xs text-ink-3 sm:col-span-2">
              The budget is a ceiling for this preparation's model runs; each run is also checked against your own limits before it starts.
              Without an approved live model, the deterministic stages still run and drafting is reported as blocked, with nothing invented
              in its place. Preparation runs only when you confirm it; nothing is prepared in the background.
            </p>
            <div className="sm:col-span-2">
              <Button type="submit">See the proposal</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
