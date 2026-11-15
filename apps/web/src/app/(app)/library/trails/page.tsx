import { requireSession } from "@/lib/session";
import { LibraryHeader } from "../shared";

export const metadata = { title: "Trails" };

/** Placeholder while Milestone 20 builds this tab (docs/RESEARCH_LIBRARY.md, build order). */
export default async function TrailsPage() {
  await requireSession("/library/trails");
  return (
    <div className="mx-auto w-full max-w-5xl">
      <LibraryHeader title="Trails" active="/library/trails" />
      <p className="text-sm text-ink-2">Not built yet.</p>
    </div>
  );
}
