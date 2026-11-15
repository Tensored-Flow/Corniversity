import type { WorkDocumentEntry } from "@corniversity/db/services/library-home";
import type { WorkRow } from "@corniversity/db/services/scholarly-works";
import Link from "next/link";
import type { ReactNode } from "react";
import { pageViewAvailable, textViewAvailable } from "@/components/reader/rules";
import { authorLine, paperHref } from "@/components/scholarly/format";
import { workIsFixture } from "@/components/scholarly/model";
import { FixtureBadge } from "@/components/scholarly/PaperView";
import { Badge, LinkButton } from "@/components/ui";

/** A Document of a paper that can be read here, by work: the most recently opened readable one, else the newest. */
export interface ReadableDocument {
  assetId: string;
  label: string;
}

export function readableByWork(docs: readonly WorkDocumentEntry[]): Map<string, ReadableDocument> {
  const out = new Map<string, ReadableDocument>();
  for (const d of docs)
    if (!out.has(d.workId) && (pageViewAvailable(d.asset) || textViewAvailable(d.asset)))
      out.set(d.workId, { assetId: d.asset.id, label: d.versionLabel });
  return out;
}

/** "Juan Maldacena · 1999 · Advances in Theoretical and Mathematical Physics": first authors, year, venue. */
export function workMeta(work: Pick<WorkRow, "authors" | "publicationYear" | "venue">): string {
  return [authorLine(work.authors), work.publicationYear ? String(work.publicationYear) : null, work.venue].filter(Boolean).join(" · ");
}

export function workTitle(work: Pick<WorkRow, "title">): string {
  return work.title ?? "Untitled paper";
}

/**
 * One of the owner's papers in a list: its title to the paper page, first authors, year and venue,
 * *Fixture data* when its details are recorded fixtures, an integrity notice when one is recorded,
 * and *Read* when a Document of it can be opened in the reader.
 */
export function WorkLine({
  work,
  read,
  heading: Heading = "h3",
  extra,
  actions,
}: {
  work: WorkRow;
  read?: ReadableDocument | null;
  heading?: "h3" | "h4";
  extra?: ReactNode;
  actions?: ReactNode;
}) {
  const meta = workMeta(work);
  const retracted = work.integrityNotices.some((n) => n.type === "retraction");
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-x-4">
      <div className="min-w-0 [overflow-wrap:anywhere] sm:flex-1">
        <Heading className="text-base text-ink">
          <Link href={paperHref(work.id)} className="inline-flex min-h-6 items-center hover:underline">
            {workTitle(work)}
          </Link>
        </Heading>
        {meta ? <p className="text-sm text-ink-2">{meta}</p> : null}
        {workIsFixture(work.provenance) || work.integrityNotices.length || extra ? (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            {work.integrityNotices.length ? <Badge tone="rust">{retracted ? "Retraction notice" : "Integrity notice"}</Badge> : null}
            {workIsFixture(work.provenance) ? <FixtureBadge /> : null}
            {extra}
          </p>
        ) : null}
      </div>
      {read || actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:max-w-[50%] sm:justify-end">
          {read ? (
            <LinkButton href={`/library/read/${read.assetId}`} variant="secondary">
              Read<span className="sr-only"> {workTitle(work)}</span>
            </LinkButton>
          ) : null}
          {/* The row's own controls wrap as one group, so on a phone Move up, Move down and Remove stay together. */}
          {actions ? <div className="flex flex-wrap items-center gap-x-2 gap-y-1">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
