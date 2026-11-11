import { withinExamTime } from "@corniversity/core/exams/exam";
import { getCourseDetail } from "@corniversity/db/services/catalogue";
import { closeIfExpired, ExamError, examView } from "@corniversity/db/services/exams";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { DateTime } from "luxon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { Badge, Card, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { examGrader } from "@/lib/exam-grader";
import { renderMarkdown } from "@/lib/markdown";
import { requireSession } from "@/lib/session";
import { ExamPaper } from "./ExamPaper";

const pct = (score: number) => `${Math.round(score * 100)}%`;

/** A running exam (countdown and answers), or once submitted its marking, scores and worked solutions. */
export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const session = await requireSession(`/exams/${id}`);
  const ownerId = session.user.id;
  let view: Awaited<ReturnType<typeof examView>>;
  try {
    view = await examView(db(), ownerId, id);
  } catch (error) {
    if (error instanceof ExamError) notFound();
    throw error;
  }
  // Past its deadline and grace, the exam submits what was saved.
  if (view.exam.status === "in_progress" && !withinExamTime(view.exam.deadlineAt)) {
    await closeIfExpired(db(), ownerId, id, await examGrader(ownerId));
    view = await examView(db(), ownerId, id);
  }
  const detail = await getCourseDetail(db(), view.exam.courseId);
  const courseTitle = detail?.course.title ?? view.exam.courseId;
  const header = (
    <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-3">
      <Link href={`/courses/${view.exam.courseId}`} className="hover:text-ink">
        {courseTitle}
      </Link>
      <span className="mx-2">/</span>
      <span>Exam</span>
    </nav>
  );

  if (view.exam.status === "in_progress") {
    const questions = await Promise.all(
      view.questions.map(async (q) => ({
        number: q.number,
        exerciseId: q.exerciseId,
        title: q.title,
        unit: `Unit ${q.unit.sequence}`,
        promptHtml: await renderMarkdown(q.promptMarkdown),
        answer: q.answer,
      })),
    );
    return (
      <div className="mx-auto w-full max-w-3xl">
        {header}
        <h1 className="text-3xl text-ink">Exam</h1>
        <p className="mt-1 text-sm text-ink-2">
          {questions.length} question{questions.length === 1 ? "" : "s"} · {view.exam.durationMinutes} min · closed book. Answers save as
          you type.
        </p>
        <ExamPaper examId={view.exam.id} deadlineAt={view.exam.deadlineAt.toISOString()} serverNow={Date.now()} questions={questions} />
      </div>
    );
  }

  const r = view.result!;
  const zone = (await ensureProfile(db(), ownerId)).timezone;
  return (
    <div className="mx-auto w-full max-w-3xl">
      {header}
      <header className="mb-6">
        <h1 className="text-3xl text-ink">Exam results</h1>
        <p className="mt-1 text-sm text-ink-2">
          {DateTime.fromJSDate(view.exam.startedAt).setZone(zone).toFormat("d LLL yyyy, HH:mm")} · {r.questions} question
          {r.questions === 1 ? "" : "s"} · {view.exam.durationMinutes} min
          {view.exam.submittedBy === "deadline" ? " · submitted when time ran out" : ""}
        </p>
        <p className="mt-3 text-2xl text-ink" data-testid="exam-score">
          {r.score !== null ? `Score ${pct(r.score)}` : `${r.marked} of ${r.questions - r.unanswered} answers marked`}
        </p>
        {r.awaiting > 0 ? (
          <p className="mt-1 text-xs text-ink-3">
            Marking needs a connected teacher. Without one, answers stay unmarked; nothing is invented.
          </p>
        ) : null}
      </header>
      <ol className="flex flex-col gap-4">
        {view.questions.map((q) => (
          <li key={q.exerciseId}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg text-ink">
                  {q.number}. {q.title}
                </h2>
                {q.outcome.kind === "marked" ? (
                  <Badge tone="moss">{pct(q.outcome.score)}</Badge>
                ) : q.outcome.kind === "unanswered" ? (
                  <Badge tone="rust">not answered · 0%</Badge>
                ) : q.outcome.kind === "unscored" ? (
                  <Badge>marked · no criterion applied</Badge>
                ) : (
                  <Badge>awaiting marking</Badge>
                )}
              </div>
              <div className="mt-2 text-sm">
                <Markdown source={q.promptMarkdown} />
              </div>
              {q.submitted ? (
                <details className="mt-3" open>
                  <summary className="cursor-pointer text-sm text-ink">Your answer</summary>
                  <div className="mt-2 rounded-[var(--radius-control)] border border-stone bg-paper p-3 text-sm">
                    <Markdown source={q.submitted} />
                  </div>
                </details>
              ) : null}
              {q.run?.feedback ? (
                <div className="mt-3 text-sm">
                  <p className="text-ink">{q.run.feedback.summary}</p>
                  {q.run.feedback.checks.length > 0 ? (
                    <ul className="mt-1 list-disc pl-5 text-ink-2">
                      {q.run.feedback.checks.map((c) => (
                        <li key={c.criterionId}>
                          {c.status.replace("_", " ")}
                          {c.comment ? `: ${c.comment}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {q.solution ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-ink">Worked solution</summary>
                  <div className="mt-2 text-sm">
                    <Markdown source={q.solution} />
                  </div>
                </details>
              ) : (
                <p className="mt-3 text-xs text-ink-3">No worked solution is released for this problem.</p>
              )}
            </Card>
          </li>
        ))}
      </ol>
      {view.questions.length === 0 ? <Notice tone="neutral">This exam has no questions.</Notice> : null}
    </div>
  );
}
