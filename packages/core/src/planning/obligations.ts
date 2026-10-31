import type { StudyPreferences } from "./preferences";

/**
 * Three different things that a timetable used to blur, kept apart here:
 *
 * 1. Content sequence: what to study before what (units and prerequisites). It has no dates.
 * 2. Study appointments: when the learner intends to read, attend a tutorial or try a problem.
 *    Missing one is a scheduling fact. It never produces an academic consequence.
 * 3. Academic deadlines: when assessed work is due, only if the learner chose deadlines (or
 *    examinations). Only these can be late, and only when they are binding.
 */

export type AppointmentOutcome = "upcoming" | "in_progress" | "completed" | "attempted" | "cancelled" | "passed_unmarked";

export function appointmentOutcome(appointment: { startsAt: string; endsAt: string; status: string }, now: string): AppointmentOutcome {
  if (appointment.status === "completed") return "completed";
  if (appointment.status === "attempted") return "attempted";
  if (appointment.status === "cancelled" || appointment.status === "moved") return "cancelled";
  if (Date.parse(appointment.endsAt) <= Date.parse(now)) return "passed_unmarked";
  if (Date.parse(appointment.startsAt) <= Date.parse(now)) return "in_progress";
  return "upcoming";
}

export const APPOINTMENT_LABEL: Record<AppointmentOutcome, string> = {
  upcoming: "planned",
  in_progress: "now",
  completed: "done",
  attempted: "attempted",
  cancelled: "cancelled",
  passed_unmarked: "passed without a mark (no consequence; reschedule if you like)",
};

export type DeadlineKind = "assessment" | "examination" | "milestone";

export interface Deadline {
  id: string;
  kind: DeadlineKind;
  dueAt: string;
  /** Milestones are never binding; assessment and examination deadlines are binding when chosen. */
  binding: boolean;
  status: "open" | "met" | "withdrawn";
  metAt?: string | null;
}

export type DeadlineOutcome = "open" | "met" | "met_after_due" | "passed" | "withdrawn";

export function deadlineOutcome(deadline: Deadline, now: string): DeadlineOutcome {
  if (deadline.status === "withdrawn") return "withdrawn";
  if (deadline.status === "met") {
    return deadline.metAt && Date.parse(deadline.metAt) > Date.parse(deadline.dueAt) ? "met_after_due" : "met";
  }
  return Date.parse(deadline.dueAt) <= Date.parse(now) ? "passed" : "open";
}

/** Whether the learner may create a deadline of this kind under their preferences. */
export function deadlineAllowed(
  kind: DeadlineKind,
  prefs: Pick<StudyPreferences, "hardDeadlines" | "examinations">,
): { allowed: boolean; reason?: string } {
  if (kind === "milestone") return { allowed: true };
  if (kind === "assessment" && !prefs.hardDeadlines)
    return { allowed: false, reason: "Hard deadlines are off. Turn them on in Settings if you want binding due dates." };
  if (kind === "examination" && !prefs.examinations)
    return { allowed: false, reason: "Examinations are off. Turn them on in Settings if you want them." };
  return { allowed: true };
}

export interface AcademicConsequence {
  deadlineId: string;
  kind: DeadlineKind;
  outcome: "passed" | "met_after_due";
}

/**
 * The only academic consequences the system records: binding deadlines of a kind the learner
 * has switched on, that passed unmet or were met after the due time. Appointments are not an
 * input at all, so a missed reading appointment cannot become an overdue penalty.
 */
export function academicConsequences(
  deadlines: readonly Deadline[],
  prefs: Pick<StudyPreferences, "hardDeadlines" | "examinations">,
  now: string,
): AcademicConsequence[] {
  const out: AcademicConsequence[] = [];
  for (const d of deadlines) {
    if (!d.binding || d.kind === "milestone") continue;
    if (d.kind === "assessment" && !prefs.hardDeadlines) continue;
    if (d.kind === "examination" && !prefs.examinations) continue;
    const outcome = deadlineOutcome(d, now);
    if (outcome === "passed" || outcome === "met_after_due") out.push({ deadlineId: d.id, kind: d.kind, outcome });
  }
  return out;
}

/**
 * The planning window for rolling study. It is a horizon that moves with the learner, not a
 * completion date: when fewer than `extendWithinWeeks` remain it extends by `horizonWeeks`.
 */
export function rollingHorizon(
  start: string,
  now: string,
  horizonWeeks: number,
  extendWithinWeeks = 2,
): { horizonEnd: string; shouldExtend: boolean; weeksRemaining: number } {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const end = startMs + horizonWeeks * 7 * 86_400_000;
  const remainingWeeks = (end - Date.parse(now)) / (7 * 86_400_000);
  return {
    horizonEnd: new Date(end).toISOString().slice(0, 10),
    shouldExtend: remainingWeeks < extendWithinWeeks,
    weeksRemaining: Math.max(0, Math.floor(remainingWeeks)),
  };
}
