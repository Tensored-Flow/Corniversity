/**
 * Discover's wording, seeds and ordering. Every explanation states a fact and where it came from:
 * citations are counted from reference lists, OpenAlex similarity is never called a citation, and a
 * citation count is never presented as a judgement of importance. No scores, streaks or feeds.
 */

export type DiscoverReasonKind =
  | "cited_by_library"
  | "similar"
  | "most_cited"
  | "new_on_arxiv"
  | "reviews"
  | "earlier_work"
  | "from_courses"
  | "surprise";

export interface DiscoverReason {
  kind: DiscoverReasonKind;
  /** The full sentence as plain text. */
  text: string;
  /** For `similar`: the saved paper's title, which the page may emphasise inside `text`. */
  emphasis?: string;
}

export const DISCOVER_LIST_LIMIT = 10;

export function citedByLibraryReason(count: number): DiscoverReason {
  const n = Math.max(0, Math.trunc(count));
  return { kind: "cited_by_library", text: `Cited by ${n} ${n === 1 ? "paper" : "papers"} in your library` };
}

export function similarReason(title: string): DiscoverReason {
  return { kind: "similar", text: `Similar to ${title} in OpenAlex (similarity, not a citation)`, emphasis: title };
}

export function mostCitedReason(): DiscoverReason {
  return { kind: "most_cited", text: "Most cited in OpenAlex (a count, not a judgement of importance)" };
}

export function newOnArxivReason(categories: readonly string[]): DiscoverReason {
  return { kind: "new_on_arxiv", text: `Newest submissions to arXiv in ${categories.join(", ")}` };
}

export function reviewsReason(): DiscoverReason {
  return { kind: "reviews", text: "Classified by OpenAlex as a review" };
}

export const EARLIER_WORK_BEFORE_YEAR = 1990;

export function earlierWorkReason(): DiscoverReason {
  return {
    kind: "earlier_work",
    text: `Most cited in OpenAlex among works published before ${EARLIER_WORK_BEFORE_YEAR} (a count, not a judgement of importance)`,
  };
}

export function fromCoursesReason(courseTitles: readonly string[]): DiscoverReason {
  const list = courseTitles.length > 0 ? `: ${courseTitles.join(", ")}` : "";
  return { kind: "from_courses", text: `A source in your courses${list}` };
}

export function surpriseReason(fieldName: string): DiscoverReason {
  return {
    kind: "surprise",
    text: `A review in ${fieldName}, outside your subjects, with an abstract and free to read according to OpenAlex; chosen by OpenAlex sampling`,
  };
}

/**
 * A deterministic 31-bit seed (FNV-1a) from parts such as the owner id and the day, for OpenAlex
 * `sample`/`seed`, so a list is stable within a day and changes the next.
 */
export function discoverSeed(...parts: readonly (string | number)[]): number {
  let hash = 0x811c9dc5;
  for (const char of parts.join("\u001f")) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash & 0x7fffffff;
}

export interface LibraryReferences {
  workId: string;
  /** The OpenAlex ids (W…) the work's reference list contains, as OpenAlex matched them. */
  referencedOpenAlexIds: readonly string[];
}

export interface CitedByLibraryEntry {
  openalexId: string;
  count: number;
  citingWorkIds: string[];
}

/**
 * Works cited by at least `minimum` of the owner's papers and not already in the library, most
 * citing papers first, then by id for a stable order; bounded to `limit`.
 */
export function citedByLibrary(
  works: readonly LibraryReferences[],
  inLibrary: ReadonlySet<string>,
  minimum = 2,
  limit = DISCOVER_LIST_LIMIT,
): CitedByLibraryEntry[] {
  const citing = new Map<string, Set<string>>();
  for (const work of works) {
    for (const id of new Set(work.referencedOpenAlexIds)) {
      if (inLibrary.has(id)) continue;
      const set = citing.get(id) ?? new Set<string>();
      set.add(work.workId);
      citing.set(id, set);
    }
  }
  return [...citing.entries()]
    .filter(([, set]) => set.size >= minimum)
    .map(([openalexId, set]) => ({ openalexId, count: set.size, citingWorkIds: [...set].sort() }))
    .sort((a, b) => b.count - a.count || (a.openalexId < b.openalexId ? -1 : a.openalexId > b.openalexId ? 1 : 0))
    .slice(0, limit);
}

/** Removes entries already in the library and repeated ids, keeping order, bounded to `limit`. */
export function boundedList<T>(
  items: readonly T[],
  key: (item: T) => string,
  exclude: ReadonlySet<string>,
  limit = DISCOVER_LIST_LIMIT,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (exclude.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
    if (out.length === limit) break;
  }
  return out;
}
