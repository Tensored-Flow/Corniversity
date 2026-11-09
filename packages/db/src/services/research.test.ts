import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BlobStore } from "../blob";
import { createDb } from "../client";
import { getEnv } from "../env";
import { user } from "../schema/auth";
import { auditEvent, notebookEntry, providerRun, providerSetting, researchProject, source } from "../schema/index";
import { createEntry } from "./notebook";
import { saveProviderSetting } from "./provider-config";
import {
  addArtifact,
  addProvenance,
  createProject,
  getArtifactFile,
  getProjectBundle,
  projectReport,
  projectTag,
  ResearchError,
  requestFeedback,
  requestOralDiscussion,
  saveDraft,
  saveVersion,
  setShelf,
  updateProject,
  withdrawOralDiscussion,
} from "./research";

/**
 * The research studio against PostgreSQL: owner-only projects, immutable versions, provenance
 * that refuses data taken from people, small private artefacts, feedback that is the structural
 * checks alone in the scripted demo and is recorded as blocked when a live model cannot run, and
 * a report assembled from the project's own records.
 */
const OWNER = `studio-owner-${randomUUID()}`;
const OTHER = `studio-other-${randomUUID()}`;
const SOURCE = `test-source-${randomUUID().slice(0, 8)}`;
let handle: ReturnType<typeof createDb>;
let projectId = "";

/** An in-memory blob store with the same contract as the real ones. */
const memory = new Map<string, Buffer>();
const blobs: BlobStore = {
  driver: "pg",
  async put(data) {
    const key = randomUUID();
    memory.set(key, data);
    return { key, sha256: "test", sizeBytes: data.byteLength };
  },
  async get(key) {
    return memory.get(key) ?? null;
  },
  async delete(key) {
    memory.delete(key);
  },
  async exists(key) {
    return memory.has(key);
  },
};

beforeAll(async () => {
  handle = createDb(process.env.DATABASE_URL!, { max: 2 });
  await handle.db.insert(user).values([
    { id: OWNER, name: "Studio Owner", email: `${OWNER}@example.test` },
    { id: OTHER, name: "Someone Else", email: `${OTHER}@example.test` },
  ]);
  await handle.db.insert(source).values({
    id: SOURCE,
    title: "A verified test source",
    kind: "paper",
    canonicalUrl: "https://example.org/paper",
    currentVersionId: "v1",
  });
});

afterAll(async () => {
  for (const id of [OWNER, OTHER]) {
    await handle.db.delete(researchProject).where(eq(researchProject.ownerId, id));
    await handle.db.delete(notebookEntry).where(eq(notebookEntry.ownerId, id));
    await handle.db.delete(auditEvent).where(eq(auditEvent.ownerId, id));
    await handle.db.delete(providerRun).where(eq(providerRun.ownerId, id));
    await handle.db.delete(providerSetting).where(eq(providerSetting.userId, id));
    await handle.db.delete(user).where(eq(user.id, id));
  }
  await handle.db.delete(source).where(eq(source.id, SOURCE));
  await handle.close();
});

describe("projects", () => {
  it("start from the question, with the proposal and report templates of their kind", async () => {
    const project = await createProject(handle.db, OWNER, {
      title: "Forgetting in the ambiguous case",
      question: "Does a forgetting term change which model is recovered in the ambiguous case?",
      kind: "computational",
    });
    projectId = project.id;
    const bundle = await getProjectBundle(handle.db, OWNER, projectId);
    expect(bundle?.project.status).toBe("formulating");
    expect(bundle?.documents.proposal.draftMarkdown).toContain("## Predictions before running");
    expect(bundle?.documents.report.draftMarkdown).toContain("## What remains unsupported");
  });

  it("refuse an unknown kind and a question that is not stated", async () => {
    await expect(createProject(handle.db, OWNER, { title: "x".repeat(5), question: "Why?", kind: "computational" })).rejects.toThrow(
      ResearchError,
    );
    await expect(
      createProject(handle.db, OWNER, { title: "Survey", question: "A long enough question here?", kind: "survey" }),
    ).rejects.toThrow(/kinds of project/);
  });

  it("are the owner's alone: another account can neither read nor change them", async () => {
    expect(await getProjectBundle(handle.db, OTHER, projectId)).toBeNull();
    await expect(updateProject(handle.db, OTHER, projectId, { status: "completed" })).rejects.toThrow(/not found/);
    await expect(saveDraft(handle.db, OTHER, projectId, "proposal", "taken over")).rejects.toThrow(/not found/);
  });
});

describe("the focused shelf", () => {
  it("takes verified source records only, and other titles as leads", async () => {
    await expect(setShelf(handle.db, OWNER, projectId, { sourceIds: ["not-a-verified-source"], sourceLeads: [] })).rejects.toThrow(
      /verified/,
    );
    await setShelf(handle.db, OWNER, projectId, {
      sourceIds: [SOURCE],
      sourceLeads: ["Collins and Frank (2012), working memory in learning"],
    });
    const bundle = await getProjectBundle(handle.db, OWNER, projectId);
    expect(bundle?.shelf.map((s) => s.title)).toEqual(["A verified test source"]);
    expect(bundle?.project.sourceLeads).toHaveLength(1);
  });
});

describe("documents", () => {
  it("are saved as numbered versions that later drafts do not change", async () => {
    await saveDraft(handle.db, OWNER, projectId, "methods", "");
    await expect(saveVersion(handle.db, OWNER, projectId, "methods")).rejects.toThrow(/nothing in the draft/);
    const v1 = await saveVersion(handle.db, OWNER, projectId, "proposal", "first full draft");
    await saveDraft(handle.db, OWNER, projectId, "proposal", "## Question\n\nRewritten.");
    const v2 = await saveVersion(handle.db, OWNER, projectId, "proposal");
    expect([v1.version, v2.version]).toEqual([1, 2]);
    const bundle = await getProjectBundle(handle.db, OWNER, projectId);
    expect(bundle?.documents.proposal.versions[0]?.bodyMarkdown).toContain("## Predictions before running");
    expect(bundle?.project.status).toBe("working");
  });
});

describe("provenance", () => {
  it("records a simulation with its seed and generator, and refuses one without them", async () => {
    const simulation = {
      kind: "simulation" as const,
      title: "Synthetic bandit sessions",
      origin: "choice-model-loop laboratory",
      versionOrDate: "",
      licence: "",
      humanParticipants: "none" as const,
      seed: "7",
      generator: "Rescorla-Wagner with forgetting, 200 trials",
    };
    await expect(addProvenance(handle.db, OWNER, projectId, { ...simulation, seed: "" })).rejects.toThrow(/random seed/);
    await addProvenance(handle.db, OWNER, projectId, simulation);
    expect((await getProjectBundle(handle.db, OWNER, projectId))?.provenance).toHaveLength(1);
  });

  it("never accepts new data from people", async () => {
    await expect(
      addProvenance(handle.db, OWNER, projectId, {
        kind: "existing_dataset",
        title: "My own survey",
        origin: "collected myself",
        versionOrDate: "2026",
        licence: "none",
        humanParticipants: "new" as never,
      }),
    ).rejects.toThrow(/new data from people/);
  });
});

describe("artefacts", () => {
  it("accept a small image or a notebook entry of the owner's, served to the owner only", async () => {
    await addArtifact(handle.db, blobs, OWNER, projectId, {
      title: "Confusion matrix",
      kind: "figure",
      file: { data: Buffer.from([0x89, 0x50, 0x4e, 0x47]), filename: "matrix (seeds 1-5).png", contentType: "image/png" },
    });
    const entry = await createEntry(handle.db, OWNER, {
      title: "Fit notes",
      bodyMarkdown: "Alpha drifts.",
      kind: "note",
      tags: [projectTag(projectId)],
    });
    await addArtifact(handle.db, blobs, OWNER, projectId, { title: "Notes on the fit", kind: "notes", notebookEntryId: entry.id });
    const bundle = (await getProjectBundle(handle.db, OWNER, projectId))!;
    expect(bundle.artifacts.map((a) => a.title)).toEqual(["Confusion matrix", "Notes on the fit"]);
    expect(bundle.notebook.map((n) => n.title)).toEqual(["Fit notes"]);
    const file = bundle.artifacts[0]!;
    expect(file.filename).toBe("matrix__seeds_1-5_.png");
    expect((await getArtifactFile(handle.db, blobs, OWNER, file.id))?.contentType).toBe("image/png");
    expect(await getArtifactFile(handle.db, blobs, OTHER, file.id)).toBeNull();
  });

  it("refuse other file types, oversized files and someone else's notebook entry", async () => {
    const pdf = { data: Buffer.from("%PDF-1.7"), filename: "x.pdf", contentType: "application/pdf" };
    await expect(addArtifact(handle.db, blobs, OWNER, projectId, { title: "Paper", kind: "other", file: pdf })).rejects.toThrow(
      /Attach an image/,
    );
    const big = { data: Buffer.alloc(5 * 1024 * 1024 + 1), filename: "big.csv", contentType: "text/csv" };
    await expect(addArtifact(handle.db, blobs, OWNER, projectId, { title: "Big", kind: "data", file: big })).rejects.toThrow(/5 MB/);
    const theirs = await createEntry(handle.db, OTHER, { title: "Theirs", bodyMarkdown: "x", kind: "note" });
    await expect(
      addArtifact(handle.db, blobs, OWNER, projectId, { title: "Theirs", kind: "notes", notebookEntryId: theirs.id }),
    ).rejects.toThrow(/not found/);
  });
});

describe("feedback", () => {
  it("in the scripted demo, is the structural checks alone: no model is called and none is pretended", async () => {
    const bundle = (await getProjectBundle(handle.db, OWNER, projectId))!;
    const runsBefore = (await handle.db.select().from(providerRun).where(eq(providerRun.ownerId, OWNER))).length;
    const row = await requestFeedback(handle.db, OWNER, projectId, bundle.documents.proposal.versions[0]!.id, getEnv());
    expect(row).toMatchObject({ mode: "scripted", status: "ok", feedback: null });
    expect(row.checks.find((c) => c.id === "provenance")?.status).toBe("met");
    expect(row.checks.find((c) => c.id === "sources")?.status).toBe("met");
    expect((await handle.db.select().from(providerRun).where(eq(providerRun.ownerId, OWNER))).length).toBe(runsBefore);
  });

  it("when a live model is chosen but cannot run, is recorded as blocked with the reason", async () => {
    await saveProviderSetting(handle.db, OWNER, getEnv(), { provider: "anthropic", model: "claude-opus-5-5" });
    const bundle = (await getProjectBundle(handle.db, OWNER, projectId))!;
    const row = await requestFeedback(handle.db, OWNER, projectId, bundle.documents.proposal.versions[1]!.id, getEnv());
    expect(row).toMatchObject({ mode: "blocked", status: "blocked", feedback: null });
    expect(row.error).toMatch(/no API key is stored/);
    await saveProviderSetting(handle.db, OWNER, getEnv(), { provider: "fixture" });
  });
});

describe("the oral discussion and the report", () => {
  it("records a request that can be withdrawn", async () => {
    const request = await requestOralDiscussion(handle.db, OWNER, projectId, {
      focus: "Whether the forgetting term is identifiable in the ambiguous design.",
      preferredTimes: "weekday evenings",
    });
    expect(request.status).toBe("requested");
    await withdrawOralDiscussion(handle.db, OWNER, request.id);
    expect((await getProjectBundle(handle.db, OWNER, projectId))?.oral[0]?.status).toBe("withdrawn");
  });

  it("assembles the report from the project's own records, and says when no report is written", async () => {
    const text = (await projectReport(handle.db, OWNER, projectId))!;
    expect(text).toContain("# Forgetting in the ambiguous case");
    expect(text).toContain("*The report has not been written yet; its headings are:*");
    expect(text).toContain("**Synthetic bandit sessions** (simulation)");
    expect(text).toContain("- A verified test source: https://example.org/paper");
    expect(text).toContain("no model read it (scripted demo)");
    expect(await projectReport(handle.db, OTHER, projectId)).toBeNull();
  });
});
