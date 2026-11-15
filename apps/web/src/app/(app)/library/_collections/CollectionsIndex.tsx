import type { CollectionKind } from "@corniversity/db/schema/scholarly";
import { listCollections } from "@corniversity/db/services/library-collections";
import Link from "next/link";
import { Button, Card, EmptyState, Field, Input, Notice, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { errorNotice } from "@/lib/notices";
import { requireSession } from "@/lib/session";
import { createCollectionAction } from "../actions";
import { FlashNotices, LibraryHeader } from "../shared";
import { collectionCount, KIND_TEXT } from "./text";

/**
 * /library/shelves and /library/trails (contract §2): the owner's shelves (or trails) with how many
 * papers each holds, and a form for a new one (name and optional description). A refusal of that form
 * returns to it (`at=new`) and its notice is shown there, in view.
 */
export async function CollectionsIndex({
  kind,
  searchParams,
}: {
  kind: CollectionKind;
  searchParams: Promise<{ error?: string; deleted?: string; at?: string }>;
}) {
  const text = KIND_TEXT[kind];
  const session = await requireSession(text.path);
  const { error, deleted, at } = await searchParams;
  const formError = at === "new" ? error : undefined;
  const collections = await listCollections(db(), session.user.id, kind);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <LibraryHeader title={text.plural} lede={text.lede} active={text.path} />
      <FlashNotices error={formError ? undefined : error} />
      {deleted ? (
        <div className="mb-4">
          <Notice tone="moss">{text.deleted}</Notice>
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="collections-heading">
          <h2 id="collections-heading" className="sr-only">
            Your {text.plural.toLowerCase()}
          </h2>
          {collections.length === 0 ? (
            <EmptyState title={text.emptyTitle} body={text.emptyBody} />
          ) : (
            <ul className="flex flex-col gap-3">
              {collections.map((c) => (
                <Card as="li" key={c.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 [overflow-wrap:anywhere]">
                    <h3 className="min-w-0 text-lg text-ink">
                      <Link href={`${text.path}/${c.id}`} className="inline-block py-0.5 hover:underline">
                        {c.name}
                      </Link>
                    </h3>
                    <span className="text-sm text-ink-3">{collectionCount(kind, c.itemCount)}</span>
                  </div>
                  {c.description ? <p className="mt-1 line-clamp-2 text-sm text-ink-2 [overflow-wrap:anywhere]">{c.description}</p> : null}
                </Card>
              ))}
            </ul>
          )}
        </section>
        <Card as="section" id="new" className="scroll-mt-4 self-start">
          <h2 className="text-lg text-ink">{text.newHeading}</h2>
          {formError ? (
            <div className="mt-3">
              <Notice tone="rust">{errorNotice(formError)}</Notice>
            </div>
          ) : null}
          <form action={createCollectionAction} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="from" value={kind === "trail" ? "trails" : "shelves"} />
            <Field label="Name" htmlFor="collection-name">
              <Input id="collection-name" name="name" required maxLength={120} />
            </Field>
            <Field label="Description (optional)" htmlFor="collection-description" hint={text.descriptionHint}>
              <Textarea id="collection-description" name="description" rows={4} maxLength={2000} />
            </Field>
            <div>
              <Button type="submit">{text.create}</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
