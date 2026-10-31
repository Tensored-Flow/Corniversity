import { listDepartments } from "@corniversity/db/services/catalogue";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import Link from "next/link";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Campus map" };

interface Place {
  id: string;
  label: string;
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
  note: string;
}

/**
 * The campus as a place: six department halls around a quad, the Library, the Common Room, the
 * Director's office and the Archive (notebook and records). Every place on the drawing is also
 * in the list beneath it, so the map is never the only way in. Quiet mode leaves the Common
 * Room off the map.
 */
export default async function CampusMapPage() {
  const session = await requireSession("/campus/map");
  const [departments, profile] = await Promise.all([listDepartments(db()), ensureProfile(db(), session.user.id)]);
  const quiet = profile.immersion === "quiet";
  const slots = [
    { x: 40, y: 40 },
    { x: 300, y: 40 },
    { x: 560, y: 40 },
    { x: 40, y: 420 },
    { x: 300, y: 420 },
    { x: 560, y: 420 },
  ];
  const halls: Place[] = departments.slice(0, 6).map((d, i) => ({
    id: d.id,
    label: d.title,
    href: `/departments/${d.id}`,
    x: slots[i]!.x,
    y: slots[i]!.y,
    w: 200,
    h: 110,
    note: "Department hall: its courses, readiness and faculty.",
  }));
  const commons: Place[] = [
    {
      id: "library",
      label: "Library",
      href: "/library",
      x: 40,
      y: 200,
      w: 200,
      h: 170,
      note: "Sources, your shelf, the reading room and desktop sync.",
    },
    {
      id: "director",
      label: "Director's office",
      href: "/director",
      x: 300,
      y: 200,
      w: 200,
      h: 80,
      note: "Programme, workload and term plans, as drafts you confirm.",
    },
    {
      id: "archive",
      label: "Archive",
      href: "/records",
      x: 300,
      y: 290,
      w: 200,
      h: 80,
      note: "Notebook, portfolio and your informal record.",
    },
    ...(quiet
      ? []
      : [
          {
            id: "common-room",
            label: "Common Room",
            href: "/common-room",
            x: 560,
            y: 200,
            w: 200,
            h: 170,
            note: "Societies, office hours and labelled AI classmates.",
          },
        ]),
  ];
  const places = [...halls, ...commons];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Campus</p>
        <h1 className="mt-1 text-3xl text-ink">Map of the college</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-2">
          Six halls around the quad, the Library and the Archive on either side of the Director's office
          {quiet ? "" : ", and the Common Room"}. Every place is listed below the drawing.
        </p>
      </header>
      <Card>
        <svg viewBox="0 0 800 570" role="group" aria-labelledby="map-title" className="h-auto w-full">
          <title id="map-title">Plan of the campus with the halls and common buildings</title>
          <rect x="0" y="0" width="800" height="570" fill="var(--paper)" />
          <rect x="260" y="160" width="280" height="250" rx="8" fill="var(--moss-soft)" stroke="var(--moss)" strokeDasharray="4 4" />
          <text x="400" y="395" textAnchor="middle" fill="var(--moss)" fontSize="12" fontFamily="var(--font-ui)">
            the quad
          </text>
          {places.map((p) => (
            <a key={p.id} href={p.href}>
              <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="6" fill="var(--paper-2)" stroke="var(--stone-2)" />
              <rect x={p.x} y={p.y} width={p.w} height="6" fill={commons.some((c) => c.id === p.id) ? "var(--brass)" : "var(--slate)"} />
              <text x={p.x + 12} y={p.y + 32} fill="var(--ink)" fontSize="15" fontFamily="var(--font-display)">
                {p.label}
              </text>
              <foreignObject x={p.x + 12} y={p.y + 42} width={p.w - 24} height={p.h - 50}>
                <p style={{ fontSize: "11px", lineHeight: 1.35, color: "var(--ink-3)", fontFamily: "var(--font-ui)" }}>{p.note}</p>
              </foreignObject>
            </a>
          ))}
        </svg>
      </Card>
      <nav aria-label="Places on the campus" className="mt-6">
        <h2 className="text-lg text-ink">Places</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {places.map((p) => (
            <li key={p.id} className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 px-4 py-3 text-sm">
              <Link href={p.href} className="text-ink hover:underline">
                {p.label}
              </Link>
              <p className="text-xs text-ink-3">{p.note}</p>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
