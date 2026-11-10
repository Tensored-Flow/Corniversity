/**
 * Transcriptions of paper work. The learner (or a model, with permission) writes what the pages
 * say; anything uncertain is marked `[[?…]]`, for example `[[?ε or e]]` or `[[?sign]]`, and must be
 * confirmed before the work can be reviewed. A failed or uncertain reading is never treated as a
 * judgement of the mathematics. Pages are separated by lines of the form `[page 2]`.
 */

export interface UncertainMark {
  line: number;
  text: string;
}

const MARK = /\[\[\?([^\]]*)\]\]/g;

/** Every uncertain mark, with its 1-based line. */
export function uncertainMarks(text: string): UncertainMark[] {
  const marks: UncertainMark[] = [];
  text.split("\n").forEach((line, index) => {
    for (const m of line.matchAll(MARK)) marks.push({ line: index + 1, text: (m[1] ?? "").trim() || "?" });
  });
  return marks;
}

export type ConfirmDecision = { ok: true } | { ok: false; reason: string; marks: UncertainMark[] };

/** A transcription can be confirmed only when it says something and no uncertain mark remains. */
export function canConfirm(text: string): ConfirmDecision {
  if (text.trim().length < 20) return { ok: false, reason: "Write the transcription before confirming it.", marks: [] };
  const marks = uncertainMarks(text);
  if (marks.length > 0) {
    return {
      ok: false,
      reason: `Please confirm ${marks.length === 1 ? "this symbol" : `these ${marks.length} symbols`} first: replace each [[?…]] with what you wrote.`,
      marks,
    };
  }
  return { ok: true };
}

const PAGE = /^\s*\[page\s+(\d+)\]\s*$/i;

/** The page a 1-based line of the transcription belongs to (pages start at 1 before any marker). */
export function pageOfLine(text: string, line: number): number {
  let page = 1;
  const lines = text.split("\n");
  for (let i = 0; i < Math.min(line, lines.length); i++) {
    const m = PAGE.exec(lines[i]!);
    if (m) page = Number(m[1]);
  }
  return page;
}

/** The text of lines `from`..`to` (1-based, inclusive), for a check of a selected step. */
export function linesOf(text: string, from: number, to: number): string {
  const lines = text.split("\n");
  const a = Math.max(1, Math.min(from, to));
  const b = Math.min(lines.length, Math.max(from, to));
  return lines.slice(a - 1, b).join("\n");
}

/** The 1-based line range covered by a character selection in a text area. */
export function lineRangeOfSelection(text: string, start: number, end: number): [number, number] {
  const before = (n: number) => text.slice(0, Math.max(0, n)).split("\n").length;
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  // A selection ending just after a newline does not include the next line.
  const last = e > s && text[e - 1] === "\n" ? before(e - 1) : before(e);
  return [before(s), Math.max(before(s), last)];
}
