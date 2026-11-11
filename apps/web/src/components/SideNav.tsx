"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The four places a learner uses. The timetable, director, common room, programmes and research
 * studio still exist at their addresses but are not offered here.
 */
export const NAV_ITEMS: { href: string; label: string; match: string[] }[] = [
  { href: "/campus", label: "Courses", match: ["/campus", "/courses", "/sessions", "/exams"] },
  { href: "/catalogue", label: "Catalogue", match: ["/catalogue", "/departments"] },
  { href: "/library", label: "Library", match: ["/library"] },
  { href: "/notebook", label: "Notebook", match: ["/notebook"] },
];

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap">
      {NAV_ITEMS.map((item) => {
        const active = item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "whitespace-nowrap rounded-[var(--radius-control)] px-3 py-2 text-sm transition-colors",
              active ? "bg-paper-3 font-medium text-ink" : "text-ink-2 hover:bg-paper-3 hover:text-ink",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
