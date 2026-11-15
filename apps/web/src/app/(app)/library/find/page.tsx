import { requireSession } from "@/lib/session";
import { LibraryHeader } from "../shared";

export const metadata = { title: "Find papers" };

/** Placeholder while Milestone 20 builds this tab (docs/RESEARCH_LIBRARY.md, build order). */
export default async function FindPapersPage() {
  await requireSession("/library/find");
  return (
    <div className="mx-auto w-full max-w-5xl">
      <LibraryHeader title="Find papers" active="/library/find" />
      <p className="text-sm text-ink-2">Not built yet.</p>
    </div>
  );
}
