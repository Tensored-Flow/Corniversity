"use server";
import { createEntry } from "@corniversity/db/services/notebook";
import {
  followProgramme,
  getProgramme,
  ProgrammeError,
  proposeProgrammeRoute,
  setParticipationStatus,
} from "@corniversity/db/services/programmes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;

function programmeId(form: FormData): string {
  const id = String(form.get("programmeId") ?? "");
  if (!ID.test(id)) redirect("/programmes");
  return id;
}

/** Following records interest and shows the blocks on the academic map; it enrols in nothing. */
export async function followProgrammeAction(form: FormData): Promise<void> {
  const session = await requireSession("/programmes");
  const id = programmeId(form);
  try {
    await followProgramme(db(), session.user.id, id, "learner");
  } catch (error) {
    if (error instanceof ProgrammeError) redirect(`/programmes/${id}?error=${encodeURIComponent(error.message)}`);
    throw error;
  }
  revalidatePath(`/programmes/${id}`);
  revalidatePath("/studies");
  redirect(`/programmes/${id}?saved=following`);
}

export async function setProgrammeStatusAction(form: FormData): Promise<void> {
  const session = await requireSession("/programmes");
  const id = programmeId(form);
  const status = String(form.get("status") ?? "");
  if (status !== "paused" && status !== "left" && status !== "following") redirect(`/programmes/${id}`);
  await setParticipationStatus(db(), session.user.id, id, status);
  revalidatePath(`/programmes/${id}`);
  revalidatePath("/studies");
  redirect(`/programmes/${id}?saved=${status}`);
}

/** The director drafts a route through the programme; the learner confirms or rejects it on the director's page. */
export async function askDirectorAction(form: FormData): Promise<void> {
  const session = await requireSession("/programmes");
  const id = programmeId(form);
  try {
    await proposeProgrammeRoute(db(), session.user.id, id);
  } catch (error) {
    if (error instanceof ProgrammeError) redirect(`/programmes/${id}?error=${encodeURIComponent(error.message)}`);
    throw error;
  }
  revalidatePath("/director");
  redirect("/director?proposed=programme");
}

/** Opens a structured paper report in the notebook, with the seminar's headings and nothing else written for the learner. */
export async function startPaperReportAction(form: FormData): Promise<void> {
  const session = await requireSession("/programmes");
  const id = programmeId(form);
  const index = Number(form.get("paper"));
  const p = await getProgramme(db(), id);
  const seminar = p?.paperSeminar;
  const paper = seminar && Number.isInteger(index) ? seminar.papers[index] : undefined;
  if (!seminar || !paper) redirect(`/programmes/${id}`);
  const title = paper.sourceId ?? paper.candidate ?? "Paper";
  const body = [`*${seminar.title}. Focus: ${paper.focus}*`, "", ...seminar.reportHeadings.flatMap((h) => [`## ${h}`, "", ""])].join("\n");
  const entry = await createEntry(db(), session.user.id, {
    title: `Paper report: ${title}`,
    bodyMarkdown: body,
    kind: "note",
    tags: ["paper-seminar", id, ...paper.blockIds],
    sourceLinks: [],
    courseId: null,
  });
  revalidatePath("/notebook");
  redirect(`/notebook/${entry.id}`);
}
