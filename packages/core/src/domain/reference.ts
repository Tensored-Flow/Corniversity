/**
 * Instructor files hold the reference reasoning together with grading notes, acceptance ranges
 * and common gaps for the assessor. A practice-mode reveal shows the learner the reasoning only:
 * the "instructor only" heading becomes "practice mode", every other instructor-only section is
 * dropped, and the grader's paragraphs inside the reasoning are cut.
 */
const GRADER_PARAGRAPH = /^\*\*(alternative valid approaches|common gaps|grading notes|grading|acceptance|accept|marking)\b/i;

export function learnerVisibleReference(markdown: string): string {
  const out: string[] = [];
  let skippingSection = false;
  let skippingParagraph = false;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const text = heading[2]!;
      skippingParagraph = false;
      if (/instructor only/i.test(text) && !/reference reasoning/i.test(text)) {
        skippingSection = true;
        continue;
      }
      skippingSection = false;
      out.push(`${heading[1]} ${text.replace(/\s*\(instructor only\)/i, " (practice mode)")}`);
      continue;
    }
    if (skippingSection) continue;
    if (line.trim() === "") {
      skippingParagraph = false;
      out.push(line);
      continue;
    }
    if (GRADER_PARAGRAPH.test(line.trim())) skippingParagraph = true;
    if (!skippingParagraph) out.push(line);
  }
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
