import type { ModellingMethod, ProgrammeBlock } from "../domain/course";
import type { CourseReadiness, EvidenceState, UnitStatus } from "../domain/enums";

/**
 * Pure programme arithmetic. A block's readiness is derived from the courses and units it maps
 * to, never authored, so it cannot claim more than the catalogue holds. Work is listed once per
 * unit even when several blocks share the unit, because the learner studies and is assessed on
 * the unit, not on the block.
 */

export interface CourseState {
  courseId: string;
  title: string;
  readiness: CourseReadiness;
  units: { id: string; sequence: number; title: string; status: UnitStatus }[];
}

export type BlockReadiness = "teaching_available" | "partly_prepared" | "sources_only" | "proposed";

export interface BlockReadinessReport {
  readiness: BlockReadiness;
  /** Mapped units that are prepared and can be studied now. */
  preparedUnitIds: string[];
  /** Mapped units that exist in the catalogue but are not prepared. */
  unpreparedUnitIds: string[];
  /** Mapped unit ids that do not exist in the course (a content error the validator also reports). */
  missingUnitIds: string[];
  /** Courses mapped without a unit selection yet. */
  coursesToRefine: string[];
}

const SOURCED: CourseReadiness[] = ["source_verified", "syllabus_ready", "teaching_ready"];

export function blockReadiness(block: ProgrammeBlock, courses: ReadonlyMap<string, CourseState>): BlockReadinessReport {
  const prepared: string[] = [];
  const unprepared: string[] = [];
  const missing: string[] = [];
  const toRefine: string[] = [];
  let anySourced = false;
  for (const mapping of block.courseMappings) {
    const course = courses.get(mapping.courseId);
    if (!course) {
      toRefine.push(mapping.courseId);
      continue;
    }
    if (SOURCED.includes(course.readiness)) anySourced = true;
    if (mapping.unitIds.length === 0) {
      toRefine.push(mapping.courseId);
      continue;
    }
    for (const unitId of mapping.unitIds) {
      const unit = course.units.find((u) => u.id === unitId);
      if (!unit) missing.push(unitId);
      else if (unit.status === "ready") prepared.push(unitId);
      else unprepared.push(unitId);
    }
  }
  let readiness: BlockReadiness;
  if (prepared.length > 0 && unprepared.length === 0 && missing.length === 0 && toRefine.length === 0) readiness = "teaching_available";
  else if (prepared.length > 0) readiness = "partly_prepared";
  else if (anySourced) readiness = "sources_only";
  else readiness = "proposed";
  return { readiness, preparedUnitIds: prepared, unpreparedUnitIds: unprepared, missingUnitIds: missing, coursesToRefine: toRefine };
}

export const BLOCK_READINESS_LABEL: Record<BlockReadiness, string> = {
  teaching_available: "Prepared: every mapped unit can be studied",
  partly_prepared: "Partly prepared: some mapped units can be studied",
  sources_only: "Sources verified for a mapped course; no unit prepared yet",
  proposed: "Proposed: no mapped course is sourced yet",
};

export interface WorkItem {
  courseId: string;
  unitId: string;
  /** Every block this unit serves; one entry per unit whatever the number of blocks. */
  blockIds: string[];
}

/** The units a programme asks for, each listed once with the blocks it serves. */
export function programmeWorkItems(blocks: readonly ProgrammeBlock[]): WorkItem[] {
  const byUnit = new Map<string, WorkItem>();
  for (const block of [...blocks].sort((a, b) => a.sequence - b.sequence)) {
    for (const mapping of block.courseMappings) {
      for (const unitId of mapping.unitIds) {
        const key = `${mapping.courseId}/${unitId}`;
        const existing = byUnit.get(key);
        if (existing) {
          if (!existing.blockIds.includes(block.id)) existing.blockIds.push(block.id);
        } else {
          byUnit.set(key, { courseId: mapping.courseId, unitId, blockIds: [block.id] });
        }
      }
    }
  }
  return [...byUnit.values()];
}

export interface BlockLearnerView {
  blockId: string;
  readiness: BlockReadiness;
  /** Mapped courses the learner currently takes in any mode. */
  takingCourseIds: string[];
  /** Prepared mapped units the learner has completed at least one session of. */
  unitsWorked: string[];
  /** Prepared mapped units still open to the learner. */
  unitsOpen: string[];
  /** Units also serving another block, so the learner sees why a unit appears twice. */
  sharedUnits: { unitId: string; alsoServes: string[] }[];
}

/**
 * What a block looks like from the learner's side. Derived only from enrolments and completed
 * sessions; it awards nothing and has no grade of its own.
 */
export function blockLearnerView(
  block: ProgrammeBlock,
  allBlocks: readonly ProgrammeBlock[],
  courses: ReadonlyMap<string, CourseState>,
  learner: { activeCourseIds: ReadonlySet<string>; workedUnitIds: ReadonlySet<string> },
): BlockLearnerView {
  const report = blockReadiness(block, courses);
  const items = programmeWorkItems(allBlocks);
  const mine = block.courseMappings.flatMap((m) => m.unitIds);
  return {
    blockId: block.id,
    readiness: report.readiness,
    takingCourseIds: block.courseMappings.map((m) => m.courseId).filter((id) => learner.activeCourseIds.has(id)),
    unitsWorked: report.preparedUnitIds.filter((u) => learner.workedUnitIds.has(u)),
    unitsOpen: report.preparedUnitIds.filter((u) => !learner.workedUnitIds.has(u)),
    sharedUnits: items
      .filter((i) => mine.includes(i.unitId) && i.blockIds.length > 1)
      .map((i) => ({ unitId: i.unitId, alsoServes: i.blockIds.filter((b) => b !== block.id) })),
  };
}

export interface MethodCoverage {
  methodId: string;
  title: string;
  /** The learner's evidence state for the method's concept; introduced, practised and demonstrated stay distinct. */
  state: EvidenceState;
  preparedUnits: { courseId: string; unitId: string; role: string }[];
  plannedOnly: boolean;
}

export function methodCoverage(
  methods: readonly ModellingMethod[],
  courses: ReadonlyMap<string, CourseState>,
  conceptStates: ReadonlyMap<string, EvidenceState>,
): MethodCoverage[] {
  return methods.map((m) => {
    const preparedUnits = m.units.filter((u) => courses.get(u.courseId)?.units.some((x) => x.id === u.unitId && x.status === "ready"));
    return {
      methodId: m.id,
      title: m.title,
      state: conceptStates.get(m.conceptId) ?? "unassessed",
      preparedUnits,
      plannedOnly: preparedUnits.length === 0,
    };
  });
}
