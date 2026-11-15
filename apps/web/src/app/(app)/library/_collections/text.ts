import type { CollectionKind } from "@corniversity/db/schema/scholarly";

/** The wording of shelves and trails, which share one table and one set of pages. */
export const KIND_TEXT: Record<
  CollectionKind,
  {
    path: string;
    singular: string;
    plural: string;
    lede: string;
    emptyTitle: string;
    emptyBody: string;
    newHeading: string;
    create: string;
    descriptionHint: string;
    deleted: string;
    itemsHeading: string;
    reasonLabel: string;
    reasonEdit: string;
    reasonSaved: string;
    removeAsk: string;
    removeConfirm: string;
    removedWithReason: string;
    allHeld: string;
    deleteLabel: string;
    deleteBody: string;
    noItems: string;
  }
> = {
  shelf: {
    path: "/library/shelves",
    singular: "Shelf",
    plural: "Shelves",
    lede: "Named collections of your papers. A paper can be on many shelves; taking it off one never deletes it.",
    emptyTitle: "No shelves yet",
    emptyBody: "A shelf gathers papers under a name you choose. Create one here, or from a paper's page under Shelves and trails.",
    newHeading: "New shelf",
    create: "Create shelf",
    descriptionHint: "Markdown and LaTeX.",
    deleted: "Shelf deleted. Its papers, their notes and files are still in your library.",
    itemsHeading: "Papers",
    reasonLabel: "Note",
    reasonEdit: "Edit note",
    reasonSaved: "Note saved.",
    removeAsk:
      "Removing this paper also deletes the note you wrote for it on this shelf. The paper, its reading notes, notebook entries and files stay in your library.",
    removeConfirm: "Remove and delete the note",
    removedWithReason:
      "Removed, with your note on it here. The paper, its reading notes, notebook entries and files are still in your library.",
    allHeld: "Every paper in your library that matches these words is already on this shelf.",
    deleteLabel: "Delete this shelf",
    deleteBody:
      "Deleting the shelf removes it, its description and the notes written on its papers here. The papers, their reading notes, notebook entries and files stay in your library.",
    noItems: "No papers on this shelf yet. Add one from your library below.",
  },
  trail: {
    path: "/library/trails",
    singular: "Trail",
    plural: "Trails",
    lede: "Papers in an order you choose, around a question or theme, each step with the reason it is there.",
    emptyTitle: "No trails yet",
    emptyBody:
      "A trail is an ordered list of papers with a reason for each step. Create one here, or from a paper's page under Shelves and trails.",
    newHeading: "New trail",
    create: "Create trail",
    descriptionHint: "Markdown and LaTeX: the question, prerequisites, links to other trails or papers.",
    deleted: "Trail deleted. Its papers, their notes and files are still in your library.",
    itemsHeading: "Steps",
    reasonLabel: "Why",
    reasonEdit: "Edit why",
    reasonSaved: "Reason saved.",
    removeAsk:
      "Removing this step also deletes the reason you wrote for it. The paper, its reading notes, notebook entries and files stay in your library.",
    removeConfirm: "Remove and delete the reason",
    removedWithReason:
      "Removed, with the reason for that step. The paper, its reading notes, notebook entries and files are still in your library.",
    allHeld: "Every paper in your library that matches these words is already on this trail.",
    deleteLabel: "Delete this trail",
    deleteBody:
      "Deleting the trail removes it, its description and the reason written for each step. The papers, their reading notes, notebook entries and files stay in your library.",
    noItems: "No steps yet. Add the first paper from your library below.",
  },
};

/**
 * The confirmation a collection page shows for `?saved=`. Only the page's own keys count, so a
 * crafted key such as `__proto__` or `constructor` shows nothing rather than an inherited value.
 */
export function collectionSavedText(kind: CollectionKind, saved: string): string | null {
  const texts: Record<string, string> = {
    created: "Created. Add papers from your library below.",
    renamed: "Renamed.",
    described: "Description saved.",
    added: "Added.",
    already: "That paper is already here.",
    removed: "Removed. The paper, its notes and files are still in your library.",
    "removed-note": KIND_TEXT[kind].removedWithReason,
    moved: "Moved.",
    reason: KIND_TEXT[kind].reasonSaved,
  };
  return Object.hasOwn(texts, saved) ? texts[saved]! : null;
}

/**
 * What *Add from your library* says when it offers no paper. `found` is how many papers matched the
 * words (or, without words, were saved recently) before those already in the collection were left out.
 */
export function addListEmptyText(kind: CollectionKind, words: string, found: number): string {
  if (words) return found ? KIND_TEXT[kind].allHeld : "No paper in your library matches these words.";
  return found ? "Every paper you saved recently is already here. Search your papers for older ones." : "You have no saved papers yet.";
}

/**
 * The `?page=` of the home's saved papers: any whole number from 1 (capped, so a huge value is just a
 * page past the last, which says so); anything else is page 1.
 */
export function savedPageNumber(value: string): number {
  if (!/^\d+$/.test(value)) return 1;
  const n = Number(value);
  return n >= 1 ? Math.min(n, 100_000) : 1;
}

/** "3 papers" on a shelf, "3 steps" on a trail. */
export function collectionCount(kind: CollectionKind, n: number): string {
  if (kind === "trail") return `${n} step${n === 1 ? "" : "s"}`;
  return `${n} paper${n === 1 ? "" : "s"}`;
}
