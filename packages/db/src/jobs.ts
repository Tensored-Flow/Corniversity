import { isSubjectSlug, parseArxivId } from "@corniversity/core/scholarly/index";
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
  transcribePages: "transcribe-pages",
  scholarlyArxiv: "scholarly-arxiv",
  scholarlyRefresh: "scholarly-refresh",
  scholarlyLists: "scholarly-lists",
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

/** One run of a course-preparation request; the request's stages are its checkpoints. */
export const PrepareCoursePayload = z.object({
  idempotencyKey: z.string().min(1),
  ownerId: z.string().min(1),
  requestId: z.string().uuid(),
});
export type PrepareCoursePayload = z.infer<typeof PrepareCoursePayload>;

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

/**
 * A model transcription of paper pages, sent only under the learner's consent for these pages;
 * the worker re-checks the consent and the pages when it runs.
 */
export const TranscribePagesPayload = z.object({
  idempotencyKey: z.string().min(1),
  ownerId: z.string().min(1),
  attemptId: z.string().uuid(),
  consentId: z.string().uuid(),
  pageIds: z.array(z.string().uuid()).min(1).max(12),
});
export type TranscribePagesPayload = z.infer<typeof TranscribePagesPayload>;

export const MaintenancePayload = z.object({
  idempotencyKey: z.string().min(1),
  task: z.enum(["revision-due", "revoke-stale-pairing-codes", "expire-old-exports", "unsettle-stale-runs", "purge-provider-cache"]),
});
export type MaintenancePayload = z.infer<typeof MaintenancePayload>;

const ArxivIdField = z.string().refine((value) => {
  const parsed = parseArxivId(value);
  return parsed !== null && parsed.version === null && parsed.id === value;
}, "an arXiv id without version");
/** An arXiv category (`hep-th`, `cs.AI`) or archive wildcard (`math.*`). */
const ArxivCategory = z.string().regex(/^[a-z-]+(\.[A-Za-z-]+|\.\*)?$/);

/**
 * Every arXiv request goes through this queue (concurrency 1 across processes, at least 3.1 s
 * between requests, Retry-After honoured): the arXiv record of a work (versions, licences,
 * withdrawals), a private copy of an openly licensed version, and newest-submission listings
 * (fetched into the provider cache, which pages read).
 */
export const ScholarlyArxivPayload = z.discriminatedUnion("task", [
  z.object({
    idempotencyKey: z.string().min(1),
    ownerId: z.string().min(1),
    task: z.literal("record"),
    workId: z.string().uuid(),
    arxivId: ArxivIdField,
  }),
  z.object({
    idempotencyKey: z.string().min(1),
    ownerId: z.string().min(1),
    task: z.literal("private-copy"),
    assetId: z.string().uuid(),
  }),
  z.object({
    idempotencyKey: z.string().min(1),
    ownerId: z.string().min(1).optional(),
    task: z.literal("listing"),
    categories: z.array(ArxivCategory).min(1).max(20),
    maxResults: z.number().int().min(1).max(50),
  }),
]);
export type ScholarlyArxivPayload = z.infer<typeof ScholarlyArxivPayload>;

/** All arXiv jobs share one singleton key, so at most one is active at a time in any process. */
export const ARXIV_SINGLETON_KEY = "arxiv";

/** A work's metadata refreshed from OpenAlex (and its integrity notices), or its integrity notices alone. */
export const ScholarlyRefreshPayload = z.object({
  idempotencyKey: z.string().min(1),
  ownerId: z.string().min(1),
  task: z.enum(["work", "integrity"]),
  workId: z.string().uuid(),
});
export type ScholarlyRefreshPayload = z.infer<typeof ScholarlyRefreshPayload>;

const SubjectSlug = z.string().refine((slug) => isSubjectSlug(slug), "a known subject");

/**
 * Subject lists (Discover, subject rooms) refreshed into the provider cache from OpenAlex. Without
 * `subjects` (the daily schedule): every subject an owner has chosen, plus the defaults while some
 * owner has not chosen. `arxivListings` also queues those subjects' arXiv listings on the
 * scholarly-arxiv queue, the only queue that calls arXiv.
 */
export const ScholarlyListsPayload = z.object({
  idempotencyKey: z.string().min(1),
  ownerId: z.string().min(1).optional(),
  task: z.literal("subject-lists"),
  subjects: z.array(SubjectSlug).min(1).max(30).optional(),
  arxivListings: z.boolean().optional(),
});
export type ScholarlyListsPayload = z.infer<typeof ScholarlyListsPayload>;

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
  "transcribe-pages": {
    policy: "stately",
    retryLimit: 0,
    retryDelay: 0,
    retryBackoff: false,
    expireInSeconds: 10 * 60,
  },
  "scholarly-arxiv": {
    // With every job carrying ARXIV_SINGLETON_KEY, "singleton" allows one active job across all
    // processes; the handler spaces its requests and holds the slot for the spacing afterwards.
    policy: "singleton",
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 30 * 60,
  },
  "scholarly-refresh": {
    policy: "stately",
    retryLimit: 2,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 10 * 60,
  },
  "scholarly-lists": {
    policy: "stately",
    retryLimit: 1,
    retryDelay: 300,
    retryBackoff: false,
    expireInSeconds: 10 * 60,
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
