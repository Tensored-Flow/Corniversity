import { type IdentifierRef, type IdentifierScheme, identifierKey } from "./identifiers";
import { providerText } from "./text";

/**
 * Deduplication of scholarly works. A shared identifier is authoritative (the same work); similar
 * normalised titles are only ever a suggestion the owner may act on, never an automatic merge.
 */

/** Strength of an identifier for choosing between works that hold incoming identifiers: arXiv > DOI > W. */
export const IDENTIFIER_STRENGTH: Record<IdentifierScheme, number> = { arxiv: 5, doi: 4, openalex: 3, pmid: 2, pmcid: 1 };

/** Sorted lock keys (`scheme:value`) for taking advisory locks in a stable order. */
export function identifierLockKeys(refs: readonly IdentifierRef[]): string[] {
  return [...new Set(refs.map(identifierKey))].sort();
}

/** The strongest identifier two sets share, or null when they share none. */
export function sharedIdentifier(a: readonly IdentifierRef[], b: readonly IdentifierRef[]): IdentifierRef | null {
  const keys = new Set(b.map(identifierKey));
  let best: IdentifierRef | null = null;
  for (const ref of a) {
    if (!keys.has(identifierKey(ref))) continue;
    if (!best || IDENTIFIER_STRENGTH[ref.scheme] > IDENTIFIER_STRENGTH[best.scheme]) best = ref;
  }
  return best;
}

export interface IdentifierHolder extends IdentifierRef {
  workId: string;
}

export type IdentifierResolution =
  | { action: "create"; insert: IdentifierRef[] }
  | {
      action: "attach";
      workId: string;
      /** Incoming identifiers this work does not hold yet (insert ON CONFLICT DO NOTHING). */
      insert: IdentifierRef[];
      /** Incoming identifiers held by another work; left there. */
      skipped: IdentifierRef[];
      /** Other works holding incoming identifiers: possible duplicates for the owner to review. */
      possibleDuplicates: string[];
    };

/**
 * The import rule: no work holds any incoming identifier → create one; one work → attach to it; two
 * or more → attach to the work holding the strongest incoming identifier (arXiv > DOI > W; ties go to
 * the identifier listed first), skip identifiers the others hold, and report them as possible
 * duplicates. Never fails and never merges.
 */
export function resolveIdentifiers(incoming: readonly IdentifierRef[], holders: readonly IdentifierHolder[]): IdentifierResolution {
  const unique = [...new Map(incoming.map((r) => [identifierKey(r), r])).values()];
  const heldBy = new Map(holders.map((h) => [identifierKey(h), h.workId]));
  let chosen: { workId: string; strength: number } | null = null;
  for (const ref of unique) {
    const workId = heldBy.get(identifierKey(ref));
    if (!workId) continue;
    const strength = IDENTIFIER_STRENGTH[ref.scheme];
    if (!chosen || strength > chosen.strength) chosen = { workId, strength };
  }
  if (!chosen) return { action: "create", insert: unique };
  const target = chosen.workId;
  const insert: IdentifierRef[] = [];
  const skipped: IdentifierRef[] = [];
  const others = new Set<string>();
  for (const ref of unique) {
    const workId = heldBy.get(identifierKey(ref));
    if (!workId) insert.push(ref);
    else if (workId !== target) {
      skipped.push(ref);
      others.add(workId);
    }
  }
  return { action: "attach", workId: target, insert, skipped, possibleDuplicates: [...others].sort() };
}

/** Title normal form for comparison: plain text, NFKC, no diacritics, lower case, words only. */
export function normaliseTitle(title: string): string {
  return providerText(title)
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Jaccard similarity of the two titles' word sets (0 to 1). */
export function titleSimilarity(a: string, b: string): number {
  const left = new Set(normaliseTitle(a).split(" ").filter(Boolean));
  const right = new Set(normaliseTitle(b).split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / (left.size + right.size - shared);
}

export const TITLE_SUGGESTION_THRESHOLD = 0.9;
const MIN_TITLE_WORDS = 3;

/**
 * Whether two works look like the same paper by title (a suggestion only): titles of at least three
 * words with similarity ≥ 0.9, and publication years no more than one apart when both are known.
 */
export function titlesSuggestDuplicate(
  a: { title: string | null; year?: number | null },
  b: { title: string | null; year?: number | null },
): boolean {
  if (!a.title || !b.title) return false;
  if (normaliseTitle(a.title).split(" ").length < MIN_TITLE_WORDS || normaliseTitle(b.title).split(" ").length < MIN_TITLE_WORDS)
    return false;
  if (a.year && b.year && Math.abs(a.year - b.year) > 1) return false;
  return titleSimilarity(a.title, b.title) >= TITLE_SUGGESTION_THRESHOLD;
}
