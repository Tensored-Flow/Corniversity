import { companionState, getPermissions, listPairings, listStoredAssets } from "@corniversity/db/services/library";
import { listCollections } from "@corniversity/db/services/library-collections";
import { continueReading, documentsForWorks } from "@corniversity/db/services/library-home";
import { listWorks, type WorkListView } from "@corniversity/db/services/scholarly-works";
import Link from "next/link";
import { pageViewAvailable, textViewAvailable } from "@/components/reader/rules";
import { Badge, Button, Card, EmptyState, Input, LinkButton, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { savedPageNumber } from "./_collections/text";
import { readableByWork } from "./_collections/WorkLine";
import { ContinueReading } from "./_home/ContinueReading";
import { HomeCollections } from "./_home/HomeCollections";
import { SAVED_PAGE_SIZE, SavedPapers, VIEWS } from "./_home/SavedPapers";
import { AssetStatusBadge, assetTitle, FlashNotices, LibraryHeader, PermissionSummary } from "./shared";

export const metadata = { title: "Library" };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The Library home (contract §2), read from the database only: a find box, *Continue reading*,
 * the saved papers by view, shelves and trails, and the owner's files with their states (on the
 * desktop only, quarantined, confirmed, processing, ready, rejected) and the processing each is
 * permitted. Nothing here calls a provider; Discover and Find papers are a tab away.
 */
export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession("/library");
  const params = await searchParams;
  const deleted = one(params.deleted);
  const error = one(params.error);
  const viewParam = one(params.view);
  const view: WorkListView = VIEWS.some((v) => v.view === viewParam) ? (viewParam as WorkListView) : "saved";
  const page = savedPageNumber(one(params.page) ?? "");
  // A refusal of the shelf-or-trail form returns to that form (`at=new-collection`) and is shown there, in view,
  // with the kind and name the owner typed.
  const errorInCollections = one(params.at) === "new-collection" ? error : undefined;
  const typed = errorInCollections
    ? { kind: one(params.kind) === "trail" ? ("trail" as const) : ("shelf" as const), name: (one(params.name) ?? "").slice(0, 120) }
    : undefined;
  const database = db();
  const ownerId = session.user.id;
  const [assets, pairings, reading, works, collections] = await Promise.all([
    listStoredAssets(database, ownerId),
    listPairings(database, ownerId),
    continueReading(database, ownerId, 3),
    listWorks(database, ownerId, view, { limit: SAVED_PAGE_SIZE + 1, offset: (page - 1) * SAVED_PAGE_SIZE }),
    listCollections(database, ownerId),
  ]);
  const shown = works.slice(0, SAVED_PAGE_SIZE);
  const [permissions, documents] = await Promise.all([
    Promise.all(assets.map((a) => getPermissions(database, ownerId, a.id))),
    documentsForWorks(
      database,
      ownerId,
      shown.map((w) => w.work.id),
    ),
  ]);
  const state = companionState(pairings);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <LibraryHeader title="Library" lede="Your papers, shelves, trails and files." active="/library" sync={state} />
      <FlashNotices error={errorInCollections ? undefined : error} />
      {deleted ? (
        <div className="mb-4">
          <Notice tone="moss">
            Item deleted: original bytes, extracted text and index removed. Notes on it are kept and marked for repair.
          </Notice>
        </div>
      ) : null}

      <Card as="div" className="mb-6">
        <form method="get" action="/library/find" aria-label="Find papers" className="flex flex-col gap-1.5">
          <label htmlFor="home-find" className="text-sm font-medium text-ink">
            Find a paper: DOI, arXiv id, OpenAlex id, a link to one of them, or words
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="home-find" name="q" type="search" maxLength={2000} autoComplete="off" spellCheck={false} />
            <Button type="submit" className="shrink-0">
              Find
            </Button>
          </div>
        </form>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/library/find" className="text-brass underline underline-offset-4">
            Add a paper
          </Link>
          <Link href="/library/discover" className="text-brass underline underline-offset-4">
            Discover
          </Link>
          <Link href="/notebook?library=1" className="text-brass underline underline-offset-4">
            Library notes
          </Link>
        </p>
      </Card>

      <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <ContinueReading items={reading} />
          <SavedPapers
            view={view}
            page={page}
            items={shown}
            hasNext={works.length > SAVED_PAGE_SIZE}
            readable={readableByWork(documents)}
          />
        </div>
        <div className="min-w-0">
          <HomeCollections collections={collections} error={errorInCollections} typed={typed} />
        </div>
      </div>

      {state === "offline" ? (
        <div className="mb-6">
          <Notice tone="neutral" title="Desktop sync offline">
            No companion is running, so files on your desktop are not being watched. Items already stored here remain usable.{" "}
            <Link href="/library/sync" className="text-brass underline underline-offset-4">
              Pair or start the companion
            </Link>
            .
          </Notice>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl text-ink">Files</h2>
        <p className="flex flex-wrap gap-3 text-sm">
          <Link href="/library/upload" className="text-brass underline underline-offset-4">
            Upload
          </Link>
          <Link href="/library/sync" className="text-brass underline underline-offset-4">
            Desktop sync
          </Link>
          <Link href="/library/jobs" className="text-brass underline underline-offset-4">
            Jobs
          </Link>
        </p>
      </div>
      {assets.length === 0 ? (
        <EmptyState
          title="No files yet"
          body="Upload a file, pair your desktop so the companion registers what is in your inbox, or import an open source from the registry."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <LinkButton href="/library/upload">Upload a file</LinkButton>
              <LinkButton href="/library/sync" variant="secondary">
                Desktop sync
              </LinkButton>
              <LinkButton href="/library/sources" variant="secondary">
                Open sources
              </LinkButton>
            </div>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {assets.map((asset, index) => (
            <Card as="li" key={asset.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg text-ink">
                    <Link href={`/library/items/${asset.id}`} className="hover:underline">
                      {assetTitle(asset)}
                    </Link>
                  </h3>
                  <p className="text-sm text-ink-2">
                    {[
                      asset.confirmedAuthors?.join(", ") ?? asset.candidateMetadata.author,
                      asset.confirmedEdition,
                      asset.pageCount ? `${asset.pageCount} pages` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Metadata not confirmed yet"}
                  </p>
                  <p className="mt-1 truncate text-xs text-ink-3">
                    {asset.filename} · {asset.origin.replace("_", " ")}
                    {asset.courseIds.length ? ` · ${asset.courseIds.join(", ")}` : " · no course yet"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AssetStatusBadge status={asset.status} />
                  {asset.localOnly ? <Badge tone="slate">Local only</Badge> : null}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <PermissionSummary permissions={permissions[index]!} />
                <div className="flex gap-2">
                  <LinkButton href={`/library/items/${asset.id}`} variant="secondary">
                    Details
                  </LinkButton>
                  {pageViewAvailable(asset) || textViewAvailable(asset) ? (
                    <LinkButton href={`/library/read/${asset.id}`}>Read</LinkButton>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
