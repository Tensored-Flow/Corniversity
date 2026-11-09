import type { ProgrammeBlock } from "../domain/course";
import type { BlockReadinessReport } from "./progress";

/**
 * One manageable next step, for a block or for a programme as a whole, derived from what is
 * prepared and from the learner's own courses and completed sessions. It never enrols: the most
 * it suggests is opening a course page, where the workload preview comes before enrolment.
 */
export type NextStep =
  | { kind: "follow"; text: string }
  | { kind: "ask_director"; text: string }
  | { kind: "open_unit"; courseId: string; unitId: string; text: string }
  | { kind: "preview_course"; courseId: string; text: string }
  | { kind: "obtain_sources"; text: string }
  | { kind: "reflect"; text: string };

export interface LearnerProgress {
  activeCourseIds: ReadonlySet<string>;
  workedUnitIds: ReadonlySet<string>;
}

export function blockNextStep(block: ProgrammeBlock, report: BlockReadinessReport, learner: LearnerProgress): NextStep {
  if (report.preparedUnitIds.length === 0) {
    return {
      kind: "obtain_sources",
      text: "Nothing in this block can be studied yet. Its missing sources are on the library's list of books to obtain as leads; nothing else is asked of you, and other blocks are not held up.",
    };
  }
  for (const m of block.courseMappings) {
    if (!learner.activeCourseIds.has(m.courseId)) continue;
    const open = m.unitIds.find((u) => report.preparedUnitIds.includes(u) && !learner.workedUnitIds.has(u));
    if (open)
      return { kind: "open_unit", courseId: m.courseId, unitId: open, text: `Continue with ${open} in ${m.courseId}, which you take.` };
  }
  const notTaken = block.courseMappings.find(
    (m) =>
      !learner.activeCourseIds.has(m.courseId) &&
      m.unitIds.some((u) => report.preparedUnitIds.includes(u) && !learner.workedUnitIds.has(u)),
  );
  if (notTaken) {
    return {
      kind: "preview_course",
      courseId: notTaken.courseId,
      text: `Look at ${notTaken.courseId}'s workload preview, then enrol, audit or read it from its page if you want it.`,
    };
  }
  return {
    kind: "reflect",
    text: "You have worked every prepared unit of this block. Its activity can become a notebook entry or a question for the research studio; the rest of the block is still outlined.",
  };
}

export function programmeNextStep(
  participation: { status: string; focusBlockIds: string[] } | null,
  blocks: readonly { block: ProgrammeBlock; report: BlockReadinessReport }[],
  learner: LearnerProgress,
): NextStep {
  if (participation?.status !== "following") {
    return {
      kind: "follow",
      text: "Follow the programme to see it on your academic map, or ask the director for a small starting route. Neither enrols you in anything.",
    };
  }
  if (participation.focusBlockIds.length === 0) {
    return {
      kind: "ask_director",
      text: "Ask the director for a starting route: up to two blocks to begin with, built from the courses you already take.",
    };
  }
  const focus = participation.focusBlockIds.flatMap((id) => blocks.filter((b) => b.block.id === id));
  for (const b of focus) {
    const step = blockNextStep(b.block, b.report, learner);
    if (step.kind !== "obtain_sources") return { ...step, text: `${b.block.id}: ${step.text}` };
  }
  const first = focus[0];
  return first
    ? blockNextStep(first.block, first.report, learner)
    : { kind: "ask_director", text: "Ask the director for a new starting route." };
}
