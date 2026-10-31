import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auditEvent } from "@corniversity/db/schema/index";
import { listCatalogue } from "@corniversity/db/services/catalogue";
import { latestIngestJob } from "@corniversity/db/services/jobs-admin";
import { companionState, getAsset, getPermissions, listPairings } from "@corniversity/db/services/library";
import { Badge, Button, Card, Field, Input, LinkButton, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { AutoRefresh } from "../../../sessions/[id]/AutoRefresh";
import { confirmMetadataAction, deleteAssetAction, requestIngestionAction, setPermissionAction } from "../../actions";
import { ASSET_STATUS, AssetStatusBadge, FlashNotices, LibraryHeader, PERMISSIONS, assetTitle } from "../../shared";

export const metadata = { title: "Library item" };

/**
 * One library item: what it is, where its bytes are, what may be done with it, and what has been
 * done. Metadata confirmation, each processing permission and the extraction request are separate
 * decisions, each recorded with its basis in the audit trail shown at the bottom.
 */
export default async function ItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireSession("/library");
  const { id } = await params;
  const flash = await searchParams;
  const database = db();
  const asset = await getAsset(database, session.user.id, id);
  if (!asset) notFound();
  const [permissions, pairings, catalogue, job, audit] = await Promise.all([
    getPermissions(database, session.user.id, asset.id),
    listPairings(database, session.user.id),
    listCatalogue(database),
    latestIngestJob(database, session.user.id, asset.id),
    database.select().from(auditEvent).where(eq(auditEvent.entityId, asset.id)).orderBy(desc(auditEvent.createdAt)).limit(12),
  ]);
  const title = assetTitle(asset);
  const courses = catalogue.filter((c) => c.course.launch || asset.courseIds.includes(c.course.id));
  const canProcess = Boolean(asset.storageKey) && (asset.status === "validated" || asset.status === "processed") && permissions.local_extract.status === "allowed";
  const processBlocker = !asset.storageKey
    ? asset.localOnly
      ? "The file is on your desktop only. Grant 'Store a private copy' below; the companion then sends it on its next sync."
      : "No bytes are stored for this item."
    : asset.status === "quarantined"
      ? "Confirm the metadata first."
      : asset.status === "processing"
        ? "Extraction is running."
        : asset.status === "rejected"
          ? asset.rejectionReason ?? "The file was rejected."
          : permissions.local_extract.status !== "allowed"
            ? "Allow 'Extract and index the text' first."
            : null;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <AutoRefresh active={asset.status === "processing" || asset.status === "upload_requested"} intervalMs={4000} />
      <LibraryHeader title={title} active="/library" sync={companionState(pairings)} />
      <FlashNotices error={flash.error} saved={flash.saved === "uploaded" ? undefined : flash.saved} />
      {flash.saved === "uploaded" ? <Notice tone="moss">Received and held in quarantine. Confirm what it is below.</Notice> : null}

      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <AssetStatusBadge status={asset.status} />
        {asset.localOnly ? <Badge tone="slate">Local only</Badge> : null}
        <Badge tone="neutral">{asset.origin.replace("_", " ")}</Badge>
        <span className="text-ink-3">
          {asset.filename} · {(asset.sizeBytes / 1_048_576).toFixed(2)} MB{asset.pageCount ? ` · ${asset.pageCount} pages` : ""} · sha256 {asset.sha256.slice(0, 12)}…
        </span>
      </div>
      <p className="mb-6 max-w-prose text-sm text-ink-2">{ASSET_STATUS[asset.status].help}</p>

      {asset.localOnly ? (
        <div className="mb-6">
          <Notice tone="slate" title="Reference only: nothing but metadata has left your device">
            This item was registered by the companion{asset.localPathHint ? ` from ${asset.localPathHint}` : ""}. No tutor or lecturer can read it, and the reading room cannot open it, until you grant private storage and it is uploaded. You can still cite it by hand in your notebook.
          </Notice>
        </div>
      ) : null}
      {asset.status === "rejected" ? (
        <div className="mb-6">
          <Notice tone="rust" title="Rejected">
            {asset.rejectionReason ?? "The file could not be processed."}
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card as="section" aria-labelledby="meta-heading">
          <h2 id="meta-heading" className="text-lg text-ink">
            What this is
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Pre-filled from the file where possible{asset.candidateMetadata.author ? ` (PDF author field: ${asset.candidateMetadata.author})` : ""}. Confirm it; a wrong title here becomes a wrong citation later.
          </p>
          <form action={confirmMetadataAction} className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="assetId" value={asset.id} />
            <Field label="Title" htmlFor="meta-title">
              <Input id="meta-title" name="title" required maxLength={300} defaultValue={asset.confirmedTitle ?? asset.candidateMetadata.title ?? ""} />
            </Field>
            <Field label="Authors (comma-separated)" htmlFor="meta-authors">
              <Input id="meta-authors" name="authors" maxLength={300} defaultValue={asset.confirmedAuthors?.join(", ") ?? asset.candidateMetadata.author ?? ""} />
            </Field>
            <Field label="Edition or year" htmlFor="meta-edition">
              <Input id="meta-edition" name="edition" maxLength={120} defaultValue={asset.confirmedEdition ?? ""} />
            </Field>
            <fieldset>
              <legend className="text-sm font-medium text-ink">Supports these courses</legend>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {courses.map((c) => (
                  <label key={c.course.id} className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" name="courseIds" value={c.course.id} defaultChecked={asset.courseIds.includes(c.course.id)} />
                    <span className="font-mono text-xs text-ink-3">{c.course.id}</span> {c.course.title}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <Button type="submit">Confirm metadata</Button>
            </div>
          </form>
        </Card>

        <Card as="section" aria-labelledby="perm-heading">
          <h2 id="perm-heading" className="text-lg text-ink">
            Processing permissions
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Each is a separate decision and defaults to unknown, which means reference only. Owning a copy does not settle what its licence permits; write the basis you are relying on.
          </p>
          <ul className="mt-4 flex flex-col gap-4">
            {PERMISSIONS.map((p) => {
              const current = permissions[p.action];
              return (
                <li key={p.action} className="border-t border-stone pt-3 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{p.label}</span>
                    <Badge tone={current.status === "allowed" ? "moss" : current.status === "denied" ? "rust" : "neutral"}>{current.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-2">{p.explain}</p>
                  {current.basis ? <p className="mt-1 text-xs text-ink-3">Basis: {current.basis}</p> : null}
                  <form action={setPermissionAction} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="assetId" value={asset.id} />
                    <input type="hidden" name="action" value={p.action} />
                    <div className="min-w-48 flex-1">
                      <label htmlFor={`basis-${p.action}`} className="sr-only">
                        Basis for {p.label}
                      </label>
                      <Input id={`basis-${p.action}`} name="basis" placeholder="Basis, e.g. CC BY-NC-SA 4.0, or my own notes" maxLength={300} defaultValue={current.basis ?? ""} />
                    </div>
                    <Button type="submit" name="status" value="allowed" variant="secondary">
                      Allow
                    </Button>
                    <Button type="submit" name="status" value="denied" variant="danger">
                      Deny
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card as="section" aria-labelledby="proc-heading">
          <h2 id="proc-heading" className="text-lg text-ink">
            Extraction and indexing
          </h2>
          {job ? (
            <div className="mt-2 text-sm">
              <p className="text-ink">
                Last job: <Badge tone={job.status === "completed" ? "moss" : job.status === "failed" ? "rust" : job.status === "cancelled" ? "neutral" : "brass"}>{job.status}</Badge>{" "}
                <span className="text-ink-3">
                  {job.progress.stage}
                  {typeof job.progress.percent === "number" ? ` · ${job.progress.percent}%` : ""}
                </span>
              </p>
              {job.error ? <p className="mt-1 text-rust">{job.error}</p> : null}
              <p className="mt-1 text-xs text-ink-3">
                Idempotency key <span className="font-mono">{job.idempotencyKey}</span> ·{" "}
                <Link href="/library/jobs" className="text-brass underline underline-offset-4">
                  all jobs
                </Link>
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-2">Not yet extracted.</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <form action={requestIngestionAction}>
              <input type="hidden" name="assetId" value={asset.id} />
              <Button type="submit" disabled={!canProcess}>
                {asset.status === "processed" ? "Re-extract and re-index" : "Extract and index"}
              </Button>
            </form>
            {asset.status === "processed" ? <LinkButton href={`/library/read/${asset.id}`}>Open in the reading room</LinkButton> : null}
          </div>
          {processBlocker ? <p className="mt-2 text-xs text-ink-3">{processBlocker}</p> : null}
          {asset.status === "processed" ? (
            <p className="mt-2 text-xs text-ink-3">
              {asset.pageCount} pages indexed{asset.printedLabelsPresent ? " with printed page labels" : "; the PDF carries no printed page labels, so citations use the physical page index"}.
              {asset.rejectionReason ? ` ${asset.rejectionReason}.` : ""}
            </p>
          ) : null}
        </Card>

        <Card as="section" aria-labelledby="audit-heading">
          <h2 id="audit-heading" className="text-lg text-ink">
            Record
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-2">
            {audit.map((e) => (
              <li key={e.id}>
                <span className="font-mono text-ink-3">{e.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span> · {e.actor} · {e.action}
                {typeof (e.details as { basis?: string }).basis === "string" ? ` — ${(e.details as { basis: string }).basis}` : ""}
              </li>
            ))}
            {audit.length === 0 ? <li>No events recorded.</li> : null}
          </ul>
          <form action={deleteAssetAction} className="mt-6 flex flex-wrap items-center gap-3 border-t border-stone pt-4">
            <input type="hidden" name="assetId" value={asset.id} />
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="confirm" value="1" /> Delete the stored original, extracted text and index
            </label>
            <Button type="submit" variant="danger">
              Delete item
            </Button>
          </form>
          <p className="mt-2 text-xs text-ink-3">Your notes on it stay, marked as needing repair. Nightly backups of the database may hold the bytes for their retention period; a provider that received passages keeps them under its own policy.</p>
        </Card>
      </div>
    </div>
  );
}
