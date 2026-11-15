import type { WorkListItem, WorkListView } from "@corniversity/db/services/scholarly-works";
import Link from "next/link";
import { Card } from "@/components/ui";
import { type ReadableDocument, WorkLine } from "../_collections/WorkLine";

export const VIEWS: { view: WorkListView; label: string; empty: string }[] = [
  {
    view: "saved",
    label: "All saved",
    empty: "No saved papers yet. Find a paper by its DOI, arXiv id, OpenAlex id or words, or browse Discover.",
  },
  { view: "read_later", label: "Read later", empty: "No paper is marked Read later. You mark one on its paper page." },
  { view: "favourites", label: "Favourites", empty: "No favourites yet. You mark one on its paper page." },
  {
    view: "read",
    label: "Read",
    empty: "No paper is marked as read. You mark it yourself with Have read on a paper page; nothing is marked automatically.",
  },
  { view: "recent", label: "Recently opened", empty: "No paper opened yet. Papers you open in the reader appear here." },
];

export const SAVED_PAGE_SIZE = 20;

const href = (view: WorkListView, page = 1) => {
  const params = new URLSearchParams();
  if (view !== "saved") params.set("view", view);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return `/library${s ? `?${s}` : ""}#saved`;
};

/**
 * *Saved papers* on the home page: All saved, Read later, Favourites, Read (each among the saved
 * papers, set by the owner) and Recently opened (from the reader's openings). Rows link to the
 * paper page and offer Read where a Document of the paper can be opened.
 */
export function SavedPapers({
  view,
  page,
  items,
  hasNext,
  readable,
}: {
  view: WorkListView;
  page: number;
  items: WorkListItem[];
  hasNext: boolean;
  readable: Map<string, ReadableDocument>;
}) {
  const current = VIEWS.find((v) => v.view === view) ?? VIEWS[0]!;
  return (
    <section aria-labelledby="saved-heading" id="saved">
      <Card as="div">
        <h2 id="saved-heading" className="text-lg text-ink">
          Saved papers
        </h2>
        <nav aria-label="Saved papers views" className="mt-3 flex flex-wrap gap-x-1 gap-y-1 border-b border-stone">
          {VIEWS.map((v) => (
            <Link
              key={v.view}
              href={href(v.view)}
              aria-current={v.view === view ? "page" : undefined}
              className={[
                "-mb-px whitespace-nowrap border-b-2 px-2 py-1.5 text-sm",
                v.view === view ? "border-brass font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink",
              ].join(" ")}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">
            {page > 1 ? (
              <>
                No more papers in this view on page {page}.{" "}
                <Link href={href(view)} className="text-brass underline underline-offset-4">
                  Go to page 1
                </Link>
              </>
            ) : (
              <>
                {current.empty}
                {view === "saved" ? (
                  <>
                    {" "}
                    <Link href="/library/find" className="text-brass underline underline-offset-4">
                      Find papers
                    </Link>{" "}
                    ·{" "}
                    <Link href="/library/discover" className="text-brass underline underline-offset-4">
                      Discover
                    </Link>
                  </>
                ) : null}
              </>
            )}
          </p>
        ) : (
          <ul className="mt-1 flex flex-col" aria-label={current.label}>
            {items.map(({ work, lastOpenedAt }) => (
              <li key={work.id} className="border-t border-stone py-3 first:border-t-0">
                <WorkLine
                  work={work}
                  read={readable.get(work.id) ?? null}
                  extra={
                    view === "recent" && lastOpenedAt ? (
                      <span>opened {lastOpenedAt.toISOString().slice(0, 10)}</span>
                    ) : view === "read" && work.readAt ? (
                      <span>marked read {work.readAt.toISOString().slice(0, 10)}</span>
                    ) : null
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {page > 1 || hasNext ? (
          <nav aria-label="Saved papers pages" className="mt-3 flex flex-wrap gap-3 text-sm">
            {page > 1 ? (
              <Link href={href(view, page - 1)} className="text-brass underline underline-offset-4">
                Previous page
              </Link>
            ) : null}
            {hasNext ? (
              <Link href={href(view, page + 1)} className="text-brass underline underline-offset-4">
                Next page
              </Link>
            ) : null}
          </nav>
        ) : null}
      </Card>
    </section>
  );
}
