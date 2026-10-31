import { locator } from "@corniversity/db/schema/index";
import { companionState, listAssets, listPairings, listSourceRegistry } from "@corniversity/db/services/library";
import { Badge, Button, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { importableFiles } from "@/lib/open-import";
import { requireSession } from "@/lib/session";
import { importOpenFileAction } from "../actions";
import { FlashNotices, LibraryHeader } from "../shared";

export const metadata = { title: "Sources" };

const ACCESS: Record<string, { label: string; tone: "moss" | "brass" | "rust" | "neutral" | "slate" }> = {
  open: { label: "Open", tone: "moss" },
  open_restricted_reuse: { label: "Readable online, no re-use", tone: "brass" },
  commercial: { label: "Commercial", tone: "rust" },
  institutional: { label: "Institutional login", tone: "rust" },
  unknown: { label: "Unknown", tone: "neutral" },
};

/**
 * The source registry: every verified source the catalogue rests on, with its edition, licence,
 * access status and how many exact places are pinned in it. Open sources whose registry entry
 * permits import can be fetched file by file; everything else stays reference-only.
 */
export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireSession("/library/sources");
  const { error } = await searchParams;
  const database = db();
  const [registry, pairings, assets] = await Promise.all([
    listSourceRegistry(database),
    listPairings(database, session.user.id),
    listAssets(database, session.user.id),
  ]);
  const importedTitles = new Set(assets.filter((a) => a.origin === "open_import").map((a) => a.confirmedTitle));
  const allLocators = await database.select({ sourceVersionId: locator.sourceVersionId, payload: locator.payload }).from(locator);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <LibraryHeader
        title="Source registry"
        lede="What each course actually rests on: edition, licence, what was opened and when. Reference does not imply permission to process; imports are offered only where the registry records an open licence and an allow-listed host."
        active="/library/sources"
        sync={companionState(pairings)}
      />
      <FlashNotices error={error} />
      <div className="flex flex-col gap-4">
        {registry.map((entry) => {
          const access = ACCESS[entry.version.accessStatus] ?? ACCESS.unknown!;
          const files = entry.version.importAllowed
            ? importableFiles(allLocators.filter((l) => l.sourceVersionId === entry.version.id))
            : [];
          return (
            <Card key={entry.source.id} as="article">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg text-ink">{entry.source.title}</h2>
                  <p className="text-sm text-ink-2">
                    {entry.source.authors.join(", ")}
                    {entry.source.institution ? ` · ${entry.source.institution}` : ""} · {entry.source.kind}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={access.tone}>{access.label}</Badge>
                  <Badge tone="neutral">{entry.version.licence}</Badge>
                </div>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-3">Version used</dt>
                  <dd className="text-ink">
                    {entry.version.label} ·{" "}
                    <a href={entry.version.url} target="_blank" rel="noreferrer" className="text-brass underline underline-offset-4">
                      open
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-3">Verified</dt>
                  <dd className="text-ink">
                    {entry.version.verifiedAt} · {entry.version.verifiedBy}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-3">Pinned locations</dt>
                  <dd className="text-ink">
                    {entry.locatorCount} verified ({entry.pdfLocatorCount} in PDFs)
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-3">Courses</dt>
                  <dd className="text-ink">
                    {entry.courses.length ? entry.courses.map((c) => `${c.id} (${c.role})`).join(", ") : "none yet"}
                  </dd>
                </div>
              </dl>
              {entry.version.limitations.length ? (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-ink-2">Limitations recorded ({entry.version.limitations.length})</summary>
                  <ul className="mt-1 list-disc pl-5 text-ink-2">
                    {entry.version.limitations.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {files.length ? (
                <div className="mt-4 rounded-[var(--radius-panel)] border border-stone bg-paper p-3">
                  <p className="text-sm text-ink">
                    Import permitted by the registry ({entry.version.licence}; hosts: {entry.version.importHosts.join(", ")}). Each file is
                    fetched once, stored privately, indexed, and permitted for tutors under that licence; sharing stays off.
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {files.map((file) => {
                      const already =
                        importedTitles.has(`${entry.source.title}: ${file.fileLabel}`) || importedTitles.has(entry.source.title);
                      return (
                        <li key={file.url} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="text-ink-2">{file.fileLabel}</span>
                          {already ? (
                            <Badge tone="moss">In your library</Badge>
                          ) : (
                            <form action={importOpenFileAction}>
                              <input type="hidden" name="sourceId" value={entry.source.id} />
                              <input type="hidden" name="url" value={file.url} />
                              <Button type="submit" variant="secondary">
                                Import
                              </Button>
                            </form>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
