import type { ProgrammeBlock } from "../domain/course";
import type { BlockReadinessReport } from "./progress";

/**
 * The director's starting route through a programme, by fixed rules so it can be inspected and
 * tested. It is small (at most two focus blocks and two new courses), it keeps the focus the
 * learner already chose while that focus can still be studied, it works from the learner's
 * existing courses and chosen load, and it explains every prerequisite of what it suggests.
 *
 * Prior knowledge is recognised only rule by rule: a prerequisite counts as met when evidence or
 * an explicit self-report covers that rule's own concepts. A background in one subject never
 * waives another subject's rule, so knowing mathematics does not stand in for programming,
 * biology, psychology or experimental method. Nothing here enrols or changes anything; the
 * learner confirms the route, and enrolment stays a separate act on each course page.
 */

export interface RuleAssessment {
  ruleId: string;
  strength: "hard" | "soft" | "corequisite";
  description: string;
  satisfied: boolean;
  satisfiedBy: string | null;
  basis: "evidence" | "self_report" | "none";
  /** Courses named as alternatives or bridges for the rule. */
  alternativeCourseIds: string[];
}

export interface RouteInput {
  blocks: { block: ProgrammeBlock; report: BlockReadinessReport }[];
  courseTitles: ReadonlyMap<string, string>;
  learner: {
    activeCourses: { courseId: string; mode: "enrolled" | "audit" | "reading_seminar" }[];
    focusBlockIds: string[];
    load: { mainCourseLimit: number; exploratoryLimit: number; main: number; exploratory: number };
  };
  /** Prerequisite assessments of every mapped course with prepared units in an open block. */
  prerequisites: ReadonlyMap<string, RuleAssessment[]>;
}

export type RouteAction = "continue" | "enrol" | "audit_or_read" | "later";

export interface RouteStep {
  courseId: string;
  title: string;
  blockIds: string[];
  unitIds: string[];
  action: RouteAction;
  why: string;
}

export interface RouteProposal {
  focusBlockIds: string[];
  steps: RouteStep[];
  /** Prerequisites already met, and on what basis. */
  recognised: { courseId: string; description: string; basis: "evidence" | "self_report"; satisfiedBy: string }[];
  /** Prerequisites not yet met, with the courses that would meet them. */
  toPrepare: { courseId: string; description: string; strength: RuleAssessment["strength"]; alternativeCourseIds: string[] }[];
  notYetPrepared: string[];
  focusChange: { before: string[]; after: string[] } | null;
  rationale: string[];
}

const MAX_FOCUS = 2;
const MAX_NEW_COURSES = 2;

const isOpen = (r: BlockReadinessReport) => r.readiness === "teaching_available" || r.readiness === "partly_prepared";

export function proposeRoute(input: RouteInput): RouteProposal {
  const { blocks, learner, prerequisites, courseTitles } = input;
  const taking = new Set(learner.activeCourses.map((c) => c.courseId));
  const ordered = [...blocks].sort((a, b) => a.block.sequence - b.block.sequence);
  const open = ordered.filter((b) => isOpen(b.report));
  const preparedMappings = (b: (typeof blocks)[number]) =>
    b.block.courseMappings.filter((m) => m.unitIds.some((u) => b.report.preparedUnitIds.includes(u)));
  const unmet = (courseId: string) => (prerequisites.get(courseId) ?? []).filter((r) => !r.satisfied);

  // Keep the learner's own focus while it can still be studied; fill up from the rest, preferring
  // blocks served by courses already taken, then blocks whose courses' prerequisites are all met.
  const kept = learner.focusBlockIds.filter((id) => open.some((b) => b.block.id === id)).slice(0, MAX_FOCUS);
  const score = (b: (typeof blocks)[number]) =>
    (preparedMappings(b).some((m) => taking.has(m.courseId)) ? 2 : 0) +
    (preparedMappings(b).every((m) => unmet(m.courseId).length === 0) ? 1 : 0);
  const candidates = open
    .filter((b) => !kept.includes(b.block.id))
    .map((b, index) => ({ b, index, score: score(b) }))
    .sort((x, y) => y.score - x.score || x.index - y.index)
    .map((x) => x.b.block.id);
  const focusBlockIds = [...kept, ...candidates].slice(0, MAX_FOCUS);

  // One step per course, however many focus blocks it serves.
  const byCourse = new Map<string, { blockIds: string[]; unitIds: string[] }>();
  for (const id of focusBlockIds) {
    const b = open.find((x) => x.block.id === id)!;
    for (const m of preparedMappings(b)) {
      const entry = byCourse.get(m.courseId) ?? { blockIds: [], unitIds: [] };
      entry.blockIds.push(id);
      for (const u of m.unitIds.filter((u) => b.report.preparedUnitIds.includes(u))) if (!entry.unitIds.includes(u)) entry.unitIds.push(u);
      byCourse.set(m.courseId, entry);
    }
  }

  let mainFree = Math.max(0, learner.load.mainCourseLimit - learner.load.main);
  let exploratoryFree = Math.max(0, learner.load.exploratoryLimit - learner.load.exploratory);
  let newCourses = 0;
  const title = (id: string) => courseTitles.get(id) ?? id;
  const steps: RouteStep[] = [];
  // Courses already taken first, so the route starts from existing studies.
  const courseOrder = [...byCourse.keys()].sort((a, b) => Number(taking.has(b)) - Number(taking.has(a)));
  for (const courseId of courseOrder) {
    const { blockIds, unitIds } = byCourse.get(courseId)!;
    const serves = `${unitIds.join(", ")} for ${blockIds.join(" and ")}`;
    if (taking.has(courseId)) {
      steps.push({ courseId, title: title(courseId), blockIds, unitIds, action: "continue", why: `You already take it; ${serves}.` });
      continue;
    }
    if (newCourses >= MAX_NEW_COURSES) continue;
    newCourses += 1;
    const missing = unmet(courseId);
    const hard = missing.filter((r) => r.strength === "hard");
    const preparation = missing.length ? ` Preparation not yet shown: ${missing.map((r) => r.ruleId).join(", ")}.` : "";
    let action: RouteAction;
    let why: string;
    if (hard.length) {
      action = exploratoryFree > 0 ? "audit_or_read" : "later";
      if (action === "audit_or_read") exploratoryFree -= 1;
      why = `A required prerequisite is not met yet (${hard.map((r) => r.ruleId).join(", ")}), so audit or read it, or take a bridge first; ${serves}.`;
    } else if (mainFree > 0) {
      action = "enrol";
      mainFree -= 1;
      why = `Serves ${serves}.${preparation}`;
    } else if (exploratoryFree > 0) {
      action = "audit_or_read";
      exploratoryFree -= 1;
      why = `Your chosen load has no free main place, so audit or read it alongside, or enrol later; ${serves}.${preparation}`;
    } else {
      action = "later";
      why = `Your chosen load is full; take it when a place frees up; ${serves}.${preparation}`;
    }
    steps.push({ courseId, title: title(courseId), blockIds, unitIds, action, why });
  }

  const routeCourses = steps.map((s) => s.courseId);
  const recognised = routeCourses.flatMap((courseId) =>
    (prerequisites.get(courseId) ?? []).flatMap((r) =>
      r.satisfied && r.basis !== "none" ? [{ courseId, description: r.description, basis: r.basis, satisfiedBy: r.satisfiedBy ?? "" }] : [],
    ),
  );
  const toPrepare = routeCourses.flatMap((courseId) =>
    unmet(courseId).map((r) => ({
      courseId,
      description: r.description,
      strength: r.strength,
      alternativeCourseIds: r.alternativeCourseIds,
    })),
  );
  const notYetPrepared = ordered.filter((b) => !isOpen(b.report)).map((b) => b.block.id);
  const changed = learner.focusBlockIds.length !== focusBlockIds.length || learner.focusBlockIds.some((id) => !focusBlockIds.includes(id));
  const focusChange = changed ? { before: [...learner.focusBlockIds], after: focusBlockIds } : null;

  const rationale = [
    focusBlockIds.length
      ? `Begin with ${focusBlockIds.join(" and ")}: their mapped units can be studied now.${kept.length ? ` ${kept.join(" and ")} ${kept.length === 1 ? "is" : "are"} kept from your current focus.` : ""}`
      : "No block of this programme has a prepared unit yet; following it records your interest and shows each block's status.",
    recognised.length
      ? `Recognised: ${recognised.length} prerequisite${recognised.length === 1 ? "" : "s"} already met (${recognised.filter((r) => r.basis === "self_report").length} by your own report, shown as unverified).`
      : "",
    toPrepare.length
      ? `To prepare: ${toPrepare.length} prerequisite${toPrepare.length === 1 ? "" : "s"} not yet shown; each lists what would meet it.`
      : "",
    notYetPrepared.length ? `Not yet prepared: ${notYetPrepared.join(", ")}. They stay visible with that label.` : "",
    "Confirming sets your focus; it enrols you in nothing. Enrol from each course page, after its workload preview.",
  ].filter(Boolean);

  return { focusBlockIds, steps, recognised, toPrepare, notYetPrepared, focusChange, rationale };
}
