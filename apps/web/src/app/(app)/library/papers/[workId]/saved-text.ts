/** The paper page's confirmations, by the `?saved=` key its forms and routes redirect with. */
const SAVED_TEXT: Record<string, string> = {
  flags: "Saved.",
  removed: "Removed from your saved papers. The paper, its files and notes stay here.",
  saved: "Saved to your library.",
  edited: "Your corrections are saved; a refresh from a provider never overwrites them.",
  "private-copy": "Private copy requested. The worker fetches it from arXiv; this page updates when it is stored.",
  permission: "Permission recorded.",
  processing: "Extraction queued.",
  "copy-removed": "File removed.",
  merged: "Merged into this paper.",
  collection: "Added.",
  "collection-removed": "Removed from that shelf or trail.",
  "collection-removed-note":
    "Removed from that shelf or trail, with the note you wrote for it there. The paper, its notes and files stay here.",
  "attached-stored": "Your copy is attached and can be read here.",
  "attached-promoted": "Your copy is attached to that version and can be read here.",
  "attached-adopted": "That file was already in your library; it is now this paper's file.",
  "attached-reused": "That file was already this paper's; nothing was stored twice.",
  "attached-revived": "That file was deleted earlier; it is back as this paper's file.",
  added: "Paper added from your PDF. Give it a title, authors and year under Edit details.",
};

/**
 * The confirmation for `?saved=`: only the page's own keys count (`__proto__`, `constructor` or a
 * repeated parameter show nothing). *Extraction queued.* stays only while an extraction is still
 * queued or running: the address keeps `saved=processing` while the page refreshes itself, and once
 * the job ends the file's own status (processed, or rejected with its reason) says what happened.
 */
export function savedText(key: unknown, facts: { extracting: boolean }): string | null {
  if (typeof key !== "string" || !Object.hasOwn(SAVED_TEXT, key)) return null;
  if (key === "processing" && !facts.extracting) return null;
  return SAVED_TEXT[key]!;
}
