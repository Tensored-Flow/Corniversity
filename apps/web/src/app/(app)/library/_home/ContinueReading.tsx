import type { ContinueReadingItem } from "@corniversity/db/services/library-home";
import Link from "next/link";
import { workIsFixture } from "@/components/scholarly/model";
import { FixtureBadge } from "@/components/scholarly/PaperView";
import { Card } from "@/components/ui";

/**
 * *Continue reading*: the Documents opened most recently (at most three), each named by its paper
 * (or file) with the page the reader saved; the link opens the reader, which restores the place.
 */
export function ContinueReading({ items }: { items: ContinueReadingItem[] }) {
  return (
    <section aria-labelledby="continue-heading" id="continue">
      <Card as="div">
        <h2 id="continue-heading" className="text-lg text-ink">
          Continue reading
        </h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">
            Nothing opened yet. Papers and files you open in the reader appear here with the page you were on.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col">
            {items.map((item) => (
              <li key={item.assetId} className="border-t border-stone py-3 [overflow-wrap:anywhere] first:border-t-0">
                <Link href={`/library/read/${item.assetId}`} className="text-base text-ink hover:underline">
                  {item.title}
                </Link>
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
                  <span>
                    {[
                      item.versionLabel,
                      item.pageCount ? `page ${item.page} of ${item.pageCount}` : `page ${item.page}`,
                      `opened ${item.lastOpenedAt.toISOString().slice(0, 10)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {item.workProvenance && workIsFixture(item.workProvenance) ? <FixtureBadge /> : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
