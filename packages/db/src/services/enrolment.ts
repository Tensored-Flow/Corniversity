import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "../client";
import { auditEvent, course, courseVersion, enrolment, term } from "../schema/index";

export type EnrolmentRow = typeof enrolment.$inferSelect;

export interface EnrolInput {
  ownerId: string;
  courseId: string;
  mode: "enrolled" | "audit" | "reading_seminar";
  termId?: string | null;
  priority?: number;
  /** Idempotency: the same key never creates two enrolments. Defaults to owner+course. */
  idempotencyKey?: string;
}

export class EnrolmentError extends Error {
  constructor(
    readonly code: "course_not_found" | "no_current_version" | "already_enrolled" | "not_offered",
    message: string,
  ) {
    super(message);
    this.name = "EnrolmentError";
  }
}

/**
 * Enrols the learner in the course's *current* version. A later syllabus update creates a
 * new version and never moves existing enrolments, so completed coursework keeps its context.
 * Repeating the call with the same idempotency key returns the existing row.
 */
export async function enrol(db: DbOrTx, input: EnrolInput): Promise<{ enrolment: EnrolmentRow; created: boolean }> {
  const key = input.idempotencyKey ?? `enrol:${input.ownerId}:${input.courseId}`;
  const existingByKey = await db.select().from(enrolment).where(eq(enrolment.idempotencyKey, key)).limit(1);
  if (existingByKey[0]) return { enrolment: existingByKey[0], created: false };

  const [c] = await db.select().from(course).where(eq(course.id, input.courseId)).limit(1);
  if (!c) throw new EnrolmentError("course_not_found", `Course ${input.courseId} does not exist.`);
  const [version] = await db
    .select()
    .from(courseVersion)
    .where(and(eq(courseVersion.courseId, input.courseId), eq(courseVersion.isCurrent, true)))
    .limit(1);
  if (!version) throw new EnrolmentError("no_current_version", `Course ${input.courseId} has no published version.`);
  if (!version.modesOffered.includes(input.mode)) {
    throw new EnrolmentError(
      "not_offered",
      `${input.courseId} is not offered in ${input.mode} mode (offered: ${version.modesOffered.join(", ") || "none"}).`,
    );
  }
  const active = await db
    .select()
    .from(enrolment)
    .where(and(eq(enrolment.ownerId, input.ownerId), eq(enrolment.courseVersionId, version.id)))
    .limit(1);
  if (active[0]) {
    if (active[0].status === "withdrawn") {
      const [revived] = await db
        .update(enrolment)
        .set({ status: "active", mode: input.mode, termId: input.termId ?? active[0].termId })
        .where(eq(enrolment.id, active[0].id))
        .returning();
      return { enrolment: revived!, created: false };
    }
    return { enrolment: active[0], created: false };
  }
  const [created] = await db
    .insert(enrolment)
    .values({
      ownerId: input.ownerId,
      termId: input.termId ?? null,
      courseVersionId: version.id,
      mode: input.mode,
      priority: input.priority ?? 1,
      idempotencyKey: key,
    })
    .returning();
  if (!created) throw new Error("enrolment insert returned nothing");
  await db.insert(auditEvent).values({
    ownerId: input.ownerId,
    actor: "learner",
    action: "enrol",
    entity: "enrolment",
    entityId: created.id,
    details: { courseId: input.courseId, courseVersionId: version.id, mode: input.mode },
  });
  return { enrolment: created, created: true };
}

export async function setEnrolmentStatus(
  db: DbOrTx,
  ownerId: string,
  enrolmentId: string,
  status: "active" | "paused" | "withdrawn" | "completed",
): Promise<EnrolmentRow | null> {
  const [updated] = await db
    .update(enrolment)
    .set({ status, completedAt: status === "completed" ? new Date() : null })
    .where(and(eq(enrolment.id, enrolmentId), eq(enrolment.ownerId, ownerId)))
    .returning();
  if (updated) {
    await db.insert(auditEvent).values({
      ownerId,
      actor: "learner",
      action: `enrolment:${status}`,
      entity: "enrolment",
      entityId: enrolmentId,
      details: {},
    });
  }
  return updated ?? null;
}

export interface EnrolmentView {
  enrolment: EnrolmentRow;
  course: typeof course.$inferSelect;
  version: typeof courseVersion.$inferSelect;
  term: typeof term.$inferSelect | null;
}

export async function listEnrolments(db: DbOrTx, ownerId: string): Promise<EnrolmentView[]> {
  const rows = await db
    .select({ enrolment, version: courseVersion, course, term })
    .from(enrolment)
    .innerJoin(courseVersion, eq(enrolment.courseVersionId, courseVersion.id))
    .innerJoin(course, eq(courseVersion.courseId, course.id))
    .leftJoin(term, eq(enrolment.termId, term.id))
    .where(eq(enrolment.ownerId, ownerId));
  return rows.map((r) => ({ enrolment: r.enrolment, course: r.course, version: r.version, term: r.term }));
}

export async function getEnrolmentForCourse(db: DbOrTx, ownerId: string, courseId: string): Promise<EnrolmentView | null> {
  const all = await listEnrolments(db, ownerId);
  return all.find((e) => e.course.id === courseId && e.enrolment.status !== "withdrawn") ?? null;
}
