import { CollectionsIndex } from "../_collections/CollectionsIndex";

export const metadata = { title: "Trails" };

/** The owner's reading trails and a form for a new one (contract §2). */
export default function TrailsPage({ searchParams }: { searchParams: Promise<{ error?: string; deleted?: string; at?: string }> }) {
  return <CollectionsIndex kind="trail" searchParams={searchParams} />;
}
