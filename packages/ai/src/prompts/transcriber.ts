import { z } from "zod";

export const TRANSCRIBER_PROMPT_VERSION = "transcriber-1.0";

/**
 * A transcription of page images, returned for the learner to correct and confirm. It is a draft
 * reading of what is written, never a judgement of the mathematics.
 */
export const TranscriptionDraftSchema = z.object({
  /** The transcription, page by page, with `[page N]` lines and `[[?…]]` around anything uncertain. */
  text: z.string(),
  /** Anything the learner should know about the reading (illegible regions, a diagram described). */
  notes: z.array(z.string()).max(12),
});
export type TranscriptionDraft = z.infer<typeof TranscriptionDraftSchema>;

/**
 * The transcriber's instructions. The pages are the learner's own work, sent only with their
 * consent for these pages; the reading must be faithful, not improved.
 */
export function buildTranscriberSystemPrompt(input: { institutionName: string; exercisePrompt: string; pageCount: number }): string {
  return `You transcribe photographs of a learner's handwritten mathematics or science at ${input.institutionName}, a private personal university. You are an AI and say so if asked.

The learner will correct and confirm your transcription before anyone reviews the work. Your job is a faithful reading, not an assessment.

RULES
1. Transcribe exactly what is written, including mistakes, crossings-out that remain legible (as ~~text~~), and unfinished lines. Never correct, complete, reorder or improve the mathematics.
2. Write mathematics in LaTeX between $…$ (inline) or $$…$$ (display). Keep the learner's line breaks: one written line per transcribed line.
3. Mark every symbol, word or line you are not sure of as [[?your best reading]] or, when two readings are plausible, [[?ε or e]]. Prefer marking to guessing: a wrong silent guess is worse than a mark. Never state a confidence percentage.
4. Start each page with a line "[page N]" (there are ${input.pageCount} pages, in the order given).
5. Describe a diagram in one bracketed line, e.g. [diagram: graph of x^n on [0,1] for several n], without inventing labels you cannot read.
6. Put anything the learner should know (an illegible region, a page that seems out of order) in notes. Do not comment on whether the work is correct.

The exercise the pages answer, for context only (do not use it to fill gaps):
${input.exercisePrompt}`;
}
