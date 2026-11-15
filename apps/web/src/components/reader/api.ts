/**
 * The reader's calls to POST/PATCH/DELETE /api/library/annotations (JSON, same-origin). A refusal
 * carries the server's registered sentence; anything else is described here without guessing.
 */
import type { AnchorInput, AnnotationColor, AnnotationKind, ReaderAnnotation } from "./annotations";

export type ApiFailure = { ok: false; message: string };
export type ApiResult<T> = { ok: true; value: T } | ApiFailure;
export type UpdateResult = ApiResult<ReaderAnnotation> | { ok: false; message: string; conflict: ReaderAnnotation };

const ENDPOINT = "/api/library/annotations";

function failureText(status: number): string {
  if (status === 401) return "Your session has ended, so nothing was saved. Sign in again in another tab, then retry.";
  return `The server refused the request (status ${status}), so nothing was changed.`;
}

async function call(
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> } | ApiFailure> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method,
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: "The server could not be reached, so nothing was changed. Try again." };
  }
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, json };
}

function refused(status: number, json: Record<string, unknown>): ApiFailure {
  return { ok: false, message: typeof json.message === "string" ? json.message : failureText(status) };
}

export async function createAnnotationRequest(input: {
  assetId: string;
  kind: AnnotationKind;
  physicalIndex: number;
  noteMarkdown?: string;
  color?: AnnotationColor | null;
  anchor?: AnchorInput;
  loadedSha256?: string;
}): Promise<ApiResult<ReaderAnnotation>> {
  const result = await call("POST", input);
  if ("ok" in result) return result;
  if (result.status === 201) return { ok: true, value: result.json.annotation as ReaderAnnotation };
  return refused(result.status, result.json);
}

export async function updateAnnotationRequest(input: {
  id: string;
  noteMarkdown?: string;
  color?: AnnotationColor | null;
  expectedUpdatedAt: string;
}): Promise<UpdateResult> {
  const result = await call("PATCH", input);
  if ("ok" in result) return result;
  if (result.status === 200) return { ok: true, value: result.json.annotation as ReaderAnnotation };
  if (result.status === 409 && result.json.current)
    return { ok: false, message: String(result.json.message ?? ""), conflict: result.json.current as ReaderAnnotation };
  return refused(result.status, result.json);
}

export async function deleteAnnotationRequest(id: string): Promise<ApiResult<true>> {
  const result = await call("DELETE", { id });
  if ("ok" in result) return result;
  if (result.status === 200) return { ok: true, value: true };
  return refused(result.status, result.json);
}
