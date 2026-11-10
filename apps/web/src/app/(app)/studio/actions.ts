"use server";
import { PROVENANCE_KINDS, type ProvenanceKind } from "@corniversity/core";
import { getEnv } from "@corniversity/db/env";
import { listPersonas } from "@corniversity/db/services/catalogue";
import { createEntry } from "@corniversity/db/services/notebook";
import {
  addProvenance,
  createProject,
  type DocumentKind,
  holdOralDiscussion,
  projectTag,
  ResearchError,
  removeProvenance,
  requestFeedback,
  requestOralDiscussion,
  saveDraft,
  saveVersion,
  setShelf,
  updateProject,
  withdrawOralDiscussion,
} from "@corniversity/db/services/research";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { errorCode, errorHref } from "@/lib/notices";
import { requireSession } from "@/lib/session";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const ID = /^[0-9a-f-]{36}$/;

function projectIdOf(form: FormData): string {
  const id = text(form, "projectId");
  if (!ID.test(id)) redirect("/studio");
  return id;
}

/** Runs a studio change and returns to its section with a notice; a refused change says why. */
async function inProject(projectId: string, section: string, change: () => Promise<unknown>): Promise<never> {
  try {
    await change();
  } catch (error) {
    if (error instanceof ResearchError) redirect(errorHref(`/studio/${projectId}`, errorCode(error.message), `#${section}`));
    throw error;
  }
  revalidatePath(`/studio/${projectId}`);
  redirect(`/studio/${projectId}?saved=${section}#${section}`);
}

export async function createProjectAction(form: FormData): Promise<void> {
  const session = await requireSession("/studio");
  let id: string;
  try {
    const project = await createProject(db(), session.user.id, {
      title: text(form, "title"),
      question: text(form, "question"),
      kind: text(form, "kind"),
      programmeId: text(form, "programmeId") || null,
      blockIds: form.getAll("blockIds").map(String),
    });
    id = project.id;
  } catch (error) {
    if (error instanceof ResearchError) redirect(errorHref("/studio", errorCode(error.message)));
    throw error;
  }
  revalidatePath("/studio");
  redirect(`/studio/${id}`);
}

export async function updateProjectAction(form: FormData): Promise<void> {
  const session = await requireSession("/studio");
  const id = projectIdOf(form);
  const status = text(form, "status");
  await inProject(id, "question", () =>
    updateProject(db(), session.user.id, id, {
      title: form.has("title") ? text(form, "title") : undefined,
      question: form.has("question") ? text(form, "question") : undefined,
      status: status ? (status as "formulating" | "working" | "reporting" | "completed" | "paused") : undefined,
    }),
  );
}

export async function setShelfAction(form: FormData): Promise<void> {
  const session = await requireSession("/studio");
  const id = projectIdOf(form);
  await inProject(id, "shelf", () =>
    setShelf(db(), session.user.id, id, {
      sourceIds: form.getAll("sourceIds").map(String),
      sourceLeads: text(form, "sourceLeads").split(/\r?\n/),
    }),
  );
}

export async function saveDocumentAction(form: FormData): Promise<void> {
  const session = await requireSession("/studio");
  const id = projectIdOf(form);
  const kind = text(form, "kind") as DocumentKind;
  const markdown = String(form.get("markdown") ?? "");
  await inProject(id, kind, async () => {
    await saveDraft(db(), session.user.id, id, kind, markdown);
    if (text(form, "intent") === "version") await saveVersion(db(), session.user.id, id, kind, text(form, "note"));
  });
}

export async function addProvenanceAction(form: FormData): Promise<void> {
  const session = await requireSession("/studio");
  const id = projectIdOf(form);
  const kind = text(form, "kind");
  await inProject(id, "provenance", () =>
    addProvenance(db(), session.user.id, id, {
      kind: ((PROVENANCE_KINDS as readonly string[]).includes(kind) ? kind : "derived") as ProvenanceKind,
      title: text(form, "title"),
      origin: text(form, "origin"),
      versionOrDate: text(form, "versionOrDate"),
      licence: text(form, "licence"),
      humanParticipants: humanParticipantsOf(text(form, "humanParticipants")),
      seed: text(form, "seed") || null,
      generator: text(form, "generator") || null,
      notes: text(form, "notes"),
    }),
  );
}

export async function removeProvenanceAction(form: FormData): Promise<void> {
  const session = await requireSession("/studio");
  const id = projectIdOf(form);
  await inProject(id, "provenance", () => removeProvenance(db(), session.user.id, id, text(form, "provenanceId")));
}

/** A notebook entry for the project, opened for writing; the notebook stays the single place for notes. */
export async function newNotebookEntryAction(form: FormData): Promise<void> {
  const session = await requireSession("/studio");
  const id = projectIdOf(form);
  const title = text(form, "title") || "Studio note";
  const entry = await createEntry(db(), session.user.id, {
    title,
    bodyMarkdown: "",
    kind: "note",
    tags: ["studio", projectTag(id)],
  });
  revalidatePath(`/studio/${id}`);
  redirect(`/notebook/${entry.id}`);
}

export async function requestFeedbackAction(form: FormData): Promise<void> {
  const session = await requireSession("/studio");
  const id = projectIdOf(form);
  await inProject(id, "feedback", () => requestFeedback(db(), session.user.id, id, text(form, "versionId"), getEnv()));
}

export async function requestOralAction(form: FormData): Promise<void> {
  const session = await requireSession("/studio");
  const id = projectIdOf(form);
  await inProject(id, "oral", () =>
    requestOralDiscussion(db(), session.user.id, id, { focus: text(form, "focus"), preferredTimes: text(form, "preferredTimes") }),
  );
}

/** Holds the discussion now, as bounded office hours with the director of studies. */
export async function holdOralAction(form: FormData): Promise<void> {
  const session = await requireSession("/studio");
  const id = projectIdOf(form);
  const director = (await listPersonas(db())).find((p) => p.role === "director");
  if (!director) redirect(errorHref(`/studio/${id}`, "no-faculty-member-available-office", "#oral"));
  let discussionId = "";
  try {
    discussionId = (await holdOralDiscussion(db(), session.user.id, text(form, "requestId"), director.id)).id;
  } catch (error) {
    if (error instanceof ResearchError) redirect(errorHref(`/studio/${id}`, errorCode(error.message), "#oral"));
    throw error;
  }
  redirect(`/common-room/${discussionId}`);
}

export async function withdrawOralAction(form: FormData): Promise<void> {
  const session = await requireSession("/studio");
  const id = projectIdOf(form);
  await inProject(id, "oral", () => withdrawOralDiscussion(db(), session.user.id, text(form, "requestId")));
}

/** What the form says about people; anything unrecognised is "none". */
function humanParticipantsOf(value: string): "none" | "existing_published" | "new_from_people" {
  return value === "existing_published" || value === "new_from_people" ? value : "none";
}
