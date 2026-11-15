"use client";
import Link from "next/link";
import type { ReaderDocumentInfo } from "./info";

/**
 * The reader's Paper panel: what the paper is, which exact version is open, its identifiers and a
 * link to the paper page. Everything a provider reported is plain text here, labelled with who
 * reported it and when; recorded fixture data says so.
 */
export function PaperPanel({ info, title }: { info: ReaderDocumentInfo; title: string }) {
  const { paper, version } = info;
  return (
    <div className="flex flex-col gap-4 text-sm">
      {paper ? (
        <section aria-label="Paper" className="flex flex-col gap-1">
          <p className="font-display text-base text-ink">{paper.title ?? "Title not reported yet"}</p>
          {paper.authors.length ? <p className="text-ink-2">{paper.authors.join(", ")}</p> : null}
          {paper.year || paper.venue ? <p className="text-ink-2">{[paper.year, paper.venue].filter(Boolean).join(" · ")}</p> : null}
          <p className="text-xs text-ink-3">
            {paper.fixture ? (
              <span className="mr-1 rounded-full border border-slate/30 bg-slate-soft px-2 py-0.5 font-medium text-slate">
                Fixture data
              </span>
            ) : null}
            {paper.sources.length
              ? `Details as reported by ${paper.sources.map((s) => (s.day ? `${s.name} on ${s.day}` : s.name)).join(", ")}.`
              : "No provider has reported details yet."}
          </p>
          <Link href={paper.href} className="mt-1 inline-flex min-h-6 items-center self-start text-brass underline underline-offset-4">
            Paper page
          </Link>
        </section>
      ) : (
        <section aria-label="Item" className="flex flex-col gap-1">
          <p className="font-display text-base text-ink">{title}</p>
          <p className="text-ink-2">{info.item.filename}</p>
          <Link href={info.item.href} className="mt-1 inline-flex min-h-6 items-center self-start text-brass underline underline-offset-4">
            Item page
          </Link>
        </section>
      )}

      {version ? (
        <section aria-labelledby="paper-version" className="flex flex-col gap-1 border-t border-stone pt-3">
          <h3 id="paper-version" className="text-sm font-medium text-ink">
            Version
          </h3>
          <p className="text-ink">
            {version.label}
            {version.date ? <span className="text-ink-3"> · {version.date}</span> : null}
          </p>
          {version.withdrawn ? <p className="text-rust">Withdrawn on arXiv</p> : null}
          {version.licence ? (
            <p className="text-ink-2">
              Licence: {version.licence.name} <span className="text-ink-3">({version.licence.attribution})</span>
            </p>
          ) : null}
          {version.withdrawnLater.map((v) => (
            <p key={v.version} className="text-ink-2">
              {v.label}: Withdrawn on arXiv
            </p>
          ))}
        </section>
      ) : null}

      {paper?.identifiers.length ? (
        <section aria-labelledby="paper-identifiers" className="flex flex-col gap-1 border-t border-stone pt-3">
          <h3 id="paper-identifiers" className="text-sm font-medium text-ink">
            Identifiers
          </h3>
          <ul className="flex flex-col gap-0.5">
            {paper.identifiers.map((id) => (
              <li key={`${id.label}:${id.value}`} className="break-all">
                <span className="text-ink-3">{id.label}</span>{" "}
                {id.href ? (
                  <a href={id.href} target="_blank" rel="noopener noreferrer" className="text-brass underline underline-offset-4">
                    {id.value}
                  </a>
                ) : (
                  <span className="text-ink">{id.value}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
