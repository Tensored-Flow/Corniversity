import { CollectionPage } from "../../_collections/CollectionPage";

export const metadata = { title: "Shelf" };

/** One shelf: its papers with notes, search and filters, ordering, adding, renaming and deletion (contract §2). */
export default function ShelfPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CollectionPage kind="shelf" params={params} searchParams={searchParams} />;
}
