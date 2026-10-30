import { z } from "zod";

export const CourseReadiness = z.enum([
  "proposed",
  "source_verified",
  "syllabus_ready",
  "teaching_ready",
  "resource_blocked",
]);
export type CourseReadiness = z.infer<typeof CourseReadiness>;

export const UnitStatus = z.enum(["draft", "checking", "ready", "blocked"]);
export type UnitStatus = z.infer<typeof UnitStatus>;

export const LearningMode = z.enum(["enrolled", "audit", "reading_seminar"]);
export type LearningMode = z.infer<typeof LearningMode>;

export const EvidenceState = z.enum(["unassessed", "introduced", "practised", "demonstrated", "revisit"]);
export type EvidenceState = z.infer<typeof EvidenceState>;

export const ProcessingAction = z.enum([
  "local_read",
  "local_extract",
  "private_cloud_store",
  "external_ai",
  "external_embedding",
  "share",
]);
export type ProcessingAction = z.infer<typeof ProcessingAction>;

export const PermissionStatus = z.enum(["unknown", "allowed", "denied"]);
export type PermissionStatus = z.infer<typeof PermissionStatus>;

export const Immersion = z.enum(["quiet", "collegiate", "full"]);
export type Immersion = z.infer<typeof Immersion>;

export const SubmissionState = z.enum([
  "draft",
  "submitted",
  "reviewing",
  "feedback_ready",
  "revision_requested",
  "needs_review",
  "revised",
  "accepted",
]);
export type SubmissionState = z.infer<typeof SubmissionState>;
