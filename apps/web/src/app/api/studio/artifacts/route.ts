import { addArtifact, ResearchError } from "@corniversity/db/services/research";
import { NextResponse } from "next/server";
import { blobs } from "@/lib/blobs";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The file's type comes from an allowed extension, never from what the browser claims. */
const BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  py: "text/x-python",
};

/** Images must start with their format's signature, so a renamed file is not served as an image. */
function signatureMatches(contentType: string, data: Buffer): boolean {
  if (contentType === "image/png") return data.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (contentType === "image/jpeg") return data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  return true;
}

/** Attaches an artefact to one of the signed-in owner's research projects. */
export async function POST(request: Request): Promise<Response> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return authed.response;
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send the artefact as a form." }, { status: 400 });
  const projectId = String(form.get("projectId") ?? "");
  const upload = form.get("file");
  let file: { data: Buffer; filename: string; contentType: string } | null = null;
  if (upload instanceof File && upload.size > 0) {
    const extension = upload.name.split(".").pop()?.toLowerCase() ?? "";
    const contentType = BY_EXTENSION[extension];
    if (!contentType) return NextResponse.json({ error: "Attach a PNG or JPEG image, a CSV table, code, JSON or text." }, { status: 422 });
    if (upload.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Artefacts can be at most 5 MB." }, { status: 413 });
    const data = Buffer.from(await upload.arrayBuffer());
    if (!signatureMatches(contentType, data))
      return NextResponse.json({ error: "The file is not the image its name says." }, { status: 422 });
    file = { data, filename: upload.name, contentType };
  }
  try {
    await addArtifact(db(), blobs(), authed.session.user.id, projectId, {
      title: String(form.get("title") ?? ""),
      kind: String(form.get("kind") ?? "other") as "figure" | "table" | "code" | "data" | "notes" | "other",
      description: String(form.get("description") ?? ""),
      notebookEntryId: String(form.get("notebookEntryId") ?? "") || null,
      file,
    });
  } catch (error) {
    if (error instanceof ResearchError) return NextResponse.json({ error: error.message }, { status: 422 });
    throw error;
  }
  return NextResponse.json({ ok: true });
}
