import {
  BLOCK_READINESS_LABEL,
  type BlockLearnerView,
  type BlockReadinessReport,
  blockLearnerView,
  blockReadiness,
  type CourseState,
  type EvidenceState,
  type MethodCoverage,
  methodCoverage,
  programmeWorkItems,
  type WorkItem,
} from "@corniversity/core";
import { and, eq, inArray, or } from "drizzle-orm";
import type { DbOrTx } from "../client";
import {
  auditEvent,
  changeProposal,
  conceptState,
  course,
  courseVersion,
  enrolment,
  learningSession,
  programme,
  programmeParticipation,
  teachingUnit,
} from "../schema/index";

/**
 * Programmes as the learner meets them: a catalogue of routes, each with blocks whose
 * readiness is derived from the courses and units they map to. Following a programme records
 * interest and focus; it never enrols the learner in a course (enrolment stays an explicit act
 * on the course page), and a learner may follow several programmes at once.
 */

export type ProgrammeRow = typeof programme.$inferSelect;
export type ParticipationRow = typeof programmeParticipation.$inferSelect;

export class ProgrammeError extends Error {}

export async function listProgrammes(db: DbOrTx): Promise<ProgrammeRow[]> {
  return db.select().from(programme).orderBy(programme.title);
}

/** By internal id or by stable reference id (for example MIND-BRAIN-AI). */
export async function getProgramme(db: DbOrTx, idOrReference: string): Promise<ProgrammeRow | null> {
  if (!/^[A-Za-z0-9-]{1,80}$/.test(idOrReference)) return null;
  const [row] = await db
    .select()
    .from(programme)
    .where(or(eq(programme.id, idOrReference), eq(programme.referenceId, idOrReference)))
    .limit(1);
  return row ?? null;
}

/** Every course a programme names, anywhere: stages, blocks, bridges, electives, methods. */
export function programmeCourseIds(p: ProgrammeRow): string[] {
  const ids = new Set<string>();
  for (const s of p.stages) for (const c of s.courses) ids.add(c.courseId);
  for (const b of p.blocks) {
    for (const m of b.courseMappings) ids.add(m.courseId);
    for (const br of b.bridges) if (br.courseId) ids.add(br.courseId);
  }
  for (const e of p.electives) ids.add(e.courseId);
  for (const m of p.methods) {
    for (const u of m.units) ids.add(u.courseId);
    for (const pl of m.plannedIn) ids.add(pl.courseId);
  }
  return [...ids];
}

export interface CourseSummary extends CourseState {
  level: string;
  position: string;
  launch: boolean;
  catalogueNotes: (typeof courseVersion.$inferSelect)["catalogueNotes"];
  primarySourceIds: string[];
}

/** Current-version state of the named courses, with their units in sequence. */
export async function courseStates(db: DbOrTx, courseIds: string[]): Promise<Map<string, CourseSummary>> {
  if (courseIds.length === 0) return new Map();
  const versions = await db
    .select({ version: courseVersion, course })
    .from(courseVersion)
    .innerJoin(course, eq(courseVersion.courseId, course.id))
    .where(and(inArray(courseVersion.courseId, courseIds), eq(courseVersion.isCurrent, true)));
  const units = versions.length
    ? await db
        .select({
          id: teachingUnit.id,
          courseVersionId: teachingUnit.courseVersionId,
          sequence: teachingUnit.sequence,
          title: teachingUnit.title,
          status: teachingUnit.status,
        })
        .from(teachingUnit)
        .where(
          inArray(
            teachingUnit.courseVersionId,
            versions.map((v) => v.version.id),
          ),
        )
    : [];
  return new Map(
    versions.map((v) => [
      v.course.id,
      {
        courseId: v.course.id,
        title: v.course.title,
        readiness: v.version.readiness,
        level: v.course.level,
        position: v.course.position,
        launch: v.course.launch,
        catalogueNotes: v.version.catalogueNotes,
        primarySourceIds: v.version.primarySourceIds,
        units: units
          .filter((u) => u.courseVersionId === v.version.id)
          .sort((a, b) => a.sequence - b.sequence)
          .map((u) => ({ id: u.id, sequence: u.sequence, title: u.title, status: u.status })),
      },
    ]),
  );
}

export interface ProgrammeDetail {
  programme: ProgrammeRow;
  courses: Map<string, CourseSummary>;
  blocks: { block: ProgrammeRow["blocks"][number]; report: BlockReadinessReport; label: string }[];
  workItems: WorkItem[];
}

export async function programmeDetail(db: DbOrTx, idOrReference: string): Promise<ProgrammeDetail | null> {
  const p = await getProgramme(db, idOrReference);
  if (!p) return null;
  const courses = await courseStates(db, programmeCourseIds(p));
  const blocks = [...p.blocks]
    .sort((a, b) => a.sequence - b.sequence)
    .map((block) => {
      const report = blockReadiness(block, courses);
      return { block, report, label: BLOCK_READINESS_LABEL[report.readiness] };
    });
  return { programme: p, courses, blocks, workItems: programmeWorkItems(p.blocks) };
}

export async function listParticipation(db: DbOrTx, ownerId: string): Promise<ParticipationRow[]> {
  return db.select().from(programmeParticipation).where(eq(programmeParticipation.ownerId, ownerId));
}

/**
 * Records that the learner follows a programme (idempotent). Changing the focus blocks or
 * re-following a programme left earlier updates the same row; nothing is enrolled.
 */
export async function followProgramme(
  db: DbOrTx,
  ownerId: string,
  programmeId: string,
  source: ParticipationRow["source"],
  focusBlockIds?: string[],
): Promise<ParticipationRow> {
  const p = await getProgramme(db, programmeId);
  if (!p) throw new ProgrammeError("Programme not found.");
  const valid = new Set(p.blocks.map((b) => b.id));
  const focus = (focusBlockIds ?? []).filter((b) => valid.has(b));
  const [row] = await db
    .insert(programmeParticipation)
    .values({ ownerId, programmeId: p.id, status: "following", source, focusBlockIds: focus })
    .onConflictDoUpdate({
      target: [programmeParticipation.ownerId, programmeParticipation.programmeId],
      set: { status: "following", ...(focusBlockIds ? { focusBlockIds: focus } : {}) },
    })
    .returning();
  await db.insert(auditEvent).values({
    ownerId,
    actor: source === "director_proposal" ? "director" : "learner",
    action: "programme:follow",
    entity: "programme",
    entityId: p.id,
    details: { source, focusBlockIds: focus },
  });
  return row!;
}

export async function setParticipationStatus(
  db: DbOrTx,
  ownerId: string,
  programmeId: string,
  status: "following" | "paused" | "left",
): Promise<void> {
  await db
    .update(programmeParticipation)
    .set({ status })
    .where(and(eq(programmeParticipation.ownerId, ownerId), eq(programmeParticipation.programmeId, programmeId)));
  await db.insert(auditEvent).values({
    ownerId,
    actor: "learner",
    action: `programme:${status}`,
    entity: "programme",
    entityId: programmeId,
    details: {},
  });
}

export interface ProgrammeMapEntry {
  participation: ParticipationRow;
  programme: ProgrammeRow;
  blocks: (BlockLearnerView & { title: string; sequence: number; focus: boolean })[];
  methods: MethodCoverage[];
  courses: Map<string, CourseSummary>;
}

/**
 * The learner's academic map for the programmes they follow: per block, what they take and what
 * they have worked; per method, the evidence state of its concept, with introduced, practised
 * and demonstrated kept distinct. Everything is derived; nothing is awarded here.
 */
export async function learnerProgrammeMap(db: DbOrTx, ownerId: string): Promise<ProgrammeMapEntry[]> {
  const participation = (await listParticipation(db, ownerId)).filter((p) => p.status !== "left");
  if (participation.length === 0) return [];
  const programmes = await db
    .select()
    .from(programme)
    .where(
      inArray(
        programme.id,
        participation.map((p) => p.programmeId),
      ),
    );
  const active = await db
    .select({ courseId: courseVersion.courseId })
    .from(enrolment)
    .innerJoin(courseVersion, eq(enrolment.courseVersionId, courseVersion.id))
    .where(and(eq(enrolment.ownerId, ownerId), eq(enrolment.status, "active")));
  const worked = await db
    .select({ unitId: learningSession.unitId })
    .from(learningSession)
    .where(and(eq(learningSession.ownerId, ownerId), eq(learningSession.status, "completed")));
  const states = await db.select().from(conceptState).where(eq(conceptState.ownerId, ownerId));
  const stateMap = new Map<string, EvidenceState>(states.map((s) => [s.conceptId, s.state]));
  const learner = { activeCourseIds: new Set(active.map((a) => a.courseId)), workedUnitIds: new Set(worked.map((w) => w.unitId)) };
  const out: ProgrammeMapEntry[] = [];
  for (const part of participation) {
    const p = programmes.find((x) => x.id === part.programmeId);
    if (!p) continue;
    const courses = await courseStates(db, programmeCourseIds(p));
    out.push({
      participation: part,
      programme: p,
      courses,
      blocks: [...p.blocks]
        .sort((a, b) => a.sequence - b.sequence)
        .map((b) => ({
          ...blockLearnerView(b, p.blocks, courses, learner),
          title: b.title,
          sequence: b.sequence,
          focus: part.focusBlockIds.includes(b.id),
        })),
      methods: methodCoverage(p.methods, courses, stateMap),
    });
  }
  return out;
}

/**
 * The director's proposal for a route through a programme, made by fixed rules so it can be
 * inspected: focus on the first blocks that can be studied now, and name the mapped courses with
 * prepared units the learner does not yet take. Nothing changes until the learner confirms it,
 * and confirming it still enrols in nothing.
 */
export async function proposeProgrammeRoute(db: DbOrTx, ownerId: string, programmeId: string) {
  const detail = await programmeDetail(db, programmeId);
  if (!detail) throw new ProgrammeError("Programme not found.");
  const open = detail.blocks.filter((b) => b.report.readiness === "teaching_available" || b.report.readiness === "partly_prepared");
  const focus = open.slice(0, 2).map((b) => b.block.id);
  const active = await db
    .select({ courseId: courseVersion.courseId })
    .from(enrolment)
    .innerJoin(courseVersion, eq(enrolment.courseVersionId, courseVersion.id))
    .where(and(eq(enrolment.ownerId, ownerId), eq(enrolment.status, "active")));
  const taking = new Set(active.map((a) => a.courseId));
  const suggested = [
    ...new Set(
      open
        .filter((b) => focus.includes(b.block.id))
        .flatMap((b) =>
          b.block.courseMappings.filter((m) => m.unitIds.some((u) => b.report.preparedUnitIds.includes(u))).map((m) => m.courseId),
        ),
    ),
  ].filter((c) => !taking.has(c));
  const unprepared = detail.blocks
    .filter((b) => b.report.readiness === "proposed" || b.report.readiness === "sources_only")
    .map((b) => b.block.id);
  const rationale = [
    focus.length
      ? `Begin with ${focus.join(" and ")}: their mapped units can be studied now.`
      : "No block of this programme has a prepared unit yet; following it records your interest and shows each block's status.",
    suggested.length
      ? `Courses with prepared units for those blocks that you do not take yet: ${suggested.join(", ")}. Enrol from their course pages if you want them; confirming this proposal enrols you in nothing.`
      : "You already take the courses that serve those blocks, or none is prepared.",
    unprepared.length ? `Not yet prepared: ${unprepared.join(", ")}. They stay visible with that label.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const [proposal] = await db
    .insert(changeProposal)
    .values({
      ownerId,
      kind: "programme",
      proposedBy: "director",
      title: `Follow ${detail.programme.title}${focus.length ? `, starting with ${focus.join(" and ")}` : ""}`,
      rationale,
      diff: { programmeId: detail.programme.id, action: "follow", focusBlockIds: focus, suggestedCourseIds: suggested },
    })
    .returning();
  return proposal!;
}

/** Applies a confirmed programme proposal; called from the shared proposal decision. */
export async function applyProgrammeProposal(db: DbOrTx, ownerId: string, diff: unknown): Promise<boolean> {
  const d = diff as { programmeId?: string; action?: string; focusBlockIds?: string[] };
  if (!d.programmeId || d.action !== "follow") return false;
  await followProgramme(db, ownerId, d.programmeId, "director_proposal", d.focusBlockIds ?? []);
  return true;
}

/** Titles and links of registered sources named on a programme's shelves and seminar. */
export async function sourceTitles(db: DbOrTx, ids: string[]): Promise<Map<string, { title: string; canonicalUrl: string }>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { source } = await import("../schema/index");
  const rows = await db
    .select({ id: source.id, title: source.title, canonicalUrl: source.canonicalUrl })
    .from(source)
    .where(inArray(source.id, unique));
  return new Map(rows.map((r) => [r.id, { title: r.title, canonicalUrl: r.canonicalUrl }]));
}
