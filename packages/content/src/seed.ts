import { createHash } from "node:crypto";
import type { Database } from "@corniversity/db/client";
import {
  concept,
  course,
  courseDepartment,
  courseVersion,
  department,
  instructorArtifact,
  locator,
  persona,
  prerequisiteRule,
  programme,
  society,
  source,
  sourceVersion,
  teachingUnit,
  unitExercise,
} from "@corniversity/db/schema/index";
import { and, eq } from "drizzle-orm";
import type { ContentBundle, LoadedCourse } from "./schema";

export interface SeedReport {
  departments: number;
  concepts: number;
  sources: number;
  locators: number;
  personas: number;
  societies: number;
  programmes: number;
  prerequisiteRules: number;
  coursesInserted: number;
  courseVersionsCreated: number;
  courseVersionsUnchanged: number;
  units: number;
  exercises: number;
  instructorArtifacts: number;
}

function hashCourse(course: LoadedCourse): string {
  const h = createHash("sha256");
  h.update(JSON.stringify(course.spec));
  for (const unit of course.units) {
    h.update(JSON.stringify(unit.spec));
    h.update(unit.lessonMarkdown);
    for (const e of unit.exercises) h.update(JSON.stringify(e));
    for (const i of unit.instructor) h.update(i.file).update(i.markdown);
  }
  return h.digest("hex");
}

/**
 * Seeds institution content (never learner data). Courses are versioned by content hash: an
 * unchanged course keeps its current version; a changed one gets a new version row and the old
 * one is marked not current, so existing enrolments keep pointing at the version they used.
 */
export async function seedContent(db: Database, bundle: ContentBundle): Promise<SeedReport> {
  const report: SeedReport = {
    departments: 0,
    concepts: 0,
    sources: 0,
    locators: 0,
    personas: 0,
    societies: 0,
    programmes: 0,
    prerequisiteRules: 0,
    coursesInserted: 0,
    courseVersionsCreated: 0,
    courseVersionsUnchanged: 0,
    units: 0,
    exercises: 0,
    instructorArtifacts: 0,
  };

  await db.transaction(async (tx) => {
    for (const [i, d] of bundle.departments.entries()) {
      await tx
        .insert(department)
        .values({ ...d, sort: i })
        .onConflictDoUpdate({
          target: department.id,
          set: {
            title: d.title,
            shortTitle: d.shortTitle,
            identity: d.identity,
            emblem: d.emblem,
            paths: d.paths,
            facultyPersonaIds: d.facultyPersonaIds,
            conventions: d.conventions,
            sort: i,
          },
        });
      report.departments++;
    }
    for (const c of bundle.concepts) {
      await tx
        .insert(concept)
        .values(c)
        .onConflictDoUpdate({ target: concept.id, set: { title: c.title, departmentId: c.departmentId, description: c.description } });
      report.concepts++;
    }
    for (const s of bundle.sources) {
      await tx
        .insert(source)
        .values({
          id: s.id,
          title: s.title,
          authors: s.authors,
          institution: s.institution ?? null,
          kind: s.kind,
          canonicalUrl: s.canonicalUrl,
          description: s.description ?? null,
          isbn: s.isbn ?? null,
          codeLicence: s.codeLicence ?? null,
          rightsNotes: s.rightsNotes,
          currentVersionId: s.currentVersionId,
        })
        .onConflictDoUpdate({
          target: source.id,
          set: {
            title: s.title,
            authors: s.authors,
            institution: s.institution ?? null,
            kind: s.kind,
            canonicalUrl: s.canonicalUrl,
            description: s.description ?? null,
            isbn: s.isbn ?? null,
            codeLicence: s.codeLicence ?? null,
            rightsNotes: s.rightsNotes,
            currentVersionId: s.currentVersionId,
          },
        });
      report.sources++;
      for (const v of s.versions) {
        await tx
          .insert(sourceVersion)
          .values({
            id: v.id,
            sourceId: s.id,
            label: v.label,
            url: v.url,
            verifiedAt: v.verifiedAt,
            verifiedBy: v.verifiedBy,
            componentsSeen: v.componentsSeen,
            licence: v.licence,
            licenceUrl: v.licenceUrl ?? null,
            accessStatus: v.accessStatus,
            importAllowed: v.importAllowed,
            importHosts: v.importHosts,
            limitations: v.limitations,
            isCurrent: v.id === s.currentVersionId,
          })
          .onConflictDoUpdate({
            target: sourceVersion.id,
            set: {
              label: v.label,
              url: v.url,
              verifiedAt: v.verifiedAt,
              verifiedBy: v.verifiedBy,
              componentsSeen: v.componentsSeen,
              licence: v.licence,
              licenceUrl: v.licenceUrl ?? null,
              accessStatus: v.accessStatus,
              importAllowed: v.importAllowed,
              importHosts: v.importHosts,
              limitations: v.limitations,
              isCurrent: v.id === s.currentVersionId,
            },
          });
        for (const l of v.locators) {
          await tx
            .insert(locator)
            .values({
              id: l.id,
              sourceVersionId: v.id,
              kind: l.locator.kind,
              payload: l.locator,
              label: l.label,
              verifiedAt: l.verifiedAt,
              note: l.note ?? null,
            })
            .onConflictDoUpdate({
              target: locator.id,
              set: {
                sourceVersionId: v.id,
                kind: l.locator.kind,
                payload: l.locator,
                label: l.label,
                verifiedAt: l.verifiedAt,
                note: l.note ?? null,
              },
            });
          report.locators++;
        }
      }
    }
    for (const p of bundle.personas) {
      await tx
        .insert(persona)
        .values({ ...p, departmentId: p.departmentId ?? null })
        .onConflictDoUpdate({
          target: persona.id,
          set: {
            version: p.version,
            name: p.name,
            role: p.role,
            title: p.title,
            departmentId: p.departmentId ?? null,
            style: p.style,
            introduction: p.introduction,
            avatarKey: p.avatarKey,
            promptKey: p.promptKey,
            isPeer: p.isPeer,
          },
        });
      report.personas++;
    }
    for (const s of bundle.societies) {
      await tx
        .insert(society)
        .values({ ...s, departmentId: s.departmentId ?? null, chairPersonaId: s.chairPersonaId ?? null })
        .onConflictDoUpdate({
          target: society.id,
          set: {
            title: s.title,
            description: s.description,
            departmentId: s.departmentId ?? null,
            cadence: s.cadence,
            chairPersonaId: s.chairPersonaId ?? null,
          },
        });
      report.societies++;
    }
    for (const p of bundle.programmes) {
      await tx
        .insert(programme)
        .values(p)
        .onConflictDoUpdate({
          target: programme.id,
          set: { title: p.title, description: p.description, departmentIds: p.departmentIds, stages: p.stages },
        });
      report.programmes++;
    }

    for (const c of bundle.courses) {
      const spec = c.spec;
      const inserted = await tx
        .insert(course)
        .values({
          id: spec.id,
          title: spec.title,
          primaryDepartmentId: spec.departmentIds[0]!,
          level: spec.level,
          position: spec.position,
          launch: spec.launch,
        })
        .onConflictDoUpdate({
          target: course.id,
          set: {
            title: spec.title,
            primaryDepartmentId: spec.departmentIds[0]!,
            level: spec.level,
            position: spec.position,
            launch: spec.launch,
          },
        })
        .returning({ id: course.id });
      if (inserted.length) report.coursesInserted++;
      await tx.delete(courseDepartment).where(eq(courseDepartment.courseId, spec.id));
      for (const d of spec.departmentIds) await tx.insert(courseDepartment).values({ courseId: spec.id, departmentId: d });
    }
    for (const r of bundle.prerequisiteRules) {
      await tx
        .insert(prerequisiteRule)
        .values(r)
        .onConflictDoUpdate({
          target: prerequisiteRule.id,
          set: { courseId: r.courseId, strength: r.strength, description: r.description, alternatives: r.alternatives },
        });
      report.prerequisiteRules++;
    }

    for (const c of bundle.courses) {
      const spec = c.spec;
      const contentHash = hashCourse(c);
      const [current] = await tx
        .select()
        .from(courseVersion)
        .where(and(eq(courseVersion.courseId, spec.id), eq(courseVersion.isCurrent, true)))
        .limit(1);
      if (current && current.contentHash === contentHash) {
        report.courseVersionsUnchanged++;
        continue;
      }
      if (current) {
        await tx.update(courseVersion).set({ isCurrent: false }).where(eq(courseVersion.id, current.id));
      }
      const nextVersion = (current?.version ?? 0) + 1;
      const [created] = await tx
        .insert(courseVersion)
        .values({
          courseId: spec.id,
          version: nextVersion,
          contentHash,
          readiness: spec.readiness,
          purpose: spec.purpose,
          description: spec.description,
          workload: spec.workloadHours,
          outcomes: spec.outcomes,
          assessmentSpecs: spec.assessmentSpecs,
          blockers: spec.blockers,
          provenance: spec.provenance,
          primarySourceIds: spec.primarySourceIds,
          supplementalSourceIds: spec.supplementalSourceIds,
          modesOffered: spec.modesOffered,
          recommendedConceptIds: spec.recommendedConceptIds,
          teachesConceptIds: spec.teachesConceptIds,
          prerequisiteRuleIds: spec.prerequisiteRuleIds,
          convenorPersonaId: spec.convenorPersonaId ?? null,
          tutorPersonaId: spec.tutorPersonaId ?? null,
          externalSyllabusNote: spec.externalSyllabusNote ?? null,
          isCurrent: true,
        })
        .returning({ id: courseVersion.id });
      if (!created) throw new Error(`could not create course version for ${spec.id}`);
      report.courseVersionsCreated++;

      for (const unit of c.units) {
        // Unit ids are stable across versions; the unit row follows the current version.
        const unitId = unit.spec.id;
        await tx
          .insert(teachingUnit)
          .values({
            id: unitId,
            courseVersionId: created.id,
            sequence: unit.spec.sequence,
            title: unit.spec.title,
            summary: unit.spec.summary,
            objectives: unit.spec.objectives,
            prerequisiteConceptIds: unit.spec.prerequisiteConceptIds,
            teachesConceptIds: unit.spec.teachesConceptIds,
            preparation: unit.spec.preparation,
            activities: unit.spec.activities,
            exitCheck: unit.spec.exitCheck,
            misconceptions: unit.spec.commonMisconceptions,
            estimatedMinutes: unit.spec.estimatedMinutes,
            status: unit.spec.status,
            checks: unit.spec.checks,
            lessonMarkdown: unit.lessonMarkdown,
          })
          .onConflictDoUpdate({
            target: teachingUnit.id,
            set: {
              courseVersionId: created.id,
              sequence: unit.spec.sequence,
              title: unit.spec.title,
              summary: unit.spec.summary,
              objectives: unit.spec.objectives,
              prerequisiteConceptIds: unit.spec.prerequisiteConceptIds,
              teachesConceptIds: unit.spec.teachesConceptIds,
              preparation: unit.spec.preparation,
              activities: unit.spec.activities,
              exitCheck: unit.spec.exitCheck,
              misconceptions: unit.spec.commonMisconceptions,
              estimatedMinutes: unit.spec.estimatedMinutes,
              status: unit.spec.status,
              checks: unit.spec.checks,
              lessonMarkdown: unit.lessonMarkdown,
            },
          });
        report.units++;
        for (const e of unit.exercises) {
          await tx
            .insert(unitExercise)
            .values({
              id: e.id,
              unitId,
              sequence: e.sequence,
              title: e.title,
              kind: e.kind,
              promptMarkdown: e.promptMarkdown,
              conceptIds: e.conceptIds,
              hintLadder: e.hintLadder,
              deterministicChecks: e.deterministicChecks,
              rubric: e.rubric,
              rubricVersion: e.rubric.version,
              origin: e.origin,
              attribution: e.attribution ?? null,
              externalLocatorId: e.externalLocatorId ?? null,
              estimatedMinutes: e.estimatedMinutes,
            })
            .onConflictDoUpdate({
              target: unitExercise.id,
              set: {
                unitId,
                sequence: e.sequence,
                title: e.title,
                kind: e.kind,
                promptMarkdown: e.promptMarkdown,
                conceptIds: e.conceptIds,
                hintLadder: e.hintLadder,
                deterministicChecks: e.deterministicChecks,
                rubric: e.rubric,
                rubricVersion: e.rubric.version,
                origin: e.origin,
                attribution: e.attribution ?? null,
                externalLocatorId: e.externalLocatorId ?? null,
                estimatedMinutes: e.estimatedMinutes,
              },
            });
          report.exercises++;
        }
        // Instructor artifacts are replaced wholesale for the unit (they are not learner data).
        await tx.delete(instructorArtifact).where(eq(instructorArtifact.unitId, unitId));
        for (const a of unit.instructor) {
          await tx.insert(instructorArtifact).values({
            unitId,
            exerciseId: a.exerciseId ?? null,
            kind: a.kind,
            markdown: a.markdown,
            releasePolicy: a.kind === "reference_solution" ? "on_request_practice" : "never",
          });
          report.instructorArtifacts++;
        }
      }
    }
  });
  return report;
}
