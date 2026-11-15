/**
 * The owner's subjects: slugs mapped to OpenAlex taxonomy ids and arXiv categories. The OpenAlex
 * ids and names are those of the live /fields and /subfields responses recorded on 2026-11-15
 * (packages/db/src/scholarly/fixtures/openalex); the subject rooms load subfields from OpenAlex at
 * run time. The four primary subjects come first; every OpenAlex field is reachable as a subject.
 *
 * arXiv categories are search terms for "New on arXiv" (`math.*` matches every category of the
 * archive; checked live for `math.*`). Only the primary subjects have arXiv categories.
 */

export interface SubjectDefinition {
  slug: string;
  name: string;
  primary: boolean;
  openalex: { level: "field" | "subfield"; id: string; name: string; fieldId: string };
  arxivCategories: readonly string[];
}

const PHYSICS_ARXIV = [
  "astro-ph.*",
  "cond-mat.*",
  "gr-qc",
  "hep-ex",
  "hep-lat",
  "hep-ph",
  "hep-th",
  "math-ph",
  "nlin.*",
  "nucl-ex",
  "nucl-th",
  "physics.*",
  "quant-ph",
] as const;

const PRIMARY: readonly SubjectDefinition[] = [
  {
    slug: "mathematics",
    name: "Mathematics",
    primary: true,
    openalex: { level: "field", id: "26", name: "Mathematics", fieldId: "26" },
    arxivCategories: ["math.*"],
  },
  {
    slug: "physics",
    name: "Physics",
    primary: true,
    openalex: { level: "field", id: "31", name: "Physics and Astronomy", fieldId: "31" },
    arxivCategories: PHYSICS_ARXIV,
  },
  {
    slug: "computer-science",
    name: "Computer science",
    primary: true,
    openalex: { level: "field", id: "17", name: "Computer Science", fieldId: "17" },
    arxivCategories: ["cs.*"],
  },
  {
    slug: "artificial-intelligence",
    name: "Artificial intelligence",
    primary: true,
    openalex: { level: "subfield", id: "1702", name: "Artificial Intelligence", fieldId: "17" },
    arxivCategories: ["cs.AI"],
  },
];

/** The other OpenAlex fields (id, name as OpenAlex gives it). */
const OTHER_FIELDS: readonly [string, string, string][] = [
  ["agricultural-and-biological-sciences", "11", "Agricultural and Biological Sciences"],
  ["arts-and-humanities", "12", "Arts and Humanities"],
  ["biochemistry-genetics-and-molecular-biology", "13", "Biochemistry, Genetics and Molecular Biology"],
  ["business-management-and-accounting", "14", "Business, Management and Accounting"],
  ["chemical-engineering", "15", "Chemical Engineering"],
  ["chemistry", "16", "Chemistry"],
  ["decision-sciences", "18", "Decision Sciences"],
  ["dentistry", "35", "Dentistry"],
  ["earth-and-planetary-sciences", "19", "Earth and Planetary Sciences"],
  ["economics-econometrics-and-finance", "20", "Economics, Econometrics and Finance"],
  ["energy", "21", "Energy"],
  ["engineering", "22", "Engineering"],
  ["environmental-science", "23", "Environmental Science"],
  ["health-professions", "36", "Health Professions"],
  ["immunology-and-microbiology", "24", "Immunology and Microbiology"],
  ["materials-science", "25", "Materials Science"],
  ["medicine", "27", "Medicine"],
  ["neuroscience", "28", "Neuroscience"],
  ["nursing", "29", "Nursing"],
  ["pharmacology-toxicology-and-pharmaceutics", "30", "Pharmacology, Toxicology and Pharmaceutics"],
  ["psychology", "32", "Psychology"],
  ["social-sciences", "33", "Social Sciences"],
  ["veterinary", "34", "Veterinary"],
];

export const SUBJECTS: readonly SubjectDefinition[] = [
  ...PRIMARY,
  ...OTHER_FIELDS.map(([slug, id, name]) => ({
    slug,
    name,
    primary: false,
    openalex: { level: "field" as const, id, name, fieldId: id },
    arxivCategories: [] as readonly string[],
  })),
];

export const PRIMARY_SUBJECT_SLUGS: readonly string[] = PRIMARY.map((s) => s.slug);
/** The owner's subjects until they choose others. */
export const DEFAULT_SUBJECT_SLUGS: readonly string[] = PRIMARY_SUBJECT_SLUGS;

const BY_SLUG = new Map(SUBJECTS.map((s) => [s.slug, s]));

export function subjectBySlug(slug: string): SubjectDefinition | null {
  return BY_SLUG.get(slug) ?? null;
}

export function isSubjectSlug(slug: unknown): slug is string {
  return typeof slug === "string" && BY_SLUG.has(slug);
}

/** Valid, distinct slugs in display order: primary subjects first (in their order), then the rest by name. */
export function orderSubjects(slugs: readonly string[]): SubjectDefinition[] {
  const chosen = new Set(slugs.filter(isSubjectSlug));
  return SUBJECTS.filter((s) => chosen.has(s.slug)).sort(
    (a, b) =>
      Number(b.primary) - Number(a.primary) ||
      (a.primary ? PRIMARY_SUBJECT_SLUGS.indexOf(a.slug) - PRIMARY_SUBJECT_SLUGS.indexOf(b.slug) : a.name.localeCompare(b.name, "en")),
  );
}

/** The OpenAlex filter that selects a subject's works by their primary topic. */
export function openAlexSubjectFilter(subject: SubjectDefinition): { fieldId: string } | { subfieldId: string } {
  return subject.openalex.level === "field" ? { fieldId: subject.openalex.id } : { subfieldId: subject.openalex.id };
}

/** The subject a work's OpenAlex field or subfield belongs to (subfield subjects win over their field). */
export function subjectForOpenAlex(fieldId: string | null, subfieldId: string | null): SubjectDefinition | null {
  if (subfieldId) {
    const bySubfield = SUBJECTS.find((s) => s.openalex.level === "subfield" && s.openalex.id === subfieldId);
    if (bySubfield) return bySubfield;
  }
  return fieldId ? (SUBJECTS.find((s) => s.openalex.level === "field" && s.openalex.id === fieldId) ?? null) : null;
}

/** Field-level subjects whose field is not the field of any chosen subject (for Surprise me). */
export function fieldsOutside(slugs: readonly string[]): SubjectDefinition[] {
  const taken = new Set(orderSubjects(slugs).map((s) => s.openalex.fieldId));
  return SUBJECTS.filter((s) => s.openalex.level === "field" && !taken.has(s.openalex.fieldId));
}

/** One field outside the owner's subjects, chosen by a seed (see discoverSeed); null when none is left. */
export function surpriseField(slugs: readonly string[], seed: number): SubjectDefinition | null {
  const candidates = fieldsOutside(slugs);
  return candidates.length === 0 ? null : candidates[Math.abs(Math.trunc(seed)) % candidates.length]!;
}
