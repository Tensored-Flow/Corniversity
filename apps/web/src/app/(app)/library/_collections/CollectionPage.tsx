import type { CollectionKind } from "@corniversity/db/schema/scholarly";
import { type CollectionFlag, type CollectionOrder, getCollection } from "@corniversity/db/services/library-collections";
import { documentsForWorks } from "@corniversity/db/services/library-home";
import { listWorks, searchMyLibrary, type WorkRow } from "@corniversity/db/services/scholarly-works";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { Badge, Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { errorNotice } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import {
  addCollectionItemAction,
  deleteCollectionAction,
  describeCollectionAction,
  moveCollectionItemAction,
  removeCollectionItemAction,
  renameCollectionAction,
  setCollectionItemReasonAction,
} from "../actions";
import { LibraryHeader } from "../shared";
import { addListEmptyText, collectionSavedText, KIND_TEXT } from "./text";
import { readableByWork, WorkLine, workTitle } from "./WorkLine";

type Params = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? "")).trim();

const FLAGS: { value: CollectionFlag | ""; label: string }[] = [
  { value: "", label: "All papers" },
  { value: "favourite", label: "Favourites" },
  { value: "read_later", label: "Read later" },
  { value: "read", label: "Read" },
];

/** How many saved papers the add section offers when nothing is searched. */
const CANDIDATES = 20;

/** The sections a form returns to (besides a paper's own row, `item-<id>`). */
const SECTIONS = ["papers", "add", "details", "delete"];

/**
 * A shelf or a trail (contract §2, §3): its description (owner Markdown through the sanitiser), its
 * papers in its own order with each paper's note or step reason, moving up and down, removing (the
 * paper stays in the library), search and filters within a shelf and its newest-first order, adding
 * from the owner's library, renaming, describing, and deletion behind a confirmation. Every form
 * works without JavaScript. A form returns to its own section (`#…`, named again as `at`), and its
 * notice is shown inside that section, where the browser lands, rather than above it out of view.
 */
export async function CollectionPage({
  kind,
  params,
  searchParams,
}: {
  kind: CollectionKind;
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
}) {
  const text = KIND_TEXT[kind];
  const { id } = await params;
  const session = await requireSession(/^[0-9a-f-]{36}$/.test(id) ? `${text.path}/${id}` : text.path);
  const query = await searchParams;
  const ownerId = session.user.id;
  const database = db();
  const shelf = kind === "shelf";
  const q = shelf ? one(query.q).slice(0, 300) : "";
  const flagParam = shelf ? one(query.flag) : "";
  const flag = FLAGS.some((f) => f.value && f.value === flagParam) ? (flagParam as CollectionFlag) : undefined;
  const order: CollectionOrder = shelf && one(query.order) === "added" ? "added" : "position";
  const filtered = Boolean(q || flag);
  const whole = await getCollection(database, ownerId, id);
  if (!whole) notFound();
  // A shelf's address under Trails (or the reverse) opens the right page.
  if (whole.collection.kind !== kind) redirect(`${KIND_TEXT[whole.collection.kind].path}/${whole.collection.id}`);
  const detail = filtered || order === "added" ? ((await getCollection(database, ownerId, id, { query: q, flag, order })) ?? whole) : whole;
  const { collection, items, total } = detail;
  const words = one(query.add).slice(0, 300);
  const [documents, found] = await Promise.all([
    documentsForWorks(
      database,
      ownerId,
      items.map((i) => i.work.id),
    ),
    words
      ? searchMyLibrary(database, ownerId, words, { limit: CANDIDATES + total }).then((rows) => rows.map((r) => r.work))
      : listWorks(database, ownerId, "saved", { limit: CANDIDATES + total }).then((rows) => rows.map((r) => r.work)),
  ]);
  const held = new Set(whole.items.map((i) => i.work.id));
  const candidates = found.filter((w) => !held.has(w.id)).slice(0, CANDIDATES);
  const readable = readableByWork(documents);
  const movable = order === "position" && !filtered;
  const savedText = collectionSavedText(kind, one(query.saved));
  const errorText = errorNotice(one(query.error) || undefined);
  const at = one(query.at);
  const place = SECTIONS.includes(at) || items.some((i) => at === `item-${i.work.id}`) ? at : "top";
  const notices =
    errorText || savedText ? (
      <div className="mb-4 flex flex-col gap-2">
        {errorText ? <Notice tone="rust">{errorText}</Notice> : null}
        {savedText ? <Notice tone="moss">{savedText}</Notice> : null}
      </div>
    ) : null;
  /** The notices, in the one place the redirect aimed at. */
  const noticesAt = (where: string) => (place === where ? notices : null);
  const removing = one(query.remove);
  const listHref = (patch: Record<string, string>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, flag: flag ?? "", order: order === "added" ? "added" : "", ...patch })) if (v) next.set(k, v);
    const s = next.toString();
    return `${text.path}/${collection.id}${s ? `?${s}` : ""}#papers`;
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <LibraryHeader title={collection.name} active={text.path} />
      {noticesAt("top")}
      <p className="-mt-2 mb-4 flex flex-wrap gap-x-3 text-sm text-ink-3">
        <span>
          {text.singular} · {total} {total === 1 ? "paper" : "papers"}
        </span>
        <Link href={text.path} className="inline-flex min-h-6 items-center text-brass underline underline-offset-4">
          All {text.plural.toLowerCase()}
        </Link>
      </p>

      {collection.description ? (
        <Card as="section" className="mb-6">
          <h2 className="sr-only">Description</h2>
          <Markdown source={collection.description} className="[overflow-wrap:anywhere]" />
        </Card>
      ) : null}

      <section id="papers" aria-labelledby="papers-heading">
        <h2 id="papers-heading" className="mb-3 text-xl text-ink">
          {text.itemsHeading}
        </h2>
        {noticesAt("papers")}
        {shelf && total > 0 ? (
          <form
            method="get"
            action={`${text.path}/${collection.id}#papers`}
            className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
          >
            <Field label="Search this shelf" htmlFor="shelf-q">
              <Input id="shelf-q" name="q" type="search" defaultValue={q} maxLength={300} />
            </Field>
            <Field label="Show" htmlFor="shelf-flag">
              <Select id="shelf-flag" name="flag" defaultValue={flag ?? ""}>
                {FLAGS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Order" htmlFor="shelf-order">
              <Select id="shelf-order" name="order" defaultValue={order}>
                <option value="position">Your order</option>
                <option value="added">Recently added</option>
              </Select>
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="secondary">
                Apply
              </Button>
              {filtered || order === "added" ? (
                <Link
                  href={`${text.path}/${collection.id}#papers`}
                  className="text-sm inline-flex min-h-6 items-center text-brass underline underline-offset-4"
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        ) : null}
        {total === 0 ? (
          <p className="rounded-[var(--radius-panel)] border border-dashed border-stone-2 bg-paper-2 p-5 text-sm text-ink-2">
            {text.noItems}
          </p>
        ) : items.length === 0 ? (
          <p className="rounded-[var(--radius-panel)] border border-dashed border-stone-2 bg-paper-2 p-5 text-sm text-ink-2">
            No paper on this shelf matches these words and filters.{" "}
            <Link href={listHref({ q: "", flag: "" })} className="text-brass underline underline-offset-4">
              Show every paper
            </Link>
          </p>
        ) : (
          <Card className="p-0">
            <ol className="flex flex-col" aria-label={`${text.itemsHeading} of ${collection.name}`}>
              {items.map((entry, index) => {
                const title = workTitle(entry.work);
                return (
                  <li
                    key={entry.work.id}
                    id={`item-${entry.work.id}`}
                    className="flex scroll-mt-4 flex-col gap-2 border-t border-stone px-5 py-4 first:border-t-0"
                  >
                    {noticesAt(`item-${entry.work.id}`)}
                    {kind === "trail" ? <p className="text-xs font-medium uppercase tracking-wide text-brass">Step {entry.step}</p> : null}
                    <WorkLine
                      work={entry.work}
                      read={readable.get(entry.work.id) ?? null}
                      extra={order === "added" ? <span>added {entry.item.addedAt.toISOString().slice(0, 10)}</span> : null}
                      actions={
                        <ItemControls
                          collectionId={collection.id}
                          collectionName={collection.name}
                          work={entry.work}
                          first={index === 0}
                          last={index === items.length - 1}
                          movable={movable}
                        />
                      }
                    />
                    {removing === entry.work.id && entry.item.reason ? (
                      <RemoveConfirmation
                        kind={kind}
                        collectionId={collection.id}
                        collectionName={collection.name}
                        work={entry.work}
                        keepHref={`${text.path}/${collection.id}#item-${entry.work.id}`}
                      />
                    ) : null}
                    <Reason kind={kind} reason={entry.item.reason} />
                    <details className="text-sm">
                      <summary className="cursor-pointer py-0.5 text-brass">
                        {text.reasonEdit}
                        <span className="sr-only">: {title}</span>
                      </summary>
                      <form action={setCollectionItemReasonAction} className="mt-2 flex flex-col gap-2">
                        <input type="hidden" name="collectionId" value={collection.id} />
                        <input type="hidden" name="workId" value={entry.work.id} />
                        <label htmlFor={`reason-${entry.work.id}`} className="text-sm font-medium text-ink">
                          {kind === "trail" ? "Why this step" : "Note on this paper"} (Markdown and LaTeX)
                          <span className="sr-only">: {title}</span>
                        </label>
                        <Textarea
                          id={`reason-${entry.work.id}`}
                          name="reason"
                          rows={3}
                          maxLength={2000}
                          defaultValue={entry.item.reason ?? ""}
                        />
                        <div>
                          <Button type="submit" variant="secondary">
                            Save
                            <span className="sr-only">
                              {" "}
                              {kind === "trail" ? "why" : "note"} for {title}
                            </span>
                          </Button>
                        </div>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ol>
          </Card>
        )}
        {filtered && items.length ? (
          <p className="mt-2 text-xs text-ink-3">Moving papers is offered when the whole shelf is shown in your order.</p>
        ) : null}
      </section>

      <section id="add" aria-labelledby="add-heading" className="mt-8">
        <h2 id="add-heading" className="mb-3 text-xl text-ink">
          Add from your library
        </h2>
        {noticesAt("add")}
        <Card>
          <form method="get" action={`${text.path}/${collection.id}#add`} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Search your papers" htmlFor="add-words">
                <Input id="add-words" name="add" type="search" defaultValue={words} maxLength={300} />
              </Field>
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
          <h3 className="mt-4 text-sm font-medium text-ink">{words ? "Matching papers in your library" : "Recently saved"}</h3>
          {candidates.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">
              {addListEmptyText(kind, words, found.length)}{" "}
              <Link href="/library/find" className="text-brass underline underline-offset-4">
                Find papers
              </Link>
            </p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {candidates.map((work) => (
                <li key={work.id} className="border-t border-stone py-3 first:border-t-0">
                  <WorkLine
                    work={work}
                    heading="h4"
                    extra={work.savedAt ? null : <Badge>Not in your saved papers</Badge>}
                    actions={<AddForm collectionId={collection.id} kind={kind} work={work} words={words} />}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section id="details" aria-labelledby="details-heading" className="mt-8">
        <h2 id="details-heading" className="mb-3 text-xl text-ink">
          Name and description
        </h2>
        {noticesAt("details")}
        <Card className="flex flex-col gap-5">
          <form action={renameCollectionAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <input type="hidden" name="collectionId" value={collection.id} />
            <div className="flex-1">
              <Field label="Name" htmlFor="collection-rename">
                <Input id="collection-rename" name="name" required maxLength={120} defaultValue={collection.name} />
              </Field>
            </div>
            <Button type="submit" variant="secondary">
              Rename
            </Button>
          </form>
          <form action={describeCollectionAction} className="flex flex-col gap-2">
            <input type="hidden" name="collectionId" value={collection.id} />
            <Field label="Description" htmlFor="collection-describe" hint={text.descriptionHint}>
              <Textarea id="collection-describe" name="description" rows={5} maxLength={2000} defaultValue={collection.description ?? ""} />
            </Field>
            <div>
              <Button type="submit" variant="secondary">
                Save description
              </Button>
            </div>
          </form>
        </Card>
      </section>

      <section id="delete" aria-labelledby="delete-heading" className="mt-8">
        <h2 id="delete-heading" className="mb-3 text-xl text-ink">
          {text.deleteLabel}
        </h2>
        {noticesAt("delete")}
        <Card>
          <p className="text-sm text-ink-2">{text.deleteBody}</p>
          <form action={deleteCollectionAction} className="mt-3 flex flex-wrap items-center gap-3">
            <input type="hidden" name="collectionId" value={collection.id} />
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="confirm" value="1" /> {text.deleteLabel}; its papers, notes and files are kept
            </label>
            <Button type="submit" variant="danger">
              Delete {text.singular.toLowerCase()}
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}

/**
 * A row's quiet action (Move up, Move down, Remove): narrow padding, so on a phone the three fit on one
 * row beside Read, and still a target of at least 24 px.
 */
const ROW_ACTION =
  "inline-flex min-h-6 items-center justify-center rounded-[var(--radius-control)] px-1 py-2 text-sm font-medium text-brass underline-offset-4 hover:underline";

function ItemControls({
  collectionId,
  collectionName,
  work,
  first,
  last,
  movable,
}: {
  collectionId: string;
  collectionName: string;
  work: WorkRow;
  first: boolean;
  last: boolean;
  movable: boolean;
}) {
  const title = workTitle(work);
  return (
    <>
      {movable && !first ? (
        <form action={moveCollectionItemAction}>
          <input type="hidden" name="collectionId" value={collectionId} />
          <input type="hidden" name="workId" value={work.id} />
          <input type="hidden" name="direction" value="up" />
          <button type="submit" className={ROW_ACTION} aria-label={`Move up: ${title}`}>
            Move up
          </button>
        </form>
      ) : null}
      {movable && !last ? (
        <form action={moveCollectionItemAction}>
          <input type="hidden" name="collectionId" value={collectionId} />
          <input type="hidden" name="workId" value={work.id} />
          <input type="hidden" name="direction" value="down" />
          <button type="submit" className={ROW_ACTION} aria-label={`Move down: ${title}`}>
            Move down
          </button>
        </form>
      ) : null}
      <form action={removeCollectionItemAction}>
        <input type="hidden" name="collectionId" value={collectionId} />
        <input type="hidden" name="workId" value={work.id} />
        <button type="submit" className={ROW_ACTION}>
          Remove
          <span className="sr-only">
            {" "}
            {title} from {collectionName}
          </span>
        </button>
      </form>
    </>
  );
}

/**
 * Remove on a paper with a note (a trail step's reason) written here: the row asks first, because that
 * text is deleted with the paper's place; *Keep it* returns to the row unchanged.
 */
function RemoveConfirmation({
  kind,
  collectionId,
  collectionName,
  work,
  keepHref,
}: {
  kind: CollectionKind;
  collectionId: string;
  collectionName: string;
  work: WorkRow;
  keepHref: string;
}) {
  const text = KIND_TEXT[kind];
  const title = workTitle(work);
  return (
    <div className="rounded-[var(--radius-panel)] border border-rust bg-paper px-4 py-3 text-sm">
      <p className="text-ink">{text.removeAsk}</p>
      <form action={removeCollectionItemAction} className="mt-3 flex flex-wrap items-center gap-3">
        <input type="hidden" name="collectionId" value={collectionId} />
        <input type="hidden" name="workId" value={work.id} />
        <input type="hidden" name="confirm" value="1" />
        <Button type="submit" variant="danger">
          {text.removeConfirm}
          <span className="sr-only">
            {" "}
            for {title} on {collectionName}
          </span>
        </Button>
        <Link href={keepHref} className="text-brass underline underline-offset-4">
          Keep it
        </Link>
      </form>
    </div>
  );
}

async function Reason({ kind, reason }: { kind: CollectionKind; reason: string | null }) {
  const label = KIND_TEXT[kind].reasonLabel;
  if (!reason) return kind === "trail" ? <p className="text-sm text-ink-3">No reason written for this step yet.</p> : null;
  return (
    <div className="rounded-[var(--radius-control)] border-l-2 border-brass bg-paper px-3 py-2 text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</p>
      <Markdown source={reason} className="text-sm [overflow-wrap:anywhere]" />
    </div>
  );
}

function AddForm({ collectionId, kind, work, words }: { collectionId: string; kind: CollectionKind; work: WorkRow; words: string }) {
  const title = workTitle(work);
  return (
    <form action={addCollectionItemAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="collectionId" value={collectionId} />
      <input type="hidden" name="workId" value={work.id} />
      <input type="hidden" name="add" value={words} />
      {kind === "trail" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={`why-${work.id}`} className="text-xs text-ink-2">
            Why (optional)<span className="sr-only"> for {title}</span>
          </label>
          <input
            id={`why-${work.id}`}
            name="reason"
            maxLength={2000}
            className="w-56 max-w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1.5 text-sm text-ink"
          />
        </div>
      ) : null}
      <Button type="submit" variant="secondary">
        Add<span className="sr-only"> {title}</span>
      </Button>
    </form>
  );
}
