import Link from "next/link";
import { listJobs } from "@corniversity/db/services/jobs-admin";
import { companionState, getPermissions, listAssets, listPairings, listResourceRequests, listSourceRegistry } from "@corniversity/db/services/library";
import { Badge, Card, EmptyState, LinkButton, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { AssetStatusBadge, FlashNotices, LibraryHeader, PermissionSummary, assetTitle } from "./shared";

export const metadata = { title: "Library" };

/**
 * The shelf: every item the owner holds here, its state (on the desktop only, quarantined,
 * confirmed, processing, ready, rejected) and the processing it is permitted. Verified sources
 * the catalogue rests on live under Sources; this page is about the owner's own files.
 */
export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ deleted?: string; error?: string }> }) {
  const session = await requireSession("/library");
  const { deleted, error } = await searchParams;
  const database = db();
  const ownerId = session.user.id;
  const [assets, pairings, registry, requests, jobs] = await Promise.all([
    listAssets(database, ownerId),
    listPairings(database, ownerId),
    listSourceRegistry(database),
    listResourceRequests(database, ownerId),
    listJobs(database, ownerId, 50),
  ]);
  const permissions = await Promise.all(assets.map((a) => getPermissions(database, ownerId, a.id)));
  const state = companionState(pairings);
  const running = jobs.filter((j) => j.status === "queued" || j.status === "active").length;
  const openRequests = requests.filter((r) => r.status === "open").length;
  const localOnly = assets.filter((a) => a.localOnly).length;
  const locators = registry.reduce((n, e) => n + e.locatorCount, 0);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <LibraryHeader
        title="Library"
        lede="Your shelf: what you hold here, in what state, and what may be done with it. Reference never implies permission to process; each item carries its own decisions."
        active="/library"
        sync={state}
      />
      <FlashNotices error={error} />
      {deleted ? (
        <div className="mb-4">
          <Notice tone="moss">Item deleted: original bytes, extracted text and index removed. Notes on it are kept and marked for repair.</Notice>
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-3">On the shelf</p>
          <p className="mt-1 text-2xl text-ink">{assets.length}</p>
          <p className="text-xs text-ink-3">{localOnly} on your desktop only</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-3">Verified sources</p>
          <p className="mt-1 text-2xl text-ink">{registry.length}</p>
          <p className="text-xs text-ink-3">
            {locators} pinned locations ·{" "}
            <Link href="/library/sources" className="text-brass underline underline-offset-4">
              registry
            </Link>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-3">Books to obtain</p>
          <p className="mt-1 text-2xl text-ink">{openRequests}</p>
          <p className="text-xs text-ink-3">
            open requests ·{" "}
            <Link href="/library/requests" className="text-brass underline underline-offset-4">
              list
            </Link>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-3">Jobs running</p>
          <p className="mt-1 text-2xl text-ink">{running}</p>
          <p className="text-xs text-ink-3">
            <Link href="/library/jobs" className="text-brass underline underline-offset-4">
              all jobs
            </Link>
          </p>
        </Card>
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

      {assets.length === 0 ? (
        <EmptyState
          title="Your shelf is empty"
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
                  <h2 className="text-lg text-ink">
                    <Link href={`/library/items/${asset.id}`} className="hover:underline">
                      {assetTitle(asset)}
                    </Link>
                  </h2>
                  <p className="text-sm text-ink-2">
                    {[asset.confirmedAuthors?.join(", ") ?? asset.candidateMetadata.author, asset.confirmedEdition, asset.pageCount ? `${asset.pageCount} pages` : null].filter(Boolean).join(" · ") || "Metadata not confirmed yet"}
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
                  {asset.status === "processed" ? <LinkButton href={`/library/read/${asset.id}`}>Read</LinkButton> : null}
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
