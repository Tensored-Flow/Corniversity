import type { Locator } from "@corniversity/core";

interface Props {
  label: string;
  locator: Locator;
  note?: string | null;
}

/**
 * Renders a verified source location as a link that reopens the exact place: web pages by URL
 * and heading, PDFs by file and page (the #page fragment is honoured by browser PDF viewers),
 * videos by timestamp. Book references have no link because the book is not online.
 */
export function LocatorLink({ label, locator, note }: Props) {
  let href: string | null = null;
  let detail = "";
  switch (locator.kind) {
    case "web":
      href = locator.fragment ? `${locator.url}#${locator.fragment}` : locator.url;
      detail = locator.heading ?? "web page";
      break;
    case "pdf":
      href = locator.url ? `${locator.url}#page=${locator.physicalPageIndex + 1}` : null;
      detail = locator.printedPageLabel ? `p. ${locator.printedPageLabel}` : `PDF page ${locator.physicalPageIndex + 1}`;
      if (locator.sectionLabel) detail = `${locator.sectionLabel} · ${detail}`;
      break;
    case "video":
      href = `${locator.url}#t=${Math.floor(locator.startSeconds)}`;
      detail = `from ${Math.floor(locator.startSeconds / 60)}:${String(Math.floor(locator.startSeconds % 60)).padStart(2, "0")}`;
      break;
    case "book_reference":
      detail = `${locator.edition}, ${locator.sectionLabel}${locator.exerciseLabel ? `, ${locator.exerciseLabel}` : ""} (reference only)`;
      break;
  }
  return (
    <span className="inline">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="text-brass underline underline-offset-4">
          {label}
        </a>
      ) : (
        <span className="text-ink">{label}</span>
      )}
      <span className="ml-1 text-xs text-ink-3">{detail}</span>
      {note ? <span className="ml-1 text-xs text-ink-3">· {note}</span> : null}
    </span>
  );
}
