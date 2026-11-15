import { CollectionsIndex } from "../_collections/CollectionsIndex";

export const metadata = { title: "Shelves" };

/** The owner's shelves and a form for a new one (contract §2). */
export default function ShelvesPage({ searchParams }: { searchParams: Promise<{ error?: string; deleted?: string; at?: string }> }) {
  return <CollectionsIndex kind="shelf" searchParams={searchParams} />;
}
