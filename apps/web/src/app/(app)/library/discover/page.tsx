import { requireSession } from "@/lib/session";
import { LibraryHeader } from "../shared";

export const metadata = { title: "Discover" };

/** Placeholder while Milestone 20 builds this tab (docs/RESEARCH_LIBRARY.md, build order). */
export default async function DiscoverPage() {
  await requireSession("/library/discover");
  return (
    <div className="mx-auto w-full max-w-5xl">
      <LibraryHeader title="Discover" active="/library/discover" />
      <p className="text-sm text-ink-2">Not built yet.</p>
    </div>
  );
}
