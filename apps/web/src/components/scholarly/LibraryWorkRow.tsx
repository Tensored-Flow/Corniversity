import type { WorkRow } from "@corniversity/db/services/scholarly-works";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { authorLine, paperHref, typeLabel } from "./format";
import { workIsFixture } from "./model";
import { FixtureBadge } from "./PaperView";

/**
 * One of the owner's papers in a list: title to its paper page, first authors, year, venue, whether
 * it is in the saved papers, its flags, and *Fixture data* when its details are recorded fixtures.
 */
export function LibraryWorkRow({ work }: { work: WorkRow }) {
  const meta = [authorLine(work.authors), work.publicationYear ? String(work.publicationYear) : null, work.venue, typeLabel(work.workType)]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="border-t border-stone py-3 [overflow-wrap:anywhere] first:border-t-0">
      <h3 className="text-base text-ink">
        <Link href={paperHref(work.id)} className="hover:underline">
          {work.title ?? "Untitled (no title yet)"}
        </Link>
      </h3>
      {meta ? <p className="text-sm text-ink-2">{meta}</p> : null}
      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
        {work.savedAt ? <Badge tone="moss">Saved</Badge> : <Badge tone="neutral">Not in your saved papers</Badge>}
        {workIsFixture(work.provenance) ? <FixtureBadge /> : null}
        {work.favourite ? <span>Favourite</span> : null}
        {work.readLater ? <span>Read later</span> : null}
        {work.readAt ? <span>Read</span> : null}
      </p>
    </li>
  );
}
