import { withinExamTime } from "@corniversity/core/exams/exam";
import { getUnitDetail } from "@corniversity/db/services/catalogue";
import { getEnrolmentForCourse } from "@corniversity/db/services/enrolment";
import { runningExams } from "@corniversity/db/services/exams";
import { type ProblemStatus, problemSheet } from "@corniversity/db/services/sheets";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, Button, LinkButton } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { startUnitWorkAction } from "../actions";

const STATUS: Record<ProblemStatus, { label: string; tone: "neutral" | "brass" | "moss" | "slate" }> = {
  not_started: { label: "not started", tone: "neutral" },
  in_progress: { label: "in progress", tone: "slate" },
  submitted: { label: "submitted", tone: "brass" },
  accepted: { label: "accepted", tone: "moss" },
};

/** A unit's problems, each with where you stand; opening one starts or resumes its work. */
export default async function ProblemSheetPage({ params }: { params: Promise<{ id: string; unitId: string }> }) {
  const { id, unitId } = await params;
  const session = await requireSession(`/courses/${id}/units/${unitId}/sheet`);
  const detail = await getUnitDetail(db(), unitId);
  if (!detail || detail.course.id !== id) notFound();
  if (!(await getEnrolmentForCourse(db(), session.user.id, id))) redirect(`/courses/${id}`);
  if (detail.unit.status !== "ready") redirect(`/courses/${id}/units/${unitId}`);
  const problems = await problemSheet(db(), session.user.id, unitId);
  const heldBy = new Map(
    (await runningExams(db(), session.user.id))
      .filter((x) => withinExamTime(x.deadlineAt))
      .flatMap((x) => x.exerciseIds.map((exerciseId) => [exerciseId, x.id] as const)),
  );
  const done = problems.filter((p) => p.status === "submitted" || p.status === "accepted").length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-3">
        <Link href={`/courses/${id}`} className="hover:text-ink">
          {detail.course.title}
        </Link>
        <span className="mx-2">/</span>
        <span>Unit {detail.unit.sequence}</span>
      </nav>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl text-ink">Problem sheet</h1>
          <p className="mt-1 text-sm text-ink-2">
            {detail.unit.title} · {done}/{problems.length} done
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/courses/${id}/units/${unitId}`} variant="secondary">
            Notes
          </LinkButton>
          <form action={startUnitWorkAction}>
            <input type="hidden" name="unitId" value={unitId} />
            <input type="hidden" name="courseId" value={id} />
            <Button type="submit" variant="secondary">
              Tutorial
            </Button>
          </form>
        </div>
      </header>

      <ol className="flex flex-col divide-y divide-stone rounded-[var(--radius-panel)] border border-stone bg-paper-2">
        {problems.map((p, i) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <span className="w-6 font-mono text-xs text-ink-3">{i + 1}</span>
            <span className="min-w-0 flex-1 text-ink">
              {p.title}{" "}
              <span className="text-xs text-ink-3">
                · {p.kind.replace(/_/g, " ")} · ~{p.estimatedMinutes} min
              </span>
            </span>
            <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
            {p.inExam ? <Badge tone="slate">in an exam</Badge> : null}
            {heldBy.has(p.id) ? (
              <LinkButton href={`/exams/${heldBy.get(p.id)}`} variant="secondary">
                Go to exam
              </LinkButton>
            ) : (
              <form action={startUnitWorkAction}>
                <input type="hidden" name="unitId" value={unitId} />
                <input type="hidden" name="courseId" value={id} />
                <input type="hidden" name="exerciseId" value={p.id} />
                <Button type="submit" variant={p.status === "not_started" ? "primary" : "quiet"}>
                  {p.status === "not_started" ? "Start" : "Open"}
                </Button>
              </form>
            )}
          </li>
        ))}
      </ol>
      {problems.length === 0 ? <p className="mt-3 text-sm text-ink-2">This unit has no problems.</p> : null}
    </div>
  );
}
