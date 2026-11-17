import { companionState, getPage, listPairings, searchAsset, tableOfContents } from "@corniversity/db/services/library";
import { readerDocument } from "@corniversity/db/services/reader";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAnnotationAction, saveAnnotationAction } from "@/app/(app)/library/actions";
import { assetTitle, FlashNotices, LibraryHeader } from "@/app/(app)/library/shared";
import { Markdown } from "@/components/Markdown";
import { toReaderAnnotations } from "@/components/reader/annotation-data";
import { CompanionPageView } from "@/components/reader/CompanionPageView";
import { documentInfo } from "@/components/reader/document-info";
import {
  chooseView,
  firstParam,
  formatMegabytes,
  isLargeDocument,
  pageViewAvailable,
  requestedPage,
  textViewAvailable,
} from "@/components/reader/rules";
import { Badge, Button, Card, LinkButton, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { errorNotice } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import {
  companionAnswerAction,
  companionPermissionAction,
  keepNotesOnNewFileAction,
  markOpenedAction,
  openArxivVersionAction,
  reportObservedHashAction,
} from "./actions";
import { askPanelData } from "./companion-data";
import { ProgressSaver } from "./ProgressSaver";
import { ReaderTools } from "./ReaderTools";

const companionActions = { setPermission: companionPermissionAction, latestAnswer: companionAnswerAction };

export const metadata = { title: "Reading room" };

const barLink =
  "inline-flex items-center justify-center rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2.5 py-1 text-sm text-ink hover:bg-paper-3";

/** The Text view's compact bar: back, the title (the page's heading follows below) and the switch to the pages. */
function TextBar({
  backHref,
  backLabel,
  title,
  pageSwitch,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  pageSwitch: { href: string; label: string } | null;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-stone bg-paper-2 px-3 py-2 sm:px-4">
      <Link href={backHref} className={barLink}>
        {backLabel}
      </Link>
      <p className="min-w-0 flex-1 truncate font-display text-base text-ink sm:text-lg" title={title}>
        {title}
      </p>
      {pageSwitch ? (
        <Link href={pageSwitch.href} className={barLink}>
          {pageSwitch.label}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Without JavaScript the Page view cannot start (PDF.js runs in the browser), so instead of its loading
 * status this says so and offers the ways on: back, the Text view where the text is extracted, and the
 * original (the owner's stored file, or the version's abstract page on arXiv). Plain links only: nothing
 * inside a noscript element is hydrated.
 */
function PageViewWithoutScript({
  backHref,
  backLabel,
  textHref,
  original,
}: {
  backHref: string;
  backLabel: string;
  textHref: string | null;
  original: { href: string; label: string; external: boolean } | null;
}) {
  return (
    <noscript>
      <style>{"[data-reader-loading]{display:none}"}</style>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="text-2xl text-ink">The Page view needs JavaScript</h1>
          <p className="mt-2 text-sm text-ink-2">JavaScript is off in this browser, so the pages cannot be shown here.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={backHref} className={barLink}>
              {backLabel}
            </a>
            {textHref ? (
              <a href={textHref} className={barLink}>
                Text view
              </a>
            ) : null}
            {original ? (
              <a href={original.href} className={barLink} rel={original.external ? "noopener noreferrer" : undefined}>
                {original.label}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </noscript>
  );
}

/**
 * The reading room. Page view (the default for a stored PDF that passed validation) shows the
 * original pages with PDF.js. Text view keeps the extracted-text reading room: table of contents
 * from detected headings, page jump, search within the item, the page's extracted text with
 * quality flags, the original PDF at the same page and notes anchored to a locator. Both views carry
 * the reading companion's *Ask* panel (contract §8), closed until the owner opens it; the server
 * permits or refuses each request explicitly. `?view=page|text` chooses; `?page=N`
 * (1-based physical page) overrides the remembered position in both, and switching carries it.
 * Large Documents open in Text view when their text is extracted. A paper read from arxiv.org opens
 * only in Page view: the owner's browser fetches arXiv's file, and nothing of it is stored here.
 * Arriving never saves the position, in either view; the reader saves only after the owner moves.
 */
export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession("/library");
  const { id } = await params;
  const raw = await searchParams;
  // A repeated parameter arrives as an array; the first value counts.
  const query = {
    page: firstParam(raw.page),
    q: firstParam(raw.q),
    error: firstParam(raw.error),
    saved: firstParam(raw.saved),
    view: firstParam(raw.view),
  };
  const database = db();
  const ownerId = session.user.id;
  const doc = await readerDocument(database, ownerId, id);
  if (!doc) notFound();
  const { asset } = doc;
  const title = doc.work?.title ?? assetTitle(asset);
  // A paper's file goes back to its paper page (built by the find stream); any other file to its item.
  const backHref = doc.work ? `/library/papers/${doc.work.id}` : `/library/items/${asset.id}`;
  const backLabel = doc.work ? "Back to paper" : "Back";
  const linked = asset.status === "linked_remote";
  const pageAvailable = linked ? doc.arxiv !== null : pageViewAvailable(asset);
  const textAvailable = textViewAvailable(asset);
  const view = chooseView({ requested: query.view, pageAvailable, textAvailable, sizeBytes: asset.sizeBytes, pageCount: asset.pageCount });
  const remembered = doc.position?.physicalIndex ?? 0;
  const requested = requestedPage(query.page);
  const pageSwitch = (pageNumber: number) =>
    pageAvailable
      ? {
          href: `/library/read/${asset.id}?view=page&page=${pageNumber}`,
          label: isLargeDocument(asset.sizeBytes, asset.pageCount) ? `Open page view (${formatMegabytes(asset.sizeBytes)})` : "Page view",
        }
      : null;

  if (view === "page") {
    const [toc, annotations, companion] = await Promise.all([
      textAvailable ? tableOfContents(database, asset.id) : Promise.resolve([]),
      toReaderAnnotations(doc.annotations),
      askPanelData(database, ownerId, asset.id),
    ]);
    if (!companion) notFound();
    const info = documentInfo(doc);
    const startPage = requested ?? remembered + 1;
    return (
      <>
        <PageViewWithoutScript
          backHref={backHref}
          backLabel={backLabel}
          textHref={textAvailable ? `/library/read/${asset.id}?view=text&page=${startPage}` : null}
          original={
            linked
              ? info.version?.arxiv
                ? { href: info.version.arxiv.absUrl, label: "Abstract page on arXiv", external: true }
                : null
              : { href: `/api/library/assets/${asset.id}/file#page=${startPage}`, label: "Open the original PDF", external: false }
          }
        />
        <CompanionPageView
          companion={companion}
          companionActions={companionActions}
          assetId={asset.id}
          title={title}
          source={
            linked && doc.arxiv
              ? { kind: "arxiv", id: doc.arxiv.id, version: doc.arxiv.version }
              : { kind: "stored", url: `/api/library/assets/${asset.id}/file` }
          }
          initialPage={startPage}
          pageRequested={requested !== null}
          // ?page=N chooses the page and opens at its top; otherwise the remembered place inside the page.
          initialPosition={requested === null ? (doc.position?.position ?? null) : null}
          headings={toc.map((entry) => ({ physicalIndex: entry.physicalIndex, printedLabel: entry.printedLabel, heading: entry.heading }))}
          backHref={backHref}
          backLabel={backLabel}
          textHref={textAvailable ? `/library/read/${asset.id}?view=text` : null}
          info={info}
          annotations={annotations}
          notice={errorNotice(query.error)}
          actions={{
            markOpened: markOpenedAction,
            reportObservedHash: reportObservedHashAction,
            keepNotesOnNewFile: keepNotesOnNewFileAction,
            openArxivVersion: openArxivVersionAction,
          }}
        />
      </>
    );
  }

  const pairings = await listPairings(database, ownerId);

  if (view === "unavailable" || !asset.pageCount) {
    const openPages = pageSwitch(requested ?? remembered + 1);
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto w-full max-w-3xl">
          <LibraryHeader title={title} active="/library" sync={companionState(pairings)} />
          <Notice
            tone="neutral"
            title={asset.localOnly ? "This item is on your desktop only" : linked ? "No Text view for this paper" : "Not readable yet"}
          >
            {asset.localOnly
              ? "Its contents have never left your device, so there is nothing to show here. Read it locally, or grant private storage and extraction on the item page."
              : linked
                ? "This paper is read from arxiv.org in the Page view; it has no extracted text here."
                : "The text has not been extracted. Confirm the metadata and allow extraction on the item page."}
          </Notice>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href={backHref} variant="secondary">
              {doc.work ? "Paper page" : "Item page"}
            </LinkButton>
            {openPages ? (
              <LinkButton href={openPages.href} variant="secondary">
                {openPages.label}
              </LinkButton>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const physicalIndex = Math.min(asset.pageCount - 1, Math.max(0, requested !== null ? requested - 1 : remembered));
  const annotations = doc.annotations;
  const [page, toc, hits, companion] = await Promise.all([
    getPage(database, asset.id, physicalIndex),
    tableOfContents(database, asset.id),
    query.q ? searchAsset(database, asset.id, query.q, 20) : Promise.resolve([]),
    askPanelData(database, ownerId, asset.id),
  ]);
  if (!page || !companion) notFound();
  const pageLabel = page.printedLabel ? `p. ${page.printedLabel}` : `PDF page ${physicalIndex + 1}`;
  const pageAnnotations = annotations.filter((a) => a.locator.kind === "pdf" && a.locator.physicalPageIndex === physicalIndex);
  const needsRepair = annotations.filter((a) => a.mappingStatus === "needs_repair");
  // Text view links keep the view, so moving between pages never switches to the pages.
  const href = (index: number) =>
    `/library/read/${asset.id}?page=${index + 1}&view=text${query.q ? `&q=${encodeURIComponent(query.q)}` : ""}`;

  return (
    <>
      <TextBar backHref={backHref} backLabel={backLabel} title={title} pageSwitch={pageSwitch(physicalIndex + 1)} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto w-full max-w-7xl">
          <ProgressSaver assetId={asset.id} physicalIndex={physicalIndex} />
          <LibraryHeader title={title} active="/library" sync={companionState(pairings)} />
          <FlashNotices error={query.error} saved={query.saved} />
          {needsRepair.length ? (
            <div className="mb-4">
              <Notice tone="brass" title={`${needsRepair.length} note(s) need repair`}>
                Their anchors no longer match this version of the text after re-extraction. They are listed in the notes panel with their
                original page; they were not moved automatically.
              </Notice>
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
              <span>
                PDF page {physicalIndex + 1} of {asset.pageCount}
              </span>
              {page.printedLabel ? (
                <Badge tone="brass">printed p. {page.printedLabel}</Badge>
              ) : (
                <Badge tone="neutral">no printed label</Badge>
              )}
              <Link
                href={`/library/items/${asset.id}`}
                className="inline-flex min-h-6 items-center text-brass underline underline-offset-4"
              >
                item page
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {physicalIndex > 0 ? (
                <LinkButton href={href(physicalIndex - 1)} variant="secondary">
                  Previous
                </LinkButton>
              ) : null}
              {physicalIndex + 1 < asset.pageCount ? (
                <LinkButton href={href(physicalIndex + 1)} variant="secondary">
                  Next
                </LinkButton>
              ) : null}
              {/* A client navigation (next/form), so the page it opens counts as the owner's move and is remembered. */}
              <Form action="" prefetch={false} className="flex items-center gap-2">
                <input type="hidden" name="view" value="text" />
                {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
                <label htmlFor="jump" className="text-sm text-ink-2">
                  Go to PDF page
                </label>
                <input
                  id="jump"
                  name="page"
                  type="number"
                  min={1}
                  max={asset.pageCount}
                  defaultValue={physicalIndex + 1}
                  className="w-20 rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
                />
                <Button type="submit" variant="secondary">
                  Go
                </Button>
              </Form>
            </div>
          </div>

          {/* One bounded column below lg (minmax(0, 1fr)), so a long contents entry is cut off instead of widening the page. */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr_320px]">
            <aside className="order-2 lg:order-1">
              <Card as="div">
                <h2 className="text-sm font-medium text-ink">Contents</h2>
                {toc.length === 0 ? (
                  <p className="mt-2 text-xs text-ink-3">No headings were detected in the extracted text; use page jump and search.</p>
                ) : (
                  <ul className="mt-2 max-h-[60vh] overflow-y-auto text-sm">
                    {toc.map((entry, i) => (
                      <li key={`${entry.physicalIndex}-${i}`}>
                        <Link
                          href={href(entry.physicalIndex)}
                          className={[
                            "block truncate py-0.5",
                            entry.physicalIndex === physicalIndex ? "text-ink" : "text-ink-2 hover:text-ink",
                          ].join(" ")}
                        >
                          <span className="text-ink-3">{entry.printedLabel ?? entry.physicalIndex + 1}</span> {entry.heading}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </aside>

            <section aria-label="Reading" className="order-1 lg:order-2">
              <Card as="article">
                {page.quality.scannedSuspected ? (
                  <div className="mb-3">
                    <Notice tone="rust" title="This page looks scanned">
                      Little native text was found and OCR was not run, so the text below is unreliable. Use the original view instead.
                    </Notice>
                  </div>
                ) : page.quality.lowText ? (
                  <div className="mb-3">
                    <Notice tone="neutral">Little text on this page (a figure, title page or sparse content).</Notice>
                  </div>
                ) : null}
                {asset.mediaType === "application/pdf" ? (
                  <p className="mb-3 text-xs text-ink-3">
                    Extracted text; mathematical notation may be missing. The Page view shows the original.
                  </p>
                ) : null}
                <div id="page-text" className="reading-text whitespace-pre-wrap font-serif text-[1.02rem] leading-relaxed text-ink">
                  {page.text || "(no text on this page)"}
                </div>
                {asset.mediaType === "application/pdf" ? (
                  <p className="mt-4 text-xs text-ink-3">
                    <a
                      href={`/api/library/assets/${asset.id}/file#page=${physicalIndex + 1}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brass underline underline-offset-4"
                    >
                      Open the original PDF at this page
                    </a>{" "}
                    (private; your session only)
                  </p>
                ) : null}
              </Card>
            </section>

            <aside className="order-3 flex flex-col gap-4">
              <Card as="div">
                <form method="get" className="flex flex-col gap-2">
                  <input type="hidden" name="view" value="text" />
                  <label htmlFor="search" className="text-sm font-medium text-ink">
                    Search this item
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="search"
                      name="q"
                      defaultValue={query.q ?? ""}
                      className="w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-3 py-1.5 text-sm text-ink"
                      placeholder="e.g. Cauchy sequence"
                    />
                    <Button type="submit" variant="secondary">
                      Search
                    </Button>
                  </div>
                </form>
                {query.q ? (
                  hits.length === 0 ? (
                    <p className="mt-2 text-xs text-ink-3">No pages match “{query.q}”.</p>
                  ) : (
                    <ul className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto text-sm">
                      {hits.map((hit) => (
                        <li key={hit.physical_index}>
                          <Link href={href(hit.physical_index)} className="text-brass underline underline-offset-4">
                            {hit.printed_label ? `p. ${hit.printed_label}` : `PDF page ${hit.physical_index + 1}`}
                          </Link>
                          <p className="text-xs text-ink-2">
                            {hit.snippet
                              .split(/\[\[|\]\]/)
                              .map((part, i) =>
                                i % 2 === 1 ? (
                                  <mark key={`${hit.physical_index}-${i}`}>{part}</mark>
                                ) : (
                                  <span key={`${hit.physical_index}-${i}`}>{part}</span>
                                ),
                              )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </Card>

              <Card as="div">
                <ReaderTools
                  assetId={asset.id}
                  physicalIndex={physicalIndex}
                  pageLabel={pageLabel}
                  saveAnnotation={saveAnnotationAction}
                  companion={companion}
                  companionActions={companionActions}
                />
              </Card>

              <Card as="div">
                <h3 className="text-sm font-medium text-ink">Notes on this page</h3>
                {pageAnnotations.length === 0 ? <p className="mt-1 text-xs text-ink-3">None yet.</p> : null}
                <ul className="mt-2 flex flex-col gap-3">
                  {pageAnnotations.map((a) => (
                    <li key={a.id} className="text-sm">
                      {a.selectedText ? (
                        <blockquote className="border-l-2 border-stone-2 pl-2 text-xs text-ink-3">
                          {a.selectedText.slice(0, 240)}
                        </blockquote>
                      ) : null}
                      <Markdown source={a.noteMarkdown} className="text-sm" />
                      <form action={deleteAnnotationAction} className="mt-1">
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="assetId" value={asset.id} />
                        <Button type="submit" variant="quiet">
                          Delete note
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
                {needsRepair.length ? (
                  <div className="mt-3 border-t border-stone pt-2">
                    <h4 className="text-xs font-medium uppercase tracking-wide text-ink-3">Needs repair</h4>
                    <ul className="mt-1 flex flex-col gap-1 text-xs text-ink-2">
                      {needsRepair.map((a) => (
                        <li key={a.id}>
                          {a.locator.kind === "pdf" ? (
                            <Link
                              href={href(Math.min(asset.pageCount! - 1, a.locator.physicalPageIndex))}
                              className="text-brass underline underline-offset-4"
                            >
                              originally PDF page {a.locator.physicalPageIndex + 1}
                            </Link>
                          ) : null}{" "}
                          — {a.noteMarkdown.slice(0, 80)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Card>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
