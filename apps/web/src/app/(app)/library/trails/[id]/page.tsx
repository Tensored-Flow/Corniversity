import { CollectionPage } from "../../_collections/CollectionPage";

export const metadata = { title: "Trail" };

/** One reading trail: its description, ordered steps with reasons, adding, moving, renaming and deletion (contract §2). */
export default function TrailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CollectionPage kind="trail" params={params} searchParams={searchParams} />;
}
