import { and, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { attempt, courseVersion, submissionVersion, teachingUnit, unitExercise } from "../schema/index";

/*
 * Problem sheets and course progress: each prepared unit's problems with where the learner stands
 * on each, from their practice attempts (exam answers are counted separately).
 */

export type ProblemStatus = "not_started" | "in_progress" | "submitted" | "accepted";

export interface SheetProblem {
  id: string;
  sequence: number;
  title: string;
  kind: string;
  estimatedMinutes: number;
  status: ProblemStatus;
  /** Answered in an exam (a separate record from practice). */
  inExam: boolean;
}

async function statuses(db: DbOrTx, ownerId: string, exerciseIds: string[]) {
  if (exerciseIds.length === 0) return { practice: new Map<string, ProblemStatus>(), exam: new Set<string>() };
  const rows = await db
    .select({ id: attempt.id, exerciseId: attempt.exerciseId, state: attempt.state, draft: attempt.draftMarkdown, examId: attempt.examId })
    .from(attempt)
    .where(and(eq(attempt.ownerId, ownerId), inArray(attempt.exerciseId, exerciseIds)));
  const submitted = rows.length
    ? new Set(
        (
          await db
            .selectDistinct({ attemptId: submissionVersion.attemptId })
            .from(submissionVersion)
            .where(
              inArray(
                submissionVersion.attemptId,
                rows.map((r) => r.id),
              ),
            )
        ).map((s) => s.attemptId),
      )
    : new Set<string>();
  const rank: Record<ProblemStatus, number> = { not_started: 0, in_progress: 1, submitted: 2, accepted: 3 };
  const practice = new Map<string, ProblemStatus>();
  const exam = new Set<string>();
  for (const r of rows) {
    if (r.examId) {
      exam.add(r.exerciseId);
      continue;
    }
    const s: ProblemStatus =
      r.state === "accepted" ? "accepted" : submitted.has(r.id) ? "submitted" : r.draft?.trim() ? "in_progress" : "not_started";
    if (rank[s] > rank[practice.get(r.exerciseId) ?? "not_started"]) practice.set(r.exerciseId, s);
  }
  return { practice, exam };
}

/** One unit's problem sheet. */
export async function problemSheet(db: DbOrTx, ownerId: string, unitId: string): Promise<SheetProblem[]> {
  const problems = await db.select().from(unitExercise).where(eq(unitExercise.unitId, unitId)).orderBy(unitExercise.sequence);
  const { practice, exam } = await statuses(
    db,
    ownerId,
    problems.map((p) => p.id),
  );
  return problems.map((p) => ({
    id: p.id,
    sequence: p.sequence,
    title: p.title,
    kind: p.kind,
    estimatedMinutes: p.estimatedMinutes,
    status: practice.get(p.id) ?? "not_started",
    inExam: exam.has(p.id),
  }));
}

export interface UnitProgress {
  unitId: string;
  problems: number;
  /** Problems submitted or accepted in practice. */
  done: number;
}

/**
 * Problems done per prepared unit of a course. Units belong to the course's current version (a
 * content update moves them there), whichever version the learner enrolled in.
 */
export async function courseProgress(db: DbOrTx, ownerId: string, courseId: string): Promise<UnitProgress[]> {
  const rows = await db
    .select({ unitId: teachingUnit.id, exerciseId: unitExercise.id })
    .from(teachingUnit)
    .innerJoin(courseVersion, eq(teachingUnit.courseVersionId, courseVersion.id))
    .leftJoin(unitExercise, eq(unitExercise.unitId, teachingUnit.id))
    .where(and(eq(courseVersion.courseId, courseId), eq(courseVersion.isCurrent, true), eq(teachingUnit.status, "ready")));
  const ids = rows.flatMap((r) => (r.exerciseId ? [r.exerciseId] : []));
  const { practice } = await statuses(db, ownerId, ids);
  const byUnit = new Map<string, UnitProgress>();
  for (const r of rows) {
    const u = byUnit.get(r.unitId) ?? { unitId: r.unitId, problems: 0, done: 0 };
    if (r.exerciseId) {
      u.problems++;
      const s = practice.get(r.exerciseId);
      if (s === "submitted" || s === "accepted") u.done++;
    }
    byUnit.set(r.unitId, u);
  }
  return [...byUnit.values()];
}

/** The unit's activity that holds a problem (where its practice session runs), or its first tutorial. */
export function activityFor(
  activities: readonly { id: string; sessionKind: string; exerciseIds: readonly string[] }[],
  exerciseId?: string,
): string | null {
  if (exerciseId) {
    const holder = activities.find((a) => a.exerciseIds.includes(exerciseId));
    if (holder) return holder.id;
  }
  const tutorial =
    activities.find((a) => a.sessionKind === "tutorial") ??
    activities.find((a) => a.exerciseIds.length > 0) ??
    activities.find((a) => a.sessionKind !== "lab");
  return tutorial?.id ?? null;
}

/** Unit names and their courses, for "continue" links. */
export async function unitLabels(db: DbOrTx, unitIds: string[]) {
  if (unitIds.length === 0) return new Map<string, { title: string; sequence: number; courseId: string }>();
  const rows = await db
    .select({
      id: teachingUnit.id,
      title: teachingUnit.title,
      sequence: teachingUnit.sequence,
      courseId: courseVersion.courseId,
    })
    .from(teachingUnit)
    .innerJoin(courseVersion, eq(teachingUnit.courseVersionId, courseVersion.id))
    .where(inArray(teachingUnit.id, unitIds));
  return new Map(rows.map((r) => [r.id, r]));
}
