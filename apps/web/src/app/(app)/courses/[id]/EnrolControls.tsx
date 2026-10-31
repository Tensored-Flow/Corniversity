"use client";
import { useActionState } from "react";
import { Badge, Button, Notice } from "@/components/ui";
import type { EnrolState } from "./actions";

type Action = (prev: EnrolState, formData: FormData) => Promise<EnrolState>;

const MODE_LABEL: Record<string, string> = {
  enrolled: "Enrolled",
  audit: "Auditing",
  reading_seminar: "Reading seminar",
};

export function EnrolControls({
  courseId,
  modesOffered,
  prepared,
  enrolment,
  enrolAction,
  withdrawAction,
}: {
  courseId: string;
  modesOffered: string[];
  prepared: boolean;
  enrolment: { id: string; mode: string; status: string } | null;
  enrolAction: Action;
  withdrawAction: Action;
}) {
  const [enrolState, enrolForm, enrolling] = useActionState(enrolAction, {} as EnrolState);
  const [withdrawState, withdrawForm, withdrawing] = useActionState(withdrawAction, {} as EnrolState);

  if (enrolment) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Badge tone="moss">{MODE_LABEL[enrolment.mode] ?? enrolment.mode}</Badge>
          <span className="text-ink-2">{enrolment.status === "paused" ? "paused" : "active"}</span>
        </div>
        <form action={withdrawForm}>
          <input type="hidden" name="enrolmentId" value={enrolment.id} />
          <input type="hidden" name="courseId" value={courseId} />
          <Button type="submit" variant="quiet" disabled={withdrawing}>
            {withdrawing ? "Withdrawing…" : "Withdraw"}
          </Button>
        </form>
        {withdrawState.error ? <Notice tone="rust">{withdrawState.error}</Notice> : null}
      </div>
    );
  }

  return (
    <form action={enrolForm} className="flex flex-col gap-3">
      <input type="hidden" name="courseId" value={courseId} />
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="sr-only">Mode</legend>
        {["enrolled", "audit", "reading_seminar"].map((mode) => {
          const offered = modesOffered.includes(mode);
          const disabled = !offered || (mode === "enrolled" && !prepared);
          return (
            <label key={mode} className={["flex items-start gap-2", disabled ? "text-ink-3" : "text-ink"].join(" ")}>
              <input
                type="radio"
                name="mode"
                value={mode}
                disabled={disabled}
                defaultChecked={!disabled && mode === (prepared ? "enrolled" : "audit")}
                className="mt-1 accent-[var(--brass)]"
              />
              <span>
                <span className="block font-medium">{MODE_LABEL[mode]}</span>
                <span className="block text-xs">
                  {mode === "enrolled" && "Full participation: sessions, assessed work, timetable, records."}
                  {mode === "audit" && "Read and attend without assessed work. Ignores prerequisites."}
                  {mode === "reading_seminar" && "A lighter reading-and-discussion rhythm alongside a core course."}
                  {!offered && " Not offered for this course."}
                  {offered && mode === "enrolled" && !prepared && " Available once the course has prepared units."}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {enrolState.error ? <Notice tone="rust">{enrolState.error}</Notice> : null}
      <Button type="submit" disabled={enrolling}>
        {enrolling ? "Saving…" : "Take this course"}
      </Button>
    </form>
  );
}
