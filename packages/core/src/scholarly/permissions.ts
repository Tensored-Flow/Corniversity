import type { PermissionStatus, ProcessingAction } from "../domain/enums";
import { storageDecision, type VersionLicenceFacts } from "./licence";

/**
 * Permissions recorded for scholarly Documents. Each is a separate recorded action with its basis.
 * A private copy of an openly licensed arXiv version records local reading, local extraction and
 * private storage as allowed, with the licence arXiv reported for that version as the basis, and
 * sharing as denied. External AI and external embedding are never granted from a licence: only the
 * owner grants them. A linked Document records no permissions when it is linked.
 */

export interface PermissionGrant {
  action: ProcessingAction;
  status: PermissionStatus;
  basis: string;
}

/** Actions a licence never allows on its own; the owner decides them separately. */
export const NEVER_GRANTED_FROM_LICENCE: readonly ProcessingAction[] = ["external_ai", "external_embedding"];

/** What linking an arXiv version records: nothing. */
export const LINKED_DOCUMENT_GRANTS: readonly PermissionGrant[] = [];

export const SHARE_DENIED_BASIS = "Third-party material; sharing and export stay off by default.";

/** `licence reported by arXiv OAI-PMH on <date> for vN: <licence>` */
export function privateCopyBasis(retrievedOn: string, version: number, licence: string): string {
  return `licence reported by arXiv OAI-PMH on ${retrievedOn} for v${version}: ${licence}`;
}

/** The grants a private copy records, or the reason no private copy is possible for this version. */
export function privateCopyPermissions(
  version: VersionLicenceFacts,
): { ok: true; grants: PermissionGrant[] } | { ok: false; reason: string } {
  const decision = storageDecision(version);
  if (!decision.privateCopy) return { ok: false, reason: decision.reason };
  const basis = privateCopyBasis(decision.retrievedOn, version.arxivVersion!, version.licence!);
  return {
    ok: true,
    grants: [
      { action: "local_read", status: "allowed", basis },
      { action: "local_extract", status: "allowed", basis },
      { action: "private_cloud_store", status: "allowed", basis },
      { action: "share", status: "denied", basis: SHARE_DENIED_BASIS },
    ],
  };
}
