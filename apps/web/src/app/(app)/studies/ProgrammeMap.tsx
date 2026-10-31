import type { BlockReadiness } from "@corniversity/core";
import { learnerProgrammeMap } from "@corniversity/db/services/programmes";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";

const SHORT: Record<BlockReadiness, string> = {
  teaching_available: "prepared",
  partly_prepared: "partly prepared",
  sources_only: "sources only",
  proposed: "proposed",
};

const STATE_TONE: Record<string, "moss" | "brass" | "slate" | "neutral" | "rust"> = {
  demonstrated: "moss",
  practised: "brass",
  introduced: "slate",
  unassessed: "neutral",
  revisit: "rust",
};

/** The academic map for followed programmes: blocks with what the learner takes and has worked, and methods by evidence state. */
export async function ProgrammeMap({ ownerId }: { ownerId: string }) {
  const map = await learnerProgrammeMap(db(), ownerId);
  if (map.length === 0) {
    return (
      <Card as="section" aria-labelledby="map-heading" className="mt-8">
        <h2 id="map-heading" className="text-lg text-ink">
          Programmes
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          You follow no programme. Programmes are routes such as Mind, Brain and AI; following one shows its blocks here and enrols you in
          nothing.{" "}
          <Link href="/programmes" className="text-brass underline underline-offset-4">
            Browse the programmes
          </Link>
          .
        </p>
      </Card>
    );
  }
  return (
    <section aria-labelledby="map-heading" className="mt-8 flex flex-col gap-4">
      <h2 id="map-heading" className="text-xl text-ink">
        Programmes you follow
      </h2>
      {map.map((m) => (
        <Card key={m.programme.id}>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/programmes/${m.programme.id}`} className="text-lg text-ink hover:underline">
              {m.programme.title}
            </Link>
            {m.participation.status === "paused" ? <Badge>paused</Badge> : null}
          </div>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {m.blocks.map((b) => (
              <li key={b.blockId} className="rounded-[var(--radius-panel)] border border-stone bg-paper p-2 text-sm">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-mono text-xs text-ink-3">{b.blockId}</span>
                  <Link href={`/programmes/${m.programme.id}#${b.blockId}`} className="text-ink hover:underline">
                    {b.title}
                  </Link>
                  {b.focus ? <Badge tone="brass">focus</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-ink-3">
                  {SHORT[b.readiness]} · {b.takingCourseIds.length ? `you take ${b.takingCourseIds.join(", ")}` : "no course taken"} ·
                  worked {b.unitsWorked.length} of {b.unitsWorked.length + b.unitsOpen.length}
                  {b.sharedUnits.length ? ` · ${b.sharedUnits.length} shared unit${b.sharedUnits.length === 1 ? "" : "s"}` : ""}
                </p>
              </li>
            ))}
          </ol>
          {m.methods.length ? (
            <div className="mt-4">
              <p className="text-sm font-medium text-ink">Modelling methods</p>
              <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                {m.methods.map((x) => (
                  <li
                    key={x.methodId}
                    className="flex items-center gap-1 rounded-[var(--radius-control)] border border-stone bg-paper px-2 py-1"
                  >
                    <span className="text-ink">{x.title}</span>
                    <Badge tone={STATE_TONE[x.state]}>{x.state}</Badge>
                    {x.plannedOnly ? <span className="text-ink-3">(no prepared unit yet)</span> : null}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-ink-3">
                States move only on recorded evidence; running a laboratory or notebook is activity, not evidence.
              </p>
            </div>
          ) : null}
        </Card>
      ))}
    </section>
  );
}
