import { getCourseDetail } from "@corniversity/db/services/catalogue";
import {
  companionState,
  getAsset,
  getPage,
  getReadingProgress,
  isAllowed,
  listAnnotations,
  listPairings,
  searchAsset,
  tableOfContents,
} from "@corniversity/db/services/library";
import { latestConversationForAsset, listMessages } from "@corniversity/db/services/tutoring";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiLabel } from "@/components/AiLabel";
import { Markdown } from "@/components/Markdown";
import { RenderedHtml } from "@/components/RenderedHtml";
import { Badge, Button, Card, LinkButton, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { producerLabels } from "@/lib/producers";
import { requireSession } from "@/lib/session";
import { deleteAnnotationAction, saveAnnotationAction } from "../../actions";
import { assetTitle, FlashNotices, LibraryHeader } from "../../shared";
import { ProgressSaver } from "./ProgressSaver";
import { ReaderTools } from "./ReaderTools";

export const metadata = { title: "Reading room" };

/**
 * The reading room: table of contents from detected headings, page jump, search within the
 * item, the page's extracted text with quality flags, the original PDF at the same page, notes
 * anchored to a locator, and passage questions that the server permits or refuses explicitly.
 */
export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string; error?: string; saved?: string }>;
}) {
  const session = await requireSession("/library");
  const { id } = await params;
  const query = await searchParams;
  const database = db();
  const ownerId = session.user.id;
  const asset = await getAsset(database, ownerId, id);
  if (!asset) notFound();
  const pairings = await listPairings(database, ownerId);
  const title = assetTitle(asset);

  if (asset.status !== "processed" || !asset.pageCount) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <LibraryHeader title={title} active="/library" sync={companionState(pairings)} />
        <Notice tone="neutral" title={asset.localOnly ? "This item is on your desktop only" : "Not readable yet"}>
          {asset.localOnly
            ? "Its contents have never left your device, so there is nothing to show here. Read it locally, or grant private storage and extraction on the item page."
            : "The text has not been extracted. Confirm the metadata and allow extraction on the item page."}
        </Notice>
        <div className="mt-4">
          <LinkButton href={`/library/items/${asset.id}`} variant="secondary">
            Item page
          </LinkButton>
        </div>
      </div>
    );
  }

  const remembered = await getReadingProgress(database, ownerId, asset.id);
  const requested = Number(query.page);
  const physicalIndex = Math.min(
    asset.pageCount - 1,
    Math.max(0, Number.isFinite(requested) && requested >= 1 ? requested - 1 : remembered),
  );
  const [page, toc, annotations, hits, conversation] = await Promise.all([
    getPage(database, asset.id, physicalIndex),
    tableOfContents(database, asset.id),
    listAnnotations(database, ownerId, asset.id),
    query.q ? searchAsset(database, asset.id, query.q, 20) : Promise.resolve([]),
    latestConversationForAsset(database, ownerId, asset.id),
  ]);
  if (!page) notFound();
  const pageLabel = page.printedLabel ? `p. ${page.printedLabel}` : `PDF page ${physicalIndex + 1}`;
  const externalAi = await isAllowed(database, ownerId, asset.id, "external_ai");
  let personaName = "the reading-room lecturer";
  for (const courseId of asset.courseIds) {
    const detail = await getCourseDetail(database, courseId);
    if (detail?.tutor) {
      personaName = detail.tutor.name;
      break;
    }
  }
  const messages = conversation ? await listMessages(database, conversation.id) : [];
  const producedBy = await producerLabels(
    database,
    messages.slice(-6).map((m) => m.providerRunId),
  );
  const rendered = await Promise.all(
    messages.slice(-6).map(async (m) => ({
      id: m.id,
      sender: m.sender,
      producedBy: producedBy(m.providerRunId),
      html: await renderMarkdown(m.contentMarkdown),
      citations: m.citations,
      labels: m.labels,
      uncited: m.uncitedClaims.length,
    })),
  );
  const pageAnnotations = annotations.filter((a) => a.locator.kind === "pdf" && a.locator.physicalPageIndex === physicalIndex);
  const needsRepair = annotations.filter((a) => a.mappingStatus === "needs_repair");
  const href = (index: number) => `/library/read/${asset.id}?page=${index + 1}${query.q ? `&q=${encodeURIComponent(query.q)}` : ""}`;

  return (
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
          {page.printedLabel ? <Badge tone="brass">printed p. {page.printedLabel}</Badge> : <Badge tone="neutral">no printed label</Badge>}
          <Link href={`/library/items/${asset.id}`} className="text-brass underline underline-offset-4">
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
          <form method="get" className="flex items-center gap-2">
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
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr_320px]">
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
              personaName={personaName}
              ask={
                externalAi
                  ? { allowed: true }
                  : {
                      allowed: false,
                      reason: `External AI processing is not permitted for this item, so nothing from it is sent to a model and no tutor can discuss it. Allow it on the item page if the licence permits.`,
                    }
              }
              saveAnnotation={saveAnnotationAction}
            />
            {rendered.length ? (
              <div className="mt-4 flex flex-col gap-2 border-t border-stone pt-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-ink">Recent answers</h3>
                  <AiLabel kind="lecturer" />
                </div>
                {rendered.map((m) => (
                  <div
                    key={m.id}
                    className={[
                      "rounded-[var(--radius-panel)] px-3 py-2 text-sm",
                      m.sender === "learner" ? "border border-stone bg-paper" : "border border-stone bg-paper-3/60",
                    ].join(" ")}
                  >
                    <p className="mb-1 text-[0.65rem] uppercase tracking-wide text-ink-3">
                      {m.sender === "learner" ? "You" : `${personaName}${m.producedBy ? ` · ${m.producedBy}` : ""}`}
                    </p>
                    <RenderedHtml html={m.html} className="text-sm" />
                    {m.sender === "persona" ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.labels.map((l) => (
                          <Badge key={l} tone={l === "source_backed" ? "moss" : l === "needs_checking" ? "rust" : "neutral"}>
                            {l.replace("_", " ")}
                          </Badge>
                        ))}
                        {m.citations.map((c) => (
                          <span key={c.tag} className="text-[0.7rem] text-ink-3">
                            {c.tag}: {c.label}
                          </span>
                        ))}
                        {m.uncited > 0 ? <Badge tone="rust">{m.uncited} unverifiable citation removed</Badge> : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </Card>

          <Card as="div">
            <h3 className="text-sm font-medium text-ink">Notes on this page</h3>
            {pageAnnotations.length === 0 ? <p className="mt-1 text-xs text-ink-3">None yet.</p> : null}
            <ul className="mt-2 flex flex-col gap-3">
              {pageAnnotations.map((a) => (
                <li key={a.id} className="text-sm">
                  {a.selectedText ? (
                    <blockquote className="border-l-2 border-stone-2 pl-2 text-xs text-ink-3">{a.selectedText.slice(0, 240)}</blockquote>
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
  );
}
