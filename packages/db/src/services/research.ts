import {
  buildSupervisorPrompt,
  ProviderError,
  ROLE_CONTRACTS,
  SUPERVISOR_PROMPT_VERSION,
  SupervisorFeedbackSchema,
} from "@corniversity/ai";
import {
  assembleReport,
  checkProposal,
  PROJECT_KIND_INFO,
  PROJECT_KINDS,
  type ProjectKind,
  type ProvenanceInput,
  proposalTemplate,
  reportTemplate,
  validateProvenance,
} from "@corniversity/core";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { BlobStore } from "../blob";
import type { DbOrTx } from "../client";
import type { Env } from "../env";
import { isUuid } from "../ids";
import {
  auditEvent,
  notebookEntry,
  programme,
  researchArtifact,
  researchDocument,
  researchFeedback,
  researchOralRequest,
  researchProject,
  researchProvenance,
  researchVersion,
  source,
} from "../schema/index";
import { planRun } from "./ai-runs";
import { openDiscussion } from "./community";
import { finishProviderRun } from "./provider-config";

/**
 * The research studio: the learner's own projects, from a question to a report. Everything is
 * owned by one learner and checked on every call; documents are saved as immutable versions;
 * provenance is validated so no project rests on data taken from people; feedback is the
 * structural checks plus, only when a live model is configured and approved, a supervisor's
 * written feedback. Nothing here contacts anyone, publishes anything or imports private data.
 */
export class ResearchError extends Error {}

export type ResearchProjectRow = typeof researchProject.$inferSelect;
export const DOCUMENT_KINDS = ["proposal", "methods", "report"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const ARTIFACT_LIMIT_BYTES = 5 * 1024 * 1024;
export const ARTIFACT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "text/csv": "csv",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/json": "json",
  "text/x-python": "py",
};

async function audit(db: DbOrTx, ownerId: string, action: string, projectId: string, details: Record<string, unknown> = {}) {
  await db.insert(auditEvent).values({ ownerId, actor: "learner", action, entity: "research_project", entityId: projectId, details });
}

async function owned(db: DbOrTx, ownerId: string, projectId: string): Promise<ResearchProjectRow> {
  if (!isUuid(projectId)) throw new ResearchError("Project not found.");
  const [row] = await db
    .select()
    .from(researchProject)
    .where(and(eq(researchProject.id, projectId), eq(researchProject.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new ResearchError("Project not found.");
  return row;
}

export async function createProject(
  db: DbOrTx,
  ownerId: string,
  input: { title: string; question: string; kind: string; programmeId?: string | null; blockIds?: string[] },
): Promise<ResearchProjectRow> {
  const title = input.title.trim();
  const question = input.question.trim();
  if (title.length < 3 || title.length > 200) throw new ResearchError("Give the project a title of 3 to 200 characters.");
  if (question.length < 10 || question.length > 1000) throw new ResearchError("State the question in 10 to 1,000 characters.");
  if (!(PROJECT_KINDS as readonly string[]).includes(input.kind)) throw new ResearchError("Choose one of the kinds of project.");
  let blockIds: string[] = [];
  if (input.programmeId) {
    const [p] = await db.select().from(programme).where(eq(programme.id, input.programmeId)).limit(1);
    if (!p) throw new ResearchError("Programme not found.");
    blockIds = (input.blockIds ?? []).filter((b) => p.blocks.some((x) => x.id === b));
  }
  const [project] = await db
    .insert(researchProject)
    .values({ ownerId, title, question, kind: input.kind as ProjectKind, programmeId: input.programmeId ?? null, blockIds })
    .returning();
  await db.insert(researchDocument).values([
    { projectId: project!.id, kind: "proposal", draftMarkdown: proposalTemplate(input.kind as ProjectKind) },
    { projectId: project!.id, kind: "methods", draftMarkdown: "" },
    { projectId: project!.id, kind: "report", draftMarkdown: reportTemplate() },
  ]);
  await audit(db, ownerId, "research:create", project!.id, { kind: input.kind });
  return project!;
}

export async function listProjects(db: DbOrTx, ownerId: string): Promise<ResearchProjectRow[]> {
  return db.select().from(researchProject).where(eq(researchProject.ownerId, ownerId)).orderBy(desc(researchProject.updatedAt));
}

/** The projects that belong in the learner's record: their own, never a labelled demonstration. */
export async function listRecordProjects(db: DbOrTx, ownerId: string): Promise<ResearchProjectRow[]> {
  return db
    .select()
    .from(researchProject)
    .where(and(eq(researchProject.ownerId, ownerId), eq(researchProject.demo, false)))
    .orderBy(desc(researchProject.updatedAt));
}

export interface ProjectBundle {
  project: ResearchProjectRow;
  documents: Record<DocumentKind, { id: string; draftMarkdown: string; versions: (typeof researchVersion.$inferSelect)[] }>;
  provenance: (typeof researchProvenance.$inferSelect)[];
  artifacts: (typeof researchArtifact.$inferSelect)[];
  feedback: (typeof researchFeedback.$inferSelect & { version: number; documentKind: DocumentKind })[];
  oral: (typeof researchOralRequest.$inferSelect)[];
  shelf: { id: string; title: string; canonicalUrl: string }[];
  notebook: { id: string; title: string; createdAt: Date }[];
}

/** Everything about one project, for its owner only; null for anyone else. */
export async function getProjectBundle(db: DbOrTx, ownerId: string, projectId: string): Promise<ProjectBundle | null> {
  let project: ResearchProjectRow;
  try {
    project = await owned(db, ownerId, projectId);
  } catch {
    return null;
  }
  const docs = await db.select().from(researchDocument).where(eq(researchDocument.projectId, project.id));
  const versions = docs.length
    ? await db
        .select()
        .from(researchVersion)
        .where(
          inArray(
            researchVersion.documentId,
            docs.map((d) => d.id),
          ),
        )
        .orderBy(asc(researchVersion.version))
    : [];
  const documents = Object.fromEntries(
    DOCUMENT_KINDS.map((kind) => {
      const doc = docs.find((d) => d.kind === kind)!;
      return [kind, { id: doc.id, draftMarkdown: doc.draftMarkdown, versions: versions.filter((v) => v.documentId === doc.id) }];
    }),
  ) as ProjectBundle["documents"];
  const [provenance, artifacts, feedbackRows, oral, shelf, notebook] = await Promise.all([
    db.select().from(researchProvenance).where(eq(researchProvenance.projectId, project.id)).orderBy(asc(researchProvenance.createdAt)),
    db.select().from(researchArtifact).where(eq(researchArtifact.projectId, project.id)).orderBy(asc(researchArtifact.createdAt)),
    db.select().from(researchFeedback).where(eq(researchFeedback.projectId, project.id)).orderBy(desc(researchFeedback.createdAt)),
    db.select().from(researchOralRequest).where(eq(researchOralRequest.projectId, project.id)).orderBy(desc(researchOralRequest.createdAt)),
    project.sourceIds.length
      ? db
          .select({ id: source.id, title: source.title, canonicalUrl: source.canonicalUrl })
          .from(source)
          .where(inArray(source.id, project.sourceIds))
      : Promise.resolve([]),
    db
      .select({ id: notebookEntry.id, title: notebookEntry.title, createdAt: notebookEntry.createdAt, tags: notebookEntry.tags })
      .from(notebookEntry)
      .where(eq(notebookEntry.ownerId, ownerId))
      .orderBy(desc(notebookEntry.createdAt)),
  ]);
  const feedback = feedbackRows.map((f) => {
    const v = versions.find((x) => x.id === f.versionId)!;
    return { ...f, version: v.version, documentKind: docs.find((d) => d.id === v.documentId)!.kind };
  });
  return {
    project,
    documents,
    provenance,
    artifacts,
    feedback,
    oral,
    shelf,
    notebook: notebook.filter((n) => n.tags.includes(projectTag(project.id))).map(({ id, title, createdAt }) => ({ id, title, createdAt })),
  };
}

/**
 * Notebook entries for a project carry this tag; the notebook stays the single place for notes.
 * The UUID's hex digits keep it within the notebook's forty-character tags.
 */
export const projectTag = (projectId: string) => `project:${projectId.replace(/-/g, "").toLowerCase()}`;

export async function updateProject(
  db: DbOrTx,
  ownerId: string,
  projectId: string,
  change: { title?: string; question?: string; status?: ResearchProjectRow["status"] },
): Promise<void> {
  await owned(db, ownerId, projectId);
  const patch: Partial<typeof researchProject.$inferInsert> = {};
  if (change.title !== undefined) {
    const t = change.title.trim();
    if (t.length < 3 || t.length > 200) throw new ResearchError("Give the project a title of 3 to 200 characters.");
    patch.title = t;
  }
  if (change.question !== undefined) {
    const q = change.question.trim();
    if (q.length < 10 || q.length > 1000) throw new ResearchError("State the question in 10 to 1,000 characters.");
    patch.question = q;
  }
  if (change.status !== undefined) {
    if (!["formulating", "working", "reporting", "completed", "paused"].includes(change.status)) throw new ResearchError("Unknown status.");
    patch.status = change.status;
  }
  await db.update(researchProject).set(patch).where(eq(researchProject.id, projectId));
  await audit(db, ownerId, "research:update", projectId, change);
}

/** The focused shelf: verified source records only; anything else is a lead for the library. */
export async function setShelf(db: DbOrTx, ownerId: string, projectId: string, input: { sourceIds: string[]; sourceLeads: string[] }) {
  await owned(db, ownerId, projectId);
  const ids = [...new Set(input.sourceIds)];
  const found = ids.length ? await db.select({ id: source.id }).from(source).where(inArray(source.id, ids)) : [];
  if (found.length !== ids.length) throw new ResearchError("Only verified source records can go on the shelf; add other titles as leads.");
  const leads = [...new Set(input.sourceLeads.map((l) => l.trim()).filter(Boolean))];
  if (leads.length > 10 || leads.some((l) => l.length > 200)) throw new ResearchError("Keep to ten leads of up to 200 characters each.");
  await db.update(researchProject).set({ sourceIds: ids, sourceLeads: leads }).where(eq(researchProject.id, projectId));
  await audit(db, ownerId, "research:shelf", projectId, { sources: ids.length, leads: leads.length });
}

async function documentOf(db: DbOrTx, projectId: string, kind: DocumentKind) {
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind)) throw new ResearchError("Unknown document.");
  const [doc] = await db
    .select()
    .from(researchDocument)
    .where(and(eq(researchDocument.projectId, projectId), eq(researchDocument.kind, kind)))
    .limit(1);
  if (!doc) throw new ResearchError("Document not found.");
  return doc;
}

export async function saveDraft(db: DbOrTx, ownerId: string, projectId: string, kind: DocumentKind, markdown: string): Promise<void> {
  await owned(db, ownerId, projectId);
  if (markdown.length > 100_000) throw new ResearchError("A document can hold at most 100,000 characters.");
  const doc = await documentOf(db, projectId, kind);
  await db.update(researchDocument).set({ draftMarkdown: markdown }).where(eq(researchDocument.id, doc.id));
  await db.update(researchProject).set({ updatedAt: new Date() }).where(eq(researchProject.id, projectId));
}

/** Saves the current draft as the next numbered version. Versions are never edited afterwards. */
export async function saveVersion(db: DbOrTx, ownerId: string, projectId: string, kind: DocumentKind, note?: string) {
  await owned(db, ownerId, projectId);
  const doc = await documentOf(db, projectId, kind);
  if (!doc.draftMarkdown.trim()) throw new ResearchError("There is nothing in the draft to save as a version.");
  const [last] = await db
    .select({ version: researchVersion.version })
    .from(researchVersion)
    .where(eq(researchVersion.documentId, doc.id))
    .orderBy(desc(researchVersion.version))
    .limit(1);
  const [row] = await db
    .insert(researchVersion)
    .values({
      documentId: doc.id,
      version: (last?.version ?? 0) + 1,
      bodyMarkdown: doc.draftMarkdown,
      note: note?.trim().slice(0, 500) || null,
    })
    .returning();
  if (kind === "proposal") await db.update(researchProject).set({ status: "working" }).where(eq(researchProject.id, projectId));
  if (kind === "report") await db.update(researchProject).set({ status: "reporting" }).where(eq(researchProject.id, projectId));
  await audit(db, ownerId, "research:version", projectId, { kind, version: row!.version });
  return row!;
}

export async function addProvenance(
  db: DbOrTx,
  ownerId: string,
  projectId: string,
  input: ProvenanceInput & { notes?: string },
): Promise<void> {
  await owned(db, ownerId, projectId);
  const errors = validateProvenance(input);
  if (errors.length) throw new ResearchError(errors.join(" "));
  await db.insert(researchProvenance).values({
    projectId,
    kind: input.kind,
    title: input.title.trim(),
    origin: input.origin.trim(),
    versionOrDate: input.versionOrDate.trim(),
    licence: input.licence.trim(),
    // Data the learner collected from people was refused above, so only these two remain.
    humanParticipants: input.humanParticipants === "existing_published" ? "existing_published" : "none",
    seed: input.seed?.trim() || null,
    generator: input.generator?.trim() || null,
    notes: (input.notes ?? "").trim().slice(0, 2000),
  });
  await audit(db, ownerId, "research:provenance", projectId, { kind: input.kind });
}

export async function removeProvenance(db: DbOrTx, ownerId: string, projectId: string, provenanceId: string): Promise<void> {
  await owned(db, ownerId, projectId);
  if (!isUuid(provenanceId)) return;
  await db.delete(researchProvenance).where(and(eq(researchProvenance.id, provenanceId), eq(researchProvenance.projectId, projectId)));
}

/**
 * An intermediate artefact: a notebook entry of the owner's, or a small file (images, tables,
 * code or text, at most 5 MB) kept in the private blob store and served only to the owner.
 */
export async function addArtifact(
  db: DbOrTx,
  blobs: BlobStore,
  ownerId: string,
  projectId: string,
  input: {
    title: string;
    kind: (typeof researchArtifact.$inferInsert)["kind"];
    description?: string;
    notebookEntryId?: string | null;
    file?: { data: Buffer; filename: string; contentType: string } | null;
  },
): Promise<void> {
  await owned(db, ownerId, projectId);
  const title = input.title.trim();
  if (title.length < 2 || title.length > 200) throw new ResearchError("Give the artefact a title.");
  if (!["figure", "table", "code", "data", "notes", "other"].includes(input.kind)) throw new ResearchError("Unknown kind of artefact.");
  let notebookEntryId: string | null = null;
  if (input.notebookEntryId) {
    if (!isUuid(input.notebookEntryId)) throw new ResearchError("Notebook entry not found.");
    const [entry] = await db
      .select({ id: notebookEntry.id })
      .from(notebookEntry)
      .where(and(eq(notebookEntry.id, input.notebookEntryId), eq(notebookEntry.ownerId, ownerId)))
      .limit(1);
    if (!entry) throw new ResearchError("Notebook entry not found.");
    notebookEntryId = entry.id;
  }
  let stored: { key: string; sizeBytes: number } | null = null;
  if (input.file) {
    if (!ARTIFACT_TYPES[input.file.contentType])
      throw new ResearchError("Attach an image (PNG or JPEG), a table (CSV), code, JSON or text.");
    if (input.file.data.byteLength === 0) throw new ResearchError("The file is empty.");
    if (input.file.data.byteLength > ARTIFACT_LIMIT_BYTES) throw new ResearchError("Artefacts can be at most 5 MB.");
    stored = await blobs.put(input.file.data);
  }
  if (!notebookEntryId && !stored) throw new ResearchError("Attach a file or choose a notebook entry.");
  await db.insert(researchArtifact).values({
    projectId,
    title,
    kind: input.kind,
    description: (input.description ?? "").trim().slice(0, 2000),
    notebookEntryId,
    blobKey: stored?.key ?? null,
    filename: input.file ? input.file.filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) : null,
    contentType: input.file?.contentType ?? null,
    sizeBytes: stored?.sizeBytes ?? null,
  });
  await audit(db, ownerId, "research:artifact", projectId, { kind: input.kind, file: Boolean(stored) });
}

export async function getArtifactFile(
  db: DbOrTx,
  blobs: BlobStore,
  ownerId: string,
  artifactId: string,
): Promise<{ data: Buffer; filename: string; contentType: string } | null> {
  if (!isUuid(artifactId)) return null;
  const [row] = await db
    .select({ artifact: researchArtifact })
    .from(researchArtifact)
    .innerJoin(researchProject, eq(researchArtifact.projectId, researchProject.id))
    .where(and(eq(researchArtifact.id, artifactId), eq(researchProject.ownerId, ownerId)))
    .limit(1);
  const a = row?.artifact;
  if (!a?.blobKey || !a.contentType) return null;
  const data = await blobs.get(a.blobKey);
  return data ? { data, filename: a.filename ?? "artefact", contentType: a.contentType } : null;
}

/**
 * Feedback on one saved version. The structural checks are always recorded. Written feedback
 * comes only from a live, approved model; in the scripted demo no model reads the work and none
 * is pretended, and a blocked provider is recorded with its reason.
 */
export async function requestFeedback(db: DbOrTx, ownerId: string, projectId: string, versionId: string, env: Env) {
  const project = await owned(db, ownerId, projectId);
  if (!isUuid(versionId)) throw new ResearchError("Version not found.");
  const [version] = await db
    .select({ v: researchVersion, kind: researchDocument.kind })
    .from(researchVersion)
    .innerJoin(researchDocument, eq(researchVersion.documentId, researchDocument.id))
    .where(and(eq(researchVersion.id, versionId), eq(researchDocument.projectId, projectId)))
    .limit(1);
  if (!version) throw new ResearchError("Version not found.");
  const bundle = (await getProjectBundle(db, ownerId, projectId))!;
  const latest = (kind: DocumentKind) => bundle.documents[kind].versions.at(-1)?.bodyMarkdown ?? bundle.documents[kind].draftMarkdown;
  const provenance = bundle.provenance.map((p) => ({ ...p, seed: p.seed, generator: p.generator }));
  const checks = checkProposal({
    kind: project.kind,
    question: project.question,
    proposal: version.kind === "proposal" ? version.v.bodyMarkdown : latest("proposal"),
    methods: version.kind === "methods" ? version.v.bodyMarkdown : latest("methods"),
    sourceCount: project.sourceIds.length,
    provenance,
  });
  const system = buildSupervisorPrompt({
    institutionName: env.INSTITUTION_NAME,
    projectTitle: project.title,
    kindLabel: PROJECT_KIND_INFO[project.kind].label,
    question: project.question,
    documentKind: version.kind,
    version: version.v.version,
    body: version.v.bodyMarkdown,
    provenance: bundle.provenance.map((p) => `${p.title} (${p.kind}): ${p.origin}`),
    sources: bundle.shelf.map((s) => s.title),
    checks,
  });
  const instruction = "Give your provisional feedback on this version.";
  const promptVersion = `${SUPERVISOR_PROMPT_VERSION};role:${ROLE_CONTRACTS.supervisor.version}`;
  const plan = await planRun(db, ownerId, env, "supervisor", `${system}\n${instruction}`, { purpose: "studio-feedback", promptVersion });
  const base = { projectId, versionId, checks };
  if (plan.kind === "scripted") {
    const [row] = await db
      .insert(researchFeedback)
      .values({ ...base, mode: "scripted", status: "ok" })
      .returning();
    await audit(db, ownerId, "research:feedback", projectId, { mode: "scripted" });
    return row!;
  }
  if (plan.kind === "refused") {
    const [row] = await db
      .insert(researchFeedback)
      .values({ ...base, mode: "blocked", status: "blocked", error: plan.reason })
      .returning();
    return row!;
  }
  try {
    const result = await plan.provider.generateStructured({
      role: "supervisor",
      purpose: "studio-feedback",
      system,
      messages: [{ role: "user", content: instruction }],
      schema: SupervisorFeedbackSchema,
      schemaName: "SupervisorFeedback",
      maxTokens: plan.maxTokens,
      effort: plan.effort,
    });
    await finishProviderRun(db, plan.runId, { status: "ok", model: result.model, attempts: result.attempts });
    const providerRunId = plan.runId;
    const [row] = await db
      .insert(researchFeedback)
      .values({ ...base, mode: "live", status: "ok", feedback: result.object, providerRunId })
      .returning();
    await audit(db, ownerId, "research:feedback", projectId, { mode: "live" });
    return row!;
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    await finishProviderRun(db, plan.runId, {
      status: error.kind === "refused" ? "refused" : "error",
      model: plan.model,
      error: error.message,
      attempts: error.attempts,
    });
    const providerRunId = plan.runId;
    const [row] = await db
      .insert(researchFeedback)
      .values({ ...base, mode: "live", status: "failed", error: error.message, providerRunId })
      .returning();
    return row!;
  }
}

export async function requestOralDiscussion(
  db: DbOrTx,
  ownerId: string,
  projectId: string,
  input: { focus: string; preferredTimes: string },
) {
  await owned(db, ownerId, projectId);
  const focus = input.focus.trim();
  if (focus.length < 10 || focus.length > 1000) throw new ResearchError("Say in a sentence what you want to discuss.");
  const [row] = await db
    .insert(researchOralRequest)
    .values({ projectId, focus, preferredTimes: input.preferredTimes.trim().slice(0, 300) })
    .returning();
  await audit(db, ownerId, "research:oral-request", projectId);
  return row!;
}

/** Holds a requested oral discussion as a bounded office-hours discussion with a faculty persona. */
export async function holdOralDiscussion(db: DbOrTx, ownerId: string, requestId: string, chairPersonaId: string) {
  if (!isUuid(requestId)) throw new ResearchError("Request not found.");
  const [row] = await db
    .select({ request: researchOralRequest, project: researchProject })
    .from(researchOralRequest)
    .innerJoin(researchProject, eq(researchOralRequest.projectId, researchProject.id))
    .where(and(eq(researchOralRequest.id, requestId), eq(researchProject.ownerId, ownerId)))
    .limit(1);
  if (row?.request.status !== "requested") throw new ResearchError("Request not found.");
  const discussion = await openDiscussion(db, ownerId, {
    kind: "office_hours",
    title: `Oral discussion: ${row.project.title}. ${row.request.focus}`.slice(0, 200),
    chairPersonaId,
    maxRounds: 6,
  });
  await db.update(researchOralRequest).set({ status: "held", discussionId: discussion.id }).where(eq(researchOralRequest.id, requestId));
  return discussion;
}

export async function withdrawOralDiscussion(db: DbOrTx, ownerId: string, requestId: string): Promise<void> {
  if (!isUuid(requestId)) return;
  const [row] = await db
    .select({ id: researchOralRequest.id })
    .from(researchOralRequest)
    .innerJoin(researchProject, eq(researchOralRequest.projectId, researchProject.id))
    .where(and(eq(researchOralRequest.id, requestId), eq(researchProject.ownerId, ownerId)))
    .limit(1);
  if (row) await db.update(researchOralRequest).set({ status: "withdrawn" }).where(eq(researchOralRequest.id, requestId));
}

/** The report as Markdown, assembled from the project's latest saved report and its records. */
export async function projectReport(db: DbOrTx, ownerId: string, projectId: string): Promise<string | null> {
  const bundle = await getProjectBundle(db, ownerId, projectId);
  if (!bundle) return null;
  const { project } = bundle;
  const report = bundle.documents.report.versions.at(-1)?.bodyMarkdown ?? null;
  return assembleReport({
    title: project.title,
    kind: project.kind,
    question: project.question,
    body: report,
    provenance: bundle.provenance.map((p) => ({ ...p, seed: p.seed, generator: p.generator })),
    artifacts: bundle.artifacts.map((a) => ({ title: a.title, kind: a.kind })),
    sources: bundle.shelf.map((s) => ({ title: s.title, url: s.canonicalUrl })),
    feedback: bundle.feedback.map((f) => ({
      version: f.version,
      document: f.documentKind,
      outcome: f.mode === "scripted" ? "scripted" : f.mode === "blocked" ? "blocked" : f.status === "ok" ? "live" : "failed",
      met: f.checks.filter((c) => c.status === "met").length,
      total: f.checks.length,
    })),
    generatedAt: new Date().toISOString(),
  });
}
