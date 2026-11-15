import type { ReactNode } from "react";
import { Badge, Card, Notice } from "@/components/ui";
import {
  abstractLabel,
  authorLine,
  count,
  dateWithPrecision,
  detailsSentence,
  displayIdentifier,
  identifierHref,
  integritySource,
  integrityType,
  reportedBy,
  resetSentence,
  schemeLabel,
  typeLabel,
} from "./format";
import { commonStamp, namedSubjects, type PaperSummary, type Stamp, sameStamp } from "./model";

/**
 * One paper, the same on the preview (a provider's record, not in the library) and on the paper
 * page (a work in the library): title line, authors, date with its precision, venue and type,
 * integrity notices first and prominently, the abstract with its source, identifiers with their
 * source and retrieval date, and OpenAlex's subjects. Provider strings are rendered only as escaped
 * React text. Mode-specific controls arrive as `actions` (beside the summary) and `children`
 * (sections below).
 */
export function PaperView({
  paper,
  mode,
  citedBy,
  actions,
  children,
}: {
  paper: PaperSummary;
  mode: "preview" | "paper";
  /** OpenAlex's cited-by count with its retrieval, when its record was read. */
  citedBy?: { count: number; retrievedAt: string; fixture: boolean } | null;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const date = dateWithPrecision({ date: paper.date, year: paper.year, precision: paper.datePrecision });
  const type = typeLabel(paper.workType);
  const subjects = namedSubjects(paper.subjects);
  const common = commonStamp(paper);
  return (
    // Long unbroken values (a pasted venue, a provider's title) wrap rather than widen the page.
    <div className="flex flex-col gap-6 [overflow-wrap:anywhere]">
      {paper.integrityNotices.length ? <IntegrityNotices notices={paper.integrityNotices} /> : null}

      <Card as="section" aria-labelledby="paper-summary-heading">
        <h2 id="paper-summary-heading" className="sr-only">
          Summary
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {mode === "preview" ? <Badge tone="slate">Not in your library</Badge> : null}
          {paper.fixture ? <FixtureBadge /> : null}
          {paper.unidentified ? (
            <Badge tone="neutral" title="No provider has described this paper; its details are yours.">
              Not identified
            </Badge>
          ) : null}
        </div>
        {paper.fixture ? (
          <p className="mt-2 text-xs text-ink-3">
            Fixture data: recorded provider responses used by tests (SCHOLARLY_PROVIDER=fixture), not a live lookup.
          </p>
        ) : null}
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-ink-3">Authors</dt>
          <dd className="min-w-0 text-ink">
            {paper.authors.length ? <Authors authors={paper.authors} /> : <span className="text-ink-3">None reported</span>}
            <StampNote stamp={paper.stamps.authors} common={common} />
          </dd>
          <dt className="text-ink-3">Date</dt>
          <dd className="text-ink">
            {date ?? <span className="text-ink-3">Not reported</span>}
            <StampNote stamp={paper.stamps.date} common={common} />
          </dd>
          <dt className="text-ink-3">Venue</dt>
          <dd className="min-w-0 text-ink">
            {paper.venue ?? <span className="text-ink-3">Not reported</span>}
            <StampNote stamp={paper.stamps.venue} common={common} />
          </dd>
          <dt className="text-ink-3">Type</dt>
          <dd className="text-ink">
            {type ?? <span className="text-ink-3">Not reported</span>}
            <StampNote stamp={paper.stamps.workType} common={common} />
          </dd>
          {citedBy ? (
            <>
              <dt className="text-ink-3">Cited by</dt>
              <dd className="text-ink">
                {count(citedBy.count)} according to OpenAlex
                <StampNote stamp={{ source: citedBy.fixture ? "fixture" : "openalex", retrievedAt: citedBy.retrievedAt }} common={common} />
              </dd>
            </>
          ) : null}
        </dl>
        {common ? <p className="mt-3 text-xs text-ink-3">{detailsSentence(common.source, common.retrievedAt)}</p> : null}
        {paper.stamps.title && !sameStamp(paper.stamps.title, common) ? (
          <p className="text-xs text-ink-3">Title {reportedBy(paper.stamps.title.source, paper.stamps.title.retrievedAt)}.</p>
        ) : null}
        {actions ? <div className="mt-4 border-t border-stone pt-4">{actions}</div> : null}
      </Card>

      <Card as="section" aria-labelledby="abstract-heading">
        <h2 id="abstract-heading" className="text-lg text-ink">
          Abstract
        </h2>
        {paper.abstract ? (
          <>
            <p className="mt-1 text-xs text-ink-3">
              {abstractLabel(paper.abstract.source)}
              {paper.abstract.stamp && !sameStamp(paper.abstract.stamp, common)
                ? ` (${reportedBy(paper.abstract.stamp.source, paper.abstract.stamp.retrievedAt)})`
                : ""}
              .
            </p>
            <p className="mt-3 max-w-prose whitespace-pre-line font-serif text-base leading-relaxed text-ink">{paper.abstract.text}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-3">No abstract was reported.</p>
        )}
      </Card>

      <Card as="section" aria-labelledby="identifiers-heading">
        <h2 id="identifiers-heading" className="text-lg text-ink">
          Identifiers
        </h2>
        {paper.identifiers.length ? (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {paper.identifiers.map((id) => {
              const href = identifierHref(id.scheme, id.value);
              return (
                <li key={`${id.scheme}:${id.value}`} className="min-w-0">
                  <span className="text-ink-3">{schemeLabel(id.scheme)}</span>{" "}
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-brass underline underline-offset-4">
                      {displayIdentifier(id.scheme, id.value)}
                    </a>
                  ) : (
                    <span className="break-all">{displayIdentifier(id.scheme, id.value)}</span>
                  )}{" "}
                  {id.superseded ? <Badge tone="neutral">superseded</Badge> : null}
                  <span className="block text-xs text-ink-3">
                    {id.source === "owner" ? "given by you" : reportedBy(id.source, id.retrievedAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-3">No identifier yet.</p>
        )}
        {subjects.length ? (
          <>
            <h3 className="mt-5 text-base text-ink">Subjects</h3>
            <p className="text-xs text-ink-3">
              As classified by OpenAlex
              {paper.stamps.subjects && !sameStamp(paper.stamps.subjects, common)
                ? ` (${reportedBy(paper.stamps.subjects.source, paper.stamps.subjects.retrievedAt)})`
                : ""}
              .
            </p>
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {subjects.map((s) => (
                <li key={`${s.level}:${s.id}`} className="rounded-full border border-stone px-2.5 py-0.5 text-ink-2">
                  {s.name} <span className="text-xs text-ink-3">({s.level})</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Card>

      {children}
    </div>
  );
}

function Authors({ authors }: { authors: { name: string }[] }) {
  if (authors.length <= 12) return <span>{authors.map((a) => a.name).join(", ")}</span>;
  return (
    <details>
      <summary className="cursor-pointer">
        {authorLine(authors, 10)} <span className="text-ink-3">({count(authors.length)} authors; show all)</span>
      </summary>
      <p className="mt-1">{authors.map((a) => a.name).join(", ")}</p>
    </details>
  );
}

/** A field's own provenance, shown only where it differs from the stamp the details share. */
function StampNote({ stamp, common }: { stamp: Stamp | undefined; common: Stamp | null }) {
  if (!stamp || sameStamp(stamp, common)) return null;
  return <span className="ml-2 text-xs text-ink-3">({reportedBy(stamp.source, stamp.retrievedAt)})</span>;
}

export function FixtureBadge() {
  return (
    <Badge tone="brass" title="Recorded provider responses used by tests (SCHOLARLY_PROVIDER=fixture), not a live lookup.">
      Fixture data
    </Badge>
  );
}

/** Retractions, corrections, expressions of concern and withdrawals, each with its source and dates. */
export function IntegrityNotices({ notices }: { notices: PaperSummary["integrityNotices"] }) {
  return (
    <Notice tone="rust" title={notices.some((n) => n.type === "retraction") ? "Retracted" : "Integrity notices"}>
      <ul className="flex flex-col gap-2">
        {notices.map((n) => {
          const href = n.noticeDoi ? identifierHref("doi", n.noticeDoi) : null;
          return (
            <li key={`${n.type}|${n.source}|${n.concerns}|${n.noticeDoi ?? ""}`}>
              <span className="font-medium">{integrityType(n.type)}</span>
              {n.label && n.label !== integrityType(n.type) ? `: ${n.label}` : ""} — concerns {n.concerns}
              {n.date ? `, dated ${n.date}` : ""}. Reported by {integritySource(n.source)}, retrieved {n.retrievedAt.slice(0, 10)}.
              {href ? (
                <>
                  {" "}
                  <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    The notice ({n.noticeDoi})
                  </a>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Notice>
  );
}

/** A provider failure as it happened: the registered sentence, the reset time when there is one. Never "no results". */
export function ProviderFailure({ message, resetAt, title }: { message: string; resetAt?: Date | string | null; title?: string }) {
  const reset = resetSentence(resetAt ?? null);
  return (
    <Notice tone="brass" title={title}>
      {message}
      {reset ? ` ${reset}` : ""}
    </Notice>
  );
}
