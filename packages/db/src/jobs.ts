import { z } from "zod";

/**
 * Queue names and payload schemas shared by the web app (which enqueues) and the worker
 * (which executes). Every payload carries an idempotency key so that a retried or duplicated
 * delivery cannot create a second grade, a second ingestion or a second course version.
 */
export const QUEUES = {
  ingestAsset: "ingest-asset",
  prepareUnit: "prepare-unit",
  assessSubmission: "assess-submission",
  embedPassages: "embed-passages",
  exportRecords: "export-records",
  maintenance: "maintenance",
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const IngestAssetPayload = z.object({
  idempotencyKey: z.string().min(1),
  ownerId: z.string().min(1),
  assetId: z.string().uuid(),
});
export type IngestAssetPayload = z.infer<typeof IngestAssetPayload>;

export const PrepareUnitPayload = z.object({
  idempotencyKey: z.string().min(1),
  ownerId: z.string().min(1),
  unitId: z.string().min(1),
});
export type PrepareUnitPayload = z.infer<typeof PrepareUnitPayload>;

export const AssessSubmissionPayload = z.object({
  idempotencyKey: z.string().min(1),
  ownerId: z.string().min(1),
  submissionVersionId: z.string().uuid(),
  assessmentRunId: z.string().uuid(),
});
export type AssessSubmissionPayload = z.infer<typeof AssessSubmissionPayload>;

export const EmbedPassagesPayload = z.object({
  idempotencyKey: z.string().min(1),
  ownerId: z.string().min(1),
  assetId: z.string().uuid(),
});
export type EmbedPassagesPayload = z.infer<typeof EmbedPassagesPayload>;

export const ExportRecordsPayload = z.object({
  idempotencyKey: z.string().min(1),
  ownerId: z.string().min(1),
  exportId: z.string().uuid(),
  kind: z.enum(["full", "notebook", "records", "alter_markdown"]),
});
export type ExportRecordsPayload = z.infer<typeof ExportRecordsPayload>;

export const MaintenancePayload = z.object({
  idempotencyKey: z.string().min(1),
  task: z.enum(["revision-due", "revoke-stale-pairing-codes", "expire-old-exports"]),
});
export type MaintenancePayload = z.infer<typeof MaintenancePayload>;

/** Queue configuration applied by whichever process starts pg-boss first. */
export const QUEUE_CONFIG: Record<
  QueueName,
  {
    policy: "standard" | "singleton" | "stately";
    retryLimit: number;
    retryDelay: number;
    retryBackoff: boolean;
    expireInSeconds: number;
    heartbeatSeconds?: number;
    deadLetter?: string;
  }
> = {
  "ingest-asset": {
    policy: "stately",
    retryLimit: 2,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 60 * 60,
    heartbeatSeconds: 60,
    deadLetter: "ingest-asset-dlq",
  },
  "prepare-unit": {
    policy: "stately",
    retryLimit: 1,
    retryDelay: 60,
    retryBackoff: false,
    expireInSeconds: 30 * 60,
    deadLetter: "prepare-unit-dlq",
  },
  "assess-submission": {
    policy: "stately",
    retryLimit: 2,
    retryDelay: 20,
    retryBackoff: true,
    expireInSeconds: 10 * 60,
    deadLetter: "assess-submission-dlq",
  },
  "embed-passages": {
    policy: "stately",
    retryLimit: 2,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 30 * 60,
    heartbeatSeconds: 60,
  },
  "export-records": {
    policy: "stately",
    retryLimit: 1,
    retryDelay: 30,
    retryBackoff: false,
    expireInSeconds: 15 * 60,
  },
  maintenance: {
    policy: "singleton",
    retryLimit: 0,
    retryDelay: 0,
    retryBackoff: false,
    expireInSeconds: 10 * 60,
  },
};

export const DEAD_LETTER_QUEUES = ["ingest-asset-dlq", "prepare-unit-dlq", "assess-submission-dlq"] as const;
