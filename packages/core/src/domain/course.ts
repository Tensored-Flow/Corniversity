import { z } from "zod";
import { CourseReadiness, LearningMode, UnitStatus } from "./enums";

export const DepartmentId = z.enum(["mathematics", "physics", "chemistry", "computer-science-ai", "neuroscience", "cognitive-science"]);
export type DepartmentId = z.infer<typeof DepartmentId>;

export const CourseId = z.string().regex(/^[A-Z]{3}-\d{3}$/, "course ids look like MAT-230");

export const Outcome = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  evidenceExpected: z.string().min(1),
});
export type Outcome = z.infer<typeof Outcome>;

export const Workload = z.object({
  minimum: z.number().positive(),
  typical: z.number().positive(),
  maximum: z.number().positive(),
});
export type Workload = z.infer<typeof Workload>;

export const Blocker = z.object({
  type: z.enum(["source", "resource", "prerequisite_data", "review", "licence"]),
  reason: z.string().min(1),
  resolutionAction: z.string().min(1),
});
export type Blocker = z.infer<typeof Blocker>;

export const AssessmentSpec = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum([
    "problem_set",
    "proof_portfolio",
    "written_explanation",
    "oral_explanation",
    "computational_notebook",
    "lab_report",
    "project",
    "synthesis_seminar",
    "timed_paper",
  ]),
  description: z.string().min(1),
  weight: z.number().min(0).max(1).optional(),
  rubricSummary: z.array(z.string()).default([]),
});
export type AssessmentSpec = z.infer<typeof AssessmentSpec>;

export const Provenance = z.object({
  authoringMethod: z.string().min(1),
  verifiedAt: z.string().date().optional(),
  reviewerNotes: z.array(z.string()).default([]),
});
export type Provenance = z.infer<typeof Provenance>;

/** Course-level record as authored in content/courses/<ID>/course.json. */
export const CourseSpec = z.object({
  id: CourseId,
  version: z.number().int().positive(),
  title: z.string().min(1),
  departmentIds: z.array(DepartmentId).min(1),
  level: z.enum(["bridge", "foundation", "intermediate", "advanced", "graduate"]),
  position: z.string().min(1), // catalogue wording from Appendix A
  launch: z.boolean().default(false),
  purpose: z.string().min(1),
  description: z.string().min(1),
  outcomes: z.array(Outcome).default([]),
  prerequisiteRuleIds: z.array(z.string()).default([]),
  recommendedConceptIds: z.array(z.string()).default([]),
  teachesConceptIds: z.array(z.string()).default([]),
  primarySourceIds: z.array(z.string()).default([]),
  supplementalSourceIds: z.array(z.string()).default([]),
  unitIds: z.array(z.string()).default([]),
  assessmentSpecs: z.array(AssessmentSpec).default([]),
  workloadHours: Workload,
  readiness: CourseReadiness,
  blockers: z.array(Blocker).default([]),
  provenance: Provenance,
  modesOffered: z.array(LearningMode).default(["enrolled", "audit"]),
  convenorPersonaId: z.string().optional(),
  tutorPersonaId: z.string().optional(),
  // Distinguishes the source institution's own syllabus from the Corniversity adaptation.
  externalSyllabusNote: z.string().optional(),
  // Catalogue notes for a course that is not yet prepared. All optional and without defaults, so
  // records that do not use them parse (and hash) exactly as before.
  /** The question the course exists to answer. */
  centralQuestion: z.string().min(1).optional(),
  /** What to know first and which bridge serves; guidance, not a verified prerequisite rule. */
  prerequisiteGuidance: z.string().min(1).optional(),
  /** How the course would be prepared next: sources to resolve, first unit to write. */
  preparationPath: z.string().min(1).optional(),
  /** Assessed activities the course is designed around before any of them is prepared. */
  plannedActivities: z.array(z.string().min(1)).optional(),
  /** Named leads that are not yet verified sources. Shown as leads; never cited. */
  sourceCandidates: z.array(z.object({ name: z.string().min(1), note: z.string().min(1) })).optional(),
});
export type CourseSpec = z.infer<typeof CourseSpec>;

/** The catalogue notes above, stored with each course version. */
export const CatalogueNotes = CourseSpec.pick({
  centralQuestion: true,
  prerequisiteGuidance: true,
  preparationPath: true,
  plannedActivities: true,
  sourceCandidates: true,
});
export type CatalogueNotes = z.infer<typeof CatalogueNotes>;

export const ActivityType = z.enum([
  "reading",
  "lecture",
  "worked_example",
  "problem",
  "proof_workshop",
  "discussion",
  "lab",
  "retrieval_practice",
  "explain_back",
  "project",
]);
export type ActivityType = z.infer<typeof ActivityType>;

export const SessionKind = z.enum(["lecture", "tutorial", "problem_class", "seminar", "lab", "revision", "oral", "project"]);
export type SessionKind = z.infer<typeof SessionKind>;

export const Activity = z.object({
  id: z.string().min(1),
  type: ActivityType,
  title: z.string().min(1),
  instructions: z.string().min(1),
  estimatedMinutes: z.number().int().positive(),
  sourceLocatorIds: z.array(z.string()).default([]),
  exerciseIds: z.array(z.string()).default([]),
  labId: z.string().optional(),
  sessionKind: SessionKind,
});
export type Activity = z.infer<typeof Activity>;

export const Preparation = z.object({
  description: z.string().min(1),
  locatorId: z.string().min(1),
  estimatedMinutes: z.number().int().positive().optional(),
});
export type Preparation = z.infer<typeof Preparation>;

export const UnitCheck = z.object({
  name: z.string().min(1),
  result: z.enum(["pass", "fail", "needs_review"]),
  evidence: z.string().min(1),
});
export type UnitCheck = z.infer<typeof UnitCheck>;

export const Misconception = z.object({
  claim: z.string().min(1),
  correction: z.string().min(1),
  correctionLocatorIds: z.array(z.string()).default([]),
});
export type Misconception = z.infer<typeof Misconception>;

export const HintLadder = z.array(z.string().min(1)).max(6);

export const DeterministicCheck = z.object({
  id: z.string().min(1),
  kind: z.enum(["expression_present", "numeric_value", "forbidden_claim", "requires_hypothesis", "finite_examples_not_proof"]),
  description: z.string().min(1),
  params: z.record(z.string(), z.unknown()),
});
export type DeterministicCheck = z.infer<typeof DeterministicCheck>;

export const RubricCriterion = z.object({
  id: z.string().min(1),
  criterion: z.string().min(1),
  weight: z.number().min(0).max(1),
  levels: z.array(z.object({ label: z.string(), description: z.string() })).min(2),
});

export const Rubric = z.object({
  version: z.number().int().positive(),
  criteria: z.array(RubricCriterion).min(1),
  acceptAlternateApproaches: z.boolean().default(true),
  referenceIsExhaustive: z.boolean().default(false),
});
export type Rubric = z.infer<typeof Rubric>;

export const ExerciseKind = z.enum([
  "proof",
  "calculation",
  "derivation",
  "explanation",
  "conceptual",
  "code",
  "short_answer",
  "model_interpretation",
]);
export type ExerciseKind = z.infer<typeof ExerciseKind>;

export const ExerciseSpec = z.object({
  id: z.string().min(1),
  sequence: z.number().int().positive(),
  title: z.string().min(1),
  kind: ExerciseKind,
  promptMarkdown: z.string().min(1),
  conceptIds: z.array(z.string()).default([]),
  hintLadder: HintLadder.default([]),
  deterministicChecks: z.array(DeterministicCheck).default([]),
  rubric: Rubric,
  origin: z.enum(["original", "adapted_with_attribution", "linked_external"]),
  attribution: z.string().optional(),
  externalLocatorId: z.string().optional(),
  estimatedMinutes: z.number().int().positive(),
  /** Sample texts with the expected outcome of each automatic check; the validator runs them. */
  checkExamples: z
    .array(
      z.object({
        label: z.string().min(1),
        text: z.string().min(1),
        expect: z.record(z.string(), z.boolean()),
      }),
    )
    .default([]),
});
export type ExerciseSpec = z.infer<typeof ExerciseSpec>;

/** Unit-level record as authored in content/courses/<ID>/units/<nn>-slug/unit.json. */
export const TeachingUnitSpec = z.object({
  id: z.string().min(1),
  courseId: CourseId,
  sequence: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().min(1),
  objectives: z.array(z.object({ id: z.string(), description: z.string() })).min(1),
  prerequisiteConceptIds: z.array(z.string()).default([]),
  teachesConceptIds: z.array(z.string()).default([]),
  preparation: z.array(Preparation).default([]),
  activities: z.array(Activity).min(1),
  exerciseIds: z.array(z.string()).default([]),
  exitCheck: z.object({ description: z.string(), exerciseId: z.string().optional() }),
  commonMisconceptions: z.array(Misconception).default([]),
  estimatedMinutes: z.number().int().positive(),
  status: UnitStatus,
  checks: z.array(UnitCheck).default([]),
  lessonFile: z.string().default("lesson.md"),
  instructorFiles: z.array(z.string()).default([]), // never served to learner clients
});
export type TeachingUnitSpec = z.infer<typeof TeachingUnitSpec>;

export const ConceptSpec = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  departmentId: DepartmentId,
  description: z.string().min(1),
});
export type ConceptSpec = z.infer<typeof ConceptSpec>;

/** Alternative groups: satisfying ALL concepts in ANY one group satisfies the rule. */
export const PrerequisiteRule = z.object({
  id: z.string().min(1),
  courseId: CourseId,
  strength: z.enum(["hard", "soft", "corequisite"]),
  description: z.string().min(1),
  alternatives: z
    .array(
      z.object({
        label: z.string().min(1),
        conceptIds: z.array(z.string()).default([]),
        courseIds: z.array(CourseId).default([]),
        bridgeCourseId: CourseId.optional(),
      }),
    )
    .min(1),
});
export type PrerequisiteRule = z.infer<typeof PrerequisiteRule>;

export const DepartmentSpec = z.object({
  id: DepartmentId,
  title: z.string().min(1),
  shortTitle: z.string().min(1),
  identity: z.string().min(1),
  paths: z.array(z.object({ title: z.string(), courseIds: z.array(CourseId) })).default([]),
  facultyPersonaIds: z.array(z.string()).default([]),
  conventions: z.array(z.string()).default([]),
  emblem: z.string().min(1),
});
export type DepartmentSpec = z.infer<typeof DepartmentSpec>;

/**
 * A programme block is an intellectual unit of a programme, not a course: it is served by chosen
 * units of one or more canonical courses, and a unit may serve several blocks. Learner work and
 * grades belong to the unit's exercises, never to the block, so a shared unit is studied and
 * assessed once.
 */
export const BlockCourseMapping = z.object({
  courseId: CourseId,
  /** The units that serve the block. Empty: the course is mapped and its units are still to choose. */
  unitIds: z.array(z.string().min(1)).default([]),
  contribution: z.string().min(1),
});
export type BlockCourseMapping = z.infer<typeof BlockCourseMapping>;

export const ShelfEntry = z
  .object({
    /** A registered, verified source in content/sources. */
    sourceId: z.string().min(1).optional(),
    /** A named lead that is not yet verified; shown as a lead and never cited. */
    candidate: z.string().min(1).optional(),
    role: z.enum(["spine", "supplement", "optional"]),
    note: z.string().min(1),
  })
  .refine((e) => Boolean(e.sourceId) !== Boolean(e.candidate), "a shelf entry names exactly one of sourceId or candidate");
export type ShelfEntry = z.infer<typeof ShelfEntry>;

export const ProgrammeBlock = z.object({
  id: z.string().regex(/^[A-Z]{2,4}-\d{2}$/, "block ids look like MBI-01"),
  sequence: z.number().int().positive(),
  title: z.string().min(1),
  centralQuestion: z.string().min(1),
  entryLevel: z.string().min(1),
  requiredCoverage: z.array(z.string().min(1)).min(1),
  /** Why the block sits where it does, and what (if anything) must come first. */
  prerequisiteReasoning: z.string().min(1),
  bridges: z
    .array(
      z.object({
        title: z.string().min(1),
        courseId: CourseId.optional(),
        unitIds: z.array(z.string().min(1)).default([]),
        note: z.string().min(1),
      }),
    )
    .default([]),
  /** Blocks this one can be studied in parallel with; numbering is not a prerequisite chain. */
  canStudyAlongside: z.array(z.string()).default([]),
  courseMappings: z.array(BlockCourseMapping).min(1),
  sourceShelf: z.array(ShelfEntry).default([]),
  activities: z
    .array(z.object({ title: z.string().min(1), description: z.string().min(1), methodIds: z.array(z.string()).default([]) }))
    .min(1),
  evidenceOfUnderstanding: z.string().min(1),
  tutorGuidance: z.string().min(1).optional(),
  /** The block's work is a project in the research studio, which needs no prepared unit. */
  studio: z.boolean().optional(),
  gaps: z.array(z.string().min(1)).default([]),
});
export type ProgrammeBlock = z.infer<typeof ProgrammeBlock>;

export const ProgrammeElective = z.object({
  courseId: CourseId,
  connectsToBlockIds: z.array(z.string()).min(1),
  note: z.string().min(1),
});
export type ProgrammeElective = z.infer<typeof ProgrammeElective>;

/** A modelling method taught explicitly, mapped to the units that introduce, practise and assess it. */
export const ModellingMethod = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  section: z.string().min(1),
  title: z.string().min(1),
  /** The concept whose evidence state shows introduced, practised and demonstrated for the method. */
  conceptId: z.string().min(1),
  learnerShould: z.array(z.string().min(1)).min(1),
  units: z
    .array(z.object({ courseId: CourseId, unitId: z.string().min(1), role: z.enum(["introduces", "practises", "assesses"]) }))
    .default([]),
  /** Where the method will be taught once those units are prepared. */
  plannedIn: z.array(z.object({ courseId: CourseId, note: z.string().min(1) })).default([]),
  evidence: z.string().min(1),
});
export type ModellingMethod = z.infer<typeof ModellingMethod>;

/** A bounded paper seminar: a fixed list, never a feed. */
export const PaperSeminar = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  maxPapers: z.number().int().positive().max(12),
  papers: z
    .array(
      z
        .object({
          sourceId: z.string().min(1).optional(),
          candidate: z.string().min(1).optional(),
          blockIds: z.array(z.string()).min(1),
          focus: z.string().min(1),
        })
        .refine((p) => Boolean(p.sourceId) !== Boolean(p.candidate), "a paper names exactly one of sourceId or candidate"),
    )
    .min(1),
  reportHeadings: z.array(z.string().min(1)).min(4),
});
export type PaperSeminar = z.infer<typeof PaperSeminar>;

export const ProgrammeSpec = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  /** A stable external reference (for example MIND-BRAIN-AI) mapped to the internal id. */
  referenceId: z
    .string()
    .regex(/^[A-Z][A-Z0-9-]*$/)
    .optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  departmentIds: z.array(DepartmentId).min(1),
  stages: z
    .array(
      z.object({
        title: z.string().min(1),
        courses: z.array(
          z.object({
            courseId: CourseId,
            role: z.enum(["core", "seminar", "bridge", "elective"]),
            note: z.string().optional(),
          }),
        ),
      }),
    )
    .min(1),
  blocks: z.array(ProgrammeBlock).optional(),
  electives: z.array(ProgrammeElective).optional(),
  methods: z.array(ModellingMethod).optional(),
  paperSeminar: PaperSeminar.optional(),
});
export type ProgrammeSpec = z.infer<typeof ProgrammeSpec>;
