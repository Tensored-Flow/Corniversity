import { SUBJECTS, subjectBySlug } from "@corniversity/core";
import { isUuid } from "@corniversity/db/ids";
import { OPENALEX_WORK_TYPES } from "@corniversity/db/scholarly/openalex";
import { FIND_PAGE_SIZE, type PaperPage, searchPapers } from "@corniversity/db/services/paper-lists";
import { resolveInput, ScholarlyError, searchMyLibrary, type WorkRow } from "@corniversity/db/services/scholarly-works";
import Link from "next/link";
import { redirect } from "next/navigation";
import { browsingRefusal, scholarly } from "@/components/scholarly/client";
import { type FindParams, findHref, hasFilters, parseFindParams } from "@/components/scholarly/find-params";
import { count, paperHref, previewHref, resultsSummary, typeLabel } from "@/components/scholarly/format";
import { LibraryWorkRow } from "@/components/scholarly/LibraryWorkRow";
import { FixtureBadge, ProviderFailure } from "@/components/scholarly/PaperView";
import { WorkSummaryRow } from "@/components/scholarly/WorkSummaryRow";
import { Button, Card, Input, Notice, Select } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { FlashNotices, LibraryHeader } from "../shared";

export const metadata = { title: "Find papers" };

type Results =
  | { kind: "none" }
  | { kind: "refused"; message: string }
  | { kind: "failed"; message: string; resetAt: Date | null }
  | { kind: "openalex"; page: PaperPage }
  | { kind: "mine"; works: WorkRow[]; hasNext: boolean };

/**
 * Find papers (contract §2): one box for a DOI (also inside any link), an arXiv id or link, an
 * OpenAlex id or link, or words. An exact identifier goes straight to the paper page when the
 * owner has the paper, else to its preview with Save. Words search OpenAlex (All papers) or the
 * owner's own works (My library), with filters and pages up to OpenAlex's 10,000 results. No link
 * typed here is ever fetched: identifiers are read out of it as text.
 */
export default async function FindPapersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession("/library/find");
  const raw = await searchParams;
  const params = parseFindParams(raw);
  const ownerId = session.user.id;
  const database = db();
  const input = params.q ? await resolveInput(database, ownerId, params.q) : ({ kind: "empty" } as const);
  if (input.kind === "identifier") {
    if (input.workId) redirect(paperHref(input.workId));
    const { scheme, value } = input.ref;
    if (scheme === "doi" || scheme === "arxiv" || scheme === "openalex") redirect(previewHref(scheme, value));
  }

  // A link with no identifier whose path gives no words: one notice, nothing searched.
  const emptyLink = input.kind === "search" && Boolean(input.host) && !input.query.trim();
  // Text shaped like a DOI that is not a valid one: said so, and not searched as words.
  const invalidDoi = input.kind === "search" && input.invalidDoi === true;
  let results: Results = { kind: "none" };
  if (input.kind === "search" && !emptyLink && !invalidDoi) {
    const subject = params.field ? subjectBySlug(params.field) : null;
    if (params.scope === "mine") {
      const rows = await searchMyLibrary(database, ownerId, input.query, {
        limit: FIND_PAGE_SIZE + 1,
        offset: (params.page - 1) * FIND_PAGE_SIZE,
        yearFrom: params.yearFrom,
        yearTo: params.yearTo,
        type: params.type,
        ...(subject ? (subject.openalex.level === "field" ? { fieldId: subject.openalex.id } : { subfieldId: subject.openalex.id }) : {}),
      });
      results = { kind: "mine", works: rows.slice(0, FIND_PAGE_SIZE).map((r) => r.work), hasNext: rows.length > FIND_PAGE_SIZE };
    } else {
      const refusal = browsingRefusal();
      if (refusal) results = { kind: "refused", message: refusal };
      else {
        try {
          const page = await searchPapers(database, ownerId, scholarly(), {
            query: input.query,
            page: params.page,
            filters: {
              yearFrom: params.yearFrom,
              yearTo: params.yearTo,
              type: params.type,
              freeToRead: params.freeToRead,
              subject: subject ? subject.slug : undefined,
            },
          });
          results = { kind: "openalex", page };
        } catch (error) {
          if (!(error instanceof ScholarlyError)) throw error;
          results = { kind: "failed", message: error.message, resetAt: error.details.resetAt ?? null };
        }
      }
    }
  }
  const saved = typeof raw.saved === "string" && isUuid(raw.saved) ? raw.saved : null;
  const here = findHref(params);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <LibraryHeader title="Find papers" active="/library/find" />
      <FlashNotices error={typeof raw.error === "string" ? raw.error : undefined} />
      {raw.deleted === "paper" ? (
        <div className="mb-4">
          <Notice tone="moss">
            Paper deleted, with its files and the highlights, notes and bookmarks on its pages. Notebook entries linked to it stay, without
            the link.
          </Notice>
        </div>
      ) : null}
      {saved ? (
        <div className="mb-4">
          <Notice tone="moss">
            Saved to your library.{" "}
            <Link href={paperHref(saved)} className="underline underline-offset-4">
              Open its paper page
            </Link>
            .
          </Notice>
        </div>
      ) : null}

      <Card>
        <form method="get" action="/library/find" aria-label="Find papers" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="find-q" className="text-sm font-medium text-ink">
              DOI, arXiv id, OpenAlex id, a link to one of them, or words
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="find-q" name="q" type="search" defaultValue={params.q} maxLength={2000} autoComplete="off" spellCheck={false} />
              <Button type="submit" className="shrink-0">
                Find
              </Button>
            </div>
            <p className="text-xs text-ink-3">Links are read as text for their identifier; nothing you type here is opened or fetched.</p>
          </div>
          <fieldset className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink">
            <legend className="mb-1 text-sm font-medium text-ink">Search words in</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="scope" value="all" defaultChecked={params.scope === "all"} /> All papers (OpenAlex)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="scope" value="mine" defaultChecked={params.scope === "mine"} /> My library
            </label>
          </fieldset>
          <Filters params={params} />
        </form>
      </Card>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/library/papers/new" className="text-brass underline underline-offset-4">
          Add a paper without an identifier (PDF)
        </Link>
        <Link href="/library/upload" className="text-brass underline underline-offset-4">
          Upload a file to Files
        </Link>
      </p>

      {invalidDoi ? (
        <div className="mt-4">
          <Notice tone="slate">
            That is not a valid DOI: a DOI starts with 10., then four to nine digits, a slash and the rest (for example 10.7717/peerj.4375).
            Nothing was searched; check it, or search by words.
          </Notice>
        </div>
      ) : null}
      {input.kind === "search" && input.host ? (
        <div className="mt-4">
          <Notice tone="slate">
            {emptyLink
              ? `No DOI, arXiv id or OpenAlex id was found in that link (${input.host}), and it has no words to search for.`
              : `No DOI, arXiv id or OpenAlex id was found in that link (${input.host}); its words are searched instead.`}
          </Notice>
        </div>
      ) : null}

      <section aria-labelledby="results-heading" className="mt-6">
        {results.kind === "none" ? null : (
          <h2 id="results-heading" className="mb-3 text-xl text-ink">
            {results.kind === "mine" ? "In my library" : "All papers"}
          </h2>
        )}
        {results.kind === "refused" ? <ProviderFailure message={results.message} /> : null}
        {results.kind === "failed" ? <ProviderFailure message={results.message} resetAt={results.resetAt} /> : null}
        {results.kind === "openalex" ? <OpenAlexResults page={results.page} params={params} back={here} /> : null}
        {results.kind === "mine" ? <MineResults works={results.works} hasNext={results.hasNext} params={params} /> : null}
      </section>
    </div>
  );
}

function Filters({ params }: { params: FindParams }) {
  return (
    <details open={hasFilters(params)} className="rounded-[var(--radius-control)] border border-stone px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-ink">Filters</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="find-from" className="text-sm text-ink">
            Published from (year)
          </label>
          <Input id="find-from" name="from" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} defaultValue={params.yearFrom ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="find-to" className="text-sm text-ink">
            Published to (year)
          </label>
          <Input id="find-to" name="to" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} defaultValue={params.yearTo ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="find-type" className="text-sm text-ink">
            Type
          </label>
          <Select id="find-type" name="type" defaultValue={params.type ?? ""}>
            <option value="">Any type</option>
            {OPENALEX_WORK_TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="find-field" className="text-sm text-ink">
            Field
          </label>
          <Select id="find-field" name="field" defaultValue={params.field ?? ""}>
            <option value="">Any field</option>
            {SUBJECTS.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
          <input type="checkbox" name="free" value="1" defaultChecked={params.freeToRead} /> Free to read (according to OpenAlex; All papers
          only)
        </label>
      </div>
      <p className="mt-2 text-xs text-ink-3">Field and type are as OpenAlex classifies and reports them.</p>
    </details>
  );
}

/** Result pages: "Page n of N" when the number of pages is known, "Page n" when it is not (My library). */
function Pager({ params, page, hasNext, lastPage }: { params: FindParams; page: number; hasNext: boolean; lastPage: number | null }) {
  if (page <= 1 && !hasNext) return null;
  return (
    <nav aria-label="Result pages" className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={findHref({ ...params, page: page - 1 })} className="text-brass underline underline-offset-4">
          Previous page
        </Link>
      ) : null}
      <span className="text-ink-2">
        Page {count(page)}
        {lastPage !== null ? ` of ${count(lastPage)}` : ""}
      </span>
      {hasNext ? (
        <Link href={findHref({ ...params, page: page + 1 })} className="text-brass underline underline-offset-4">
          Next page
        </Link>
      ) : null}
    </nav>
  );
}

function OpenAlexResults({ page, params, back }: { page: PaperPage; params: FindParams; back: string }) {
  const first = (page.page - 1) * page.perPage + 1;
  // Past the last page OpenAlex still counts results, so this is never "no papers" (resultsSummary).
  const summary = resultsSummary({
    page: page.page,
    perPage: page.perPage,
    lastPage: page.lastPage,
    count: page.count,
    shown: page.items.length,
  });
  return (
    <>
      <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-ink-2">
        {summary.line}
        {page.provenance.source === "fixture" ? <FixtureBadge /> : null}
        <span className="text-xs text-ink-3">
          {page.provenance.source === "fixture" ? "recorded" : "retrieved"} {page.provenance.retrievedAt.slice(0, 10)}
          {page.provenance.stale ? " (an older list; it is refreshed when OpenAlex answers)" : ""}
        </span>
      </p>
      {page.count !== null && page.count > page.perPage * page.lastPage ? (
        <p className="mb-2 text-xs text-ink-3">OpenAlex pages stop at 10,000 results; narrow the words or filters to see others.</p>
      ) : null}
      {page.items.length ? (
        <Card>
          <ol className="flex flex-col" start={first}>
            {page.items.map((item) => (
              <WorkSummaryRow key={item.record.openalexId} record={item.record} workId={item.workId} saved={item.saved} back={back} />
            ))}
          </ol>
        </Card>
      ) : null}
      {page.items.length ? (
        <Pager params={params} page={page.page} hasNext={page.page < page.lastPage} lastPage={page.lastPage} />
      ) : summary.goTo !== null ? (
        <p className="mt-4 text-sm">
          <Link href={findHref({ ...params, page: summary.goTo })} className="text-brass underline underline-offset-4">
            Go to page {count(summary.goTo)}
          </Link>
        </p>
      ) : null}
    </>
  );
}

function MineResults({ works, hasNext, params }: { works: WorkRow[]; hasNext: boolean; params: FindParams }) {
  if (!works.length && params.page > 1)
    return (
      <p className="text-sm text-ink-2">
        No more papers in your library match these words and filters on page {count(params.page)}.{" "}
        <Link href={findHref({ ...params, page: 1 })} className="text-brass underline underline-offset-4">
          Go to page 1
        </Link>
      </p>
    );
  return (
    <>
      {works.length ? (
        <Card>
          <ul className="flex flex-col">
            {works.map((work) => (
              <LibraryWorkRow key={work.id} work={work} />
            ))}
          </ul>
        </Card>
      ) : (
        <p className="text-sm text-ink-2">No paper in your library matches these words and filters.</p>
      )}
      <Pager params={params} page={params.page} hasNext={hasNext} lastPage={null} />
    </>
  );
}
