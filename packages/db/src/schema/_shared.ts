import { customType, pgEnum, timestamp } from "drizzle-orm/pg-core";

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
export const tz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const courseReadinessEnum = pgEnum("course_readiness", [
  "proposed",
  "source_verified",
  "syllabus_ready",
  "teaching_ready",
  "resource_blocked",
]);
export const unitStatusEnum = pgEnum("unit_status", ["draft", "checking", "ready", "blocked"]);
export const learningModeEnum = pgEnum("learning_mode", ["enrolled", "audit", "reading_seminar"]);
export const evidenceStateEnum = pgEnum("evidence_state", [
  "unassessed",
  "introduced",
  "practised",
  "demonstrated",
  "revisit",
]);
export const processingActionEnum = pgEnum("processing_action", [
  "local_read",
  "local_extract",
  "private_cloud_store",
  "external_ai",
  "external_embedding",
  "share",
]);
export const permissionStatusEnum = pgEnum("permission_status", ["unknown", "allowed", "denied"]);
export const immersionEnum = pgEnum("immersion", ["quiet", "collegiate", "full"]);
export const submissionStateEnum = pgEnum("submission_state", [
  "draft",
  "submitted",
  "reviewing",
  "feedback_ready",
  "revision_requested",
  "needs_review",
  "revised",
  "accepted",
]);
