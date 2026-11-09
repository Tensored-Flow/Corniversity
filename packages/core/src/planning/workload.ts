import type { Activity, ActivityType } from "../domain/course";

/**
 * What a course's workload consists of, shown before enrolment. The weekly figure comes from the
 * course's whole estimate, which counts independent work; the breakdown comes from the activities
 * of the units that are prepared, so the learner sees that most of the time is reading, problems,
 * laboratories and written work done alone, not appointments on a timetable.
 */
export type WorkCategory = "reading" | "problems" | "laboratory" | "writing" | "explaining" | "discussion";

export const WORK_CATEGORY_LABEL: Record<WorkCategory, string> = {
  reading: "reading and lectures",
  problems: "problems and proofs",
  laboratory: "laboratories",
  writing: "written work and projects",
  explaining: "explaining back and retrieval",
  discussion: "discussion",
};

const CATEGORY: Record<ActivityType, WorkCategory> = {
  reading: "reading",
  lecture: "reading",
  worked_example: "problems",
  problem: "problems",
  proof_workshop: "problems",
  lab: "laboratory",
  project: "writing",
  explain_back: "explaining",
  retrieval_practice: "explaining",
  discussion: "discussion",
};

/** Work done alone, beyond reading: problems, laboratories and writing. */
const INDEPENDENT: readonly WorkCategory[] = ["problems", "laboratory", "writing"];

export interface WorkloadBreakdown {
  preparedUnits: number;
  totalUnits: number;
  /** Planned minutes per category across the prepared units. */
  minutes: Record<WorkCategory, number>;
  preparedHours: number;
  /** Share of the prepared minutes that is independent work (problems, laboratories, writing). */
  independentShare: number;
  /** The course estimate spread over ten weeks; null when the syllabus is not prepared. */
  weeklyHours: number | null;
}

export function workloadBreakdown(
  units: readonly { status: string; activities: readonly Pick<Activity, "type" | "estimatedMinutes">[] }[],
  courseTypicalHours: number,
): WorkloadBreakdown {
  const minutes: Record<WorkCategory, number> = { reading: 0, problems: 0, laboratory: 0, writing: 0, explaining: 0, discussion: 0 };
  const prepared = units.filter((u) => u.status === "ready");
  for (const unit of prepared) for (const a of unit.activities) minutes[CATEGORY[a.type]] += a.estimatedMinutes;
  const total = Object.values(minutes).reduce((s, m) => s + m, 0);
  const independent = INDEPENDENT.reduce((s, c) => s + minutes[c], 0);
  return {
    preparedUnits: prepared.length,
    totalUnits: units.length,
    minutes,
    preparedHours: Math.round((total / 60) * 10) / 10,
    independentShare: total ? Math.round((independent / total) * 100) / 100 : 0,
    weeklyHours: prepared.length ? Math.round((courseTypicalHours / 10) * 10) / 10 : null,
  };
}
