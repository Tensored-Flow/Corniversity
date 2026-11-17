/** Bounded teaching context. Omission is explicit and never described as having read the full work. */
export const TUTOR_ATTEMPT_CHARACTERS = 20_000;
export const TUTOR_LESSON_CHARACTERS = 12_000;

export function boundedTeachingText(text: string, limit: number, selection?: string): { text: string; note: string; truncated: boolean } {
  if (limit < 400) throw new Error("Teaching context allowance must be at least 400 characters.");
  if (text.length <= limit) return { text, note: `Complete text (${text.length.toLocaleString("en-GB")} characters).`, truncated: false };
  // Keep opening definitions/assumptions as well as the selected step, or the conclusion when
  // nothing is selected. The omitted interval is visible to the model and in the attachment preview.
  const beginning = Math.floor(limit / 3);
  const remainder = limit - beginning;
  const selectedAt = selection ? text.indexOf(selection) : -1;
  const start =
    selectedAt >= 0
      ? Math.max(beginning, Math.min(text.length - remainder, selectedAt - Math.floor((remainder - selection!.length) / 2)))
      : text.length - remainder;
  const end = Math.min(text.length, start + remainder);
  const note = `Excerpt only: characters 1–${beginning} and ${start + 1}–${end} of ${text.length}. Other text was omitted; do not assess or claim to have read missing steps.`;
  return {
    text: `${text.slice(0, beginning)}\n\n[CONTEXT OMITTED: characters ${beginning + 1}–${start}]\n\n${text.slice(start, end)}${end < text.length ? `\n\n[CONTEXT OMITTED: characters ${end + 1}–${text.length}]` : ""}`,
    note,
    truncated: true,
  };
}
