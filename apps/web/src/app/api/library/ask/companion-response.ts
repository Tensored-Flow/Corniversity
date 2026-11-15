import type { EvidenceRef } from "@corniversity/core/grounding/citations";
import { ERROR_NOTICES, type ErrorCode, errorCode } from "@/lib/notices";

/**
 * How /api/library/ask answers a refusal: always the registered sentence under its code, never a
 * service's or provider's own words in its place. A refusal of the model run itself (a limit, a
 * blocked provider) also carries the run planner's reason, with its amounts, beside the sentence.
 */

export type RefusalKind = "not_found" | "invalid" | "state" | "permission" | "action";

const STATUS: Record<RefusalKind, number> = { not_found: 404, invalid: 400, state: 409, permission: 403, action: 422 };

export interface RefusalAnswer {
  status: number;
  body: { error: ErrorCode; message: string; reason?: string; code?: string };
}

/** A refusal decided before any model call (core or the companion service). */
export function gateRefusal(refusal: { reason: string; kind: RefusalKind }): RefusalAnswer {
  const code = errorCode(refusal.reason);
  return { status: STATUS[refusal.kind], body: { error: code, message: ERROR_NOTICES[code] } };
}

/**
 * A model run the planner refused (streamPersonaTurn answers it as JSON `{message, code}` with 402
 * for a limit and 409 for a blocked provider): the registered sentence, and the planner's reason.
 */
export function runRefusal(status: number, body: unknown): RefusalAnswer {
  const fields = (body && typeof body === "object" ? body : {}) as { message?: unknown; code?: unknown };
  const code: ErrorCode = fields.code === "budget_blocked" ? "companion-budget-refused" : "companion-provider-blocked";
  return {
    status,
    body: {
      error: code,
      message: ERROR_NOTICES[code],
      ...(typeof fields.message === "string" ? { reason: fields.message.slice(0, 600) } : {}),
      ...(typeof fields.code === "string" ? { code: fields.code } : {}),
    },
  };
}

/** What was sent, as the panel lists it: each evidence block's tag and label (a header value, URI-encoded). */
export function evidenceHeader(refs: readonly EvidenceRef[]): string {
  return encodeURIComponent(JSON.stringify(refs.map((r) => ({ tag: r.tag, label: r.label }))));
}

/** The selection's standing, for the panel: only the selection (linked), found or not found on the page, or none. */
export function selectionHeader(turn: { selectionOnly: boolean; selectionFound: boolean | null }): string {
  if (turn.selectionOnly) return "only";
  if (turn.selectionFound === null) return "none";
  return turn.selectionFound ? "found" : "not-found";
}
