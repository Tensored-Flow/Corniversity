import type { OpenAlexWorkRecord } from "@corniversity/db/scholarly/types";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import { authorLine, count, paperHref, previewHref, typeLabel } from "./format";
import { saveWorkAction } from "./save-action";

/**
 * One paper in a list (Find results, references, cited by, related): title (to the paper page when
 * the owner has it, else to the preview), first authors, year and venue, OpenAlex's cited-by count
 * as OpenAlex's, the "In your library" marker (or, for a paper the owner removed from the library
 * and kept the files and notes of, "Not in your saved papers"), and Save. Provider strings are
 * escaped React text.
 */
export function WorkSummaryRow({
  record,
  workId,
  saved = true,
  back,
  headingLevel = 3,
}: {
  record: OpenAlexWorkRecord;
  workId: string | null;
  /** Whether the owner's work is in their saved papers (ignored without a work). */
  saved?: boolean;
  /** Where Save returns to (this page); without it Save opens the saved paper's page. */
  back?: string;
  headingLevel?: 3 | 4;
}) {
  const href = workId ? paperHref(workId) : previewHref("openalex", record.openalexId);
  const meta = [
    authorLine(record.authors),
    record.publicationYear ? String(record.publicationYear) : null,
    record.venue,
    typeLabel(record.workType),
  ]
    .filter(Boolean)
    .join(" · ");
  const Heading = headingLevel === 3 ? "h3" : "h4";
  return (
    <li className="flex flex-col gap-2 border-t border-stone py-3 first:border-t-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <Heading className="text-base text-ink">
          <Link href={href} className="inline-flex min-h-6 items-center hover:underline">
            {record.title ?? "Untitled (no title reported)"}
          </Link>
        </Heading>
        {meta ? <p className="text-sm text-ink-2">{meta}</p> : null}
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
          {record.citedByCount !== null ? <span>Cited by {count(record.citedByCount)} according to OpenAlex</span> : null}
          {record.openAccess?.isOa ? <span>Free to read according to OpenAlex</span> : null}
          {workId && saved ? <Badge tone="moss">In your library</Badge> : null}
          {workId && !saved ? <Badge tone="neutral">Not in your saved papers</Badge> : null}
        </p>
      </div>
      {workId && saved ? null : (
        <form action={saveWorkAction} className="shrink-0">
          <input type="hidden" name="scheme" value="openalex" />
          <input type="hidden" name="value" value={record.openalexId} />
          {back ? <input type="hidden" name="back" value={back} /> : null}
          <Button type="submit" variant="secondary" aria-label={`Save “${record.title ?? record.openalexId}” to your library`}>
            Save
          </Button>
        </form>
      )}
    </li>
  );
}
