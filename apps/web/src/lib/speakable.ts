/**
 * Plain text for reading aloud from Markdown with LaTeX. A speech voice would read LaTeX source
 * symbol by symbol, so each formula is replaced by a short spoken marker and the reader looks at
 * the screen for it; Markdown syntax and link targets are dropped.
 */
export function speakableText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " (code shown on screen) ")
    .replace(/\$\$[\s\S]+?\$\$/g, " (formula shown on screen) ")
    .replace(/\\\[[\s\S]+?\\\]/g, " (formula shown on screen) ")
    .replace(/\$[^$\n]+?\$/g, " (formula) ")
    .replace(/\\\([\s\S]+?\\\)/g, " (formula) ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[E\d+\]/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/(\*\*|__|\*|_)(\S[^*_]*?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
}
