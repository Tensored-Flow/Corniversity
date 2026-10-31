import { getEnv } from "@corniversity/db/env";
import { listCatalogue } from "@corniversity/db/services/catalogue";
import { companionState, listPairings, listResourceRequests, suggestedRequests } from "@corniversity/db/services/library";
import { Badge, Button, Card, EmptyState, Field, Input, LinkButton, Select, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { addSuggestedRequestAction, createRequestAction, setRequestStatusAction, writeRequestsToDataFolderAction } from "../actions";
import { FlashNotices, LibraryHeader } from "../shared";

export const metadata = { title: "Books to obtain" };

/**
 * "Books to obtain": structured acquisition requests. Suggestions come from the source registry
 * (commercial or institutional sources named by launch courses) and say only what the registry
 * verified; the owner adds their own requests and marks items obtained. Exportable as Markdown
 * and JSON, and written into the data root's requests folder in local mode.
 */
export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; written?: string }> }) {
  const session = await requireSession("/library/requests");
  const params = await searchParams;
  const database = db();
  const [requests, suggestions, pairings, catalogue] = await Promise.all([
    listResourceRequests(database, session.user.id),
    suggestedRequests(database, session.user.id),
    listPairings(database, session.user.id),
    listCatalogue(database),
  ]);
  const local = getEnv().DEPLOYMENT_MODE === "local";

  return (
    <div className="mx-auto w-full max-w-5xl">
      <LibraryHeader
        title="Books to obtain"
        lede="Material a course needs that cannot be fetched automatically. Obtain it through legitimate channels, place it in the folder shown, and the companion or the upload page takes it from there. Nothing here claims a title is available at any particular library."
        active="/library/requests"
        sync={companionState(pairings)}
      />
      <FlashNotices error={params.error} saved={params.saved} written={params.written} />

      <div className="mb-6 flex flex-wrap gap-2">
        <LinkButton href="/api/library/requests?format=md" variant="secondary">
          Download requests.md
        </LinkButton>
        <LinkButton href="/api/library/requests?format=json" variant="secondary">
          Download requests.json
        </LinkButton>
        {local ? (
          <form action={writeRequestsToDataFolderAction}>
            <Button type="submit" variant="secondary">
              Write both into the data folder
            </Button>
          </form>
        ) : null}
      </div>

      <section aria-labelledby="list-heading">
        <h2 id="list-heading" className="text-xl text-ink">
          Your list
        </h2>
        {requests.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="Nothing on the list" body="Add a request below or take one of the catalogue's suggestions." />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {requests.map((r) => (
              <Card key={r.id} as="li">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg text-ink">{r.title}</h3>
                    <p className="text-sm text-ink-2">
                      {[r.authors, r.edition, r.isbn ? `ISBN ${r.isbn}` : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Badge tone={r.status === "obtained" ? "moss" : r.status === "declined" ? "neutral" : "brass"}>{r.status}</Badge>
                    <Badge tone={r.essential ? "rust" : "neutral"}>{r.essential ? "essential" : "optional"}</Badge>
                  </div>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-ink-3">Why</dt>
                    <dd className="text-ink">{r.why}</dd>
                  </div>
                  {r.courseId ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-ink-3">Course</dt>
                      <dd className="text-ink">
                        {r.courseId}
                        {r.unitIds.length ? ` · units ${r.unitIds.join(", ")}` : ""}
                      </dd>
                    </div>
                  ) : null}
                  {r.chaptersNeeded.length ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-ink-3">Sections needed (verified)</dt>
                      <dd className="text-ink">{r.chaptersNeeded.join("; ")}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-ink-3">Put it in</dt>
                    <dd className="font-mono text-xs text-ink">
                      {r.destinationFolder} · {r.acceptedFormats.join(", ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-ink-3">Minimum permission needed</dt>
                    <dd className="text-ink">{r.minPermission.replace(/_/g, " ")}</dd>
                  </div>
                  {r.links.length ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs uppercase tracking-wide text-ink-3">Legitimate links</dt>
                      <dd className="flex flex-wrap gap-3 text-ink">
                        {r.links.map((l) => (
                          <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="text-brass underline underline-offset-4">
                            {l.label}
                          </a>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                  {r.openAlternative ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs uppercase tracking-wide text-ink-3">Open alternative</dt>
                      <dd className="text-ink">{r.openAlternative}</dd>
                    </div>
                  ) : null}
                  {r.caveats ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs uppercase tracking-wide text-ink-3">Access and licensing</dt>
                      <dd className="text-ink-2">{r.caveats}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["open", "obtained", "declined"] as const)
                    .filter((s) => s !== r.status)
                    .map((s) => (
                      <form key={s} action={setRequestStatusAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value={s} />
                        <Button type="submit" variant="quiet">
                          Mark {s}
                        </Button>
                      </form>
                    ))}
                </div>
              </Card>
            ))}
          </ul>
        )}
      </section>

      {suggestions.length ? (
        <section aria-labelledby="suggested-heading" className="mt-8">
          <h2 id="suggested-heading" className="text-xl text-ink">
            Suggested by the catalogue
          </h2>
          <p className="mt-1 text-sm text-ink-2">Commercial or institutional sources that launch courses name. Everything shown comes from the verified source record.</p>
          <ul className="mt-3 flex flex-col gap-3">
            {suggestions.map((s) => (
              <Card key={s.key} as="li">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg text-ink">{s.title}</h3>
                    <p className="text-sm text-ink-2">{[s.authors, s.edition, s.isbn ? `ISBN ${s.isbn}` : null].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Badge tone={s.essential ? "rust" : "neutral"}>{s.essential ? "essential" : "optional"}</Badge>
                </div>
                <p className="mt-2 text-sm text-ink">{s.why}</p>
                {s.chaptersNeeded.length ? <p className="mt-1 text-sm text-ink-2">Sections referenced by prepared material: {s.chaptersNeeded.join("; ")}</p> : null}
                {s.openAlternative ? <p className="mt-1 text-sm text-ink-2">{s.openAlternative}</p> : null}
                <p className="mt-1 text-xs text-ink-3">{s.caveats}</p>
                <form action={addSuggestedRequestAction} className="mt-3">
                  <input type="hidden" name="key" value={s.key} />
                  <Button type="submit" variant="secondary">
                    Add to the list
                  </Button>
                </form>
              </Card>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="add-heading" className="mt-8">
        <details className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-5">
          <summary id="add-heading" className="cursor-pointer text-lg text-ink">
            Add a request of your own
          </summary>
          <form action={createRequestAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Exact title" htmlFor="req-title">
              <Input id="req-title" name="title" required maxLength={300} />
            </Field>
            <Field label="Authors" htmlFor="req-authors">
              <Input id="req-authors" name="authors" maxLength={300} />
            </Field>
            <Field label="Edition or year" htmlFor="req-edition">
              <Input id="req-edition" name="edition" maxLength={120} />
            </Field>
            <Field label="ISBN (only if verified)" htmlFor="req-isbn">
              <Input id="req-isbn" name="isbn" maxLength={40} />
            </Field>
            <Field label="Course" htmlFor="req-course">
              <Select id="req-course" name="courseId" defaultValue="">
                <option value="">None in particular</option>
                {catalogue.map((c) => (
                  <option key={c.course.id} value={c.course.id}>
                    {c.course.id} · {c.course.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Minimum processing permission needed" htmlFor="req-perm">
              <Select id="req-perm" name="minPermission" defaultValue="local_read">
                <option value="local_read">Read locally</option>
                <option value="local_extract">Extract and index</option>
                <option value="private_cloud_store">Store a private copy</option>
                <option value="external_ai">Tutors may read passages</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Why it is needed" htmlFor="req-why">
                <Textarea id="req-why" name="why" required rows={3} />
              </Field>
            </div>
            <Field label="Sections needed, one per line (only if verified)" htmlFor="req-chapters">
              <Textarea id="req-chapters" name="chaptersNeeded" rows={3} />
            </Field>
            <Field label="Links, one per line as label | https://…" htmlFor="req-links" hint="Publisher, author page, library search or open-access link.">
              <Textarea id="req-links" name="links" rows={3} />
            </Field>
            <Field label="Open alternative, with differences" htmlFor="req-open">
              <Textarea id="req-open" name="openAlternative" rows={2} />
            </Field>
            <Field label="Access or licensing caveats" htmlFor="req-caveats">
              <Textarea id="req-caveats" name="caveats" rows={2} />
            </Field>
            <Field label="Destination folder" htmlFor="req-folder" hint="Relative to your library root.">
              <Input id="req-folder" name="destinationFolder" defaultValue="inbox/mathematics" maxLength={120} />
            </Field>
            <label className="flex items-center gap-2 self-end text-sm text-ink">
              <input type="checkbox" name="essential" value="1" /> Essential (the course cannot proceed without it)
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">Add request</Button>
            </div>
          </form>
        </details>
      </section>
    </div>
  );
}
