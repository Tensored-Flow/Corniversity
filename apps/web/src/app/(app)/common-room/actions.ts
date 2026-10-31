"use server";
import { CommunityError, openDiscussion, setDiscussionStatus, setPeerMembership } from "@corniversity/db/services/community";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

const UUID = /^[0-9a-f-]{36}$/;
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function openDiscussionAction(form: FormData): Promise<void> {
  const session = await requireSession("/common-room");
  const kind = text(form, "kind");
  if (!["seminar", "common_room", "society", "office_hours"].includes(kind)) redirect("/common-room");
  const peers = form
    .getAll("peers")
    .map(String)
    .filter((p) => /^[a-z0-9-]+$/.test(p));
  const rounds = Number(text(form, "rounds") || "3");
  let id = "";
  try {
    const row = await openDiscussion(db(), session.user.id, {
      kind: kind as "seminar" | "common_room" | "society" | "office_hours",
      title: text(form, "title"),
      societyId: text(form, "societyId") || undefined,
      chairPersonaId: text(form, "chairPersonaId"),
      peerPersonaIds: peers,
      maxRounds: Number.isFinite(rounds) ? rounds : 3,
    });
    id = row.id;
  } catch (error) {
    if (error instanceof CommunityError) redirect(`/common-room?error=${encodeURIComponent(error.message)}`);
    throw error;
  }
  revalidatePath("/common-room");
  redirect(`/common-room/${id}`);
}

export async function setPeerMembershipAction(form: FormData): Promise<void> {
  const session = await requireSession("/common-room");
  const personaId = text(form, "personaId");
  if (!/^[a-z0-9-]+$/.test(personaId)) redirect("/common-room");
  const field = text(form, "field");
  const value = text(form, "value") === "1";
  if (field === "enabled") await setPeerMembership(db(), session.user.id, personaId, { enabled: value });
  else if (field === "muted") await setPeerMembership(db(), session.user.id, personaId, { muted: value });
  revalidatePath("/common-room");
}

export async function setDiscussionStatusAction(form: FormData): Promise<void> {
  const session = await requireSession("/common-room");
  const id = text(form, "id");
  const status = text(form, "status");
  if (!UUID.test(id) || (status !== "closed" && status !== "muted")) redirect("/common-room");
  await setDiscussionStatus(db(), session.user.id, id, status);
  revalidatePath("/common-room");
  revalidatePath(`/common-room/${id}`);
}
