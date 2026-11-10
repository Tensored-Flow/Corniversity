import { getLocators } from "@corniversity/db/services/catalogue";
import { listEnrolments } from "@corniversity/db/services/enrolment";
import { getEntry, listEntries } from "@corniversity/db/services/notebook";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocatorLink } from "@/components/LocatorLink";
import { Markdown } from "@/components/Markdown";
import { Badge, Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { errorNotice } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import { deleteEntryAction, toggleResolvedAction, updateEntryAction } from "../actions";
import { excerpt, KIND_OPTIONS, KindBadge } from "../shared";

export const metadata = { title: "Notebook entry" };

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requireSession("/notebook");
  const { id } = await params;
  const flash = await searchParams;
  const database = db();
  const entry = await getEntry(database, session.user.id, id);
  if (!entry) notFound();
  const [locators, enrolments, related] = await Promise.all([
    getLocators(
      database,
      entry.sourceLinks.map((l) => l.locatorId).filter((v): v is string => Boolean(v)),
    ),
    listEnrolments(database, session.user.id),
    entry.unitId
      ? listEntries(database, session.user.id, { unitId: entry.unitId, limit: 8 })
      : entry.courseId
        ? listEntries(database, session.user.id, { courseId: entry.courseId, limit: 8 })
        : Promise.resolve([]),
  ]);
  const locatorById = new Map(locators.map((l) => [l.id, l]));

  return (
    <div className="mx-auto w-full max-w-4xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-3">
        <Link href="/notebook" className="hover:text-ink">
          Notebook
        </Link>
        <span className="mx-2">/</span>
        <span>{entry.title}</span>
      </nav>
      {flash.error ? (
        <div className="mb-4">
          <Notice tone="rust">{errorNotice(flash.error)}</Notice>
        </div>
      ) : null}
      {flash.saved ? (
        <div className="mb-4">
          <Notice tone="moss">Saved.</Notice>
        </div>
      ) : null}
      <Card as="article">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind={entry.kind} />
          {entry.kind === "question" ? <Badge tone={entry.resolved ? "moss" : "rust"}>{entry.resolved ? "resolved" : "open"}</Badge> : null}
          {entry.courseId ? <span className="font-mono text-xs text-ink-3">{entry.courseId}</span> : null}
          <span className="text-xs text-ink-3">
            created {entry.createdAt.toISOString().slice(0, 10)} · updated {entry.updatedAt.toISOString().slice(0, 10)}
          </span>
        </div>
        <h1 className="mt-2 text-2xl text-ink">{entry.title}</h1>
        <div className="mt-4">
          <Markdown source={entry.bodyMarkdown || "*(empty)*"} />
        </div>
        {entry.tags.length ? (
          <ul className="mt-4 flex flex-wrap gap-1">
            {entry.tags.map((t) => (
              <li key={t}>
                <Link
                  href={`/notebook?tag=${encodeURIComponent(t)}`}
                  className="rounded-full border border-stone px-2 py-0.5 text-xs text-ink-2 hover:text-ink"
                >
                  {t}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {entry.sourceLinks.length ? (
          <div className="mt-4 border-t border-stone pt-3">
            <h2 className="text-sm font-medium text-ink">Sources</h2>
            <ul className="mt-1 flex flex-col gap-1 text-sm">
              {entry.sourceLinks.map((link) => {
                const locator = link.locatorId ? locatorById.get(link.locatorId) : undefined;
                return (
                  <li key={`${link.tag}-${link.locatorId ?? link.assetId ?? link.label}`}>
                    {locator ? (
                      <LocatorLink label={link.label} locator={locator.payload} />
                    ) : link.assetId ? (
                      <Link href={`/library/items/${link.assetId}`} className="text-brass underline underline-offset-4">
                        {link.label}
                      </Link>
                    ) : (
                      <span className="text-ink">{link.label}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {entry.kind === "question" ? (
          <form action={toggleResolvedAction} className="mt-4">
            <input type="hidden" name="id" value={entry.id} />
            <input type="hidden" name="resolved" value={entry.resolved ? "0" : "1"} />
            <Button type="submit" variant="secondary">
              {entry.resolved ? "Reopen the question" : "Mark resolved"}
            </Button>
          </form>
        ) : null}
      </Card>

      <Card as="section" aria-labelledby="edit-heading" className="mt-6">
        <h2 id="edit-heading" className="text-lg text-ink">
          Edit
        </h2>
        <form action={updateEntryAction} className="mt-3 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={entry.id} />
          <Field label="Title" htmlFor="edit-title">
            <Input id="edit-title" name="title" required maxLength={200} defaultValue={entry.title} />
          </Field>
          <Field label="Kind" htmlFor="edit-kind">
            <Select id="edit-kind" name="kind" defaultValue={entry.kind}>
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tags" htmlFor="edit-tags">
            <Input id="edit-tags" name="tags" maxLength={300} defaultValue={entry.tags.join(", ")} />
          </Field>
          <Field label="Course" htmlFor="edit-course">
            <Select id="edit-course" name="courseId" defaultValue={entry.courseId ?? ""}>
              <option value="">None</option>
              {enrolments.map((e) => (
                <option key={e.enrolment.id} value={e.course.id}>
                  {e.course.id} · {e.course.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Body (Markdown with LaTeX)" htmlFor="edit-body">
              <Textarea id="edit-body" name="body" rows={12} defaultValue={entry.bodyMarkdown} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
        <form action={deleteEntryAction} className="mt-6 flex flex-wrap items-center gap-3 border-t border-stone pt-4">
          <input type="hidden" name="id" value={entry.id} />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="confirm" value="1" /> I want to delete this entry
          </label>
          <Button type="submit" variant="danger">
            Delete
          </Button>
        </form>
      </Card>

      {related.filter((r) => r.id !== entry.id).length ? (
        <Card as="aside" className="mt-6">
          <h2 className="text-sm font-medium text-ink">Nearby in your notebook</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {related
              .filter((r) => r.id !== entry.id)
              .map((r) => (
                <li key={r.id}>
                  <Link href={`/notebook/${r.id}`} className="text-brass underline underline-offset-4">
                    {r.title}
                  </Link>{" "}
                  <span className="text-xs text-ink-3">{excerpt(r.bodyMarkdown, 80)}</span>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
