import { and, eq, inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import type { DbOrTx } from "../client";
import {
  availabilityWindow,
  commitment,
  course,
  courseVersion,
  dayOff,
  learnerConceptOverride,
  learnerProfile,
  prerequisiteRule,
  programme,
  teachingUnit,
  term,
} from "../schema/index";
import type { OnboardingAnswers } from "../schema/learner";
import { getConceptStates } from "./evidence";

export interface PrerequisiteAssessment {
  ruleId: string;
  strength: "hard" | "soft" | "corequisite";
  description: string;
  satisfied: boolean;
  satisfiedBy: string | null; // label of the alternative that satisfied it
  basis: "evidence" | "self_report" | "none";
  /** Courses the rule names as alternatives or bridges, which would meet it. */
  alternativeCourseIds: string[];
}

/**
 * Prerequisite readiness is evidence-based: a rule is satisfied when some alternative group has
 * all its concepts `practised`/`demonstrated` by evidence, or self-reported known by the learner
 * (recorded as a provenance-bearing override and labelled "unverified" in the UI).
 */
export async function assessPrerequisites(db: DbOrTx, ownerId: string, courseId: string): Promise<PrerequisiteAssessment[]> {
  const rules = await db.select().from(prerequisiteRule).where(eq(prerequisiteRule.courseId, courseId));
  if (rules.length === 0) return [];
  const states = await getConceptStates(db, ownerId);
  const demonstrated = new Set(
    states.filter((s) => s.state.state === "demonstrated" || s.state.state === "practised").map((s) => s.concept.id),
  );
  const overrides = await db.select().from(learnerConceptOverride).where(eq(learnerConceptOverride.userId, ownerId));
  const selfKnown = new Set(overrides.filter((o) => o.claim === "known").map((o) => o.conceptId));
  return rules.map((rule) => {
    const alternativeCourseIds = [
      ...new Set(rule.alternatives.flatMap((a) => [...(a.courseIds ?? []), ...(a.bridgeCourseId ? [a.bridgeCourseId] : [])])),
    ];
    for (const alt of rule.alternatives) {
      if (alt.conceptIds.length > 0 && alt.conceptIds.every((c) => demonstrated.has(c))) {
        return {
          ruleId: rule.id,
          strength: rule.strength,
          description: rule.description,
          satisfied: true,
          satisfiedBy: alt.label,
          basis: "evidence",
          alternativeCourseIds,
        };
      }
    }
    for (const alt of rule.alternatives) {
      if (alt.conceptIds.length > 0 && alt.conceptIds.every((c) => demonstrated.has(c) || selfKnown.has(c))) {
        return {
          ruleId: rule.id,
          strength: rule.strength,
          description: rule.description,
          satisfied: true,
          satisfiedBy: `${alt.label} (self-reported, unverified)`,
          basis: "self_report",
          alternativeCourseIds,
        };
      }
    }
    return {
      ruleId: rule.id,
      strength: rule.strength,
      description: rule.description,
      satisfied: false,
      satisfiedBy: null,
      basis: "none",
      alternativeCourseIds,
    };
  });
}

export async function setConceptSelfReport(db: DbOrTx, ownerId: string, conceptIds: string[], known: boolean, note: string): Promise<void> {
  if (conceptIds.length === 0) return;
  await db
    .delete(learnerConceptOverride)
    .where(and(eq(learnerConceptOverride.userId, ownerId), inArray(learnerConceptOverride.conceptId, conceptIds)));
  await db
    .insert(learnerConceptOverride)
    .values(
      conceptIds.map((conceptId) => ({ userId: ownerId, conceptId, claim: known ? ("known" as const) : ("not_known" as const), note })),
    );
}

export interface CandidatePlan {
  id: string;
  title: string;
  description: string;
  courses: {
    courseId: string;
    title: string;
    role: "core" | "seminar" | "bridge" | "elective";
    mode: "enrolled" | "audit" | "reading_seminar";
    readiness: string;
    preparedUnits: number;
    totalUnits: number;
    typicalHours: number;
    prerequisites: PrerequisiteAssessment[];
  }[];
  estimatedWeeklyHours: { minimum: number; typical: number; maximum: number };
  warnings: string[];
}

type PlanMode = CandidatePlan["courses"][number]["mode"];

/**
 * The preferred mode when the course offers it (enrolled also needs prepared units), otherwise
 * the nearest lighter mode it does offer, so a plan never proposes a mode its course refuses.
 */
export function offeredMode(preferred: PlanMode, offered: readonly string[], preparedUnits: number): PlanMode {
  const order: Record<PlanMode, PlanMode[]> = {
    enrolled: ["enrolled", "reading_seminar", "audit"],
    reading_seminar: ["reading_seminar", "audit"],
    audit: ["audit", "reading_seminar"],
  };
  return order[preferred].find((m) => offered.includes(m) && (m !== "enrolled" || preparedUnits > 0)) ?? preferred;
}

/**
 * Deterministic candidate first-term plans from the learner's interests. The default is one
 * demanding core course plus a lighter seminar; heavier options are offered with their cost
 * stated. Only courses with prepared units can be taken as enrolled; others are offered as audit.
 * Every course is proposed in a mode it offers.
 */
export async function candidatePlans(
  db: DbOrTx,
  ownerId: string,
  answers: OnboardingAnswers,
  teachingWeeks = 10,
): Promise<CandidatePlan[]> {
  const interestIds = answers.interestCourseIds ?? [];
  const departmentIds = answers.departmentIds ?? [];
  const programmes = await db.select().from(programme);
  const versions = await db
    .select({ version: courseVersion, course })
    .from(courseVersion)
    .innerJoin(course, eq(courseVersion.courseId, course.id))
    .where(eq(courseVersion.isCurrent, true));
  const units = await db.select({ courseVersionId: teachingUnit.courseVersionId, status: teachingUnit.status }).from(teachingUnit);
  const info = new Map(
    versions.map((v) => {
      const mine = units.filter((u) => u.courseVersionId === v.version.id);
      return [v.course.id, { ...v, prepared: mine.filter((u) => u.status === "ready").length, total: mine.length }];
    }),
  );

  // Rank courses: explicit interest first, then launch courses in chosen departments, prepared before unprepared.
  const ranked = [...info.values()]
    .filter((c) => c.course.launch || interestIds.includes(c.course.id))
    .filter((c) => interestIds.includes(c.course.id) || departmentIds.length === 0 || departmentIds.includes(c.course.primaryDepartmentId))
    .sort((a, b) => {
      const ia = interestIds.includes(a.course.id) ? 0 : 1;
      const ib = interestIds.includes(b.course.id) ? 0 : 1;
      return ia - ib || b.prepared - a.prepared || a.course.id.localeCompare(b.course.id);
    });

  const describe = async (c: NonNullable<ReturnType<typeof info.get>>, role: CandidatePlan["courses"][number]["role"], mode: PlanMode) => ({
    courseId: c.course.id,
    title: c.course.title,
    role,
    mode: offeredMode(mode, c.version.modesOffered, c.prepared),
    readiness: c.version.readiness,
    preparedUnits: c.prepared,
    totalUnits: c.total,
    typicalHours: c.version.workload.typical,
    prerequisites: await assessPrerequisites(db, ownerId, c.course.id),
  });

  const hoursPerWeek = (courses: { typicalHours: number; mode: string }[]) => {
    const total = courses.reduce((acc, c) => acc + (c.mode === "enrolled" ? c.typicalHours : c.typicalHours * 0.4), 0);
    const typical = total / Math.max(1, teachingWeeks);
    return { minimum: Math.round(typical * 0.75), typical: Math.round(typical), maximum: Math.round(typical * 1.3) };
  };

  const plans: CandidatePlan[] = [];
  const prepared = ranked.filter((c) => c.prepared > 0);
  const core = prepared[0];
  const second = prepared[1] ?? ranked.find((c) => c !== core);

  if (core) {
    const courses = [await describe(core, "core", "enrolled")];
    if (second) courses.push(await describe(second, "seminar", second.prepared > 0 ? "reading_seminar" : "audit"));
    plans.push({
      id: "core-plus-seminar",
      title: "One core course and a lighter seminar",
      description:
        "The default first term: one demanding course taken in full, with a second subject read alongside at seminar pace. Enough to find out how the sources read and how tutorials feel before the load rises.",
      courses,
      estimatedWeeklyHours: hoursPerWeek(courses),
      warnings: courses.flatMap((c) =>
        c.prerequisites
          .filter((p) => !p.satisfied && p.strength === "hard")
          .map((p) => `${c.courseId}: unmet hard prerequisite (${p.description})`),
      ),
    });
  }
  if (prepared.length >= 2) {
    const courses = [await describe(prepared[0]!, "core", "enrolled"), await describe(prepared[1]!, "core", "enrolled")];
    plans.push({
      id: "two-cores",
      title: "Two core courses",
      description:
        "Two full courses at once. Heavier: expect two tutorials a week and two sets of assessed work. Choose this only if the weekly-hours preview below fits your availability.",
      courses,
      estimatedWeeklyHours: hoursPerWeek(courses),
      warnings: ["Heavier load; the timetable preview will say whether it fits your hours."].concat(
        courses.flatMap((c) =>
          c.prerequisites
            .filter((p) => !p.satisfied && p.strength === "hard")
            .map((p) => `${c.courseId}: unmet hard prerequisite (${p.description})`),
        ),
      ),
    });
  }
  if (core) {
    const courses = [await describe(core, "core", "reading_seminar")];
    plans.push({
      id: "reading-course",
      title: "A focused reading course",
      description:
        "One subject read carefully with no assessed work: lectures, readings and the tutor's office hours, at a rhythm you set. Good for a busy term or for curiosity-led study.",
      courses,
      estimatedWeeklyHours: hoursPerWeek(courses),
      warnings: [],
    });
  }
  // Named programme suggestion: a programme the learner chose, else one whose first stage
  // matches the course interests.
  const chosenProgrammes = answers.programmeIds ?? [];
  const ordered = [...programmes].sort((a, b) => Number(chosenProgrammes.includes(b.id)) - Number(chosenProgrammes.includes(a.id)));
  for (const p of ordered) {
    const first = p.stages[0];
    if (!first) continue;
    const ids = first.courses.map((c) => c.courseId);
    if (!chosenProgrammes.includes(p.id) && !ids.some((id) => interestIds.includes(id))) continue;
    const courses = [];
    for (const c of first.courses) {
      const inf = info.get(c.courseId);
      if (!inf) continue;
      courses.push(
        await describe(inf, c.role, c.role === "core" && inf.prepared > 0 ? "enrolled" : inf.prepared > 0 ? "reading_seminar" : "audit"),
      );
    }
    if (courses.length) {
      plans.push({
        id: `programme-${p.id}`,
        title: `${p.title}: first courses`,
        description: p.description,
        courses,
        estimatedWeeklyHours: hoursPerWeek(courses),
        warnings: courses
          .filter((c) => c.preparedUnits === 0)
          .map((c) => `${c.courseId} has no prepared units yet; offered as audit of its reading list only.`),
      });
    }
    break;
  }
  return plans;
}

/** Writes availability, commitments and days off from the onboarding answers (idempotent). */
export async function saveAvailability(db: DbOrTx, ownerId: string, answers: OnboardingAnswers): Promise<void> {
  await db.delete(availabilityWindow).where(eq(availabilityWindow.ownerId, ownerId));
  if (answers.availability?.length) {
    await db
      .insert(availabilityWindow)
      .values(answers.availability.map((a) => ({ ownerId, weekday: a.weekday, startMinute: a.startMinute, endMinute: a.endMinute })));
  }
  await db.delete(commitment).where(and(eq(commitment.ownerId, ownerId), eq(commitment.source, "onboarding_suggestion")));
  if (answers.commitments?.length) {
    await db.insert(commitment).values(
      answers.commitments.map((c) => ({
        ownerId,
        title: c.title,
        weekday: c.weekday,
        startMinute: c.startMinute,
        endMinute: c.endMinute,
        protected: c.protected,
        source: "onboarding_suggestion" as const,
      })),
    );
  }
  if (answers.weeklyHours) {
    await db
      .update(learnerProfile)
      .set({ weeklyHoursCeiling: answers.weeklyHours, studyRhythm: answers.rhythm })
      .where(eq(learnerProfile.userId, ownerId));
  }
}

export async function ensureTerm(db: DbOrTx, ownerId: string, answers: OnboardingAnswers, timezone: string) {
  const existing = await db
    .select()
    .from(term)
    .where(and(eq(term.ownerId, ownerId), inArray(term.status, ["planned", "active"])))
    .limit(1);
  if (existing[0]) return existing[0];
  const start = answers.termStart ? DateTime.fromISO(answers.termStart, { zone: timezone }) : nextMonday(timezone);
  // A learner who never chose a rhythm studies on a rolling basis. A rolling "term" is only the
  // planning horizon the scheduler fills; it has no reading or synthesis week and its end is not
  // a completion date (the timetable extends it as the learner goes).
  const rhythm = answers.rhythm ?? "rolling";
  const teachingWeeks = rhythm === "reading_course" ? 8 : 10;
  const [created] = await db
    .insert(term)
    .values({
      ownerId,
      title: `${rhythm === "term" ? "First term" : rhythm === "rolling" ? "Rolling study" : "Reading course"} from ${start.toFormat("d LLLL yyyy")}`,
      startDate: start.toISODate() ?? "",
      endDate:
        start
          .plus({ weeks: teachingWeeks + 2 })
          .minus({ days: 1 })
          .toISODate() ?? "",
      teachingWeeks,
      readingWeek: rhythm === "term",
      synthesisWeek: rhythm === "term",
      mode: rhythm,
      timezone,
      status: "planned",
    })
    .returning();
  return created!;
}

export function nextMonday(zone: string, from = DateTime.now().setZone(zone)): DateTime {
  const daysAhead = (8 - from.weekday) % 7 || 7;
  return from.plus({ days: daysAhead }).startOf("day");
}

export async function listDaysOff(db: DbOrTx, ownerId: string) {
  return db.select().from(dayOff).where(eq(dayOff.ownerId, ownerId));
}
