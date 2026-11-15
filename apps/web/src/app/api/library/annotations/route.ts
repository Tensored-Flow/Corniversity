import {
  AnnotationConflictError,
  createAnnotation,
  deleteAnnotation,
  LibraryError,
  MAX_ANNOTATION_NOTE_CHARS,
  updateAnnotation,
} from "@corniversity/db/services/library";
import { NextResponse } from "next/server";
import { z } from "zod";
import { toReaderAnnotation } from "@/components/reader/annotation-data";
import { db } from "@/lib/db";
import { ERROR_NOTICES, errorCode } from "@/lib/notices";
import { requireApiSession } from "@/lib/session";
import { refuseUnlessReaderRequest } from "./guard";

export const dynamic = "force-dynamic";

const Note = z.string().max(MAX_ANNOTATION_NOTE_CHARS);
const Color = z.string().max(16).nullable();

const CreateBody = z.strictObject({
  assetId: z.string().uuid(),
  kind: z.enum(["note", "highlight", "bookmark"]),
  physicalIndex: z.number().int().min(0).max(99_999),
  noteMarkdown: Note.optional(),
  color: Color.optional(),
  // Validated and completed by the service (core AnchorInputSchema); the client never sets the engine or the file.
  anchor: z.unknown().optional(),
  loadedSha256: z.string().max(64).optional(),
});

const UpdateBody = z.strictObject({
  id: z.string().uuid(),
  noteMarkdown: Note.optional(),
  color: Color.optional(),
  expectedUpdatedAt: z.string().min(1).max(40),
});

const DeleteBody = z.strictObject({ id: z.string().uuid() });

/** Every request: a session, then JSON from this site's own pages, then a body of the right shape. */
async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<{ ownerId: string; body: T } | { response: Response }> {
  const authed = await requireApiSession(request);
  if ("response" in authed) return { response: authed.response };
  const refused = refuseUnlessReaderRequest(request);
  if (refused) return { response: refused };
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return { response: NextResponse.json({ error: "invalid_request" }, { status: 400 }) };
  return { ownerId: authed.session.user.id, body: parsed.data };
}

/** A service refusal as JSON: its code and the registered sentence, never anything else. */
function refusal(error: unknown): Response {
  if (!(error instanceof LibraryError)) throw error;
  const status = error.code === "not_found" ? 404 : error.code === "conflict" ? 409 : 400;
  return NextResponse.json({ error: error.code, message: ERROR_NOTICES[errorCode(error.message)] }, { status });
}

/**
 * Creates a highlight, note (on a selection, a marked area or a whole page) or bookmark on one of the
 * owner's Documents. The server fills the anchor's engine and the file it names.
 */
export async function POST(request: Request): Promise<Response> {
  const read = await readBody(request, CreateBody);
  if ("response" in read) return read.response;
  try {
    const row = await createAnnotation(db(), read.ownerId, read.body);
    return NextResponse.json({ annotation: await toReaderAnnotation(row) }, { status: 201 });
  } catch (error) {
    return refusal(error);
  }
}

/**
 * Edits a note or colour. The edit names the version it changes (`expectedUpdatedAt`); when the
 * annotation changed since, nothing is written and the answer is 409 with the current row, so the
 * reader can show it beside the owner's draft.
 */
export async function PATCH(request: Request): Promise<Response> {
  const read = await readBody(request, UpdateBody);
  if ("response" in read) return read.response;
  const { id, ...edit } = read.body;
  try {
    const row = await updateAnnotation(db(), read.ownerId, id, edit);
    return NextResponse.json({ annotation: await toReaderAnnotation(row) });
  } catch (error) {
    if (error instanceof AnnotationConflictError) {
      return NextResponse.json(
        { error: "conflict", message: ERROR_NOTICES[errorCode(error.message)], current: await toReaderAnnotation(error.current) },
        { status: 409 },
      );
    }
    return refusal(error);
  }
}

/** Deletes one of the owner's annotations; another owner's id, or none, is not found. */
export async function DELETE(request: Request): Promise<Response> {
  const read = await readBody(request, DeleteBody);
  if ("response" in read) return read.response;
  const deleted = await deleteAnnotation(db(), read.ownerId, read.body.id);
  if (!deleted) return NextResponse.json({ error: "not_found", message: ERROR_NOTICES["annotation-not-found"] }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
