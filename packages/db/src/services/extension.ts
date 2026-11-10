import { createHash } from "node:crypto";
import { and, desc, eq, ilike, inArray, like, or } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "../client";
import { isUuid } from "../ids";
import { concept, course, courseDepartment, courseVersion, department, teachingUnit } from "../schema/academic";
import { curriculumProposal, curriculumProposalVersion, type OverlapDecision, type ProposalKind } from "../schema/extension";
import { resourceRequest } from "../schema/library";
import { auditEvent } from "../schema/operations";

export class ProposalError extends Error {}

export type ProposalRow = typeof curriculumProposal.$inferSelect;

export const PROPOSAL_KINDS: { kind: ProposalKind; label: string }[] = [
  { kind: "reading_course", label: "Focused reading course" },
  { kind: "seminar", label: "Seminar" },
  { kind: "structured_curriculum", label: "Structured curriculum" },
  { kind: "cross_disciplinary_programme", label: "Cross-disciplinary programme" },
];

const ProposalInput = z.object({
  kind: z.enum(["reading_course", "seminar", "structured_curriculum", "cross_disciplinary_programme"]),
  departmentId: z.string().min(1),
  title: z.string().trim().min(5, "Give the proposal a title of a few words.").max(160),
  purpose: z.string().trim().min(20, "Say in a sentence or two what it is for.").max(2000),
  scope: z.string().trim().min(20, "Describe its scope: what it covers and what it leaves out.").max(4000),
  depth: z.enum(["survey", "standard", "rigorous"]),
  sourceCandidates: z
    .array(z.object({ title: z.string().trim().min(2).max(300), note: z.string().trim().max(500) }))
    .max(20)
    .default([]),
});
export type ProposalInput = z.input<typeof ProposalInput>;

const STOP = new Set(["about", "their", "there", "which", "these", "those", "would", "could", "should", "between", "through", "within"]);

/** The distinctive words of a text, for a deliberate search before anything new is created. */
export function searchTerms(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z]{5,}/g) ?? [];
  return [...new Set(words.filter((w) => !STOP.has(w)))].slice(0, 10);
}

/** Existing courses, prepared units and concepts that share distinctive words with a proposal. */
export async function findOverlap(db: DbOrTx, text: string, excludeCourseId?: string) {
  const terms = searchTerms(text);
  if (terms.length === 0) return { terms, courses: [], units: [], concepts: [] };
  const [courses, units, concepts] = await Promise.all([
    db
      .select({ id: course.id, title: course.title, readiness: courseVersion.readiness })
      .from(course)
      .innerJoin(courseVersion, and(eq(courseVersion.courseId, course.id), eq(courseVersion.isCurrent, true)))
      .where(or(...terms.map((t) => ilike(course.title, `%${t}%`))))
      .orderBy(course.id)
      .limit(12),
    db
      .select({ id: teachingUnit.id, title: teachingUnit.title, status: teachingUnit.status, courseId: courseVersion.courseId })
      .from(teachingUnit)
      .innerJoin(courseVersion, and(eq(teachingUnit.courseVersionId, courseVersion.id), eq(courseVersion.isCurrent, true)))
      .where(or(...terms.flatMap((t) => [ilike(teachingUnit.title, `%${t}%`), ilike(teachingUnit.summary, `%${t}%`)])))
      .orderBy(teachingUnit.id)
      .limit(20),
    db
      .select({ id: concept.id, title: concept.title })
      .from(concept)
      .where(or(...terms.map((t) => ilike(concept.title, `%${t}%`))))
      .orderBy(concept.id)
      .limit(20),
  ]);
  return { terms, courses: courses.filter((c) => c.id !== excludeCourseId), units, concepts };
}

async function snapshot(db: DbOrTx, row: ProposalRow): Promise<void> {
  const { createdAt: _c, updatedAt: _u, ...rest } = row;
  await db.insert(curriculumProposalVersion).values({ proposalId: row.id, version: row.version, snapshot: rest });
}

export async function createProposal(db: DbOrTx, ownerId: string, input: ProposalInput): Promise<ProposalRow> {
  const parsed = ProposalInput.parse(input);
  const [dept] = await db.select({ id: department.id }).from(department).where(eq(department.id, parsed.departmentId)).limit(1);
  if (!dept) throw new ProposalError("Choose one of the existing departments; a proposal does not create a department.");
  const [row] = await db
    .insert(curriculumProposal)
    .values({ ownerId, ...parsed })
    .returning();
  await snapshot(db, row!);
  await db
    .insert(auditEvent)
    .values({ ownerId, actor: "learner", action: "proposal:create", entity: "curriculum_proposal", entityId: row!.id });
  return row!;
}

export async function getProposal(db: DbOrTx, ownerId: string, id: string): Promise<ProposalRow | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select()
    .from(curriculumProposal)
    .where(and(eq(curriculumProposal.id, id), eq(curriculumProposal.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

export async function listProposals(db: DbOrTx, ownerId: string): Promise<ProposalRow[]> {
  return db.select().from(curriculumProposal).where(eq(curriculumProposal.ownerId, ownerId)).orderBy(desc(curriculumProposal.updatedAt));
}

export async function listProposalVersions(db: DbOrTx, proposalId: string) {
  return db
    .select({ version: curriculumProposalVersion.version, createdAt: curriculumProposalVersion.createdAt })
    .from(curriculumProposalVersion)
    .where(eq(curriculumProposalVersion.proposalId, proposalId))
    .orderBy(desc(curriculumProposalVersion.version));
}

type Revision = Partial<
  Pick<ProposalRow, "title" | "purpose" | "scope" | "depth" | "sourceCandidates" | "conceptIds" | "reusedUnitIds" | "overlapDecisions">
>;

/** A new version of a draft proposal; the previous version is kept as it was. */
export async function reviseProposal(db: DbOrTx, ownerId: string, id: string, change: Revision): Promise<ProposalRow> {
  const row = await getProposal(db, ownerId, id);
  if (!row) throw new ProposalError("Proposal not found.");
  if (row.status !== "draft") throw new ProposalError("Only a draft proposal can be revised.");
  const merged = ProposalInput.parse({ ...row, ...change });
  if (change.conceptIds?.length) {
    const found = await db.select({ id: concept.id }).from(concept).where(inArray(concept.id, change.conceptIds));
    if (found.length !== new Set(change.conceptIds).size) throw new ProposalError("Reuse only concepts that exist.");
  }
  if (change.reusedUnitIds?.length) {
    const found = await db
      .select({ id: teachingUnit.id })
      .from(teachingUnit)
      .innerJoin(courseVersion, and(eq(teachingUnit.courseVersionId, courseVersion.id), eq(courseVersion.isCurrent, true)))
      .where(and(inArray(teachingUnit.id, change.reusedUnitIds), eq(teachingUnit.status, "ready")));
    if (found.length !== new Set(change.reusedUnitIds).size) throw new ProposalError("Reuse only prepared units from current courses.");
  }
  const [next] = await db
    .update(curriculumProposal)
    .set({
      title: merged.title,
      purpose: merged.purpose,
      scope: merged.scope,
      depth: merged.depth,
      sourceCandidates: merged.sourceCandidates,
      conceptIds: change.conceptIds ? [...new Set(change.conceptIds)] : row.conceptIds,
      reusedUnitIds: change.reusedUnitIds ? [...new Set(change.reusedUnitIds)] : row.reusedUnitIds,
      overlapDecisions: change.overlapDecisions ?? row.overlapDecisions,
      version: row.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(curriculumProposal.id, id))
    .returning();
  await snapshot(db, next!);
  return next!;
}

/** Records the owner's decision on one overlapping course (reuse its units, or keep the proposal distinct, with a reason). */
export async function decideOverlap(db: DbOrTx, ownerId: string, id: string, decision: OverlapDecision): Promise<ProposalRow> {
  const row = await getProposal(db, ownerId, id);
  if (!row) throw new ProposalError("Proposal not found.");
  if (decision.decision === "distinct" && decision.note.trim().length < 5) {
    throw new ProposalError("Say why the proposal is distinct from this course.");
  }
  const others = row.overlapDecisions.filter((d) => d.courseId !== decision.courseId);
  return reviseProposal(db, ownerId, id, { overlapDecisions: [...others, { ...decision, note: decision.note.trim() }] });
}

export async function rejectProposal(db: DbOrTx, ownerId: string, id: string, note: string): Promise<void> {
  const row = await getProposal(db, ownerId, id);
  if (!row) throw new ProposalError("Proposal not found.");
  if (row.status !== "draft") throw new ProposalError("Only a draft proposal can be rejected.");
  await db
    .update(curriculumProposal)
    .set({ status: "rejected", decisionNote: note.trim() || null, updatedAt: new Date() })
    .where(eq(curriculumProposal.id, id));
  await db.insert(auditEvent).values({ ownerId, actor: "learner", action: "proposal:reject", entity: "curriculum_proposal", entityId: id });
}

const LEVEL = { survey: "foundation", standard: "intermediate", rigorous: "advanced" } as const;
const WORKLOAD = { survey: [10, 15, 25], standard: [20, 30, 45], rigorous: [30, 45, 70] } as const;

/** The next free id in the department's own course prefix, from 901 upward (proposals never take a seeded number). */
async function nextCourseId(db: DbOrTx, departmentId: string): Promise<string> {
  const own = await db.select({ id: course.id }).from(course).where(eq(course.primaryDepartmentId, departmentId));
  const counts = new Map<string, number>();
  for (const { id } of own) {
    const prefix = /^([A-Z]{2,4})-\d+$/.exec(id)?.[1];
    if (prefix) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  const prefix = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "RDG";
  const taken = new Set(
    (
      await db
        .select({ id: course.id })
        .from(course)
        .where(like(course.id, `${prefix}-9%`))
    ).map((r) => r.id),
  );
  for (let n = 901; n <= 999; n++) if (!taken.has(`${prefix}-${n}`)) return `${prefix}-${n}`;
  throw new ProposalError("No free course number is left in this department's range.");
}

/**
 * Publishes a draft as a catalogue item at readiness "proposed", only once every overlapping course
 * has the owner's decision. It enrols nobody, verifies no source (each lead becomes a request in
 * Books to obtain) and prepares no teaching; the proposal and its versions stay as they were.
 */
export async function publishProposal(db: DbOrTx, ownerId: string, id: string): Promise<{ courseId: string }> {
  const row = await getProposal(db, ownerId, id);
  if (!row) throw new ProposalError("Proposal not found.");
  if (row.status !== "draft") throw new ProposalError("Only a draft proposal can be published.");
  const overlap = await findOverlap(db, `${row.title} ${row.scope}`);
  const undecided = overlap.courses.filter((c) => !row.overlapDecisions.some((d) => d.courseId === c.id));
  if (undecided.length) {
    throw new ProposalError(`Decide on each overlapping course first: ${undecided.map((c) => c.id).join(", ")}.`);
  }
  const reusedUnits = row.reusedUnitIds.length
    ? await db
        .select({ id: teachingUnit.id, title: teachingUnit.title })
        .from(teachingUnit)
        .where(inArray(teachingUnit.id, row.reusedUnitIds))
    : [];
  // One transaction: a failure leaves neither a half-listed course nor a proposal marked published.
  return db.transaction(async (tx) => {
    const courseId = await nextCourseId(tx, row.departmentId);
    const [min, typical, max] = WORKLOAD[row.depth];
    const contentHash = createHash("sha256")
      .update(JSON.stringify({ id: row.id, version: row.version }))
      .digest("hex");
    await tx.insert(course).values({
      id: courseId,
      title: row.title,
      primaryDepartmentId: row.departmentId,
      level: LEVEL[row.depth],
      position: "Proposed by the owner; not yet prepared.",
    });
    await tx.insert(courseDepartment).values({ courseId, departmentId: row.departmentId });
    await tx.insert(courseVersion).values({
      courseId,
      version: 1,
      contentHash,
      readiness: "proposed",
      purpose: row.purpose,
      description: row.scope,
      workload: { minimum: min, typical, maximum: max },
      blockers: [
        {
          type: "source",
          reason: "No source has been verified for this course.",
          resolutionAction: "Obtain and register the leads in Library, Books to obtain; verify locators before any unit cites them.",
        },
        {
          type: "review",
          reason: "No syllabus or unit has been prepared.",
          resolutionAction: "Prepare a syllabus before asking for units.",
        },
      ],
      provenance: {
        authoringMethod: `Owner's proposal ${row.id}, version ${row.version}`,
        reviewerNotes: [
          "The workload is a first estimate from the chosen depth, to be set when a syllabus is prepared.",
          ...row.overlapDecisions.map((d) => `${d.courseId}: ${d.decision === "reuse" ? "reuse its units" : `distinct (${d.note})`}`),
        ],
      },
      teachesConceptIds: row.conceptIds,
      catalogueNotes: {
        centralQuestion: row.purpose,
        preparationPath: [
          reusedUnits.length
            ? `Reuses prepared units, studied where they are: ${reusedUnits.map((u) => `${u.id} (${u.title})`).join("; ")}.`
            : "Reuses no prepared unit yet.",
          "Sources are leads until verified; a syllabus comes next.",
        ].join(" "),
        sourceCandidates: row.sourceCandidates.map((s) => ({ name: s.title, note: s.note || "Proposed lead; not verified." })),
      },
    });
    for (const s of row.sourceCandidates) {
      await tx.insert(resourceRequest).values({
        ownerId,
        courseId,
        title: s.title,
        why: `Proposed as a source for ${row.title}${s.note ? `: ${s.note}` : ""}.`,
        destinationFolder: `library/${courseId}`,
      });
    }
    await tx
      .update(curriculumProposal)
      .set({ status: "published", publishedCourseId: courseId, publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(curriculumProposal.id, id));
    await tx.insert(auditEvent).values({
      ownerId,
      actor: "learner",
      action: "proposal:publish",
      entity: "curriculum_proposal",
      entityId: id,
      details: { courseId, version: row.version },
    });
    return { courseId };
  });
}
