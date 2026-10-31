import {
  type AcademicConsequence,
  academicConsequences,
  applyPreferenceChange,
  checkCourseLoad,
  type DeadlineKind,
  deadlineAllowed,
  type ExplicitStudyPreferences,
  explicitKeys,
  type LoadCheck,
  resolveStudyPreferences,
  type StudyPreferences,
} from "@corniversity/core";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { academicDeadline, auditEvent, courseVersion, enrolment, learnerProfile, unitExercise } from "../schema/index";

/**
 * Study preferences, load and academic deadlines. Only explicit choices are stored; the
 * defaults (rolling study, one main and one lighter course, appointments on, no deadlines or
 * examinations) are applied in code, so changing a default never rewrites anyone's choice.
 */

export class StudyError extends Error {}

export async function getStudyPreferences(
  db: DbOrTx,
  ownerId: string,
): Promise<{ preferences: StudyPreferences; explicit: (keyof StudyPreferences)[] }> {
  const [profile] = await db
    .select({ studyPreferences: learnerProfile.studyPreferences, studyRhythm: learnerProfile.studyRhythm })
    .from(learnerProfile)
    .where(eq(learnerProfile.userId, ownerId))
    .limit(1);
  return {
    preferences: resolveStudyPreferences(profile?.studyPreferences, profile?.studyRhythm),
    explicit: explicitKeys(profile?.studyPreferences, profile?.studyRhythm),
  };
}

/**
 * Applies the learner's own change. The older single rhythm field is kept in step so that
 * nothing reading it sees a different answer. Choosing term mode changes nothing else.
 */
export async function updateStudyPreferences(db: DbOrTx, ownerId: string, change: ExplicitStudyPreferences): Promise<StudyPreferences> {
  const [profile] = await db
    .select({ studyPreferences: learnerProfile.studyPreferences, studyRhythm: learnerProfile.studyRhythm })
    .from(learnerProfile)
    .where(eq(learnerProfile.userId, ownerId))
    .limit(1);
  if (!profile) throw new StudyError("Profile not found.");
  const base: ExplicitStudyPreferences = { ...(profile.studyRhythm ? { rhythm: profile.studyRhythm } : {}), ...profile.studyPreferences };
  let next: ExplicitStudyPreferences;
  try {
    next = applyPreferenceChange(base, change);
  } catch (error) {
    throw new StudyError((error as Error).message);
  }
  await db
    .update(learnerProfile)
    .set({ studyPreferences: next, ...(next.rhythm ? { studyRhythm: next.rhythm } : {}) })
    .where(eq(learnerProfile.userId, ownerId));
  await db.insert(auditEvent).values({
    ownerId,
    actor: "learner",
    action: "study-preferences:update",
    entity: "learner_profile",
    entityId: ownerId,
    details: { change },
  });
  return resolveStudyPreferences(next);
}

export interface ActiveLoad {
  main: number;
  exploratory: number;
  /** Rough weekly hours of the active courses, at the same rate the plan preview uses. */
  weeklyHours: number;
}

/** Main courses are taken in full; audits and reading seminars count as lighter courses. */
export async function activeLoad(db: DbOrTx, ownerId: string): Promise<ActiveLoad> {
  const rows = await db
    .select({ mode: enrolment.mode, workload: courseVersion.workload })
    .from(enrolment)
    .innerJoin(courseVersion, eq(enrolment.courseVersionId, courseVersion.id))
    .where(and(eq(enrolment.ownerId, ownerId), eq(enrolment.status, "active")));
  return {
    main: rows.filter((r) => r.mode === "enrolled").length,
    exploratory: rows.filter((r) => r.mode !== "enrolled").length,
    weeklyHours: Math.round(rows.reduce((h, r) => h + (r.mode === "enrolled" ? r.workload.typical : r.workload.typical * 0.4) / 10, 0)),
  };
}

export interface LoadPreview extends LoadCheck {
  current: ActiveLoad;
  addedWeeklyHours: number;
  totalWeeklyHours: number;
  weeklyHoursCeiling: number | null;
}

/** The workload preview shown before a course beyond the chosen load is added. */
export async function previewCourseLoad(
  db: DbOrTx,
  ownerId: string,
  courseTypicalHours: number,
  mode: "enrolled" | "audit" | "reading_seminar",
): Promise<LoadPreview> {
  const { preferences } = await getStudyPreferences(db, ownerId);
  const current = await activeLoad(db, ownerId);
  const [profile] = await db
    .select({ ceiling: learnerProfile.weeklyHoursCeiling })
    .from(learnerProfile)
    .where(eq(learnerProfile.userId, ownerId))
    .limit(1);
  const added = Math.round((mode === "enrolled" ? courseTypicalHours : courseTypicalHours * 0.4) / 10);
  return {
    ...checkCourseLoad(preferences, current, mode === "enrolled" ? "main" : "exploratory"),
    current,
    addedWeeklyHours: added,
    totalWeeklyHours: current.weeklyHours + added,
    weeklyHoursCeiling: profile?.ceiling ?? null,
  };
}

/** Records that the learner read the workload preview before taking on a heavier load. */
export async function recordLoadPreviewSeen(db: DbOrTx, ownerId: string): Promise<void> {
  const [profile] = await db
    .select({ studyPreferences: learnerProfile.studyPreferences })
    .from(learnerProfile)
    .where(eq(learnerProfile.userId, ownerId))
    .limit(1);
  await db
    .update(learnerProfile)
    .set({ studyPreferences: { ...(profile?.studyPreferences ?? {}), heavierLoadPreviewedAt: new Date().toISOString() } })
    .where(eq(learnerProfile.userId, ownerId));
}

export type DeadlineRow = typeof academicDeadline.$inferSelect;

export async function listDeadlines(db: DbOrTx, ownerId: string): Promise<DeadlineRow[]> {
  return db.select().from(academicDeadline).where(eq(academicDeadline.ownerId, ownerId)).orderBy(asc(academicDeadline.dueAt));
}

/**
 * Creates a deadline the learner chose. Assessment and examination deadlines need those modes
 * switched on and are binding; milestones are always allowed and never binding. Nothing in the
 * system creates a deadline on the learner's behalf.
 */
export async function createDeadline(
  db: DbOrTx,
  ownerId: string,
  input: { kind: DeadlineKind; title: string; dueAt: Date; enrolmentId?: string; exerciseId?: string },
): Promise<DeadlineRow> {
  const { preferences } = await getStudyPreferences(db, ownerId);
  const allowed = deadlineAllowed(input.kind, preferences);
  if (!allowed.allowed) throw new StudyError(allowed.reason ?? "Not allowed.");
  if (!input.title.trim()) throw new StudyError("Give the deadline a title.");
  if (Number.isNaN(input.dueAt.getTime())) throw new StudyError("Give a valid due date.");
  if (input.enrolmentId) {
    if (!isUuid(input.enrolmentId)) throw new StudyError("Unknown course.");
    const [own] = await db
      .select({ id: enrolment.id })
      .from(enrolment)
      .where(and(eq(enrolment.id, input.enrolmentId), eq(enrolment.ownerId, ownerId)))
      .limit(1);
    if (!own) throw new StudyError("Unknown course.");
  }
  if (input.exerciseId) {
    const [ex] = await db.select({ id: unitExercise.id }).from(unitExercise).where(eq(unitExercise.id, input.exerciseId)).limit(1);
    if (!ex) throw new StudyError("Unknown exercise.");
  }
  const [row] = await db
    .insert(academicDeadline)
    .values({
      ownerId,
      kind: input.kind,
      title: input.title.trim().slice(0, 200),
      dueAt: input.dueAt,
      binding: input.kind !== "milestone",
      enrolmentId: input.enrolmentId ?? null,
      exerciseId: input.exerciseId ?? null,
    })
    .returning();
  return row!;
}

export async function withdrawDeadline(db: DbOrTx, ownerId: string, deadlineId: string): Promise<void> {
  if (!isUuid(deadlineId)) return;
  await db
    .update(academicDeadline)
    .set({ status: "withdrawn" })
    .where(and(eq(academicDeadline.id, deadlineId), eq(academicDeadline.ownerId, ownerId)));
}

/** A submission for an exercise meets the open deadlines attached to it. */
export async function markDeadlinesMet(db: DbOrTx, ownerId: string, exerciseId: string, at = new Date()): Promise<void> {
  await db
    .update(academicDeadline)
    .set({ status: "met", metAt: at })
    .where(and(eq(academicDeadline.ownerId, ownerId), eq(academicDeadline.exerciseId, exerciseId), eq(academicDeadline.status, "open")));
}

/** The academic consequences the learner's own deadline choices produce now; appointments never appear. */
export async function academicStatus(db: DbOrTx, ownerId: string, now = new Date()): Promise<AcademicConsequence[]> {
  const { preferences } = await getStudyPreferences(db, ownerId);
  const rows = await listDeadlines(db, ownerId);
  return academicConsequences(
    rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      dueAt: r.dueAt.toISOString(),
      binding: r.binding,
      status: r.status,
      metAt: r.metAt?.toISOString() ?? null,
    })),
    preferences,
    now.toISOString(),
  );
}

/** Exercises of the learner's active courses, for choosing what a deadline is attached to. */
export async function deadlineTargets(db: DbOrTx, ownerId: string) {
  const enrolled = await db
    .select({ enrolmentId: enrolment.id, courseId: courseVersion.courseId, versionId: courseVersion.id })
    .from(enrolment)
    .innerJoin(courseVersion, eq(enrolment.courseVersionId, courseVersion.id))
    .where(and(eq(enrolment.ownerId, ownerId), eq(enrolment.status, "active")));
  if (enrolled.length === 0) return [];
  const { teachingUnit } = await import("../schema/index");
  const current = await db
    .select({ id: courseVersion.id, courseId: courseVersion.courseId })
    .from(courseVersion)
    .where(
      and(
        inArray(
          courseVersion.courseId,
          enrolled.map((e) => e.courseId),
        ),
        eq(courseVersion.isCurrent, true),
      ),
    );
  const exercises = current.length
    ? await db
        .select({ id: unitExercise.id, title: unitExercise.title, versionId: teachingUnit.courseVersionId, status: teachingUnit.status })
        .from(unitExercise)
        .innerJoin(teachingUnit, eq(unitExercise.unitId, teachingUnit.id))
        .where(
          inArray(
            teachingUnit.courseVersionId,
            current.map((c) => c.id),
          ),
        )
    : [];
  return enrolled.map((e) => ({
    enrolmentId: e.enrolmentId,
    courseId: e.courseId,
    exercises: exercises
      .filter((x) => x.status === "ready" && current.find((c) => c.id === x.versionId)?.courseId === e.courseId)
      .map((x) => ({ id: x.id, title: x.title })),
  }));
}

export interface SequencePosition {
  enrolmentId: string;
  courseId: string;
  courseTitle: string;
  mode: string;
  preparedUnits: number;
  totalUnits: number;
  /** The first prepared unit, in course order, that has no completed session yet. */
  nextUnit: { id: string; title: string; sequence: number } | null;
}

/**
 * Content sequence: where the learner is in each course's order of units. It has no dates; it
 * answers "what comes next", while appointments answer "when".
 */
export async function contentSequence(db: DbOrTx, ownerId: string): Promise<SequencePosition[]> {
  const { course, learningSession, teachingUnit } = await import("../schema/index");
  const rows = await db
    .select({ enrolmentId: enrolment.id, mode: enrolment.mode, courseId: course.id, courseTitle: course.title })
    .from(enrolment)
    .innerJoin(courseVersion, eq(enrolment.courseVersionId, courseVersion.id))
    .innerJoin(course, eq(courseVersion.courseId, course.id))
    .where(and(eq(enrolment.ownerId, ownerId), eq(enrolment.status, "active")));
  if (rows.length === 0) return [];
  const current = await db
    .select({ id: courseVersion.id, courseId: courseVersion.courseId })
    .from(courseVersion)
    .where(
      and(
        inArray(
          courseVersion.courseId,
          rows.map((r) => r.courseId),
        ),
        eq(courseVersion.isCurrent, true),
      ),
    );
  const units = current.length
    ? await db
        .select({
          id: teachingUnit.id,
          title: teachingUnit.title,
          sequence: teachingUnit.sequence,
          status: teachingUnit.status,
          versionId: teachingUnit.courseVersionId,
        })
        .from(teachingUnit)
        .where(
          inArray(
            teachingUnit.courseVersionId,
            current.map((c) => c.id),
          ),
        )
    : [];
  const done = new Set(
    (
      await db
        .select({ unitId: learningSession.unitId })
        .from(learningSession)
        .where(and(eq(learningSession.ownerId, ownerId), eq(learningSession.status, "completed")))
    ).map((r) => r.unitId),
  );
  return rows.map((r) => {
    const versionId = current.find((c) => c.courseId === r.courseId)?.id;
    const mine = units.filter((u) => u.versionId === versionId).sort((a, b) => a.sequence - b.sequence);
    const next = mine.find((u) => u.status === "ready" && !done.has(u.id)) ?? null;
    return {
      enrolmentId: r.enrolmentId,
      courseId: r.courseId,
      courseTitle: r.courseTitle,
      mode: r.mode,
      preparedUnits: mine.filter((u) => u.status === "ready").length,
      totalUnits: mine.length,
      nextUnit: next ? { id: next.id, title: next.title, sequence: next.sequence } : null,
    };
  });
}
