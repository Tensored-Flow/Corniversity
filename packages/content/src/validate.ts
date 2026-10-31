import { runDeterministicChecks } from "@corniversity/core/checks/deterministic";
import type { ContentBundle, LoadedCourse } from "./schema";

export interface Issue {
  level: "error" | "warning";
  where: string;
  message: string;
}

export interface ValidationReport {
  issues: Issue[];
  stats: {
    departments: number;
    courses: number;
    byReadiness: Record<string, number>;
    launchCourses: number;
    launchTeachingReady: number;
    units: number;
    unitsReady: number;
    exercises: number;
    sources: number;
    verifiedLocators: number;
    personas: number;
  };
}

/**
 * Referential integrity plus the honesty rules: a course may only carry the readiness it has
 * earned. These rules are the single place where "teaching_ready" is defined.
 */
export function validateContent(bundle: ContentBundle): ValidationReport {
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ level: "error", where, message });
  const warn = (where: string, message: string) => issues.push({ level: "warning", where, message });

  const departmentIds = new Set<string>(bundle.departments.map((d) => d.id));
  const conceptIds = new Set(bundle.concepts.map((c) => c.id));
  const courseIds = new Set(bundle.courses.map((c) => c.spec.id));
  const personaIds = new Set(bundle.personas.map((p) => p.id));
  const ruleIds = new Set(bundle.prerequisiteRules.map((r) => r.id));
  const sourceById = new Map(bundle.sources.map((s) => [s.id, s]));
  const locatorIds = new Set<string>();
  let verifiedLocators = 0;

  for (const source of bundle.sources) {
    const versionIds = new Set(source.versions.map((v) => v.id));
    if (!versionIds.has(source.currentVersionId))
      err(`sources/${source.id}`, `currentVersionId ${source.currentVersionId} is not a version`);
    for (const version of source.versions) {
      for (const loc of version.locators) {
        if (locatorIds.has(loc.id)) err(`sources/${source.id}`, `duplicate locator id ${loc.id}`);
        locatorIds.add(loc.id);
        if (loc.locator.sourceVersionId !== version.id)
          err(`sources/${source.id}`, `locator ${loc.id} points at a different source version`);
        verifiedLocators++;
      }
    }
  }

  for (const concept of bundle.concepts) {
    if (!departmentIds.has(concept.departmentId)) err(`concepts/${concept.id}`, `unknown department ${concept.departmentId}`);
  }
  for (const persona of bundle.personas) {
    if (persona.departmentId && !departmentIds.has(persona.departmentId))
      err(`personas/${persona.id}`, `unknown department ${persona.departmentId}`);
  }
  for (const society of bundle.societies) {
    if (society.chairPersonaId && !personaIds.has(society.chairPersonaId)) err(`societies/${society.id}`, `unknown chair persona`);
  }
  for (const rule of bundle.prerequisiteRules) {
    if (!courseIds.has(rule.courseId)) err(`prerequisites/${rule.id}`, `unknown course ${rule.courseId}`);
    for (const alt of rule.alternatives) {
      for (const c of alt.conceptIds) if (!conceptIds.has(c)) err(`prerequisites/${rule.id}`, `unknown concept ${c}`);
      for (const c of alt.courseIds) if (!courseIds.has(c)) err(`prerequisites/${rule.id}`, `unknown course ${c}`);
      if (alt.bridgeCourseId && !courseIds.has(alt.bridgeCourseId)) err(`prerequisites/${rule.id}`, `unknown bridge ${alt.bridgeCourseId}`);
    }
  }
  for (const programme of bundle.programmes) {
    for (const stage of programme.stages) {
      for (const c of stage.courses) if (!courseIds.has(c.courseId)) err(`programmes/${programme.id}`, `unknown course ${c.courseId}`);
    }
  }
  for (const department of bundle.departments) {
    for (const path of department.paths) {
      for (const c of path.courseIds)
        if (!courseIds.has(c)) err(`departments/${department.id}`, `path "${path.title}" references unknown course ${c}`);
    }
    for (const p of department.facultyPersonaIds) if (!personaIds.has(p)) err(`departments/${department.id}`, `unknown persona ${p}`);
  }

  const byReadiness: Record<string, number> = {};
  let units = 0;
  let unitsReady = 0;
  let exercises = 0;
  let launchCourses = 0;
  let launchTeachingReady = 0;

  for (const course of bundle.courses) {
    const where = `courses/${course.spec.id}`;
    const spec = course.spec;
    byReadiness[spec.readiness] = (byReadiness[spec.readiness] ?? 0) + 1;
    if (spec.launch) launchCourses++;
    for (const d of spec.departmentIds) if (!departmentIds.has(d)) err(where, `unknown department ${d}`);
    for (const r of spec.prerequisiteRuleIds) if (!ruleIds.has(r)) err(where, `unknown prerequisite rule ${r}`);
    for (const c of [...spec.recommendedConceptIds, ...spec.teachesConceptIds]) if (!conceptIds.has(c)) err(where, `unknown concept ${c}`);
    for (const p of [spec.convenorPersonaId, spec.tutorPersonaId]) if (p && !personaIds.has(p)) err(where, `unknown persona ${p}`);
    const primaryVerified = spec.primarySourceIds.filter((id) => {
      const s = sourceById.get(id);
      if (!s) {
        err(where, `unknown primary source ${id}`);
        return false;
      }
      return s.versions.some((v) => v.id === s.currentVersionId && v.verifiedAt);
    });
    for (const id of spec.supplementalSourceIds) if (!sourceById.has(id)) err(where, `unknown supplemental source ${id}`);

    const unitIdsDeclared = new Set(spec.unitIds);
    const unitIdsFound = new Set(course.units.map((u) => u.spec.id));
    for (const id of unitIdsDeclared) if (!unitIdsFound.has(id)) err(where, `declared unit ${id} has no folder`);
    for (const id of unitIdsFound) if (!unitIdsDeclared.has(id)) warn(where, `unit folder ${id} is not listed in unitIds`);

    let readyUnits = 0;
    let unitsWithVerifiedPrep = 0;
    for (const unit of course.units) {
      units++;
      const uwhere = `${where}/units/${unit.spec.id}`;
      if (unit.spec.courseId !== spec.id) err(uwhere, `unit courseId ${unit.spec.courseId} does not match course`);
      for (const c of [...unit.spec.prerequisiteConceptIds, ...unit.spec.teachesConceptIds])
        if (!conceptIds.has(c)) err(uwhere, `unknown concept ${c}`);
      const prepOk = unit.spec.preparation.length > 0 && unit.spec.preparation.every((p) => locatorIds.has(p.locatorId));
      for (const p of unit.spec.preparation)
        if (!locatorIds.has(p.locatorId)) err(uwhere, `preparation locator ${p.locatorId} does not exist`);
      if (prepOk) unitsWithVerifiedPrep++;
      for (const a of unit.spec.activities) {
        for (const l of a.sourceLocatorIds) if (!locatorIds.has(l)) err(uwhere, `activity ${a.id} locator ${l} does not exist`);
        const exerciseIds = new Set(unit.exercises.map((e) => e.id));
        for (const e of a.exerciseIds) if (!exerciseIds.has(e)) err(uwhere, `activity ${a.id} references unknown exercise ${e}`);
      }
      const exerciseIds = new Set(unit.exercises.map((e) => e.id));
      for (const e of unit.spec.exerciseIds) if (!exerciseIds.has(e)) err(uwhere, `exerciseIds lists unknown exercise ${e}`);
      if (unit.spec.exitCheck.exerciseId && !exerciseIds.has(unit.spec.exitCheck.exerciseId)) err(uwhere, `exit check exercise missing`);
      for (const exercise of unit.exercises) {
        exercises++;
        for (const c of exercise.conceptIds) if (!conceptIds.has(c)) err(uwhere, `exercise ${exercise.id} unknown concept ${c}`);
        if (exercise.externalLocatorId && !locatorIds.has(exercise.externalLocatorId))
          err(uwhere, `exercise ${exercise.id} external locator missing`);
        if (exercise.origin === "adapted_with_attribution" && !exercise.attribution)
          err(uwhere, `exercise ${exercise.id} adapted without attribution`);
        for (const check of exercise.deterministicChecks) {
          for (const key of ["patterns", "triggerPatterns", "hypothesisPatterns"]) {
            const raw = check.params[key];
            if (!Array.isArray(raw)) continue;
            for (const pattern of raw) {
              try {
                new RegExp(String(pattern), "i");
              } catch (error) {
                err(
                  uwhere,
                  `exercise ${exercise.id} check ${check.id}: invalid pattern ${JSON.stringify(pattern)} (${(error as Error).message})`,
                );
              }
            }
          }
        }
        if (exercise.deterministicChecks.length > 0 && exercise.checkExamples.length === 0 && unit.spec.status === "ready") {
          warn(uwhere, `exercise ${exercise.id} has automatic checks but no sample texts proving they behave`);
        }
        for (const example of exercise.checkExamples) {
          const results = runDeterministicChecks(example.text, exercise.deterministicChecks);
          for (const [checkId, expected] of Object.entries(example.expect)) {
            const result = results.find((r) => r.checkId === checkId);
            if (!result) err(uwhere, `exercise ${exercise.id} example "${example.label}" expects unknown check ${checkId}`);
            else if (result.passed !== expected)
              err(
                uwhere,
                `exercise ${exercise.id} example "${example.label}": check ${checkId} ${result.passed ? "passed" : "failed"} but expected ${expected ? "pass" : "fail"} (${result.detail})`,
              );
          }
        }
      }
      for (const file of unit.spec.instructorFiles) {
        if (!unit.instructor.some((i) => i.file === file)) err(uwhere, `instructor file ${file} missing`);
      }
      for (const artifact of unit.instructor) {
        if (artifact.exerciseId && !exerciseIds.has(artifact.exerciseId))
          err(uwhere, `instructor file ${artifact.file} names unknown exercise`);
      }
      if (unit.lessonMarkdown.trim().length < 400 && unit.spec.status === "ready")
        err(uwhere, `ready unit has a lesson under 400 characters`);
      if (unit.spec.status === "ready") {
        if (!prepOk) err(uwhere, `ready unit lacks verified preparation locators`);
        if (unit.exercises.length === 0) err(uwhere, `ready unit has no exercises`);
        const withReference = unit.exercises.filter((e) =>
          unit.instructor.some((i) => i.exerciseId === e.id && i.kind === "reference_solution"),
        );
        if (withReference.length === 0) err(uwhere, `ready unit has no instructor reference reasoning for any exercise`);
        if (!unit.spec.checks.some((c) => c.name === "source-locators" && c.result === "pass"))
          err(uwhere, `ready unit lacks a passing source-locators check`);
        if (!unit.spec.checks.some((c) => c.name === "mathematical-review" && c.result === "pass"))
          err(uwhere, `ready unit lacks a passing mathematical-review check`);
        readyUnits++;
        unitsReady++;
      }
    }

    // Readiness ladder: each rung requires the ones below it.
    const hasVerifiedPrimary = primaryVerified.length > 0;
    const allUnitsOutlined = spec.unitIds.length >= 6 && course.units.length === spec.unitIds.length;
    const allUnitsLocated = unitsWithVerifiedPrep === course.units.length && course.units.length > 0;
    const firstTwoReady = course.units.length >= 2 && course.units.slice(0, 2).every((u) => u.spec.status === "ready");
    const rank: Record<string, number> = { proposed: 0, resource_blocked: 0, source_verified: 1, syllabus_ready: 2, teaching_ready: 3 };
    const rung = rank[spec.readiness] ?? 0;
    if (spec.readiness === "resource_blocked" && spec.blockers.length === 0)
      err(where, `resource_blocked requires at least one blocker with a resolution action`);
    if (spec.readiness === "proposed" && course.units.some((u) => u.spec.status === "ready"))
      warn(where, `proposed course has ready units; consider raising readiness`);
    if (rung >= 1 && !hasVerifiedPrimary) err(where, `${spec.readiness} requires a verified primary source`);
    if (rung >= 2) {
      if (!allUnitsOutlined)
        err(
          where,
          `syllabus_ready requires a complete outlined sequence of at least 6 units (have ${course.units.length}, declared ${spec.unitIds.length})`,
        );
      if (spec.outcomes.length < 3) err(where, `syllabus_ready requires at least three outcomes`);
      if (spec.assessmentSpecs.length === 0) err(where, `syllabus_ready requires an assessment design`);
    }
    if (rung >= 3) {
      if (!firstTwoReady) err(where, `teaching_ready requires the first two units to be ready (ready units: ${readyUnits})`);
      if (!allUnitsLocated) err(where, `teaching_ready requires verified preparation locators on every unit`);
    }
    if (spec.launch && spec.readiness === "teaching_ready") launchTeachingReady++;
  }

  return {
    issues,
    stats: {
      departments: bundle.departments.length,
      courses: bundle.courses.length,
      byReadiness,
      launchCourses,
      launchTeachingReady,
      units,
      unitsReady,
      exercises,
      sources: bundle.sources.length,
      verifiedLocators,
      personas: bundle.personas.length,
    },
  };
}

export function formatReport(report: ValidationReport): string {
  const lines: string[] = [];
  const errors = report.issues.filter((i) => i.level === "error");
  const warnings = report.issues.filter((i) => i.level === "warning");
  for (const issue of report.issues) lines.push(`${issue.level.toUpperCase().padEnd(7)} ${issue.where}: ${issue.message}`);
  const s = report.stats;
  lines.push("");
  lines.push(
    `departments ${s.departments} · courses ${s.courses} (launch ${s.launchCourses}, launch teaching_ready ${s.launchTeachingReady})`,
  );
  lines.push(
    `readiness: ${
      Object.entries(s.byReadiness)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ") || "none"
    }`,
  );
  lines.push(
    `units ${s.units} (ready ${s.unitsReady}) · exercises ${s.exercises} · sources ${s.sources} · verified locators ${s.verifiedLocators} · personas ${s.personas}`,
  );
  lines.push(`${errors.length} error(s), ${warnings.length} warning(s)`);
  return lines.join("\n");
}

export function courseSummary(course: LoadedCourse): string {
  return `${course.spec.id} ${course.spec.title} [${course.spec.readiness}] units ${course.units.length} ready ${course.units.filter((u) => u.spec.status === "ready").length}`;
}
