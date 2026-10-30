import { z } from "zod";
import { Locator } from "./locator";

export const SourceKind = z.enum(["course", "book", "notes", "video", "web", "dataset", "software"]);
export type SourceKind = z.infer<typeof SourceKind>;

export const AccessStatus = z.enum([
  "open", // freely accessible on the web under a stated licence
  "open_restricted_reuse", // readable online; copying/AI processing not licensed (reference-only)
  "commercial", // must be obtained legitimately; reference-only by default
  "institutional", // requires an institutional login; never automated
  "unknown",
]);
export type AccessStatus = z.infer<typeof AccessStatus>;

export const VerifiedLocator = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  locator: Locator,
  verifiedAt: z.string().date(),
  note: z.string().optional(),
});
export type VerifiedLocator = z.infer<typeof VerifiedLocator>;

export const SourceVersion = z.object({
  id: z.string().min(1),
  label: z.string().min(1), // edition / term / year, e.g. "Spring 2021" or "2nd edition (2018)"
  url: z.string().url(),
  verifiedAt: z.string().date(),
  verifiedBy: z.string().min(1), // who/what opened it (agent name) — never a claim of full audit
  componentsSeen: z.array(z.string()).default([]),
  licence: z.string().min(1),
  licenceUrl: z.string().url().optional(),
  accessStatus: AccessStatus,
  importAllowed: z.boolean().default(false), // may the worker fetch and ingest this material?
  importHosts: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  locators: z.array(VerifiedLocator).default([]),
});
export type SourceVersion = z.infer<typeof SourceVersion>;

export const SourceRecord = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  authors: z.array(z.string()).default([]),
  institution: z.string().optional(),
  kind: SourceKind,
  canonicalUrl: z.string().url(),
  description: z.string().optional(),
  isbn: z.string().optional(),
  versions: z.array(SourceVersion).min(1),
  currentVersionId: z.string().min(1),
  codeLicence: z.string().optional(), // for repositories: separate from content permissions
  rightsNotes: z.array(z.string()).default([]),
});
export type SourceRecord = z.infer<typeof SourceRecord>;
