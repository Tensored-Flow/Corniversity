/**
 * Citation grounding. Models never see URLs or page numbers to copy; they see evidence blocks
 * tagged E1…En and cite the tags. The server maps tags back to locator/passage ids. Any tag
 * that was not in the run's allowed evidence is removed and the sentence is recorded as an
 * uncited claim, so a fabricated citation cannot reach the learner as if it were real.
 */

export interface EvidenceRef {
  tag: string; // "E1"
  label: string; // human-readable locator description
  locatorId?: string;
  assetId?: string;
  passageId?: string;
}

export type StatementLabel = "source_backed" | "derived" | "conjecture" | "needs_checking";

export interface AnnotatedParagraph {
  markdown: string;
  labels: StatementLabel[];
  citationTags: string[];
}

export interface AnnotatedTurn {
  /** Cleaned Markdown: unknown tags removed, label markers removed, known tags kept inline. */
  markdown: string;
  paragraphs: AnnotatedParagraph[];
  citations: EvidenceRef[];
  unknownTags: string[];
  uncitedClaims: string[];
  labels: StatementLabel[];
}

const TAG_GROUP = /\[(E\d+(?:\s*,\s*E\d+)*)\]/g;
const LABEL_MARKER = /\{(source-backed|derived|conjecture|needs-checking)\}/g;

const LABEL_MAP: Record<string, StatementLabel> = {
  "source-backed": "source_backed",
  derived: "derived",
  conjecture: "conjecture",
  "needs-checking": "needs_checking",
};

export function annotateTurn(text: string, allowed: EvidenceRef[]): AnnotatedTurn {
  const allowedByTag = new Map(allowed.map((e) => [e.tag.toUpperCase(), e]));
  const unknownTags = new Set<string>();
  const usedTags = new Set<string>();
  const uncitedClaims: string[] = [];
  const allLabels = new Set<StatementLabel>();

  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((raw) => raw.trim())
    .filter((p) => p.length > 0)
    .map((raw) => {
      const labels = new Set<StatementLabel>();
      let cleaned = raw.replace(LABEL_MARKER, (_m, key: string) => {
        const label = LABEL_MAP[key];
        if (label) {
          labels.add(label);
          allLabels.add(label);
        }
        return "";
      });
      const citationTags: string[] = [];
      let hadUnknown = false;
      cleaned = cleaned.replace(TAG_GROUP, (_m, group: string) => {
        const tags = group.split(/\s*,\s*/).map((t) => t.trim().toUpperCase());
        const known = tags.filter((t) => allowedByTag.has(t));
        for (const t of tags) {
          if (allowedByTag.has(t)) {
            usedTags.add(t);
            if (!citationTags.includes(t)) citationTags.push(t);
          } else {
            unknownTags.add(t);
            hadUnknown = true;
          }
        }
        return known.length > 0 ? `[${known.join(", ")}]` : "";
      });
      cleaned = cleaned
        .replace(/[ \t]{2,}/g, " ")
        .replace(/ +([.,;:])/g, "$1")
        .trim();
      if (hadUnknown && citationTags.length === 0) {
        uncitedClaims.push(cleaned);
        labels.add("needs_checking");
        allLabels.add("needs_checking");
      }
      return { markdown: cleaned, labels: [...labels], citationTags };
    });

  const citations = [...usedTags].map((tag) => allowedByTag.get(tag)!).sort((a, b) => tagNumber(a.tag) - tagNumber(b.tag));

  return {
    markdown: paragraphs.map((p) => p.markdown).join("\n\n"),
    paragraphs,
    citations,
    unknownTags: [...unknownTags],
    uncitedClaims,
    labels: [...allLabels],
  };
}

function tagNumber(tag: string): number {
  return Number(tag.replace(/^E/i, "")) || 0;
}

/** Builds the evidence section shown to a model, numbering blocks deterministically. */
export function formatEvidenceBlocks(blocks: { label: string; text: string; locatorId?: string; assetId?: string; passageId?: string }[]): {
  prompt: string;
  refs: EvidenceRef[];
} {
  const refs: EvidenceRef[] = [];
  const parts: string[] = [];
  blocks.forEach((block, index) => {
    const tag = `E${index + 1}`;
    refs.push({ tag, label: block.label, locatorId: block.locatorId, assetId: block.assetId, passageId: block.passageId });
    parts.push(`[${tag}] ${block.label}\n${block.text.trim()}`);
  });
  return { prompt: parts.join("\n\n"), refs };
}
