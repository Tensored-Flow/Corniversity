import { requireSession } from "@/lib/session";
import { LibraryHeader } from "../shared";

export const metadata = { title: "Shelves" };

/** Placeholder while Milestone 20 builds this tab (docs/RESEARCH_LIBRARY.md, build order). */
export default async function ShelvesPage() {
  await requireSession("/library/shelves");
  return (
    <div className="mx-auto w-full max-w-5xl">
      <LibraryHeader title="Shelves" active="/library/shelves" />
      <p className="text-sm text-ink-2">Not built yet.</p>
    </div>
  );
}
