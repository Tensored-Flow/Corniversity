import { listCatalogue, listDepartments } from "@corniversity/db/services/catalogue";
import Link from "next/link";
import { ReadinessBadge } from "@/components/Readiness";
import { Badge } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Catalogue" };

const READINESS_ORDER = ["teaching_ready", "syllabus_ready", "source_verified", "resource_blocked", "proposed"];

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string; readiness?: string; launch?: string; level?: string }>;
}) {
  await requireSession("/catalogue");
  const params = await searchParams;
  const [departments, entries] = await Promise.all([listDepartments(db()), listCatalogue(db(), { departmentId: params.department })]);
  const filtered = entries.filter((e) => {
    if (params.readiness && e.version.readiness !== params.readiness) return false;
    if (params.launch === "1" && !e.course.launch) return false;
    if (params.level && e.course.level !== params.level) return false;
    return true;
  });
  const sorted = [...filtered].sort(
    (a, b) =>
      READINESS_ORDER.indexOf(a.version.readiness) - READINESS_ORDER.indexOf(b.version.readiness) || a.course.id.localeCompare(b.course.id),
  );
  const counts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.version.readiness] = (acc[e.version.readiness] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Catalogue</p>
        <h1 className="mt-1 text-3xl text-ink">Courses</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-2">
          Every course shows the readiness it has actually earned. {counts.teaching_ready ?? 0} of {entries.length} have prepared teaching
          units; the rest are source-verified, syllabus-ready or still proposals. You can register interest in any of them, and audit
          anything that is prepared.
        </p>
      </header>

      <form className="mb-6 flex flex-wrap items-end gap-3 text-sm" method="get">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-3">Department</span>
          <select
            name="department"
            defaultValue={params.department ?? ""}
            className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1.5"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-3">Readiness</span>
          <select
            name="readiness"
            defaultValue={params.readiness ?? ""}
            className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1.5"
          >
            <option value="">Any</option>
            <option value="teaching_ready">Teaching ready</option>
            <option value="syllabus_ready">Syllabus ready</option>
            <option value="source_verified">Source verified</option>
            <option value="proposed">Proposed</option>
            <option value="resource_blocked">Resource needed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-3">Level</span>
          <select
            name="level"
            defaultValue={params.level ?? ""}
            className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1.5"
          >
            <option value="">Any</option>
            <option value="bridge">Bridge</option>
            <option value="foundation">Foundation</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="graduate">Graduate</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-1.5">
          <input type="checkbox" name="launch" value="1" defaultChecked={params.launch === "1"} className="accent-[var(--brass)]" />
          Launch courses only
        </label>
        <button type="submit" className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-3 py-1.5 hover:bg-paper-3">
          Filter
        </button>
      </form>

      <ul className="grid gap-3 md:grid-cols-2">
        {sorted.map((e) => (
          <li key={e.course.id}>
            <Link
              href={`/courses/${e.course.id}`}
              className="block rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4 hover:border-stone-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-ink-3">{e.course.id}</span>
                <ReadinessBadge readiness={e.version.readiness} />
                {e.course.launch ? <Badge tone="brass">Launch</Badge> : null}
                <Badge>{e.course.level}</Badge>
              </div>
              <h2 className="mt-2 text-lg text-ink">{e.course.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-ink-2">{e.version.purpose}</p>
              <p className="mt-2 text-xs text-ink-3">
                {e.unitCount > 0 ? `${e.readyUnitCount} of ${e.unitCount} units prepared` : "No units outlined yet"} ·{" "}
                {e.version.readiness === "proposed"
                  ? "workload not yet estimated"
                  : `about ${e.version.workload.typical} hours (${e.version.workload.minimum}–${e.version.workload.maximum})`}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {sorted.length === 0 ? <p className="text-sm text-ink-2">No courses match these filters.</p> : null}
    </div>
  );
}
