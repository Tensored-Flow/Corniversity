import { z } from "zod";

/**
 * Structured outputs the application accepts from models. Every schema is also what the
 * fixture provider must satisfy, so tests exercise the same contracts as live runs.
 */

export const FeedbackCheckSchema = z.object({
  criterionId: z.string(),
  status: z.enum(["met", "partially_met", "not_met", "not_applicable"]),
  comment: z.string(),
});

export const AssessorFeedbackSchema = z.object({
  verdict: z.enum(["accepted", "revision_requested", "needs_review"]),
  /** 0–1 self-assessed confidence; low confidence routes to needs_review regardless of verdict. */
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  firstGap: z
    .object({
      line: z.number().int().min(1),
      excerpt: z.string(),
      issue: z.string(),
    })
    .nullable(),
  checks: z.array(FeedbackCheckSchema),
  strengths: z.array(z.string()),
  nextStep: z.string(),
  alternateApproachRecognised: z.boolean(),
  hypothesesChecked: z.array(z.string()),
  /** Evidence tags (E1…) the feedback relies on; validated server-side. */
  citationTags: z.array(z.string()),
});
export type AssessorFeedback = z.infer<typeof AssessorFeedbackSchema>;

export const ProgrammeDraftSchema = z.object({
  title: z.string(),
  rationale: z.string(),
  courses: z.array(
    z.object({
      courseId: z.string(),
      role: z.enum(["core", "seminar", "bridge", "elective"]),
      mode: z.enum(["enrolled", "audit", "reading_seminar"]),
      why: z.string(),
      prerequisiteNote: z.string(),
    }),
  ),
  estimatedWeeklyHours: z.object({ minimum: z.number(), typical: z.number(), maximum: z.number() }),
  tradeOffs: z.array(z.string()),
  unresolvedAccessNeeds: z.array(z.string()),
});
export type ProgrammeDraft = z.infer<typeof ProgrammeDraftSchema>;

export const SourceMetadataGuessSchema = z.object({
  title: z.string().nullable(),
  authors: z.array(z.string()),
  edition: z.string().nullable(),
  year: z.number().int().nullable(),
  isbn: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  notes: z.string(),
});
export type SourceMetadataGuess = z.infer<typeof SourceMetadataGuessSchema>;

export const SessionSummarySchema = z.object({
  learned: z.array(z.string()),
  unresolved: z.array(z.string()),
  nextStep: z.string(),
  misconceptionsObserved: z.array(z.object({ claim: z.string(), evidence: z.string() })),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const TranscriptionSchema = z.object({
  text: z.string(),
  uncertainRegions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type Transcription = z.infer<typeof TranscriptionSchema>;
