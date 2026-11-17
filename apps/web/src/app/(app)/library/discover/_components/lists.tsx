import { earlierWorkReason, mostCitedReason, newOnArxivReason, reviewsReason } from "@corniversity/core";
import type { Provenance } from "@corniversity/db/scholarly/types";
import type { DiscoverItem, ListView, RefreshView, SubjectLists } from "@corniversity/db/services/discover";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Button, Notice } from "@/components/ui";
import { saveListedWorkAction } from "../actions";
import { failureText, hourText, KEY_NEEDED, refreshFailureText, resetText } from "./failure";
import { RefreshingNote } from "./RefreshWhilePending";

const PROVIDER = { openalex: "OpenAlex", arxiv: "arXiv" } as const;
type Provider = keyof typeof PROVIDER;

/** The paper page when the owner has the paper, else the preview by the row's identifier. */
export function workHref(item: Pick<DiscoverItem, "ref" | "workId">): string {
  if (item.workId) return `/library/papers/${item.workId}`;
  return `/library/works/${item.ref.scheme}/${encodeURIComponent(item.ref.value)}`;
}

export function itemTitle(item: Pick<DiscoverItem, "title" | "ref">): string {
  return (
    item.title ?? `Untitled (${item.ref.scheme === "arxiv" ? "arXiv" : item.ref.scheme === "doi" ? "DOI" : "OpenAlex"} ${item.ref.value})`
  );
}

/** The first three authors, "et al." when there are more. */
export function authorsLine(authors: readonly string[], more = authors.length > 3, none = "No authors reported"): string {
  if (authors.length === 0) return none;
  return `${authors.slice(0, 3).join(", ")}${more ? " et al." : ""}`;
}

function countLine(item: DiscoverItem): string | null {
  if (item.submitted) return `Submitted to arXiv ${item.submitted}${item.primaryCategory ? ` · ${item.primaryCategory}` : ""}`;
  if (item.citedByCount !== null) return `Cited by ${item.citedByCount.toLocaleString("en-GB")} works in OpenAlex`;
  return null;
}

export function SaveButton({ item, returnTo, anchor }: { item: DiscoverItem; returnTo: string; anchor: string }) {
  return (
    <form action={saveListedWorkAction}>
      <input type="hidden" name="scheme" value={item.ref.scheme} />
      <input type="hidden" name="value" value={item.ref.value} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="anchor" value={anchor} />
      <Button type="submit" variant="secondary" className="px-3 py-1" aria-label={`Save ${itemTitle(item)}`}>
        Save
      </Button>
    </form>
  );
}

export function WorkRow({ item, returnTo, anchor }: { item: DiscoverItem; returnTo: string; anchor: string }) {
  const count = countLine(item);
  return (
    <li className="flex items-start justify-between gap-3 border-t border-stone py-3 first:border-t-0">
      <div className="min-w-0">
        <Link
          href={workHref(item)}
          prefetch={false}
          className="inline-flex min-h-6 items-center text-ink underline-offset-4 [overflow-wrap:anywhere] hover:underline"
        >
          {itemTitle(item)}
        </Link>
        <p className="mt-0.5 text-xs text-ink-2 [overflow-wrap:anywhere]">
          {authorsLine(item.authors, item.moreAuthors)}
          {item.year ? ` · ${item.year}` : ""}
        </p>
        {count ? <p className="text-xs text-ink-3">{count}</p> : null}
        {item.reason ? <p className="text-xs text-ink-3">{item.reason.text}</p> : null}
        {item.retracted ? (
          <p className="mt-1">
            <Badge tone="rust">Retracted according to OpenAlex</Badge>
          </p>
        ) : null}
      </div>
      <div className="shrink-0">
        {item.workId ? <Badge tone="moss">In your library</Badge> : <SaveButton item={item} returnTo={returnTo} anchor={anchor} />}
      </div>
    </li>
  );
}

/**
 * After the date of an out-of-date list: what its refresh is doing. A list fetched in the request has
 * no refresh job: the request itself refreshes it (pages show it while the fresh one streams in).
 */
function staleText(refresh: RefreshView | undefined): string {
  if (!refresh || refresh.state === "queued") return "; out of date, refreshing in the background";
  if (refresh.state === "later") return `; out of date, refreshed when this page is opened after ${hourText(refresh.after)}`;
  return "; out of date";
}

/** Why an out-of-date list was not refreshed, when its refresh job failed or had no key. */
function RefreshFailure({ refresh }: { refresh: RefreshView | undefined }) {
  if (refresh?.state === "key_needed")
    return (
      <p role="status" className="mt-1 text-xs text-rust">
        {KEY_NEEDED}
      </p>
    );
  if (refresh?.state !== "failed") return null;
  const reset = resetText(refresh.resetAt);
  return (
    <p role="status" className="mt-1 text-xs text-rust">
      {refreshFailureText(refresh.code)}
      {reset ? ` ${reset}` : ""}
      {refresh.code === "refresh_failed" ? (
        <>
          {" "}
          <Link href="/library/jobs" className="underline underline-offset-4">
            Jobs
          </Link>
        </>
      ) : null}
    </p>
  );
}

export function ProvenanceLine({ provenance, provider, refresh }: { provenance: Provenance; provider: Provider; refresh?: RefreshView }) {
  const day = provenance.retrievedAt.slice(0, 10);
  const stale = provenance.stale ? staleText(refresh) : "";
  return (
    <>
      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-ink-3">
        {provenance.source === "fixture" ? (
          <>
            <Badge tone="slate">Fixture data</Badge>
            <span>
              recorded from {PROVIDER[provider]} on {day}
              {stale}
            </span>
          </>
        ) : (
          <span>
            From {PROVIDER[provider]}, retrieved {day}
            {stale}
          </span>
        )}
      </p>
      {provenance.stale ? <RefreshFailure refresh={refresh} /> : null}
    </>
  );
}

/**
 * "Check again" loads the page anew: its address differs from the current one (a link that differs
 * only by its fragment would just scroll), and the fragment brings the reader back to the list.
 */
export function checkAgainHref(returnTo: string, anchor: string, now = Date.now()): string {
  return `${returnTo}${returnTo.includes("?") ? "&" : "?"}checked=${now.toString(36)}#${anchor}`;
}

/** The body of a list in any state: rows, not fetched yet, a failure that says what happened, or the missing key. */
export function ListBody({
  view,
  provider,
  returnTo,
  anchor,
  empty,
}: {
  view: ListView;
  provider: Provider;
  returnTo: string;
  anchor: string;
  empty?: string;
}) {
  switch (view.state) {
    case "ready":
      return (
        <>
          <ProvenanceLine provenance={view.provenance} provider={provider} refresh={view.refresh} />
          {view.items.length > 0 ? (
            <ol className="mt-2">
              {view.items.map((item) => (
                <WorkRow key={item.key} item={item} returnTo={returnTo} anchor={anchor} />
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-ink-2">{empty ?? `${PROVIDER[provider]} listed no works for this.`}</p>
          )}
        </>
      );
    case "pending":
      return (
        <p role="status" className="mt-2 text-sm text-ink-2">
          Not fetched yet. Fetching from {PROVIDER[provider]} now.
          <RefreshingNote />{" "}
          <a href={checkAgainHref(returnTo, anchor)} className="text-brass underline underline-offset-4">
            Check again
          </a>
        </p>
      );
    case "later":
      return (
        <p role="status" className="mt-2 text-sm text-ink-2">
          Not in the cache, although this hour's fetch from {PROVIDER[provider]} has finished. It is fetched again when this page is opened
          after {hourText(view.after)}.
        </p>
      );
    case "failed": {
      const reset = resetText(view.resetAt);
      return (
        <p role="status" className="mt-2 text-sm text-rust">
          {failureText(view.code)}
          {reset ? ` ${reset}` : ""}
          {view.code === "refresh_failed" ? (
            <>
              {" "}
              <Link href="/library/jobs" className="underline underline-offset-4">
                Jobs
              </Link>
            </>
          ) : null}
        </p>
      );
    }
    case "key_needed":
      return (
        <p role="status" className="mt-2 text-sm text-ink-2">
          {KEY_NEEDED}
        </p>
      );
  }
}

/**
 * A failed Save returns to the list it came from (`at`, the list's id, and its fragment), so its
 * notice is shown in that list, where the reader is, instead of at the top of the page.
 */
export type CardNotice = { at: string; text: string } | null;

/** The notice for the list with this id, or null. */
export function noticeFor(notice: CardNotice, id: string): string | null {
  return notice?.at === id ? notice.text : null;
}

/** The error notice placed in the list `at` names when that list is on the page, else null (the page shows it at the top). */
export function cardNotice(at: string | undefined, text: string | null, ids: readonly string[]): CardNotice {
  return text && at && ids.includes(at) ? { at, text } : null;
}

export function ListCard({
  id,
  title,
  description,
  headingLevel = 3,
  notice,
  children,
}: {
  id: string;
  title: ReactNode;
  description: ReactNode;
  headingLevel?: 2 | 3;
  /** A failed Save from this list. */
  notice?: string | null;
  children: ReactNode;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  // A plain section, not a named region: every subject has a "Most cited", and the heading carries
  // the structure (the subject's own section is the region).
  return (
    <section id={id} className="min-w-0 scroll-mt-4 rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4">
      <Heading className="text-lg text-ink [overflow-wrap:anywhere]">{title}</Heading>
      <p className="mt-1 text-xs text-ink-2">{description}</p>
      {notice ? (
        <div className="mt-2">
          <Notice tone="rust">Not saved. {notice}</Notice>
        </div>
      ) : null}
      {children}
    </section>
  );
}

const subjectCardId = (slug: string, kind: string) => `${slug}-${kind}`;

/** The ids of a subject's list cards, as SubjectListCards renders them. */
export function subjectCardIds(lists: SubjectLists): string[] {
  const kinds = [...(lists.newOnArxiv ? ["new"] : []), "reviews", "most-cited", "earlier"];
  return kinds.map((kind) => subjectCardId(lists.subject.slug, kind));
}

/** A subject's four lists (three for a subject without arXiv categories). */
export function SubjectListCards({
  lists,
  returnTo,
  headingLevel,
  notice = null,
}: {
  lists: SubjectLists;
  returnTo: string;
  headingLevel: 2 | 3;
  notice?: CardNotice;
}) {
  const { subject } = lists;
  const id = (kind: string) => subjectCardId(subject.slug, kind);
  const card = (kind: string, title: string, description: string, view: ListView, provider: Provider) => (
    <ListCard id={id(kind)} title={title} description={description} headingLevel={headingLevel} notice={noticeFor(notice, id(kind))}>
      <ListBody view={view} provider={provider} returnTo={returnTo} anchor={id(kind)} />
    </ListCard>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {lists.newOnArxiv ? card("new", "New on arXiv", newOnArxivReason(subject.arxivCategories).text, lists.newOnArxiv, "arxiv") : null}
      {card(
        "reviews",
        "Reviews and surveys",
        `${reviewsReason().text}; published ${lists.reviewYears.from}–${lists.reviewYears.to}, most cited first`,
        lists.reviews,
        "openalex",
      )}
      {card("most-cited", "Most cited", mostCitedReason().text, lists.mostCited, "openalex")}
      {card("earlier", "Earlier work", earlierWorkReason().text, lists.earlierWork, "openalex")}
    </div>
  );
}
