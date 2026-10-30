import { z } from "zod";
import {
  ConceptSpec,
  CourseSpec,
  DepartmentSpec,
  ExerciseSpec,
  PrerequisiteRule,
  ProgrammeSpec,
  SourceRecord,
  TeachingUnitSpec,
} from "@corniversity/core";

export { ConceptSpec, CourseSpec, DepartmentSpec, ExerciseSpec, PrerequisiteRule, ProgrammeSpec, SourceRecord, TeachingUnitSpec };

export const PersonaSpec = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  version: z.number().int().positive().default(1),
  name: z.string().min(1),
  role: z.enum(["director", "convenor", "lecturer", "tutor", "librarian", "assessor", "seminar_chair", "supervisor", "peer"]),
  title: z.string().min(1),
  departmentId: z.string().optional(),
  style: z.object({
    approach: z.string().min(1),
    habits: z.array(z.string()).min(1),
    officeHours: z.string().min(1),
    notation: z.string().optional(),
    avoid: z.array(z.string()).optional(),
  }),
  introduction: z.string().min(1),
  avatarKey: z.string().min(1),
  promptKey: z.string().min(1),
  isPeer: z.boolean().default(false),
});
export type PersonaSpec = z.infer<typeof PersonaSpec>;

export const SocietySpec = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  description: z.string().min(1),
  departmentId: z.string().optional(),
  cadence: z.string().min(1),
  chairPersonaId: z.string().optional(),
});
export type SocietySpec = z.infer<typeof SocietySpec>;

export interface LoadedUnit {
  spec: TeachingUnitSpec;
  lessonMarkdown: string;
  exercises: ExerciseSpec[];
  instructor: { file: string; kind: "reference_solution" | "grading_notes" | "misconception_notes" | "lesson_notes"; exerciseId?: string; markdown: string }[];
  dir: string;
}

export interface LoadedCourse {
  spec: CourseSpec;
  units: LoadedUnit[];
  dir: string;
}

export interface ContentBundle {
  root: string;
  departments: DepartmentSpec[];
  programmes: ProgrammeSpec[];
  concepts: ConceptSpec[];
  prerequisiteRules: PrerequisiteRule[];
  sources: SourceRecord[];
  personas: PersonaSpec[];
  societies: SocietySpec[];
  courses: LoadedCourse[];
}
