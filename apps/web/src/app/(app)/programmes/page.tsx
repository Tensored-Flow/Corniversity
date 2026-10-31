import { listDepartments } from "@corniversity/db/services/catalogue";
import { listParticipation, listProgrammes } from "@corniversity/db/services/programmes";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Programmes" };

/**
 * The programme catalogue: routes through the university that a learner can inspect before
 * committing to anything. Following one shows its blocks on the academic map; it never enrols.
 */
export default async function ProgrammesPage() {
  const session = await requireSession("/programmes");
  const [programmes, participation, departments] = await Promise.all([
    listProgrammes(db()),
    listParticipation(db(), session.user.id),
    listDepartments(db()),
  ]);
  const deptTitle = new Map(departments.map((d) => [d.id, d.title]));
  const status = new Map(participation.map((p) => [p.programmeId, p.status]));
  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Programmes</p>
        <h1 className="mt-1 text-3xl text-ink">Routes through the university</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-2">
          A programme is a route, not a set of enrolments. You can follow several at once; following one shows its parts on your academic
          map, and you still choose each course on its own page. The{" "}
          <Link href="/catalogue" className="text-brass underline underline-offset-4">
            course catalogue
          </Link>{" "}
          lists every course on its own.
        </p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {programmes.map((p) => (
          <Card key={p.id} as="li">
            <div className="flex flex-wrap items-center gap-2">
              {p.referenceId ? <span className="font-mono text-xs text-ink-3">{p.referenceId}</span> : null}
              {status.get(p.id) === "following" ? <Badge tone="moss">following</Badge> : null}
              {status.get(p.id) === "paused" ? <Badge tone="neutral">paused</Badge> : null}
            </div>
            <h2 className="mt-1 text-lg text-ink">
              <Link href={`/programmes/${p.id}`} className="hover:underline">
                {p.title}
              </Link>
            </h2>
            <p className="mt-1 text-xs text-ink-3">{p.departmentIds.map((d) => deptTitle.get(d) ?? d).join(" · ")}</p>
            <p className="mt-2 text-sm text-ink-2">{p.description}</p>
            <p className="mt-2 text-xs text-ink-3">
              {p.blocks.length ? `${p.blocks.length} blocks · ${p.electives.length} electives · ` : ""}
              {p.stages.reduce((n, s) => n + s.courses.length, 0)} courses named
            </p>
          </Card>
        ))}
      </ul>
    </div>
  );
}
