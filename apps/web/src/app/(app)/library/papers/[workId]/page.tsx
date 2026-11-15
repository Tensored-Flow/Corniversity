import { arxivAbsUrl, classifyLicence, isArxivDoi, licenceAttribution, storageDecision } from "@corniversity/core";
import { getEnv } from "@corniversity/db/env";
import { isUuid } from "@corniversity/db/ids";
import { type CollectionMembership, collectionsForWork, listCollections } from "@corniversity/db/services/library-collections";
import { openAlexRecordForWork, type WorkRecordResult } from "@corniversity/db/services/paper-lists";
import {
  type DocumentJob,
  getWork,
  possibleDuplicates,
  resolveWorkId,
  type VersionRow,
  type WorkDetail,
  type WorkDocument,
  workDeletionSummary,
} from "@corniversity/db/services/scholarly-works";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { Markdown } from "@/components/Markdown";
import { pageViewAvailable, textViewAvailable } from "@/components/reader/rules";
import { browsingRefusal, scholarly } from "@/components/scholarly/client";
import { count, paperHref, rejectionText, reportedBy } from "@/components/scholarly/format";
import { paperFromWork } from "@/components/scholarly/model";
import { FixtureBadge, PaperView } from "@/components/scholarly/PaperView";
import { Badge, Button, Card, Field, Input, LinkButton, Notice, Select, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { ERROR_NOTICES, errorNotice } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import { AutoRefresh } from "../../../sessions/[id]/AutoRefresh";
import { KIND_TEXT } from "../../_collections/text";
import { AssetStatusBadge, LibraryHeader, PERMISSIONS, PermissionSummary } from "../../shared";
import {
  addToCollectionAction,
  createCollectionAction,
  deleteWorkAction,
  documentPermissionAction,
  editFieldsAction,
  extractAction,
  mergeAction,
  privateCopyAction,
  readArxivAction,
  removeCopyAction,
  removeFromCollectionAction,
  saveAgainAction,
  setFlagAction,
  unsaveAction,
} from "./actions";
import { EDIT_FIELDS } from "./edit-form";
import { ListFallback, PaperListSection, ReadElsewhere, ReadElsewhereFallback } from "./openalex-sections";
import { savedText } from "./saved-text";

export const metadata = { title: "Paper" };

/** The sections a form returns to (besides a shelf or trail's own row, `collection-<id>`); anything else is the top. */
const SECTIONS = ["read", "versions", "files", "collections", "duplicates", "edit", "delete"] as const;
type Section = (typeof SECTIONS)[number];

const PENDING = new Set(["queued", "active"]);

/** A job's error as a registered sentence, or a plain statement that it failed (raw job text is never shown). */
function jobFailure(error: string | null, fallback: string): string {
  return error && (Object.values(ERROR_NOTICES) as string[]).includes(error) ? error : fallback;
}

/**
 * The paper page (contract §2, §3, §6): the paper (PaperView) with its integrity notices first; Read
 * (an arXiv version through the reader, a stored file, or for a DOI-only paper the best open
 * location or the publisher's page); flags and Remove from library; arXiv versions with their dates
 * and licences as arXiv reported them, private copies where arXiv's licence for that version allows;
 * the owner's files with their permissions; shelves and trails; references, cited by and related
 * (OpenAlex, streamed); possible duplicates and merging; corrections; deletion with a confirmation
 * step. A merged paper opens the paper it was merged into.
 */
export default async function PaperPage({
  params,
  searchParams,
}: {
  params: Promise<{ workId: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    other?: string;
    more?: string;
    delete?: string;
    full?: string;
    at?: string;
    remove?: string;
  }>;
}) {
  const session = await requireSession("/library/find");
  const { workId } = await params;
  const query = await searchParams;
  const ownerId = session.user.id;
  const database = db();
  const detail = await getWork(database, ownerId, workId);
  if (!detail) notFound();
  if (detail.work.mergedIntoId) {
    const survivor = await resolveWorkId(database, ownerId, detail.work.id);
    if (survivor) redirect(paperHref(survivor));
    notFound();
  }
  const { work } = detail;
  const confirmDelete = query.delete === "confirm";
  const more = query.more === "references" || query.more === "cited_by" || query.more === "related" ? query.more : null;
  // Rendered whole, nothing streamed: the route the <noscript> links take when JavaScript is off.
  const full = query.full === "1";
  const [memberships, collections, duplicates, deletion] = await Promise.all([
    collectionsForWork(database, ownerId, work.id),
    listCollections(database, ownerId),
    possibleDuplicates(database, ownerId, work.id),
    confirmDelete ? workDeletionSummary(database, ownerId, work.id) : Promise.resolve(null),
  ]);
  const refusal = browsingRefusal();
  const recordPromise: Promise<WorkRecordResult> = openAlexRecordForWork(database, ownerId, scholarly(), work.id).catch(
    (error: unknown) => {
      console.error("[library] OpenAlex record for a paper:", error instanceof Error ? error.message : String(error));
      return { record: null, failure: { message: "The provider's answer could not be used. Nothing was changed.", resetAt: null } };
    },
  );

  const paper = paperFromWork(detail);
  const fixture = paper.fixture || detail.versions.some((v) => v.source === "fixture");
  const arxivVersions = detail.versions.filter((v) => v.arxivId !== null);
  const hasArxivId = detail.identifiers.some((i) => i.scheme === "arxiv");
  const stored = detail.documents.filter((d) => d.asset.status !== "linked_remote");
  const readable = stored.filter((d) => pageViewAvailable(d.asset) || textViewAvailable(d.asset));
  const latest = [...arxivVersions].filter((v) => !v.withdrawn).sort((a, b) => (b.arxivVersion ?? 0) - (a.arxivVersion ?? 0))[0];
  // A stored, readable copy of the latest version is read directly: one button, not two.
  const latestStored = latest ? readable.find((d) => d.version?.id === latest.id) : undefined;
  const publisherDois = detail.identifiers
    .filter((i) => i.scheme === "doi" && i.status === "current" && !isArxivDoi(i.value))
    .map((i) => i.value);
  const arxivPending = detail.arxivJob ? PENDING.has(detail.arxivJob.status) : false;
  const refreshing =
    arxivPending || detail.documentJobs.some((j) => PENDING.has(j.status)) || detail.documents.some((d) => d.asset.status === "processing");
  const other = query.other && isUuid(query.other) ? query.other : null;
  const env = getEnv();
  // Each form returns to its own section (`at`, the redirect's #fragment); its notice is shown there, in view.
  const present: Record<Section, boolean> = {
    read: true,
    versions: arxivVersions.length > 0 || hasArxivId,
    files: true,
    collections: true,
    duplicates: duplicates.length > 0,
    edit: true,
    delete: true,
  };
  const at = typeof query.at === "string" ? query.at : "";
  const place =
    ((SECTIONS as readonly string[]).includes(at) && present[at as Section]) || memberships.some((m) => at === `collection-${m.id}`)
      ? at
      : "top";
  const errorText = errorNotice(query.error);
  const extracting =
    detail.documentJobs.some((j) => j.kind === "extraction" && PENDING.has(j.status)) ||
    detail.documents.some((d) => d.asset.status === "processing");
  const confirmation = savedText(query.saved, { extracting });
  const notices =
    errorText || confirmation ? (
      <div className="mb-4 flex flex-col gap-2">
        {errorText ? <Notice tone="rust">{errorText}</Notice> : null}
        {other ? (
          <p className="text-sm">
            <Link href={paperHref(other)} className="text-brass underline underline-offset-4">
              Open the paper that file belongs to
            </Link>
          </p>
        ) : null}
        {confirmation ? <Notice tone="moss">{confirmation}</Notice> : null}
      </div>
    ) : null;
  /** The notices, in the one place the redirect aimed at. */
  const noticesAt = (where: string) => (place === where ? notices : null);
  const removing = typeof query.remove === "string" && isUuid(query.remove) ? query.remove : null;
  const integrity = detail.integrityJob;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <AutoRefresh active={refreshing} intervalMs={3000} />
      <LibraryHeader title={work.title ?? "Untitled paper"} active="/library" />
      {noticesAt("top")}
      {arxivPending ? (
        <div className="mb-4">
          <Notice tone="slate" title="Fetching the arXiv record">
            Versions, dates and licences arrive from arXiv's record; this page updates by itself.{" "}
            <Link href={paperHref(work.id)} className="underline underline-offset-4">
              Refresh
            </Link>
          </Notice>
        </div>
      ) : null}
      {detail.arxivJob?.status === "failed" ? (
        <div className="mb-4">
          <Notice tone="brass" title="The arXiv record could not be fetched">
            {jobFailure(detail.arxivJob.error, "The jobs page has the details.")}{" "}
            <Link href="/library/jobs" className="underline underline-offset-4">
              Jobs
            </Link>
          </Notice>
        </div>
      ) : null}
      {integrity?.status === "completed" && integrity.unrecorded.length ? (
        <div className="mb-4">
          <Notice tone="neutral" title="Not checked for corrections and retractions">
            No recorded response in fixture mode for {integrity.unrecorded.length === 1 ? "DOI" : "DOIs"} {integrity.unrecorded.join(", ")},
            so Crossref's check could not be made. Nothing is shown as checked.
          </Notice>
        </div>
      ) : integrity?.status === "failed" ? (
        <div className="mb-4">
          <Notice tone="brass" title="The check for corrections and retractions failed">
            {jobFailure(integrity.error, "The jobs page has the details.")}{" "}
            <Link href="/library/jobs" className="underline underline-offset-4">
              Jobs
            </Link>
          </Notice>
        </div>
      ) : null}
      {fixture && !paper.fixture ? (
        <p className="mb-4">
          <FixtureBadge />
        </p>
      ) : null}

      <PaperView
        paper={paper}
        mode="paper"
        actions={
          <div className="flex flex-col gap-4">
            <div id="read" className="scroll-mt-4">
              <h3 className="text-sm font-medium text-ink">Read</h3>
              {noticesAt("read")}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {readable.map((d) => (
                  <LinkButton
                    key={d.asset.id}
                    href={`/library/read/${d.asset.id}`}
                    variant={!latest || d === latestStored ? "primary" : "secondary"}
                  >
                    Read {d.version?.arxivId ? `${d.version.label} (copy stored here)` : "your copy"}
                  </LinkButton>
                ))}
                {latest && !latestStored ? (
                  <form action={readArxivAction}>
                    <input type="hidden" name="workId" value={work.id} />
                    <input type="hidden" name="from" value="read" />
                    <input type="hidden" name="arxivId" value={latest.arxivId!} />
                    <input type="hidden" name="version" value={latest.arxivVersion!} />
                    <Button type="submit">Read arXiv v{latest.arxivVersion}</Button>
                  </form>
                ) : null}
              </div>
              {!latest && readable.length === 0 ? (
                hasArxivId && !arxivVersions.length ? (
                  <p className="mt-1 text-sm text-ink-2">The arXiv versions appear here once arXiv's record has been fetched.</p>
                ) : (
                  <div className="mt-1">
                    {full ? (
                      <ReadElsewhere recordPromise={recordPromise} dois={publisherDois} />
                    ) : (
                      <Suspense fallback={<ReadElsewhereFallback workId={work.id} />}>
                        <ReadElsewhere recordPromise={recordPromise} dois={publisherDois} />
                      </Suspense>
                    )}
                    <p className="mt-1 text-xs text-ink-3">Or attach your own copy under Files; it can then be read here.</p>
                  </div>
                )
              ) : null}
            </div>
            <Flags workId={work.id} favourite={work.favourite} readLater={work.readLater} read={work.readAt !== null} />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {work.savedAt ? (
                <>
                  <span className="text-ink-2">In your saved papers since {work.savedAt.toISOString().slice(0, 10)}.</span>
                  <form action={unsaveAction}>
                    <input type="hidden" name="workId" value={work.id} />
                    <Button type="submit" variant="secondary">
                      Remove from library
                    </Button>
                  </form>
                </>
              ) : (
                <>
                  <span className="text-ink-2">Not in your saved papers.</span>
                  <form action={saveAgainAction}>
                    <input type="hidden" name="workId" value={work.id} />
                    <Button type="submit" variant="secondary">
                      Save to library
                    </Button>
                  </form>
                </>
              )}
              <Link href={`/notebook?library=1&work=${work.id}`} className="text-brass underline underline-offset-4">
                Notes for this paper
              </Link>
              <Link href={`/notebook?library=1&work=${work.id}#new-note`} className="text-brass underline underline-offset-4">
                New note for this paper
              </Link>
            </div>
          </div>
        }
      >
        {arxivVersions.length || hasArxivId ? (
          <Versions
            workId={work.id}
            versions={arxivVersions}
            documents={detail.documents}
            jobs={detail.documentJobs}
            pending={arxivPending}
            notices={noticesAt("versions")}
          />
        ) : null}
        <Files
          workId={work.id}
          stored={stored}
          versions={arxivVersions.filter((v) => !v.withdrawn)}
          jobs={detail.documentJobs}
          maxMb={env.MAX_UPLOAD_MB}
          notices={noticesAt("files")}
        />
        <Collections
          workId={work.id}
          memberships={memberships}
          collections={collections}
          notices={noticesAt("collections")}
          rowNotices={(id) => noticesAt(`collection-${id}`)}
          removing={removing}
        />
        {(["references", "cited_by", "related"] as const).map((kind) => {
          const section = (
            <PaperListSection
              key={kind}
              recordPromise={recordPromise}
              kind={kind}
              ownerId={ownerId}
              workId={work.id}
              more={more === kind}
              full={full}
              refusal={refusal}
            />
          );
          return full ? (
            section
          ) : (
            <Suspense key={kind} fallback={<ListFallback kind={kind} workId={work.id} more={more} />}>
              {section}
            </Suspense>
          );
        })}
        {duplicates.length ? <Duplicates workId={work.id} duplicates={duplicates} notices={noticesAt("duplicates")} /> : null}
        <Edit detail={detail} notices={noticesAt("edit")} open={place === "edit" && errorText !== null} />
        <Delete workId={work.id} confirm={confirmDelete} summary={deletion} notices={noticesAt("delete")} />
      </PaperView>
    </div>
  );
}

function Flags({ workId, favourite, readLater, read }: { workId: string; favourite: boolean; readLater: boolean; read: boolean }) {
  const flags = [
    { flag: "favourite", label: "Favourite", on: favourite },
    { flag: "readLater", label: "Read later", on: readLater },
    { flag: "read", label: "Have read", on: read },
  ];
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Flags</legend>
      {flags.map((f) => (
        <form key={f.flag} action={setFlagAction}>
          <input type="hidden" name="workId" value={workId} />
          <input type="hidden" name="flag" value={f.flag} />
          <input type="hidden" name="value" value={f.on ? "0" : "1"} />
          <Button type="submit" variant={f.on ? "primary" : "secondary"} aria-pressed={f.on}>
            {f.label}
          </Button>
        </form>
      ))}
    </fieldset>
  );
}

function licenceLine(v: VersionRow): string {
  if (!v.licence || !v.licenceSource) return "No licence reported by arXiv for this version.";
  const name = classifyLicence(v.licence, v.licenceSource).name ?? v.licence;
  return `Licence ${name}, ${licenceAttribution(v.licenceSource, v.licenceRetrievedAt)}.`;
}

function Versions({
  workId,
  versions,
  documents,
  jobs,
  pending,
  notices,
}: {
  workId: string;
  versions: VersionRow[];
  documents: WorkDocument[];
  jobs: DocumentJob[];
  pending: boolean;
  notices: ReactNode;
}) {
  const sorted = [...versions].sort(
    (a, b) => (a.arxivId ?? "").localeCompare(b.arxivId ?? "") || (a.arxivVersion ?? 0) - (b.arxivVersion ?? 0),
  );
  return (
    <Card as="section" id="versions" className="scroll-mt-4">
      <h2 className="text-lg text-ink">Versions</h2>
      {notices ? <div className="mt-3">{notices}</div> : null}
      {sorted.length === 0 ? (
        <p className="mt-2 text-sm text-ink-3">{pending ? "Fetching the arXiv record." : "No arXiv versions have been recorded yet."}</p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {sorted.map((v) => {
            const doc = documents.find((d) => d.version?.id === v.id) ?? null;
            const storedHere = doc !== null && doc.asset.status !== "linked_remote";
            const job = doc ? jobs.find((j) => j.assetId === doc.asset.id && j.kind === "private_copy") : undefined;
            const copyPending = job ? PENDING.has(job.status) : false;
            const decision = storageDecision({
              arxivId: v.arxivId,
              arxivVersion: v.arxivVersion,
              licence: v.licence,
              licenceSource: v.licenceSource,
              licenceRetrievedAt: v.licenceRetrievedAt,
              withdrawn: v.withdrawn,
            });
            return (
              <li key={v.id} className="flex flex-col gap-2 border-t border-stone py-3 first:border-t-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base text-ink">{v.label}</h3>
                  {v.withdrawn ? <Badge tone="rust">Withdrawn on arXiv</Badge> : null}
                  {storedHere ? <Badge tone="moss">Private copy stored here</Badge> : null}
                  {v.source === "fixture" ? <FixtureBadge /> : null}
                </div>
                <p className="text-sm text-ink-2">
                  {v.versionDate ? `Dated ${v.versionDate.toISOString().slice(0, 10)} on arXiv. ` : "No date reported. "}
                  {licenceLine(v)}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {v.withdrawn ? null : (
                    <form action={readArxivAction}>
                      <input type="hidden" name="workId" value={workId} />
                      <input type="hidden" name="from" value="versions" />
                      <input type="hidden" name="arxivId" value={v.arxivId!} />
                      <input type="hidden" name="version" value={v.arxivVersion!} />
                      <Button type="submit" variant="secondary">
                        Read v{v.arxivVersion}
                      </Button>
                    </form>
                  )}
                  {decision.privateCopy && !storedHere && !copyPending ? (
                    <form action={privateCopyAction}>
                      <input type="hidden" name="workId" value={workId} />
                      <input type="hidden" name="arxivId" value={v.arxivId!} />
                      <input type="hidden" name="version" value={v.arxivVersion!} />
                      <Button type="submit" variant="secondary">
                        Keep a private copy of v{v.arxivVersion}
                      </Button>
                    </form>
                  ) : null}
                  <a
                    href={arxivAbsUrl(v.arxivId!, v.arxivVersion)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brass underline underline-offset-4"
                  >
                    Abstract page on arXiv
                  </a>
                </div>
                {copyPending ? (
                  <p className="text-xs text-ink-3">Keeping a private copy: {job!.status === "queued" ? "queued" : "fetching"}.</p>
                ) : null}
                {job?.status === "failed" ? (
                  <p className="text-xs text-rust">The private copy failed: {jobFailure(job.error, "the jobs page has the details.")}</p>
                ) : null}
                {decision.privateCopy && !storedHere ? (
                  <p className="text-xs text-ink-3">
                    A private copy is possible because arXiv reported an open licence for this exact version; it is fetched from arXiv by
                    the server and kept for your use only.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-ink-3">
        Reading a version opens arXiv's file in your browser directly from arxiv.org; nothing of it is stored here unless you keep a private
        copy.
      </p>
    </Card>
  );
}

function Files({
  workId,
  stored,
  versions,
  jobs,
  maxMb,
  notices,
}: {
  workId: string;
  stored: WorkDocument[];
  versions: VersionRow[];
  jobs: DocumentJob[];
  maxMb: number;
  notices: ReactNode;
}) {
  return (
    <Card as="section" id="files" className="scroll-mt-4">
      <h2 className="text-lg text-ink">Files</h2>
      {notices ? <div className="mt-3">{notices}</div> : null}
      {stored.length === 0 ? (
        <p className="mt-2 text-sm text-ink-3">No file of this paper is stored here.</p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {stored.map((d) => {
            const extraction = jobs.find((j) => j.assetId === d.asset.id && j.kind === "extraction");
            const rejection = d.asset.status === "rejected" ? rejectionText(d.asset.rejectionReason) : null;
            return (
              <li key={d.asset.id} className="flex flex-col gap-2 border-t border-stone py-3 first:border-t-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base text-ink">
                    {d.version?.arxivId ? `${d.version.label} (private copy)` : (d.version?.label ?? "Your copy")}
                  </h3>
                  <AssetStatusBadge status={d.asset.status} />
                </div>
                <p className="text-xs text-ink-3">
                  <span className="break-all">{d.asset.filename}</span> · {(d.asset.sizeBytes / 1_048_576).toFixed(2)} MB
                  {d.asset.pageCount ? ` · ${count(d.asset.pageCount)} pages` : ""}
                </p>
                <PermissionSummary permissions={d.permissions} />
                {rejection ? (
                  <p className="text-xs text-rust">
                    {rejection.text} {rejection.next}
                  </p>
                ) : null}
                {extraction?.status === "failed" && d.asset.status !== "rejected" ? (
                  <p className="text-xs text-rust">Extraction failed: {jobFailure(extraction.error, "the jobs page has the details.")}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {pageViewAvailable(d.asset) || textViewAvailable(d.asset) ? (
                    <LinkButton href={`/library/read/${d.asset.id}`} variant="secondary">
                      Read this file
                    </LinkButton>
                  ) : null}
                  {(d.asset.status === "validated" || d.asset.status === "processed") &&
                  d.permissions.local_extract.status === "allowed" ? (
                    <form action={extractAction}>
                      <input type="hidden" name="workId" value={workId} />
                      <input type="hidden" name="assetId" value={d.asset.id} />
                      <Button type="submit" variant="secondary">
                        {d.asset.status === "processed" ? "Extract again" : "Extract and index"}
                      </Button>
                    </form>
                  ) : null}
                </div>
                <details>
                  <summary className="cursor-pointer text-sm text-brass">Permissions and removal</summary>
                  <ul className="mt-3 flex flex-col gap-3">
                    {PERMISSIONS.map((p) => {
                      const current = d.permissions[p.action];
                      return (
                        <li key={p.action} className="text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-ink">{p.label}</span>
                            <Badge tone={current.status === "allowed" ? "moss" : current.status === "denied" ? "rust" : "neutral"}>
                              {current.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-ink-2">{p.explain}</p>
                          {current.basis ? <p className="text-xs text-ink-3">Basis: {current.basis}</p> : null}
                          <form action={documentPermissionAction} className="mt-1 flex flex-wrap items-end gap-2">
                            <input type="hidden" name="workId" value={workId} />
                            <input type="hidden" name="assetId" value={d.asset.id} />
                            <input type="hidden" name="action" value={p.action} />
                            <div className="min-w-48 flex-1">
                              <label htmlFor={`basis-${d.asset.id}-${p.action}`} className="sr-only">
                                Basis for {p.label}
                              </label>
                              <Input
                                id={`basis-${d.asset.id}-${p.action}`}
                                name="basis"
                                placeholder="Basis, e.g. CC BY 4.0, or my own copy"
                                maxLength={300}
                                defaultValue={current.basis ?? ""}
                              />
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
                  <form action={removeCopyAction} className="mt-4 flex flex-wrap items-center gap-3 border-t border-stone pt-3">
                    <input type="hidden" name="workId" value={workId} />
                    <input type="hidden" name="assetId" value={d.asset.id} />
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input type="checkbox" name="confirm" value="1" />{" "}
                      {d.version?.arxivId
                        ? "Remove this copy; the version is read from arxiv.org again"
                        : "Remove this file and its extracted text"}
                    </label>
                    <Button type="submit" variant="danger">
                      Remove file
                    </Button>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      <form
        method="post"
        action={`/api/library/papers/${workId}/attach`}
        encType="multipart/form-data"
        className="mt-4 flex flex-col gap-3 border-t border-stone pt-4"
      >
        <h3 className="text-base text-ink">Attach your copy</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`PDF of your copy (up to ${maxMb} MB)`} htmlFor="attach-file">
            <input
              id="attach-file"
              name="file"
              type="file"
              required
              accept=".pdf,application/pdf"
              className="block w-full text-sm text-ink file:mr-3 file:rounded-[var(--radius-control)] file:border file:border-stone-2 file:bg-paper-2 file:px-3 file:py-2 file:text-sm file:text-ink"
            />
          </Field>
          <Field label="Which version it is" htmlFor="attach-version">
            <Select id="attach-version" name="versionId" defaultValue="">
              <option value="">Your copy (no particular version)</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <Button type="submit" variant="secondary">
            Attach
          </Button>
        </div>
        <p className="text-xs text-ink-3">
          The file is checked and kept privately; it can be read here at once. Extraction and anything else waits for the permissions above.
        </p>
      </form>
    </Card>
  );
}

function Collections({
  workId,
  memberships,
  collections,
  notices,
  rowNotices,
  removing,
}: {
  workId: string;
  memberships: CollectionMembership[];
  collections: { id: string; kind: "shelf" | "trail"; name: string }[];
  notices: ReactNode;
  rowNotices: (collectionId: string) => ReactNode;
  /** The shelf or trail whose Remove asks first (`?remove=`): a note or reason is written there. */
  removing: string | null;
}) {
  const available = collections.filter((c) => !memberships.some((m) => m.id === c.id));
  return (
    <Card as="section" id="collections" className="scroll-mt-4">
      <h2 className="text-lg text-ink">Shelves and trails</h2>
      {notices ? <div className="mt-3">{notices}</div> : null}
      {memberships.length ? (
        <ul className="mt-3 flex flex-col">
          {memberships.map((m) => (
            <li
              key={m.id}
              id={`collection-${m.id}`}
              className="flex scroll-mt-4 flex-col gap-2 border-t border-stone py-3 text-sm [overflow-wrap:anywhere] first:border-t-0"
            >
              {rowNotices(m.id)}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {m.kind === "trail" ? (
                  <span className="text-ink">
                    Trail:{" "}
                    <Link href={`/library/trails/${m.id}`} className="text-brass underline underline-offset-4">
                      {m.name}
                    </Link>
                    , step {m.step} of {m.steps}
                    {m.next ? (
                      <>
                        ; next:{" "}
                        <Link href={paperHref(m.next.workId)} className="text-brass underline underline-offset-4">
                          {m.next.title ?? "Untitled paper"}
                        </Link>
                      </>
                    ) : (
                      "; the last step"
                    )}
                  </span>
                ) : (
                  <span className="text-ink">
                    Shelf:{" "}
                    <Link href={`/library/shelves/${m.id}`} className="text-brass underline underline-offset-4">
                      {m.name}
                    </Link>
                  </span>
                )}
                <form action={removeFromCollectionAction}>
                  <input type="hidden" name="workId" value={workId} />
                  <input type="hidden" name="collectionId" value={m.id} />
                  <Button type="submit" variant="quiet" aria-label={`Remove from ${m.name}`}>
                    Remove
                  </Button>
                </form>
              </div>
              {m.reason ? (
                <div className="rounded-[var(--radius-control)] border-l-2 border-brass bg-paper px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{KIND_TEXT[m.kind].reasonLabel}</p>
                  <Markdown source={m.reason} className="text-sm [overflow-wrap:anywhere]" />
                </div>
              ) : null}
              {removing === m.id && m.reason ? (
                <div className="rounded-[var(--radius-panel)] border border-rust bg-paper px-4 py-3">
                  <p className="text-ink">{KIND_TEXT[m.kind].removeAsk}</p>
                  <form action={removeFromCollectionAction} className="mt-3 flex flex-wrap items-center gap-3">
                    <input type="hidden" name="workId" value={workId} />
                    <input type="hidden" name="collectionId" value={m.id} />
                    <input type="hidden" name="confirm" value="1" />
                    <Button type="submit" variant="danger">
                      {KIND_TEXT[m.kind].removeConfirm}
                      <span className="sr-only"> on {m.name}</span>
                    </Button>
                    <Link href={`${paperHref(workId)}#collection-${m.id}`} className="text-brass underline underline-offset-4">
                      Keep it
                    </Link>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-3">Not on a shelf or trail.</p>
      )}
      <div className="mt-4 grid gap-4 border-t border-stone pt-4 lg:grid-cols-2">
        {available.length ? (
          <form action={addToCollectionAction} className="flex flex-col gap-3">
            <input type="hidden" name="workId" value={workId} />
            <Field label="Add to" htmlFor="collection-add">
              <Select id="collection-add" name="collectionId" required defaultValue="">
                <option value="" disabled>
                  Choose a shelf or trail
                </option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.kind})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Why (optional)" htmlFor="collection-add-reason" hint="Markdown and LaTeX.">
              <Input id="collection-add-reason" name="reason" maxLength={2000} />
            </Field>
            <div>
              <Button type="submit" variant="secondary">
                Add
              </Button>
            </div>
          </form>
        ) : null}
        <form action={createCollectionAction} className="flex flex-col gap-3">
          <input type="hidden" name="workId" value={workId} />
          <div className="grid gap-3 sm:grid-cols-[max-content_1fr]">
            <Field label="New" htmlFor="collection-new-kind">
              <Select id="collection-new-kind" name="kind" defaultValue="shelf">
                <option value="shelf">Shelf</option>
                <option value="trail">Trail</option>
              </Select>
            </Field>
            <Field label="Name" htmlFor="collection-new-name">
              <Input id="collection-new-name" name="name" required maxLength={120} />
            </Field>
          </div>
          <Field label="Why (optional)" htmlFor="collection-new-reason" hint="Markdown and LaTeX.">
            <Input id="collection-new-reason" name="reason" maxLength={2000} />
          </Field>
          <div>
            <Button type="submit" variant="secondary">
              Create and add
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

function Duplicates({
  workId,
  duplicates,
  notices,
}: {
  workId: string;
  duplicates: { workId: string; title: string | null; reason: "shared_identifier" | "similar_title" }[];
  notices: ReactNode;
}) {
  return (
    <Card as="section" id="duplicates" className="scroll-mt-4">
      <h2 className="text-lg text-ink">Possible duplicates</h2>
      {notices ? <div className="mt-3">{notices}</div> : null}
      <p className="mt-1 text-sm text-ink-2">
        Merging moves the other paper's identifiers, versions, files, notes and shelf places here; it then points to this paper. Nothing is
        merged unless you confirm it.
      </p>
      <ul className="mt-3 flex flex-col">
        {duplicates.map((d) => (
          <li key={d.workId} className="flex flex-col gap-2 border-t border-stone py-3 first:border-t-0">
            <p className="text-sm">
              <Link href={paperHref(d.workId)} className="text-brass underline underline-offset-4">
                {d.title ?? "Untitled paper"}
              </Link>{" "}
              <span className="text-xs text-ink-3">
                {d.reason === "shared_identifier"
                  ? "shares an identifier with this paper"
                  : "has a near-identical title (a suggestion only)"}
              </span>
            </p>
            <form action={mergeAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="workId" value={workId} />
              <input type="hidden" name="mergeId" value={d.workId} />
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="confirm" value="1" /> They are the same paper
              </label>
              <Button type="submit" variant="secondary">
                Merge into this paper
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Edit({ detail, notices, open }: { detail: WorkDetail; notices: ReactNode; open: boolean }) {
  const { work } = detail;
  const edited = work.ownerEditedFields;
  // What the form shows; it travels back as `shown_*`, so only the fields changed here become edits.
  const shown = {
    title: work.title ?? "",
    authors: work.authors.map((a) => a.name).join("\n"),
    abstract: work.abstract ?? "",
    year: work.publicationYear === null ? "" : String(work.publicationYear),
    venue: work.venue ?? "",
    workType: work.workType ?? "",
  };
  return (
    <Card as="section" id="edit" className="scroll-mt-4">
      {notices}
      <details open={open || undefined}>
        <summary className="cursor-pointer text-lg text-ink">Edit details</summary>
        <p className="mt-2 text-sm text-ink-2">
          Your corrections are kept as yours: a refresh from a provider never overwrites a field you edited.
          {edited.length ? ` Edited by you: ${edited.join(", ")}.` : ""}
        </p>
        <form action={editFieldsAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="workId" value={work.id} />
          {EDIT_FIELDS.map((field) => (
            <input key={field} type="hidden" name={`shown_${field}`} value={shown[field]} />
          ))}
          <Field label="Title" htmlFor="edit-title">
            <Input id="edit-title" name="title" maxLength={500} defaultValue={shown.title} />
          </Field>
          <Field label="Authors (one per line)" htmlFor="edit-authors">
            <Textarea id="edit-authors" name="authors" rows={4} defaultValue={shown.authors} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Year" htmlFor="edit-year">
              <Input id="edit-year" name="year" inputMode="numeric" maxLength={4} defaultValue={shown.year} />
            </Field>
            <Field label="Venue" htmlFor="edit-venue">
              <Input id="edit-venue" name="venue" maxLength={500} defaultValue={shown.venue} />
            </Field>
            <Field label="Type" htmlFor="edit-type">
              <Input id="edit-type" name="workType" maxLength={100} defaultValue={shown.workType} />
            </Field>
          </div>
          <Field label="Abstract" htmlFor="edit-abstract">
            <Textarea id="edit-abstract" name="abstract" rows={6} defaultValue={shown.abstract} />
          </Field>
          <div>
            <Button type="submit">Save corrections</Button>
          </div>
          {work.provenance.title ? (
            <p className="text-xs text-ink-3">Title now {reportedBy(work.provenance.title.source, work.provenance.title.retrievedAt)}.</p>
          ) : null}
        </form>
      </details>
    </Card>
  );
}

function Delete({
  workId,
  confirm,
  summary,
  notices,
}: {
  workId: string;
  confirm: boolean;
  summary: { documents: number; storedCopies: number; annotations: number; notebookEntries: number; collections: number } | null;
  notices: ReactNode;
}) {
  return (
    <Card as="section" id="delete" className="scroll-mt-4">
      <h2 className="text-lg text-ink">Delete this paper and its notes</h2>
      {notices ? <div className="mt-3">{notices}</div> : null}
      {confirm && summary ? (
        <form action={deleteWorkAction} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="workId" value={workId} />
          <p className="text-sm text-ink-2">This removes the paper, its identifiers, versions and reading positions, and:</p>
          <ul className="list-disc pl-5 text-sm text-ink-2">
            <li>
              Files: {count(summary.documents)} ({count(summary.storedCopies)} stored here, with their extracted text)
            </li>
            <li>Highlights, notes and bookmarks on its pages: {count(summary.annotations)}</li>
            <li>Places on shelves and trails: {count(summary.collections)}</li>
          </ul>
          <p className="text-sm text-ink-2">
            Notebook entries linked to it ({count(summary.notebookEntries)}) stay, without the link. This cannot be undone.
          </p>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="confirm" value="1" /> Delete this paper and its notes
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="danger">
              Delete permanently
            </Button>
            <Link href={paperHref(workId)} className="text-sm text-brass underline underline-offset-4">
              Cancel
            </Link>
          </div>
        </form>
      ) : (
        <p className="mt-2 text-sm">
          <Link href={`${paperHref(workId)}?delete=confirm#delete`} className="text-rust underline underline-offset-4">
            Delete this paper and its notes…
          </Link>{" "}
          <span className="text-ink-3">You are shown what would be removed first.</span>
        </p>
      )}
    </Card>
  );
}
