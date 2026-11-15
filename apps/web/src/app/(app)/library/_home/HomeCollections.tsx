import type { CollectionRow } from "@corniversity/db/services/library-collections";
import Link from "next/link";
import { Button, Card, Field, Input, Notice, Select } from "@/components/ui";
import { errorNotice } from "@/lib/notices";
import { collectionCount, KIND_TEXT } from "../_collections/text";
import { createCollectionAction } from "../actions";

/**
 * Shelves and trails on the home page: names, how many papers each holds, links, and a form for a new
 * one. A refusal of that form returns to the form (`#new-collection`) and its notice is shown there.
 */
export function HomeCollections({ collections, error }: { collections: (CollectionRow & { itemCount: number })[]; error?: string }) {
  const shelves = collections.filter((c) => c.kind === "shelf");
  const trails = collections.filter((c) => c.kind === "trail");
  return (
    <section aria-labelledby="collections-heading" id="collections">
      <Card as="div">
        <h2 id="collections-heading" className="text-lg text-ink">
          Shelves and trails
        </h2>
        {collections.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">
            None yet. A shelf gathers papers under a name; a trail puts papers in an order, with a reason for each step.
          </p>
        ) : null}
        {(
          [
            ["shelf", shelves],
            ["trail", trails],
          ] as const
        ).map(([kind, list]) =>
          list.length ? (
            <div key={kind} className="mt-3">
              <h3 className="text-sm font-medium text-ink">
                <Link href={KIND_TEXT[kind].path} className="hover:underline">
                  {KIND_TEXT[kind].plural}
                </Link>
              </h3>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {list.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-3 [overflow-wrap:anywhere]">
                    <Link href={`${KIND_TEXT[kind].path}/${c.id}`} className="min-w-0 text-brass underline underline-offset-4">
                      {c.name}
                    </Link>
                    <span className="text-xs text-ink-3">{collectionCount(kind, c.itemCount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
        <form
          id="new-collection"
          action={createCollectionAction}
          className="mt-4 flex scroll-mt-4 flex-col gap-3 border-t border-stone pt-4"
        >
          <input type="hidden" name="from" value="home" />
          {error ? <Notice tone="rust">{errorNotice(error)}</Notice> : null}
          <div className="grid gap-3 sm:grid-cols-[max-content_1fr] lg:grid-cols-1 xl:grid-cols-[max-content_1fr]">
            <Field label="New" htmlFor="home-collection-kind">
              <Select id="home-collection-kind" name="kind" defaultValue="shelf">
                <option value="shelf">Shelf</option>
                <option value="trail">Trail</option>
              </Select>
            </Field>
            <Field label="Name" htmlFor="home-collection-name">
              <Input id="home-collection-name" name="name" required maxLength={120} />
            </Field>
          </div>
          <div>
            <Button type="submit" variant="secondary">
              Create
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
