/**
 * Scheduling is deterministic application logic. Models may propose priorities; this module
 * owns date arithmetic, clashes and hour totals. All wall-clock inputs are in the learner's
 * IANA time zone; all outputs carry UTC instants.
 */

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface AvailabilityWindow {
  weekday: Weekday;
  startMinute: number; // minutes after local midnight
  endMinute: number;
}

export interface Commitment {
  id: string;
  title: string;
  /** Recurring weekly when set; one-off when `date` is set instead. */
  weekday?: Weekday;
  date?: string; // ISO date in the learner's zone
  startMinute: number;
  endMinute: number;
  protected: boolean;
}

export interface TermTemplate {
  /** ISO date of the first teaching day (the engine aligns weeks to this date). */
  startDate: string;
  teachingWeeks: number;
  readingWeek: boolean;
  synthesisWeek: boolean;
}

export type SessionKind = "lecture" | "tutorial" | "problem_class" | "seminar" | "lab" | "revision" | "oral" | "project";

export interface PlanActivity {
  /** Unique within the plan: `${unitId}:${activityId}`. */
  key: string;
  enrolmentId: string;
  courseId: string;
  unitId: string;
  unitSequence: number;
  activityId: string;
  title: string;
  sessionKind: SessionKind;
  estimatedMinutes: number;
  /** Keys that must be fully scheduled before this activity may start. */
  dependsOn: string[];
  /** Zero-based teaching week before which this activity should not be scheduled. */
  earliestWeek: number;
}

export interface PlanCourse {
  enrolmentId: string;
  courseId: string;
  title: string;
  /** 1 is highest. Ties broken by course id for determinism. */
  priority: number;
  activities: PlanActivity[];
}

export interface SchedulerInput {
  timezone: string;
  term: TermTemplate;
  availability: AvailabilityWindow[];
  commitments: Commitment[];
  daysOff: string[]; // ISO dates
  courses: PlanCourse[];
  weeklyCapMinutes: number;
  preferredSessionMinutes: number;
  minSessionMinutes: number;
  breakMinutes: number;
  /** Minimum gap between an activity and anything that depends on it (default 18 hours: next day). */
  minDependencyGapMinutes?: number;
  /** Maximum planned minutes on one calendar day (default 180). */
  dailyCapMinutes?: number;
  /** Nothing is scheduled before this instant (ISO). Defaults to the term start. */
  notBefore?: string;
  /** Existing future sessions to keep in place when they still fit (limits churn on re-planning). */
  pinned?: PinnedSession[];
}

export interface PinnedSession {
  uid: string;
  startsAt: string;
  endsAt: string;
}

export interface ScheduledSessionPlan {
  uid: string;
  key: string;
  enrolmentId: string;
  courseId: string;
  unitId: string;
  activityId: string;
  title: string;
  sessionKind: SessionKind;
  startsAt: string; // ISO UTC
  endsAt: string;
  weekIndex: number;
  part: number;
  parts: number;
  minutes: number;
}

export interface WeekSummary {
  weekIndex: number;
  weekStart: string; // ISO date
  label: string; // "Teaching week 3", "Reading week", "Synthesis week"
  availableMinutes: number;
  capMinutes: number;
  plannedMinutes: number;
}

export interface UnplacedActivity {
  key: string;
  title: string;
  minutes: number;
  reason: string;
}

export interface ScheduleResult {
  sessions: ScheduledSessionPlan[];
  unplaced: UnplacedActivity[];
  weekly: WeekSummary[];
  totals: { requiredMinutes: number; plannedMinutes: number; availableMinutes: number };
  feasible: boolean;
  shortfallMinutes: number;
  explanations: string[];
  suggestions: string[];
}

export interface PlanDiff {
  added: ScheduledSessionPlan[];
  removed: ScheduledSessionPlan[];
  moved: { from: ScheduledSessionPlan; to: ScheduledSessionPlan }[];
  unchanged: number;
}
