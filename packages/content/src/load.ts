import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { ZodType } from "zod";
import {
  BridgeSpec,
  ConceptSpec,
  type ContentBundle,
  CourseSpec,
  DepartmentSpec,
  ExerciseSpec,
  type LoadedBridge,
  type LoadedCourse,
  type LoadedUnit,
  type LoadedVisual,
  PersonaSpec,
  PrerequisiteRule,
  ProgrammeSpec,
  SocietySpec,
  SourceRecord,
  TeachingUnitSpec,
  VisualRender,
  VisualSpec,
} from "./schema";

export class ContentError extends Error {
  constructor(
    readonly file: string,
    message: string,
  ) {
    super(`${file}: ${message}`);
    this.name = "ContentError";
  }
}

function readJson<T>(file: string, schema: ZodType<T>): T {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new ContentError(file, `invalid JSON (${(error as Error).message})`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join("; ");
    throw new ContentError(file, issues);
  }
  return parsed.data;
}

function readJsonArray<T>(file: string, schema: ZodType<T>): T[] {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new ContentError(file, `invalid JSON (${(error as Error).message})`);
  }
  if (!Array.isArray(raw)) throw new ContentError(file, "expected a JSON array");
  return raw.map((item, index) => {
    const parsed = schema.safeParse(item);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join("; ");
      throw new ContentError(file, `item ${index}: ${issues}`);
    }
    return parsed.data;
  });
}

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => join(dir, f));
}

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => join(dir, f))
    .filter((p) => statSync(p).isDirectory())
    .sort();
}

const INSTRUCTOR_KINDS = {
  "reference-solution": "reference_solution",
  "grading-notes": "grading_notes",
  "misconception-notes": "misconception_notes",
  "lesson-notes": "lesson_notes",
} as const;

function loadUnit(dir: string): LoadedUnit {
  const spec = readJson(join(dir, "unit.json"), TeachingUnitSpec);
  const lessonPath = join(dir, spec.lessonFile);
  if (!existsSync(lessonPath)) throw new ContentError(lessonPath, "lesson file missing");
  const lessonMarkdown = readFileSync(lessonPath, "utf8");

  const exercises: LoadedUnit["exercises"] = [];
  for (const file of listFiles(join(dir, "exercises"), ".json")) {
    const exercise = readJson(file, ExerciseSpec);
    const promptFile = join(dir, "exercises", `${basename(file, ".json")}.md`);
    if (existsSync(promptFile)) exercise.promptMarkdown = readFileSync(promptFile, "utf8");
    exercises.push(exercise);
  }
  exercises.sort((a, b) => a.sequence - b.sequence);

  const instructor: LoadedUnit["instructor"] = [];
  for (const file of listFiles(join(dir, "instructor"), ".md")) {
    // Naming: <exerciseId>.<kind>.md or <kind>.md where kind ∈ INSTRUCTOR_KINDS.
    const name = basename(file, ".md");
    const parts = name.split(".");
    const kindKey = parts[parts.length - 1] as keyof typeof INSTRUCTOR_KINDS;
    const kind = INSTRUCTOR_KINDS[kindKey];
    if (!kind) throw new ContentError(file, `unknown instructor artifact kind "${kindKey}"`);
    const exerciseId = parts.length > 1 ? parts.slice(0, -1).join(".") : undefined;
    instructor.push({ file: basename(file), kind, exerciseId, markdown: readFileSync(file, "utf8") });
  }
  return { spec, lessonMarkdown, exercises, instructor, dir };
}

function loadCourse(dir: string): LoadedCourse {
  const spec = readJson(join(dir, "course.json"), CourseSpec);
  const units = listDirs(join(dir, "units")).map(loadUnit);
  units.sort((a, b) => a.spec.sequence - b.spec.sequence);
  return { spec, units, dir };
}

/** Loads and schema-validates the whole content tree. Referential checks live in validate.ts. */
export function loadContent(root: string): ContentBundle {
  const r = resolve(root);
  return {
    root: r,
    departments: listFiles(join(r, "departments"), ".json").map((f) => readJson(f, DepartmentSpec)),
    programmes: listFiles(join(r, "programmes"), ".json").map((f) => readJson(f, ProgrammeSpec)),
    concepts: listFiles(join(r, "concepts"), ".json").flatMap((f) => readJsonArray(f, ConceptSpec)),
    prerequisiteRules: listFiles(join(r, "prerequisites"), ".json").flatMap((f) => readJsonArray(f, PrerequisiteRule)),
    sources: listFiles(join(r, "sources"), ".json").map((f) => readJson(f, SourceRecord)),
    personas: listFiles(join(r, "personas"), ".json").map((f) => readJson(f, PersonaSpec)),
    societies: existsSync(join(r, "societies.json")) ? readJsonArray(join(r, "societies.json"), SocietySpec) : [],
    courses: listDirs(join(r, "courses")).map(loadCourse),
    bridges: existsSync(join(r, "bridges")) ? listDirs(join(r, "bridges")).map(loadBridge) : [],
    visuals: existsSync(join(r, "visuals")) ? listDirs(join(r, "visuals")).map(loadVisual) : [],
  };
}

/** A visual's storyboard, with the record of a locally recorded film (render/render.json) merged in. */
function loadVisual(dir: string): LoadedVisual {
  const parsed = readJson(join(dir, "visual.json"), VisualSpec);
  const renderPath = join(dir, "render", "render.json");
  const render = existsSync(renderPath) ? readJson(renderPath, VisualRender) : undefined;
  const filmPath = render ? join(dir, "render", render.file) : null;
  const present = filmPath !== null && existsSync(filmPath);
  return {
    spec: render ? { ...parsed, render } : parsed,
    dir,
    filmPath: present ? filmPath : null,
    filmBytes: present ? statSync(filmPath).size : null,
  };
}

function loadBridge(dir: string): LoadedBridge {
  const spec = readJson(join(dir, "bridge.json"), BridgeSpec);
  const bodyPath = join(dir, spec.bodyFile);
  if (!existsSync(bodyPath)) throw new ContentError(bodyPath, "missing bridge body");
  return { spec, bodyMarkdown: readFileSync(bodyPath, "utf8"), dir };
}

export function defaultContentRoot(): string {
  // packages/content/src → repository root/content
  return resolve(import.meta.dirname ?? ".", "..", "..", "..", "content");
}
