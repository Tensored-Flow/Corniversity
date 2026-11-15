import { scholarlyRecordFromCrossref, scholarlyRecordFromOpenAlex } from "@corniversity/db/scholarly/records";
import type { OpenAlexWorkRecord } from "@corniversity/db/scholarly/types";
import { type PaperPreview, previewIdentifier, previewPaper } from "@corniversity/db/services/paper-lists";
import { ScholarlyError } from "@corniversity/db/services/scholarly-works";
import Link from "next/link";
import { redirect } from "next/navigation";
import { scholarly } from "@/components/scholarly/client";
import { displayIdentifier, locationLabel, paperHref, resetSentence } from "@/components/scholarly/format";
import { paperFromRecord } from "@/components/scholarly/model";
import { PaperView, ProviderFailure } from "@/components/scholarly/PaperView";
import { saveWorkAction } from "@/components/scholarly/save-action";
import { Button, Card, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { FlashNotices, LibraryHeader } from "../../../shared";

export const metadata = { title: "Paper preview" };

/** The identifier in the address: segments joined (DOIs and old arXiv ids contain slashes), percent-decoding tolerated. */
function identifierValue(segments: string[]): string {
  const joined = segments.join("/");
  try {
    return decodeURIComponent(joined);
  } catch {
    return joined;
  }
}

/**
 * The preview of a paper that is not in the library (`scheme` doi, arxiv or openalex; the value may
 * contain slashes). When the owner has the paper it opens the paper page. Otherwise the provider's
 * record (through the provider cache) in PaperView, with Save to library; for an arXiv id OpenAlex
 * did not answer for, that fact and Save, which creates the paper and queues its arXiv record.
 */
export default async function PaperPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ scheme: string; value: string[] }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession("/library/find");
  const { scheme, value } = await params;
  const { error } = await searchParams;
  const raw = identifierValue(value);
  let preview: PaperPreview | null = null;
  let failure: { message: string; resetAt: Date | null } | null = null;
  let ref: { scheme: string; value: string } | null = null;
  try {
    ref = previewIdentifier(scheme, raw);
    preview = await previewPaper(db(), session.user.id, scholarly(), scheme, raw);
  } catch (caught) {
    if (!(caught instanceof ScholarlyError)) throw caught;
    failure = { message: caught.message, resetAt: caught.details.resetAt ?? null };
  }
  if (preview?.kind === "owned") redirect(paperHref(preview.workId));

  const heading =
    preview?.kind === "openalex"
      ? (preview.record.title ?? "Untitled (no title reported)")
      : preview?.kind === "crossref"
        ? (preview.work.title ?? "Untitled (no title reported)")
        : ref
          ? displayIdentifier(ref.scheme, ref.value)
          : "Paper preview";
  const save = ref ? <SaveForm scheme={ref.scheme} value={ref.value} /> : null;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <LibraryHeader title={heading} active="/library/find" />
      <p className="mb-4 text-sm">
        <Link href="/library/find" className="text-brass underline underline-offset-4">
          Back to Find papers
        </Link>
      </p>
      <FlashNotices error={error} />
      {failure ? (
        <div className="flex flex-col gap-4">
          <ProviderFailure message={failure.message} resetAt={failure.resetAt} />
        </div>
      ) : null}
      {preview?.kind === "openalex" ? (
        <PaperView
          paper={paperFromRecord(scholarlyRecordFromOpenAlex(preview.record))}
          mode="preview"
          citedBy={
            preview.record.citedByCount !== null
              ? {
                  count: preview.record.citedByCount,
                  retrievedAt: preview.record.provenance.retrievedAt,
                  fixture: preview.record.provenance.source === "fixture",
                }
              : null
          }
          actions={
            <div className="flex flex-col gap-3">
              {preview.merged ? (
                <p className="text-sm text-ink-2">
                  OpenAlex now lists this work as {preview.record.openalexId} (it merged the record you asked for).
                </p>
              ) : null}
              {save}
              <OpenLocation record={preview.record} />
            </div>
          }
        />
      ) : null}
      {preview?.kind === "crossref" ? (
        <PaperView
          paper={paperFromRecord(scholarlyRecordFromCrossref(preview.work))}
          mode="preview"
          actions={
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-2">OpenAlex has no record of this DOI; this is Crossref's record of it.</p>
              {save}
            </div>
          }
        />
      ) : null}
      {preview?.kind === "arxiv_only" ? (
        <Card>
          <Notice tone="slate" title={`OpenAlex did not describe arXiv:${preview.arxivId}`}>
            {preview.reason}
            {resetSentence(preview.resetAt) ? ` ${resetSentence(preview.resetAt)}` : ""}
          </Notice>
          <p className="mt-3 max-w-prose text-sm text-ink-2">
            Saving creates the paper from its arXiv id alone. Its title, authors, versions and licences arrive from arXiv's record, which
            the server fetches next; nothing is shown here that arXiv has not reported.
          </p>
          <div className="mt-4">{save}</div>
        </Card>
      ) : null}
    </div>
  );
}

function SaveForm({ scheme, value }: { scheme: string; value: string }) {
  return (
    <form action={saveWorkAction}>
      <input type="hidden" name="scheme" value={scheme} />
      <input type="hidden" name="value" value={value} />
      <Button type="submit">Save to library</Button>
    </form>
  );
}

/** Where OpenAlex says the paper is free to read (host and version named); opened in a new tab. */
function OpenLocation({ record }: { record: OpenAlexWorkRecord }) {
  const location = record.bestOaLocation;
  const href = location ? (location.pdfUrl ?? location.landingPageUrl) : null;
  if (!location || !href) return <p className="text-xs text-ink-3">OpenAlex reports no free-to-read copy.</p>;
  return (
    <p className="text-sm text-ink-2">
      Free to read according to OpenAlex:{" "}
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-brass underline underline-offset-4">
        {locationLabel(location)}
      </a>
    </p>
  );
}
