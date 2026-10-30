import { and, asc, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../client";
import {
  concept,
  course,
  courseDepartment,
  courseVersion,
  department,
  locator,
  persona,
  prerequisiteRule,
  programme,
  source,
  sourceVersion,
  teachingUnit,
  unitExercise,
} from "../schema/index";

export type DepartmentRow = typeof department.$inferSelect;
export type CourseRow = typeof course.$inferSelect;
export type CourseVersionRow = typeof courseVersion.$inferSelect;
export type TeachingUnitRow = typeof teachingUnit.$inferSelect;
export type ExerciseRow = typeof unitExercise.$inferSelect;
export type LocatorRow = typeof locator.$inferSelect;

export interface CatalogueEntry {
  course: CourseRow;
  version: CourseVersionRow;
  departments: string[];
  unitCount: number;
  readyUnitCount: number;
}

export async function listDepartments(db: DbOrTx): Promise<DepartmentRow[]> {
  return db.select().from(department).orderBy(asc(department.sort));
}

export async function getDepartment(db: DbOrTx, id: string): Promise<DepartmentRow | null> {
  const rows = await db.select().from(department).where(eq(department.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Catalogue with current versions and honest unit counts; one query per table, joined in memory. */
export async function listCatalogue(db: DbOrTx, filter: { departmentId?: string } = {}): Promise<CatalogueEntry[]> {
  const courses = await db.select().from(course).orderBy(asc(course.id));
  const versions = await db.select().from(courseVersion).where(eq(courseVersion.isCurrent, true));
  const links = await db.select().from(courseDepartment);
  const versionIds = versions.map((v) => v.id);
  const units = versionIds.length
    ? await db
        .select({ courseVersionId: teachingUnit.courseVersionId, status: teachingUnit.status })
        .from(teachingUnit)
        .where(inArray(teachingUnit.courseVersionId, versionIds))
    : [];
  const byCourse = new Map(versions.map((v) => [v.courseId, v]));
  const entries: CatalogueEntry[] = [];
  for (const c of courses) {
    const version = byCourse.get(c.id);
    if (!version) continue;
    const departments = links.filter((l) => l.courseId === c.id).map((l) => l.departmentId);
    if (filter.departmentId && !departments.includes(filter.departmentId)) continue;
    const unitRows = units.filter((u) => u.courseVersionId === version.id);
    entries.push({
      course: c,
      version,
      departments,
      unitCount: unitRows.length,
      readyUnitCount: unitRows.filter((u) => u.status === "ready").length,
    });
  }
  return entries;
}

export interface CourseDetail extends CatalogueEntry {
  units: (TeachingUnitRow & { exerciseCount: number })[];
  prerequisites: (typeof prerequisiteRule.$inferSelect)[];
  primarySources: { source: typeof source.$inferSelect; version: typeof sourceVersion.$inferSelect | null }[];
  supplementalSources: { source: typeof source.$inferSelect; version: typeof sourceVersion.$inferSelect | null }[];
  tutor: typeof persona.$inferSelect | null;
  convenor: typeof persona.$inferSelect | null;
  teachesConcepts: (typeof concept.$inferSelect)[];
}

export async function getCourseDetail(db: DbOrTx, courseId: string): Promise<CourseDetail | null> {
  const [c] = await db.select().from(course).where(eq(course.id, courseId)).limit(1);
  if (!c) return null;
  const [version] = await db
    .select()
    .from(courseVersion)
    .where(and(eq(courseVersion.courseId, courseId), eq(courseVersion.isCurrent, true)))
    .limit(1);
  if (!version) return null;
  const links = await db.select().from(courseDepartment).where(eq(courseDepartment.courseId, courseId));
  const units = await db
    .select()
    .from(teachingUnit)
    .where(eq(teachingUnit.courseVersionId, version.id))
    .orderBy(asc(teachingUnit.sequence));
  const unitIds = units.map((u) => u.id);
  const exercises = unitIds.length
    ? await db.select({ unitId: unitExercise.unitId }).from(unitExercise).where(inArray(unitExercise.unitId, unitIds))
    : [];
  const prerequisites = await db.select().from(prerequisiteRule).where(eq(prerequisiteRule.courseId, courseId));
  const sourceIds = [...version.primarySourceIds, ...version.supplementalSourceIds];
  const sources = sourceIds.length ? await db.select().from(source).where(inArray(source.id, sourceIds)) : [];
  const versionRows = sources.length
    ? await db
        .select()
        .from(sourceVersion)
        .where(inArray(sourceVersion.id, sources.map((s) => s.currentVersionId)))
    : [];
  const withVersion = (ids: string[]) =>
    ids
      .map((id) => sources.find((s) => s.id === id))
      .filter((s): s is typeof source.$inferSelect => Boolean(s))
      .map((s) => ({ source: s, version: versionRows.find((v) => v.id === s.currentVersionId) ?? null }));
  const personaIds = [version.tutorPersonaId, version.convenorPersonaId].filter((p): p is string => Boolean(p));
  const personas = personaIds.length ? await db.select().from(persona).where(inArray(persona.id, personaIds)) : [];
  const concepts = version.teachesConceptIds.length
    ? await db.select().from(concept).where(inArray(concept.id, version.teachesConceptIds))
    : [];
  return {
    course: c,
    version,
    departments: links.map((l) => l.departmentId),
    unitCount: units.length,
    readyUnitCount: units.filter((u) => u.status === "ready").length,
    units: units.map((u) => ({ ...u, exerciseCount: exercises.filter((e) => e.unitId === u.id).length })),
    prerequisites,
    primarySources: withVersion(version.primarySourceIds),
    supplementalSources: withVersion(version.supplementalSourceIds),
    tutor: personas.find((p) => p.id === version.tutorPersonaId) ?? null,
    convenor: personas.find((p) => p.id === version.convenorPersonaId) ?? null,
    teachesConcepts: concepts,
  };
}

export interface UnitDetail {
  unit: TeachingUnitRow;
  course: CourseRow;
  version: CourseVersionRow;
  exercises: ExerciseRow[];
  locators: LocatorRow[];
  previous: { id: string; title: string; sequence: number } | null;
  next: { id: string; title: string; sequence: number } | null;
}

/** Learner-facing unit payload: never includes instructor artifacts. */
export async function getUnitDetail(db: DbOrTx, unitId: string): Promise<UnitDetail | null> {
  const [unit] = await db.select().from(teachingUnit).where(eq(teachingUnit.id, unitId)).limit(1);
  if (!unit) return null;
  const [version] = await db.select().from(courseVersion).where(eq(courseVersion.id, unit.courseVersionId)).limit(1);
  if (!version) return null;
  const [c] = await db.select().from(course).where(eq(course.id, version.courseId)).limit(1);
  if (!c) return null;
  const exercises = await db
    .select()
    .from(unitExercise)
    .where(eq(unitExercise.unitId, unitId))
    .orderBy(asc(unitExercise.sequence));
  const locatorIds = new Set<string>();
  for (const p of unit.preparation) locatorIds.add(p.locatorId);
  for (const a of unit.activities) for (const l of a.sourceLocatorIds) locatorIds.add(l);
  for (const e of exercises) if (e.externalLocatorId) locatorIds.add(e.externalLocatorId);
  const locators = locatorIds.size ? await db.select().from(locator).where(inArray(locator.id, [...locatorIds])) : [];
  const siblings = await db
    .select({ id: teachingUnit.id, title: teachingUnit.title, sequence: teachingUnit.sequence })
    .from(teachingUnit)
    .where(eq(teachingUnit.courseVersionId, version.id))
    .orderBy(asc(teachingUnit.sequence));
  const index = siblings.findIndex((s) => s.id === unitId);
  return {
    unit,
    course: c,
    version,
    exercises,
    locators,
    previous: index > 0 ? (siblings[index - 1] ?? null) : null,
    next: index >= 0 && index < siblings.length - 1 ? (siblings[index + 1] ?? null) : null,
  };
}

export async function listProgrammes(db: DbOrTx) {
  return db.select().from(programme).orderBy(asc(programme.title));
}

export async function listPersonas(db: DbOrTx) {
  return db.select().from(persona).orderBy(asc(persona.name));
}

export async function getLocators(db: DbOrTx, ids: string[]): Promise<LocatorRow[]> {
  if (ids.length === 0) return [];
  return db.select().from(locator).where(inArray(locator.id, ids));
}
