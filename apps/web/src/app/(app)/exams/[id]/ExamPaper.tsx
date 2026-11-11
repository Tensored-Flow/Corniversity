"use client";
import { useEffect, useRef, useState } from "react";
import { RenderedHtml } from "@/components/RenderedHtml";
import { Button } from "@/components/ui";
import { saveExamAnswerAction, submitExamAction } from "../actions";

interface Question {
  number: number;
  exerciseId: string;
  title: string;
  unit: string;
  promptHtml: string;
  answer: string;
}

function remaining(deadline: number, now: number): string {
  const s = Math.max(0, Math.floor((deadline - now) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * The running exam: a countdown, one answer box per question (saved as you type), and Submit.
 * The countdown follows the server's clock (`serverNow` at render), not the device's. Before any
 * submission, answers still waiting to save are saved; at zero, what was saved is submitted.
 */
export function ExamPaper({
  examId,
  deadlineAt,
  serverNow,
  questions,
}: {
  examId: string;
  deadlineAt: string;
  serverNow: number;
  questions: Question[];
}) {
  const deadline = Date.parse(deadlineAt);
  // Server time minus device time, measured once when the paper opens.
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(() => Date.now() + offset);
  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries(questions.map((q) => [q.exerciseId, q.answer])));
  const [saved, setSaved] = useState<Record<string, "saved" | "saving" | string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, string>>({});
  const submitForm = useRef<HTMLFormElement>(null);
  const reason = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [offset]);

  function save(exerciseId: string, text: string): Promise<void> {
    clearTimeout(timers.current[exerciseId]);
    delete pending.current[exerciseId];
    setSaved((s) => ({ ...s, [exerciseId]: "saving" }));
    return saveExamAnswerAction(examId, exerciseId, text).then((r) =>
      setSaved((s) => ({ ...s, [exerciseId]: r.ok ? "saved" : (r.error ?? "Not saved.") })),
    );
  }

  function change(exerciseId: string, text: string) {
    setAnswers((a) => ({ ...a, [exerciseId]: text }));
    clearTimeout(timers.current[exerciseId]);
    pending.current[exerciseId] = text;
    timers.current[exerciseId] = setTimeout(() => void save(exerciseId, text), 1200);
  }

  async function submit(by: "learner" | "deadline") {
    if (submitting.current) return;
    submitting.current = true;
    await Promise.all(Object.entries(pending.current).map(([id, text]) => save(id, text)));
    if (reason.current) reason.current.value = by;
    submitForm.current?.requestSubmit();
  }

  useEffect(() => {
    if (now >= deadline) void submit("deadline");
  });

  const left = deadline - now;
  const warning = left <= 60_000 ? "One minute left." : left <= 5 * 60_000 ? "Five minutes left." : "";
  return (
    <div>
      <div
        className={`sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-stone bg-paper py-3 ${warning ? "text-rust" : "text-ink"}`}
      >
        <span className="font-mono text-lg" role="timer" aria-label="Time left" suppressHydrationWarning>
          {remaining(deadline, now)}
        </span>
        <span className="sr-only" role="status">
          {warning}
        </span>
        <form ref={submitForm} action={submitExamAction}>
          <input type="hidden" name="examId" value={examId} />
          <input ref={reason} type="hidden" name="reason" defaultValue="learner" />
          <Button
            type="button"
            onClick={() => {
              if (window.confirm("Submit the exam now? Answers can't change afterwards.")) void submit("learner");
            }}
          >
            Submit exam
          </Button>
        </form>
      </div>
      <ol className="flex flex-col gap-6">
        {questions.map((q) => (
          <li key={q.exerciseId} className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4">
            <p className="text-xs text-ink-3">
              Question {q.number} · {q.unit}
            </p>
            <h2 className="mt-1 text-lg text-ink">{q.title}</h2>
            <RenderedHtml html={q.promptHtml} className="mt-2 text-sm" />
            <label htmlFor={`answer-${q.exerciseId}`} className="sr-only">
              Answer to question {q.number}
            </label>
            <textarea
              id={`answer-${q.exerciseId}`}
              value={answers[q.exerciseId] ?? ""}
              onChange={(e) => change(q.exerciseId, e.target.value)}
              onBlur={(e) => {
                if (q.exerciseId in pending.current) void save(q.exerciseId, e.target.value);
              }}
              rows={10}
              spellCheck={false}
              placeholder="Your answer. Markdown and LaTeX work."
              className="mt-3 w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-2 font-mono text-sm text-ink focus-visible:outline-2 focus-visible:outline-focus"
            />
            <p className="mt-1 text-xs text-ink-3" aria-live="polite">
              {saved[q.exerciseId] === "saving" ? "Saving…" : saved[q.exerciseId] === "saved" ? "Saved" : (saved[q.exerciseId] ?? "")}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
