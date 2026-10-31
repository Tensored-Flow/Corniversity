"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS: { href: string; label: string; mobileOnly?: boolean }[] = [
  { href: "/campus", label: "Campus" },
  { href: "/studies", label: "My Studies" },
  { href: "/timetable", label: "Timetable" },
  { href: "/library", label: "Library" },
  { href: "/notebook", label: "Notebook" },
  { href: "/common-room", label: "Common Room" },
  { href: "/catalogue", label: "Catalogue" },
  // The sidebar has its own director card on wider screens; phones get the plain link.
  { href: "/director", label: "Director", mobileOnly: true },
];

export function SideNav({ quiet }: { quiet: boolean }) {
  const pathname = usePathname();
  const items = quiet ? NAV_ITEMS.filter((i) => i.href !== "/common-room") : NAV_ITEMS;
  return (
    <nav aria-label="Primary" className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "whitespace-nowrap rounded-[var(--radius-control)] px-3 py-2 text-sm transition-colors",
              item.mobileOnly ? "md:hidden" : "",
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
