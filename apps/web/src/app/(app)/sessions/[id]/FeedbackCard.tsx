import { modelLabel } from "@corniversity/ai";
import type { AssessmentRunRow } from "@corniversity/db/services/learning";
import { Markdown } from "@/components/Markdown";
import { Badge } from "@/components/ui";
import type { ActionResult } from "./actions";
import { ReviewForm } from "./ReviewForm";

interface Review {
  id: string;
  kind: string;
  learnerNote: string;
  status: string;
  createdAt: Date;
}

interface Props {
  version: number;
  submittedAt: Date;
  contentMarkdown: string;
  run: AssessmentRunRow | null;
  /** The exercise's rubric version now, to say when this submission was assessed against an earlier one. */
  currentRubricVersion: number;
  reviews: Review[];
  fileReview: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  /**
   * Paper work: the transcription version this feedback read, the latest version now, and the page
   * each line of the transcription is on, so the first gap points at a page.
   */
  paper?: { transcriptionVersion: number; latestTranscriptionVersion: number; pageOfLine: Record<number, number> };
}

const VERDICT: Record<string, { label: string; tone: "moss" | "rust" | "slate" }> = {
  accepted: { label: "Accepted", tone: "moss" },
  revision_requested: { label: "Revision requested", tone: "rust" },
  needs_review: { label: "Needs review", tone: "slate" },
};

function confidenceWords(c: number | null): string {
  if (c === null) return "confidence not recorded";
  if (c >= 0.8) return `assessor confidence high (${c.toFixed(2)})`;
  if (c >= 0.6) return `assessor confidence moderate (${c.toFixed(2)})`;
  return `assessor confidence low (${c.toFixed(2)}): treat as provisional`;
}

/** One immutable submission version with its assessment. Instructor reasoning never appears here. */
export async function FeedbackCard({
  version,
  submittedAt,
  contentMarkdown,
  run,
  currentRubricVersion,
  reviews,
  fileReview,
  paper,
}: Props) {
  const verdict = run?.verdict ? VERDICT[run.verdict] : null;
  const fb = run?.feedback ?? null;
  const live = run?.graderConfig.provider !== "fixture";
  return (
    <article className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-5">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg text-ink">Submission v{version}</h3>
        <span className="text-xs text-ink-3">{submittedAt.toLocaleString("en-GB", { timeZone: "Europe/London" })}</span>
        {run?.status === "queued" || run?.status === "reviewing" ? <Badge tone="brass">being assessed</Badge> : null}
        {run?.status === "failed" ? <Badge tone="rust">assessment failed</Badge> : null}
        {verdict ? <Badge tone={verdict.tone}>{verdict.label}</Badge> : null}
        {paper ? <Badge>paper work · transcription v{paper.transcriptionVersion}</Badge> : null}
        {run ? (
          <Badge tone={live ? "slate" : "neutral"}>
            {live ? `AI assessor · ${modelLabel(run.graderConfig.model)}` : "Scripted demo assessor: no model read this"}
          </Badge>
        ) : null}
      </header>

      {paper && paper.latestTranscriptionVersion > paper.transcriptionVersion ? (
        <p className="mt-2 text-xs text-ink-3">
          This feedback read transcription v{paper.transcriptionVersion}. You have corrected the transcription since (now v
          {paper.latestTranscriptionVersion}); submit a revision for feedback on the corrected reading.
        </p>
      ) : null}

      {run?.exerciseSnapshot && run.exerciseSnapshot.rubricVersion !== currentRubricVersion ? (
        <div className="mt-2 text-sm">
          <p className="text-xs text-ink-3">
            Assessed against version {run.exerciseSnapshot.rubricVersion} of this exercise; it has since been revised (now version{" "}
            {currentRubricVersion}).
          </p>
          <details className="mt-1">
            <summary className="cursor-pointer text-ink-2">Show the exercise as you answered it</summary>
            <div className="mt-2 rounded-[var(--radius-control)] border border-stone bg-paper p-3">
              <Markdown source={run.exerciseSnapshot.promptMarkdown} />
            </div>
          </details>
        </div>
      ) : null}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-2">Show this version of the attempt</summary>
        <div className="mt-2 rounded-[var(--radius-control)] border border-stone bg-paper p-3">
          <Markdown source={contentMarkdown} />
        </div>
      </details>

      {run?.deterministicResults.length ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-ink-3">Automatic checks (advisory)</p>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {run.deterministicResults.map((d) => (
              <li key={d.checkId} className="flex items-start gap-2">
                <span className={d.passed ? "text-moss" : "text-rust"} aria-hidden="true">
                  {d.passed ? "✓" : "✗"}
                </span>
                <span className="text-ink-2">
                  <span className="sr-only">{d.passed ? "passed:" : "not passed:"}</span> {d.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {run?.status === "failed" ? (
        <p className="mt-4 text-sm text-rust">
          The assessment could not run: {run.error}. Your attempt is safe; try submitting again later or configure a provider in Settings.
        </p>
      ) : null}

      {fb ? (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-3">Assessment · {confidenceWords(run?.confidence ?? null)}</p>
            <div className="mt-1">
              <Markdown source={fb.summary} />
            </div>
          </div>
          {fb.firstGap ? (
            <div className="rounded-[var(--radius-control)] border border-rust/40 bg-rust-soft/40 p-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-rust">
                First substantive gap · line {fb.firstGap.line}
                {paper?.pageOfLine[fb.firstGap.line] ? ` · page ${paper.pageOfLine[fb.firstGap.line]}` : ""}
              </p>
              <p className="mt-1 font-mono text-xs text-ink-2">“{fb.firstGap.excerpt}”</p>
              <div className="mt-1">
                <Markdown source={fb.firstGap.issue} />
              </div>
            </div>
          ) : null}
          {fb.checks.length ? (
            <table className="w-full text-sm">
              <caption className="sr-only">Rubric criteria</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-3">
                  <th className="py-1 pr-3 font-medium">Criterion</th>
                  <th className="py-1 pr-3 font-medium">Status</th>
                  <th className="py-1 font-medium">Comment</th>
                </tr>
              </thead>
              <tbody>
                {fb.checks.map((c) => (
                  <tr key={c.criterionId} className="border-t border-stone align-top">
                    <td className="py-1.5 pr-3 font-mono text-xs text-ink-2">{c.criterionId}</td>
                    <td className="py-1.5 pr-3">
                      <Badge
                        tone={
                          c.status === "met" ? "moss" : c.status === "partially_met" ? "brass" : c.status === "not_met" ? "rust" : "neutral"
                        }
                      >
                        {c.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-1.5 text-ink-2">{c.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {fb.strengths.length ? (
            <div className="text-sm">
              <p className="text-xs uppercase tracking-wide text-ink-3">What holds</p>
              <ul className="mt-1 list-disc pl-5 text-ink-2">
                {fb.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="text-sm">
            <p className="text-xs uppercase tracking-wide text-ink-3">Next step</p>
            <div className="mt-1">
              <Markdown source={fb.nextStep} />
            </div>
          </div>
          {fb.alternateApproachRecognised ? (
            <p className="text-xs text-ink-3">
              The assessor recognised an approach different from the reference; the reference is not exhaustive.
            </p>
          ) : null}
          {fb.citations.length ? (
            <p className="text-xs text-ink-3">Evidence used: {fb.citations.map((c) => `${c.tag} ${c.label}`).join("; ")}</p>
          ) : null}
          <div className="border-t border-stone pt-3">
            {reviews.length ? (
              <ul className="mb-3 flex flex-col gap-1 text-xs text-ink-2">
                {reviews.map((r) => (
                  <li key={r.id}>
                    <Badge tone={r.status === "open" ? "brass" : "neutral"}>{r.kind.replace("_", " ")}</Badge> {r.learnerNote}
                  </li>
                ))}
              </ul>
            ) : null}
            {run ? <ReviewForm assessmentRunId={run.id} action={fileReview} /> : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
