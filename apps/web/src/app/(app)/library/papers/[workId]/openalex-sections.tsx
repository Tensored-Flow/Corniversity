import { isArxivDoi, normaliseDoi } from "@corniversity/core";
import {
  PAPER_LIST_MAX,
  PAPER_LIST_SHORT,
  type PaperListKind,
  paperList,
  type WorkRecordResult,
} from "@corniversity/db/services/paper-lists";
import { ScholarlyError } from "@corniversity/db/services/scholarly-works";
import Link from "next/link";
import { scholarly } from "@/components/scholarly/client";
import {
  identifierHref,
  listCountSentence,
  locationLabel,
  readElsewhereNote,
  resetSentence,
  showMoreLabel,
} from "@/components/scholarly/format";
import { FixtureBadge, ProviderFailure } from "@/components/scholarly/PaperView";
import { WorkSummaryRow } from "@/components/scholarly/WorkSummaryRow";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";

/**
 * The parts of the paper page that read OpenAlex (through the provider cache), streamed so the
 * page itself renders from the database at once: where a DOI-only paper can be read, and the
 * bounded references, cited-by and related lists with their provenance. Failures say what happened.
 * Without JavaScript a streamed part never replaces its placeholder, so each placeholder carries a
 * <noscript> link to the same page rendered whole (`?full=1`), where nothing is streamed.
 */

/** The paper page rendered whole (`full=1`), keeping the list shown in full (`more`) and a section anchor. */
export function fullPageHref(workId: string, more: PaperListKind | null, hash: string): string {
  return `/library/papers/${workId}?full=1${more ? `&more=${more}` : ""}${hash}`;
}

/** The placeholder while the open locations load, with the no-JavaScript route to them. */
export function ReadElsewhereFallback({ workId }: { workId: string }) {
  return (
    <>
      <p className="text-sm text-ink-3">Looking up where it can be read…</p>
      <noscript>
        <p className="text-sm">
          <a href={fullPageHref(workId, null, "#read")} className="text-brass underline underline-offset-4">
            Show where it can be read
          </a>
        </p>
      </noscript>
    </>
  );
}

/**
 * *Read* for a paper with no file here and no arXiv version: the best free-to-read location
 * OpenAlex reports (host and version named), and the publisher's page through doi.org for the DOI
 * OpenAlex names as the work's own (or the paper's only publisher DOI when OpenAlex could not be
 * asked; other DOIs, such as repository deposits, are listed under Identifiers). External links
 * open in a new tab without a referrer.
 */
export async function ReadElsewhere({ recordPromise, dois }: { recordPromise: Promise<WorkRecordResult>; dois: string[] }) {
  const { record, failure } = await recordPromise;
  const location = record?.bestOaLocation ?? null;
  const open = location ? (location.pdfUrl ?? location.landingPageUrl) : null;
  const primary = record ? record.doi : dois.length === 1 ? dois[0]! : null;
  const publisher = primary && normaliseDoi(primary) && !isArxivDoi(primary) ? identifierHref("doi", primary) : null;
  const reset = failure ? resetSentence(failure.resetAt) : null;
  const note = readElsewhereNote({
    record: record !== null,
    openCopy: Boolean(open),
    publisher: Boolean(publisher),
    failed: Boolean(failure),
  });
  const link = "text-brass underline underline-offset-4";
  return (
    <div className="flex flex-col gap-1 text-sm">
      {open && location ? (
        <p>
          <a href={open} target="_blank" rel="noopener noreferrer" className={link}>
            Read at {locationLabel(location)}
          </a>{" "}
          <span className="text-xs text-ink-3">
            (free to read according to OpenAlex
            {location.licenceName ? `; licence ${location.licenceName} as reported for this location` : ""})
          </span>
        </p>
      ) : null}
      {publisher ? (
        <p>
          <a href={publisher} target="_blank" rel="noopener noreferrer" className={link}>
            Publisher's page (through doi.org)
          </a>
        </p>
      ) : null}
      {note ? <p className="text-xs text-ink-3">{note}</p> : null}
      {failure ? (
        <p className="text-xs text-ink-3">
          Open locations could not be looked up: {failure.message}
          {reset ? ` ${reset}` : ""}
        </p>
      ) : null}
    </div>
  );
}

const LIST_TITLES: Record<PaperListKind, string> = { references: "References", cited_by: "Cited by", related: "Related" };

const listId = (kind: PaperListKind) => `list-${kind.replace("_", "-")}`;

/** The placeholder while a list loads, with the no-JavaScript route to the lists. */
export function ListFallback({ kind, workId, more }: { kind: PaperListKind; workId: string; more: PaperListKind | null }) {
  return (
    <Card as="section">
      <h2 className="text-lg text-ink">{LIST_TITLES[kind]}</h2>
      <p className="mt-2 text-sm text-ink-3">Loading from OpenAlex…</p>
      <noscript>
        <p className="mt-1 text-sm">
          <a href={fullPageHref(workId, more, `#${listId(kind)}`)} className="text-brass underline underline-offset-4">
            Show the {LIST_TITLES[kind].toLowerCase()} list
          </a>
        </p>
      </noscript>
    </Card>
  );
}

/** One bounded list: about ten, *Show more* up to fifty, with what OpenAlex counted, returned and lists. */
export async function PaperListSection({
  recordPromise,
  kind,
  ownerId,
  workId,
  more,
  full,
  refusal,
}: {
  recordPromise: Promise<WorkRecordResult>;
  kind: PaperListKind;
  ownerId: string;
  workId: string;
  more: boolean;
  /** The page is rendered whole (no streaming): its links keep `full=1`. */
  full: boolean;
  refusal: string | null;
}) {
  const id = listId(kind);
  const heading = (
    <h2 id={`${id}-heading`} className="text-lg text-ink">
      {LIST_TITLES[kind]}
    </h2>
  );
  const { record, failure } = await recordPromise;
  if (refusal || !record) {
    return (
      <Card as="section" id={id}>
        {heading}
        <div className="mt-2">
          {refusal ? (
            <ProviderFailure message={refusal} />
          ) : failure ? (
            <ProviderFailure message={failure.message} resetAt={failure.resetAt} />
          ) : (
            <p className="text-sm text-ink-3">This paper has no identifier OpenAlex can look up.</p>
          )}
        </div>
      </Card>
    );
  }
  let list: Awaited<ReturnType<typeof paperList>> | null = null;
  let error: { message: string; resetAt: Date | null } | null = null;
  try {
    list = await paperList(db(), ownerId, scholarly(), record, kind);
  } catch (caught) {
    if (!(caught instanceof ScholarlyError)) throw caught;
    error = { message: caught.message, resetAt: caught.details.resetAt ?? null };
  }
  const shown = list ? list.items.slice(0, more ? PAPER_LIST_MAX : PAPER_LIST_SHORT) : [];
  const href = (showAll: boolean) => {
    const query = [full ? "full=1" : "", showAll ? `more=${kind}` : ""].filter(Boolean).join("&");
    return `/library/papers/${workId}${query ? `?${query}` : ""}#${id}`;
  };
  const counts = list ? { total: list.total, returned: list.returned, listed: list.items.length, missing: list.missing } : null;
  return (
    <Card as="section" id={id}>
      {heading}
      {error ? (
        <div className="mt-2">
          <ProviderFailure message={error.message} resetAt={error.resetAt} />
        </div>
      ) : null}
      {list && counts ? (
        <>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <span>{listCountSentence(kind, counts)}</span>
            {list.provenance.source === "fixture" ? <FixtureBadge /> : null}
            <span>
              {list.provenance.source === "fixture" ? "recorded" : "retrieved"} {list.provenance.retrievedAt.slice(0, 10)}
            </span>
          </p>
          {shown.length ? (
            <ol className="mt-2 flex flex-col">
              {shown.map((item) => (
                <WorkSummaryRow
                  key={item.record.openalexId}
                  record={item.record}
                  workId={item.workId}
                  saved={item.saved}
                  back={href(more)}
                />
              ))}
            </ol>
          ) : null}
          {!more && list.items.length > PAPER_LIST_SHORT ? (
            <p className="mt-2 text-sm">
              <Link href={href(true)} className="text-brass underline underline-offset-4" scroll={false}>
                {showMoreLabel(kind, counts)}
              </Link>
            </p>
          ) : null}
          {more && list.items.length > PAPER_LIST_SHORT ? (
            <p className="mt-2 text-sm">
              <Link href={href(false)} className="text-brass underline underline-offset-4" scroll={false}>
                Show fewer
              </Link>
            </p>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
