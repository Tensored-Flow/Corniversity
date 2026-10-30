"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS = [
  { href: "/campus", label: "Campus" },
  { href: "/studies", label: "My Studies" },
  { href: "/timetable", label: "Timetable" },
  { href: "/library", label: "Library" },
  { href: "/notebook", label: "Notebook" },
  { href: "/common-room", label: "Common Room" },
] as const;

export function SideNav({ quiet }: { quiet: boolean }) {
  const pathname = usePathname();
  const items = quiet ? NAV_ITEMS.filter((i) => i.href !== "/common-room") : NAV_ITEMS;
  return (
    <nav aria-label="Primary" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
