"use server";
import {
  createProposal,
  decideOverlap,
  ProposalError,
  publishProposal,
  rejectProposal,
  reviseProposal,
} from "@corniversity/db/services/extension";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { errorCode, errorHref } from "@/lib/notices";
import { requireSession } from "@/lib/session";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** "Title | note" per line; a line without a bar is a title with no note. */
function sourceLines(raw: string): { title: string; note: string }[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [title = "", ...rest] = l.split("|");
      return { title: title.trim(), note: rest.join("|").trim() };
    });
}

function failure(error: unknown, back: string): never {
  const message =
    error instanceof ProposalError ? error.message : error instanceof ZodError ? (error.issues[0]?.message ?? "Check the fields.") : null;
  if (message) redirect(errorHref(back, errorCode(message)));
  throw error;
}

export async function createProposalAction(form: FormData): Promise<void> {
  const session = await requireSession("/proposals");
  let id: string;
  try {
    const row = await createProposal(db(), session.user.id, {
      kind: text(form, "kind") as "reading_course",
      departmentId: text(form, "departmentId"),
      title: text(form, "title"),
      purpose: text(form, "purpose"),
      scope: text(form, "scope"),
      depth: text(form, "depth") as "standard",
      sourceCandidates: sourceLines(text(form, "sources")),
    });
    id = row.id;
  } catch (error) {
    failure(error, "/proposals");
  }
  redirect(`/proposals/${id}`);
}

async function act(form: FormData, run: (ownerId: string, id: string) => Promise<unknown>): Promise<void> {
  const session = await requireSession("/proposals");
  const id = text(form, "id");
  try {
    await run(session.user.id, id);
  } catch (error) {
    failure(error, `/proposals/${id}`);
  }
  revalidatePath(`/proposals/${id}`);
}

export async function decideOverlapAction(form: FormData): Promise<void> {
  await act(form, (owner, id) =>
    decideOverlap(db(), owner, id, {
      courseId: text(form, "courseId"),
      decision: text(form, "decision") === "reuse" ? "reuse" : "distinct",
      note: text(form, "note"),
    }),
  );
}

export async function reviseProposalAction(form: FormData): Promise<void> {
  await act(form, (owner, id) =>
    reviseProposal(db(), owner, id, {
      scope: text(form, "scope"),
      depth: text(form, "depth") as "standard",
      reusedUnitIds: form.getAll("reusedUnitIds").map(String),
      conceptIds: form.getAll("conceptIds").map(String),
      sourceCandidates: sourceLines(text(form, "sources")),
    }),
  );
}

export async function publishProposalAction(form: FormData): Promise<void> {
  await act(form, (owner, id) => publishProposal(db(), owner, id));
  revalidatePath("/catalogue");
}

export async function rejectProposalAction(form: FormData): Promise<void> {
  await act(form, (owner, id) => rejectProposal(db(), owner, id, text(form, "note")));
}
